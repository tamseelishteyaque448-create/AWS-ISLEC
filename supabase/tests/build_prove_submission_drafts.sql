begin;

create temp table build_prove_draft_test_context (
  admin_id uuid not null,
  member_id uuid not null,
  other_member_id uuid not null
) on commit drop;

insert into build_prove_draft_test_context(admin_id, member_id, other_member_id)
select a.user_id,
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id limit 1),
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id offset 1 limit 1)
from private.admin_users a
order by a.granted_at
limit 1;

do $$
begin
  if not exists (
    select 1 from build_prove_draft_test_context
    where member_id is not null and other_member_id is not null
  ) then
    raise exception 'Draft/evidence test requires one admin and two non-admin profiles';
  end if;
  if exists (select 1 from public.build_submission_evidence) then
    raise exception 'Draft/evidence rollback test requires an empty local evidence table';
  end if;
end;
$$;

select set_config('build_draft_test.admin_id', admin_id::text, true),
       set_config('build_draft_test.member_id', member_id::text, true),
       set_config('build_draft_test.other_member_id', other_member_id::text, true)
from build_prove_draft_test_context;

select set_config('request.jwt.claim.sub', current_setting('build_draft_test.admin_id'), true);
set local role authenticated;

select set_config(
  'build_draft_test.assignment_id',
  public.save_build_assignment(
    p_slug => 'draft-security-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Draft security ' || gen_random_uuid()::text,
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published'
  )->>'assignment_id',
  true
);
select public.assign_build_member(
  current_setting('build_draft_test.assignment_id')::uuid,
  current_setting('build_draft_test.member_id')::uuid
);
select public.assign_build_member(
  current_setting('build_draft_test.assignment_id')::uuid,
  current_setting('build_draft_test.other_member_id')::uuid
);
select set_config(
  'build_draft_test.work_item_id',
  (select id::text from public.build_assignment_members
   where assignment_id = current_setting('build_draft_test.assignment_id')::uuid
     and member_id = current_setting('build_draft_test.member_id')::uuid),
  true
);
select set_config(
  'build_draft_test.other_work_item_id',
  (select id::text from public.build_assignment_members
   where assignment_id = current_setting('build_draft_test.assignment_id')::uuid
     and member_id = current_setting('build_draft_test.other_member_id')::uuid),
  true
);

select set_config(
  'build_draft_test.cancel_assignment_id',
  public.save_build_assignment(
    p_slug => 'draft-cancel-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Draft cancellation ' || gen_random_uuid()::text,
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published'
  )->>'assignment_id',
  true
);
select public.assign_build_member(
  current_setting('build_draft_test.cancel_assignment_id')::uuid,
  current_setting('build_draft_test.member_id')::uuid
);
select set_config(
  'build_draft_test.cancel_work_item_id',
  (select id::text from public.build_assignment_members
   where assignment_id = current_setting('build_draft_test.cancel_assignment_id')::uuid
     and member_id = current_setting('build_draft_test.member_id')::uuid),
  true
);

do $$
begin
  if not has_function_privilege(
       'authenticated',
       'public.save_build_submission_draft(uuid,text,text,text,text[],text,text,text,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.save_build_submission_draft(uuid,text,text,text,text[],text,text,text,text,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.submit_build_submission_draft(uuid)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.submit_build_submission_draft(uuid)',
       'execute'
     ) then
    raise exception 'Draft RPC execution grants are not least-privilege';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.register_build_draft_evidence(uuid,uuid,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.remove_build_draft_evidence(uuid)',
       'execute'
     ) then
    raise exception 'Evidence RPC execution grants are missing';
  end if;
  if has_table_privilege('authenticated', 'public.build_submission_drafts', 'insert')
     or has_table_privilege('authenticated', 'public.build_submission_drafts', 'update')
     or has_table_privilege('authenticated', 'public.build_submission_drafts', 'delete')
     or has_table_privilege('authenticated', 'public.build_submission_evidence', 'insert')
     or has_table_privilege('authenticated', 'public.build_submission_evidence', 'update')
     or has_table_privilege('authenticated', 'public.build_submission_evidence', 'delete') then
    raise exception 'Members must not directly mutate draft or evidence tables';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;

do $$
begin
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.work_item_id')::uuid,
      'Too early', 'Description', 'Approach'
    );
    raise exception 'Assigned work must not permit draft creation';
  exception when sqlstate '40001' then
    null;
  end;
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.other_work_item_id')::uuid,
      'Guessed work', 'Description', 'Approach'
    );
    raise exception 'A guessed other-member work item must be rejected';
  exception when sqlstate 'P0002' then
    null;
  end;
  if (select count(*) from public.build_submission_drafts) <> 0 then
    raise exception 'Other members must not read drafts';
  end if;
end;
$$;

select public.start_build_assignment(current_setting('build_draft_test.work_item_id')::uuid);
select set_config(
  'build_draft_test.draft_1',
  (public.save_build_submission_draft(
    current_setting('build_draft_test.work_item_id')::uuid,
    'Initial draft', 'Initial explanation', 'Initial approach',
    array['TypeScript'], 'Initial challenge', 'Initial learning', 'Initial follow-up',
    'https://example.test/repo', null, null
  )->>'draft_id'),
  true
);
select set_config(
  'build_draft_test.draft_1_retry',
  (public.save_build_submission_draft(
    current_setting('build_draft_test.work_item_id')::uuid,
    'Updated draft', 'Updated explanation', 'Updated approach'
  )->>'draft_id'),
  true
);

do $$
begin
  if current_setting('build_draft_test.draft_1') <>
     current_setting('build_draft_test.draft_1_retry') then
    raise exception 'Saving a draft must update the one open draft';
  end if;
  if (select count(*) from public.build_submission_drafts
      where work_item_id = current_setting('build_draft_test.work_item_id')::uuid
        and state = 'open') <> 1 then
    raise exception 'Only one open draft may exist per work item';
  end if;
  begin
    perform public.register_build_draft_evidence(
      gen_random_uuid(), gen_random_uuid(), 'guessed draft'
    );
    raise exception 'A guessed draft ID must be rejected';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select public.start_build_assignment(current_setting('build_draft_test.cancel_work_item_id')::uuid);
select set_config(
  'build_draft_test.cancel_draft',
  (public.save_build_submission_draft(
    current_setting('build_draft_test.cancel_work_item_id')::uuid,
    'Cancellation draft', 'Description', 'Approach'
  )->>'draft_id'),
  true
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.other_member_id'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.build_submission_drafts
      where id = current_setting('build_draft_test.draft_1')::uuid) <> 0 then
    raise exception 'Other member must not read another draft';
  end if;
  if private.can_upload_build_draft_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.draft_1') || '/' || gen_random_uuid()::text
     ) then
    raise exception 'Other member must not upload under another draft path';
  end if;
  begin
    perform public.register_build_draft_evidence(
      current_setting('build_draft_test.draft_1')::uuid,
      gen_random_uuid(),
      'cross-owner'
    );
    raise exception 'Other member must not register evidence on another draft';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;

select set_config('build_draft_test.object_1', gen_random_uuid()::text, true);
do $$
begin
  begin
    perform public.register_build_draft_evidence(
      current_setting('build_draft_test.draft_1')::uuid,
      gen_random_uuid(),
      'missing object'
    );
    raise exception 'Evidence without a Storage object must be rejected';
  exception when sqlstate 'P0002' then
    null;
  end;
end;
$$;

insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
values (
  'build-prove-private',
  'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
    current_setting('build_draft_test.draft_1') || '/' ||
    current_setting('build_draft_test.object_1'),
  current_setting('build_draft_test.member_id')::uuid,
  current_setting('build_draft_test.member_id'),
  '{"size":1024,"mimetype":"application/pdf"}'::jsonb
);
select set_config('build_draft_test.invalid_mime_object', gen_random_uuid()::text, true);
select set_config('build_draft_test.oversize_object', gen_random_uuid()::text, true);
insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
values
(
  'build-prove-private',
  'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
    current_setting('build_draft_test.draft_1') || '/' ||
    current_setting('build_draft_test.invalid_mime_object'),
  current_setting('build_draft_test.member_id')::uuid,
  current_setting('build_draft_test.member_id'),
  '{"size":100,"mimetype":"text/plain"}'::jsonb
),
(
  'build-prove-private',
  'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
    current_setting('build_draft_test.draft_1') || '/' ||
    current_setting('build_draft_test.oversize_object'),
  current_setting('build_draft_test.member_id')::uuid,
  current_setting('build_draft_test.member_id'),
  '{"size":10485761,"mimetype":"application/pdf"}'::jsonb
);

do $$
begin
  if private.can_upload_build_draft_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.draft_1') || '/' ||
         current_setting('build_draft_test.object_1')
     ) is not true then
    raise exception 'Member must be able to upload under own eligible draft';
  end if;
  if (select count(*) from storage.objects
      where name = 'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
        current_setting('build_draft_test.draft_1') || '/' ||
        current_setting('build_draft_test.object_1')) <> 0 then
    raise exception 'Unregistered orphan object must not be readable';
  end if;
  begin
    perform public.register_build_draft_evidence(
      current_setting('build_draft_test.draft_1')::uuid,
      current_setting('build_draft_test.invalid_mime_object')::uuid,
      'Unsupported MIME'
    );
    raise exception 'Unsupported evidence MIME must be rejected';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.register_build_draft_evidence(
      current_setting('build_draft_test.draft_1')::uuid,
      current_setting('build_draft_test.oversize_object')::uuid,
      'Oversize evidence'
    );
    raise exception 'Oversize evidence must be rejected';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

select set_config(
  'build_draft_test.evidence_1',
  (public.register_build_draft_evidence(
    current_setting('build_draft_test.draft_1')::uuid,
    current_setting('build_draft_test.object_1')::uuid,
    'Initial proof'
  )->>'evidence_id'),
  true
);
select set_config(
  'build_draft_test.evidence_1_retry',
  (public.register_build_draft_evidence(
    current_setting('build_draft_test.draft_1')::uuid,
    current_setting('build_draft_test.object_1')::uuid,
    'Initial proof'
  )->>'evidence_id'),
  true
);

do $$
begin
  if current_setting('build_draft_test.evidence_1') <>
     current_setting('build_draft_test.evidence_1_retry') then
    raise exception 'Identical evidence registration must be idempotent';
  end if;
  if (select count(*) from storage.objects
      where name = 'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
        current_setting('build_draft_test.draft_1') || '/' ||
        current_setting('build_draft_test.object_1')) <> 1 then
    raise exception 'Registered own evidence must be readable from the private bucket';
  end if;
  if not private.can_access_build_storage_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.draft_1') || '/' ||
         current_setting('build_draft_test.object_1')
     ) then
    raise exception 'Own registered draft evidence must pass the complete access helper';
  end if;
  if private.can_upload_build_draft_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.draft_1') || '/../../outside.pdf'
     ) then
    raise exception 'Storage path traversal must not be authorized';
  end if;
  begin
    insert into public.build_submission_evidence(
      submission_id, draft_id, owner_id, storage_path, content_type, file_size
    ) values (
      null, current_setting('build_draft_test.draft_1')::uuid,
      current_setting('build_draft_test.member_id')::uuid, 'submissions/invalid',
      'application/pdf', 1
    );
    raise exception 'Members must not directly insert evidence metadata';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.other_member_id'), true);
set local role authenticated;
do $$
begin
  begin
    perform public.remove_build_draft_evidence(
      current_setting('build_draft_test.evidence_1')::uuid
    );
    raise exception 'Other member must not remove another member evidence';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;

select set_config('build_draft_test.removable_object', gen_random_uuid()::text, true);
insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
values (
  'build-prove-private',
  'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
    current_setting('build_draft_test.draft_1') || '/' ||
    current_setting('build_draft_test.removable_object'),
  current_setting('build_draft_test.member_id')::uuid,
  current_setting('build_draft_test.member_id'),
  '{"size":256,"mimetype":"image/jpeg"}'::jsonb
);
select set_config(
  'build_draft_test.removable_evidence',
  (public.register_build_draft_evidence(
    current_setting('build_draft_test.draft_1')::uuid,
    current_setting('build_draft_test.removable_object')::uuid,
    'Removable proof'
  )->>'evidence_id'),
  true
);
select public.remove_build_draft_evidence(
  current_setting('build_draft_test.removable_evidence')::uuid
);
do $$
begin
  if (select count(*) from public.build_submission_evidence
      where id = current_setting('build_draft_test.removable_evidence')::uuid) <> 0
     or (select count(*) from storage.objects
         where name = 'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
           current_setting('build_draft_test.draft_1') || '/' ||
           current_setting('build_draft_test.removable_object')) <> 0 then
    raise exception 'Removing evidence must delete its metadata and hide the orphan object';
  end if;
end;
$$;

reset role;
do $$
begin
  begin
    insert into public.build_submission_evidence(
      submission_id, draft_id, owner_id, storage_path, content_type, file_size
    ) values (
      null, null, current_setting('build_draft_test.member_id')::uuid,
      'submissions/invalid', 'application/pdf', 1
    );
    raise exception 'Evidence must have exactly one parent';
  exception when check_violation then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;
reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.other_member_id'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.build_submission_evidence
      where id = current_setting('build_draft_test.evidence_1')::uuid) <> 0
     or private.can_access_build_storage_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.draft_1') || '/' ||
         current_setting('build_draft_test.object_1')
     ) then
    raise exception 'Other member must not read evidence or its Storage object';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;
select set_config(
  'build_draft_test.submission_1',
  (public.submit_build_submission_draft(
    current_setting('build_draft_test.draft_1')::uuid
  )->>'submission_id'),
  true
);
select set_config(
  'build_draft_test.submit_1_retry',
  (public.submit_build_submission_draft(
    current_setting('build_draft_test.draft_1')::uuid
  )->>'submission_id'),
  true
);

reset role;
do $$
begin
  if current_setting('build_draft_test.submission_1') <>
     current_setting('build_draft_test.submit_1_retry')
     or (select count(*) from public.build_submissions
         where work_item_id = current_setting('build_draft_test.work_item_id')::uuid) <> 1
     or (select count(*) from public.build_submission_drafts
         where id = current_setting('build_draft_test.draft_1')::uuid
           and state = 'submitted'
           and submission_id = current_setting('build_draft_test.submission_1')::uuid) <> 1
     or (select count(*) from public.build_submission_evidence
         where id = current_setting('build_draft_test.evidence_1')::uuid
           and draft_id is null
           and submission_id = current_setting('build_draft_test.submission_1')::uuid) <> 1 then
    raise exception 'Submission must atomically seal draft, associate evidence, and create one revision';
  end if;
  if (select status from public.build_assignment_members
      where id = current_setting('build_draft_test.work_item_id')::uuid) <> 'submitted' then
    raise exception 'Initial draft submission must transition work to submitted';
  end if;
  begin
    update public.build_submission_drafts
    set explanation = 'Mutated after submission'
    where id = current_setting('build_draft_test.draft_1')::uuid;
    raise exception 'Submitted draft content must be immutable';
  exception when sqlstate '55000' then
    null;
  end;
  begin
    delete from public.build_submission_evidence
    where id = current_setting('build_draft_test.evidence_1')::uuid;
    raise exception 'Submitted evidence metadata must be immutable';
  exception when sqlstate '55000' then
    null;
  end;
  if not private.can_access_build_storage_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.draft_1') || '/' ||
         current_setting('build_draft_test.object_1')
     ) then
    raise exception 'Own submitted evidence must remain readable';
  end if;
  begin
    perform public.remove_build_draft_evidence(
      current_setting('build_draft_test.evidence_1')::uuid
    );
    raise exception 'Submitted evidence must not be removable';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.work_item_id')::uuid,
      'Invalid submitted edit', 'Description', 'Approach'
    );
    raise exception 'Submitted work must not permit a new draft';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;

set local role authenticated;
reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.admin_id'), true);
set local role authenticated;
select public.review_build_submission(
  current_setting('build_draft_test.submission_1')::uuid,
  'changes_requested',
  'Please add another artifact.'
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;
select set_config(
  'build_draft_test.draft_2',
  (public.save_build_submission_draft(
    current_setting('build_draft_test.work_item_id')::uuid,
    'Revision two', 'Revised explanation', 'Revised approach',
    array['TypeScript', 'PostgreSQL'], 'Updated challenge', 'Updated learning',
    'Updated future work', null, 'https://example.test/deploy', null
  )->>'draft_id'),
  true
);
do $$
begin
  if (select revision_number from public.build_submission_drafts
      where id = current_setting('build_draft_test.draft_2')::uuid) <> 2
     or (select count(*) from public.build_submission_evidence
         where draft_id = current_setting('build_draft_test.draft_2')::uuid) <> 0
     or (select explanation from public.build_submissions
         where id = current_setting('build_draft_test.submission_1')::uuid) <> 'Updated explanation'
     or (select count(*) from public.build_submission_reviews
         where submission_id = current_setting('build_draft_test.submission_1')::uuid
           and decision = 'changes_requested') <> 1 then
    raise exception 'Revision 2 must be independent and preserve revision 1 and its review';
  end if;
end;
$$;

select set_config('build_draft_test.object_2', gen_random_uuid()::text, true);
insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
values (
  'build-prove-private',
  'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
    current_setting('build_draft_test.draft_2') || '/' ||
    current_setting('build_draft_test.object_2'),
  current_setting('build_draft_test.member_id')::uuid,
  current_setting('build_draft_test.member_id'),
  '{"size":2048,"mimetype":"image/png"}'::jsonb
);
select public.register_build_draft_evidence(
  current_setting('build_draft_test.draft_2')::uuid,
  current_setting('build_draft_test.object_2')::uuid,
  'Revision two proof'
);
select set_config(
  'build_draft_test.submission_2',
  (public.submit_build_submission_draft(
    current_setting('build_draft_test.draft_2')::uuid
  )->>'submission_id'),
  true
);
do $$
begin
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.work_item_id')::uuid,
      'Premature resubmission', 'Description', 'Approach'
    );
    raise exception 'Resubmitted work must not allow another draft before a changes request';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;
do $$
begin
  if (select status from public.build_assignment_members
      where id = current_setting('build_draft_test.work_item_id')::uuid) <> 'resubmitted'
     or (select revision_number from public.build_submissions
         where id = current_setting('build_draft_test.submission_2')::uuid) <> 2
     or (select count(*) from public.build_submission_evidence
         where submission_id = current_setting('build_draft_test.submission_1')::uuid) <> 1
     or (select count(*) from public.build_submission_evidence
         where submission_id = current_setting('build_draft_test.submission_2')::uuid) <> 1
     or (select count(*) from public.build_submission_reviews
         where submission_id = current_setting('build_draft_test.submission_1')::uuid
           and decision = 'changes_requested') <> 1 then
    raise exception 'Revision 2 must retain independent evidence and prior revision history';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.admin_id'), true);
set local role authenticated;
select public.review_build_submission(
  current_setting('build_draft_test.submission_2')::uuid,
  'approved',
  'Approved.'
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;
do $$
begin
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.work_item_id')::uuid,
      'Approved edit', 'Description', 'Approach'
    );
    raise exception 'Approved work must not permit a new draft';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;

select set_config(
  'build_draft_test.cancel_draft_evidence',
  current_setting('build_draft_test.cancel_draft'),
  true
);
select set_config('build_draft_test.cancel_object', gen_random_uuid()::text, true);
insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
values (
  'build-prove-private',
  'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
    current_setting('build_draft_test.cancel_draft_evidence') || '/' ||
    current_setting('build_draft_test.cancel_object'),
  current_setting('build_draft_test.member_id')::uuid,
  current_setting('build_draft_test.member_id'),
  '{"size":512,"mimetype":"image/jpeg"}'::jsonb
);
select set_config(
  'build_draft_test.cancel_evidence',
  (public.register_build_draft_evidence(
    current_setting('build_draft_test.cancel_draft_evidence')::uuid,
    current_setting('build_draft_test.cancel_object')::uuid,
    'Will be cancelled'
  )->>'evidence_id'),
  true
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.admin_id'), true);
set local role authenticated;
select public.cancel_build_work_item(current_setting('build_draft_test.cancel_work_item_id')::uuid);

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_draft_test.member_id'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.build_submission_drafts
      where id = current_setting('build_draft_test.cancel_draft_evidence')::uuid) <> 0
     or (select count(*) from public.build_submission_evidence
         where id = current_setting('build_draft_test.cancel_evidence')::uuid) <> 0
     or private.can_access_build_storage_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.cancel_draft_evidence') || '/' ||
         current_setting('build_draft_test.cancel_object')
     )
     or private.can_upload_build_draft_object(
       'submissions/' || current_setting('build_draft_test.member_id') || '/' ||
         current_setting('build_draft_test.cancel_draft_evidence') || '/' ||
         gen_random_uuid()::text
     ) then
    raise exception 'Cancelled work must deny member draft and Storage access';
  end if;
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.cancel_work_item_id')::uuid,
      'Cancelled edit', 'Description', 'Approach'
    );
    raise exception 'Cancelled work must not permit draft edits';
  exception when sqlstate '40001' then
    null;
  end;
  begin
    perform public.remove_build_draft_evidence(
      current_setting('build_draft_test.cancel_evidence')::uuid
    );
    raise exception 'Cancelled work must not permit evidence mutation';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if has_function_privilege(
       'anon',
       'public.register_build_draft_evidence(uuid,uuid,text)',
       'execute'
     ) then
    raise exception 'Anonymous must not execute draft evidence RPCs';
  end if;
  begin
    perform public.save_build_submission_draft(
      current_setting('build_draft_test.work_item_id')::uuid,
      'Anonymous draft', 'Description', 'Approach'
    );
    raise exception 'Anonymous draft operation must fail';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
