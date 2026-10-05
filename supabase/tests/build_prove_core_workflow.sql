begin;

create temp table build_prove_test_context (
  admin_id uuid not null,
  member_id uuid not null,
  other_member_id uuid not null,
  third_member_id uuid not null
) on commit drop;

insert into build_prove_test_context(admin_id, member_id, other_member_id, third_member_id)
select a.user_id,
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id limit 1),
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id offset 1 limit 1),
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id offset 2 limit 1)
from private.admin_users a
order by a.granted_at
limit 1;

do $$
begin
  if not exists (select 1 from build_prove_test_context
                 where member_id is not null and other_member_id is not null and third_member_id is not null) then
    raise exception 'Local workflow test requires one admin and three non-admin profiles';
  end if;
end;
$$;

select set_config('build_prove.test_admin_id', admin_id::text, true),
       set_config('build_prove.test_member_id', member_id::text, true),
       set_config('build_prove.test_other_member_id', other_member_id::text, true),
       set_config('build_prove.test_third_member_id', third_member_id::text, true),
       set_config('build_prove.points_before',
         (select points::text from public.profiles where id = member_id), true),
       set_config('build_prove.other_points_before',
         (select points::text from public.profiles
          where id = (select other_member_id from build_prove_test_context)), true),
       set_config('build_prove.third_points_before',
         (select points::text from public.profiles
          where id = (select third_member_id from build_prove_test_context)), true),
       set_config('build_prove.challenge_count_before',
         (select count(*)::text from public.challenge_completions), true),
       set_config('build_prove.project_count_before',
         (select count(*)::text from public.projects), true)
from build_prove_test_context;

select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
set local role authenticated;

select set_config(
  'build_prove.test_assignment_id',
  public.save_build_assignment(
    p_slug => 'build-core-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Build core validation ' || gen_random_uuid()::text,
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published',
    p_reward_points => 35
  )->>'assignment_id',
  true
);

select public.assign_build_member(
  current_setting('build_prove.test_assignment_id')::uuid,
  current_setting('build_prove.test_member_id')::uuid
);
select public.assign_build_member(
  current_setting('build_prove.test_assignment_id')::uuid,
  current_setting('build_prove.test_member_id')::uuid
);
select public.assign_build_member(
  current_setting('build_prove.test_assignment_id')::uuid,
  current_setting('build_prove.test_other_member_id')::uuid
);
select public.assign_build_member(
  current_setting('build_prove.test_assignment_id')::uuid,
  current_setting('build_prove.test_third_member_id')::uuid
);

select set_config(
  'build_prove.reference_assignment_id',
  public.save_build_assignment(
    p_slug => 'build-reference-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Build reference isolation ' || gen_random_uuid()::text,
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published',
    p_member_ids => array[current_setting('build_prove.test_member_id')::uuid]
  )->>'assignment_id',
  true
);

select set_config(
  'build_prove.test_work_item_id',
  (select id::text from public.build_assignment_members
   where assignment_id = current_setting('build_prove.test_assignment_id')::uuid
     and member_id = current_setting('build_prove.test_member_id')::uuid),
  true
);
select set_config(
  'build_prove.other_work_item_id',
  (select id::text from public.build_assignment_members
   where assignment_id = current_setting('build_prove.test_assignment_id')::uuid
     and member_id = current_setting('build_prove.test_other_member_id')::uuid),
  true
);
select set_config(
  'build_prove.third_work_item_id',
  (select id::text from public.build_assignment_members
   where assignment_id = current_setting('build_prove.test_assignment_id')::uuid
     and member_id = current_setting('build_prove.test_third_member_id')::uuid),
  true
);

select public.save_build_assignment(
  p_assignment_id => current_setting('build_prove.test_assignment_id')::uuid,
  p_slug => (select slug from public.build_assignments
             where id = current_setting('build_prove.test_assignment_id')::uuid),
  p_title => (select title from public.build_assignments
              where id = current_setting('build_prove.test_assignment_id')::uuid),
  p_summary => (select summary from public.build_assignments
                where id = current_setting('build_prove.test_assignment_id')::uuid),
  p_objective => (select objective from public.build_assignments
                  where id = current_setting('build_prove.test_assignment_id')::uuid),
  p_difficulty => 'easy',
  p_domain => 'documentation',
  p_assignment_scope => 'individual',
  p_publication_state => 'published',
  p_priority => 'normal',
  p_reward_points => 99
);
do $$
begin
  if (select reward_points_snapshot from public.build_assignment_members
      where id = current_setting('build_prove.test_work_item_id')::uuid) <> 35 then
    raise exception 'Task edits must not change the member reward snapshot';
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.build_assignment_members
      where id = current_setting('build_prove.test_work_item_id')::uuid) <> 1 then
    raise exception 'Admin must read assigned work items';
  end if;
  if (select count(*) from public.build_assignment_members
      where assignment_id = current_setting('build_prove.test_assignment_id')::uuid
        and member_id = current_setting('build_prove.test_member_id')::uuid) <> 1 then
    raise exception 'Duplicate task assignment must not create another work item';
  end if;
  if has_function_privilege('anon', 'public.submit_build_work(uuid,text,text,text,text[],text,text,text,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.submit_build_work(uuid,text,text,text,text[],text,text,text,text,text,text)', 'execute') then
    raise exception 'Workflow RPC grants are not restricted as expected';
  end if;
  if has_function_privilege('anon', 'public.award_build_submission_reward(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.award_build_submission_reward(uuid)', 'execute') then
    raise exception 'Reward RPC grants are not restricted as expected';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_member_id'), true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.build_assignment_members
      where id = current_setting('build_prove.test_work_item_id')::uuid) <> 1 then
    raise exception 'Member must see own work item';
  end if;
  if (select count(*) from public.build_assignment_members
      where id = current_setting('build_prove.other_work_item_id')::uuid) <> 0 then
    raise exception 'Member must not see another member work item';
  end if;
  if (select count(*) from public.build_assignments
      where id = current_setting('build_prove.test_assignment_id')::uuid) <> 1 then
    raise exception 'Assigned member must read task definition';
  end if;
  if not private.can_access_build_storage_object(
      'assignments/' || current_setting('build_prove.test_assignment_id') || '/brief.pdf') then
    raise exception 'Assigned member must read task reference objects';
  end if;
  begin
    perform public.submit_build_work(
      current_setting('build_prove.test_work_item_id')::uuid, 'First submission', 'Summary', 'Approach'
    );
    raise exception 'Submission directly from ASSIGNED must fail';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;

select public.start_build_assignment(current_setting('build_prove.test_work_item_id')::uuid);
select public.start_build_assignment(current_setting('build_prove.test_work_item_id')::uuid);

do $$
begin
  begin
    update public.build_assignment_members
    set status = 'approved'
    where id = current_setting('build_prove.test_work_item_id')::uuid;
    raise exception 'Direct member state update must fail';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.review_build_submission(gen_random_uuid(), 'approved', '');
    raise exception 'Member review must fail';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.resubmit_build_work(
      current_setting('build_prove.test_work_item_id')::uuid, 'Early resubmit', 'Summary', 'Approach'
    );
    raise exception 'Resubmission before a changes request must fail';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;

select set_config(
  'build_prove.test_submission_1',
  (public.submit_build_work(
    current_setting('build_prove.test_work_item_id')::uuid,
    'Revision one', 'Original explanation', 'Original approach'
  )->>'submission_id'),
  true
);

do $$
declare
  v_result jsonb;
begin
  v_result := public.submit_build_work(
    current_setting('build_prove.test_work_item_id')::uuid,
    'Duplicate payload', 'Ignored retry payload', 'Ignored retry approach'
  );
  if v_result->>'idempotent' <> 'true'
     or v_result->>'submission_id' <> current_setting('build_prove.test_submission_1') then
    raise exception 'Duplicate submit must return the existing revision';
  end if;
  if (select revision_number from public.build_submissions
      where id = current_setting('build_prove.test_submission_1')::uuid) <> 1 then
    raise exception 'First submission must be revision 1';
  end if;
end;
$$;

reset role;
insert into public.build_assignment_attachments(
  assignment_id, storage_path, content_type, file_size, label, created_by
)
values (
  current_setting('build_prove.reference_assignment_id')::uuid,
  'assignments/' || current_setting('build_prove.reference_assignment_id') || '/brief.pdf',
  'application/pdf', 1024, 'Member-only reference', current_setting('build_prove.test_admin_id')::uuid
);

select set_config('request.jwt.claim.sub', current_setting('build_prove.test_member_id'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.build_assignment_members
      where id = current_setting('build_prove.test_work_item_id')::uuid) <> 1
     or (select count(*) from public.build_submissions
         where id = current_setting('build_prove.test_submission_1')::uuid) <> 1
     or (select count(*) from public.build_submission_reviews
         where submission_id = current_setting('build_prove.test_submission_1')::uuid) <> 0
     or (select count(*) from public.build_submission_evidence
         where submission_id = current_setting('build_prove.test_submission_1')::uuid) <> 0
     or (select count(*) from public.build_assignment_attachments
         where assignment_id = current_setting('build_prove.reference_assignment_id')::uuid) <> 1 then
    raise exception 'Member must read own work, revisions, and assigned reference metadata';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_other_member_id'), true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.build_assignment_members
      where id = current_setting('build_prove.test_work_item_id')::uuid) <> 0
     or (select count(*) from public.build_assignments
         where id = current_setting('build_prove.reference_assignment_id')::uuid) <> 0
     or (select count(*) from public.build_assignment_attachments
         where assignment_id = current_setting('build_prove.reference_assignment_id')::uuid) <> 0 then
    raise exception 'Member must not read another member work or unassigned reference metadata';
  end if;
  if (select count(*) from public.build_submissions
      where id = current_setting('build_prove.test_submission_1')::uuid) <> 0 then
    raise exception 'Another member must not see the submission';
  end if;
  if (select count(*) from public.build_submission_reviews r
      where r.submission_id = current_setting('build_prove.test_submission_1')::uuid) <> 0 then
    raise exception 'Another member must not see review history';
  end if;
  if private.can_access_build_storage_object(
      'submissions/' || current_setting('build_prove.test_member_id') || '/' ||
        current_setting('build_prove.test_submission_1') || '/proof.pdf') then
    raise exception 'Another member must not access submission evidence';
  end if;
  begin
    perform public.award_build_submission_reward(
      current_setting('build_prove.test_work_item_id')::uuid
    );
    raise exception 'Non-admin reward attempts must fail';
  exception when insufficient_privilege then
    null;
  end;
  perform public.start_build_assignment(current_setting('build_prove.other_work_item_id')::uuid);
end;
$$;

select set_config(
  'build_prove.other_submission_id',
  (public.submit_build_work(
    current_setting('build_prove.other_work_item_id')::uuid,
    'Independent submission', 'Summary', 'Approach'
  )->>'submission_id'),
  true
);

do $$
begin
  begin
    perform public.start_build_assignment(current_setting('build_prove.test_work_item_id')::uuid);
    raise exception 'Another member must not start this work item';
  exception when sqlstate 'P0002' then
    null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
set local role authenticated;

do $$
declare
  v_result jsonb;
begin
  if (select count(*) from public.build_assignment_members
      where id in (
        current_setting('build_prove.test_work_item_id')::uuid,
        current_setting('build_prove.other_work_item_id')::uuid,
        current_setting('build_prove.third_work_item_id')::uuid
      )) <> 3
     or (select count(*) from public.build_submissions
         where work_item_id in (
           current_setting('build_prove.test_work_item_id')::uuid,
           current_setting('build_prove.other_work_item_id')::uuid
         )) <> 2
     or (select count(*) from public.build_assignment_attachments
         where assignment_id = current_setting('build_prove.reference_assignment_id')::uuid) <> 1 then
    raise exception 'Admin must read task, member, submission, and reference metadata';
  end if;
  begin
    perform public.review_build_submission(
      current_setting('build_prove.test_submission_1')::uuid, 'rejected', 'unsupported'
    );
    raise exception 'REJECTED is not a supported review decision';
  exception when sqlstate '22023' then
    null;
  end;
  v_result := public.review_build_submission(
    current_setting('build_prove.test_submission_1')::uuid, 'changes_requested', 'Please add deployment proof.'
  );
  if v_result->>'status' <> 'changes_requested' then
    raise exception 'Admin must be able to request changes';
  end if;
  v_result := public.review_build_submission(
    current_setting('build_prove.other_submission_id')::uuid, 'approved', 'Approved directly from submission.'
  );
  if v_result->>'status' <> 'approved'
     or v_result->>'reward_status' <> 'awarded'
     or (v_result->>'points_awarded')::integer <> 35 then
    raise exception 'Direct SUBMITTED approval must award its immutable work-item snapshot';
  end if;
  if (select count(*) from public.build_submission_reviews
      where work_item_id = current_setting('build_prove.test_work_item_id')::uuid) <> 1
     or (select count(*) from public.build_submission_reviews
         where work_item_id = current_setting('build_prove.other_work_item_id')::uuid) <> 1 then
    raise exception 'Admin must read review histories for member submissions';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('build_prove.test_member_id'), true);
set local role authenticated;

select set_config(
  'build_prove.test_submission_2',
  (public.resubmit_build_work(
    current_setting('build_prove.test_work_item_id')::uuid,
    'Revision two', 'Updated explanation', 'Updated approach'
  )->>'submission_id'),
  true
);

do $$
begin
  if (select revision_number from public.build_submissions
      where id = current_setting('build_prove.test_submission_2')::uuid) <> 2 then
    raise exception 'Resubmission must create revision 2';
  end if;
  if (select explanation from public.build_submissions
      where id = current_setting('build_prove.test_submission_1')::uuid) <> 'Original explanation' then
    raise exception 'Revision 1 content must remain unchanged';
  end if;
  begin
    update public.build_submissions
    set explanation = 'tampered'
    where id = current_setting('build_prove.test_submission_1')::uuid;
    raise exception 'Direct member revision update must fail';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.build_submission_reviews(submission_id, work_item_id, reviewer_id, decision)
    values (
      current_setting('build_prove.test_submission_2')::uuid,
      current_setting('build_prove.test_work_item_id')::uuid,
      current_setting('build_prove.test_member_id')::uuid,
      'approved'
    );
    raise exception 'Member review insert must fail';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
set local role authenticated;
do $$
declare
  v_result jsonb;
begin
  v_result := public.review_build_submission(
    current_setting('build_prove.test_submission_2')::uuid,
    'changes_requested', 'Please add one final clarification.'
  );
  if v_result->>'status' <> 'changes_requested' then
    raise exception 'Admin must request changes from RESUBMITTED';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_member_id'), true);
set local role authenticated;
select set_config(
  'build_prove.test_submission_3',
  (public.resubmit_build_work(
    current_setting('build_prove.test_work_item_id')::uuid,
    'Revision three', 'Final explanation', 'Final approach'
  )->>'submission_id'),
  true
);
do $$
begin
  if (select revision_number from public.build_submissions
      where id = current_setting('build_prove.test_submission_3')::uuid) <> 3 then
    raise exception 'Second resubmission must create revision 3';
  end if;
  if (select explanation from public.build_submissions
      where id = current_setting('build_prove.test_submission_2')::uuid) <> 'Updated explanation' then
    raise exception 'Revision 2 content must remain unchanged';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
set local role authenticated;

do $$
declare
  v_result jsonb;
begin
  begin
    perform public.review_build_submission(
      current_setting('build_prove.test_submission_2')::uuid, 'approved', ''
    );
    raise exception 'A prior revision must not be reviewable after resubmission';
  exception when sqlstate 'PT409' then
    null;
  end;
  v_result := public.review_build_submission(
    current_setting('build_prove.test_submission_3')::uuid, 'approved', 'Accepted.'
  );
  if v_result->>'status' <> 'approved'
     or v_result->>'idempotent' <> 'false'
     or v_result->>'reward_status' <> 'awarded'
     or (v_result->>'points_awarded')::integer <> 35 then
    raise exception 'Admin must approve the latest revision and award its snapshot';
  end if;
  v_result := public.review_build_submission(
    current_setting('build_prove.test_submission_3')::uuid, 'approved', 'Retry.'
  );
  if v_result->>'status' <> 'approved'
     or v_result->>'idempotent' <> 'true'
     or v_result->>'reward_status' <> 'already_awarded'
     or (v_result->>'points_awarded')::integer <> 35 then
    raise exception 'Repeated approval must return the existing reward without duplication';
  end if;
  if (select count(*) from public.build_submission_reviews
      where work_item_id = current_setting('build_prove.test_work_item_id')::uuid) <> 3 then
    raise exception 'Review history must append one record for each decision';
  end if;
  begin
    update public.build_submission_reviews
    set feedback = 'overwritten'
    where submission_id = current_setting('build_prove.test_submission_2')::uuid;
    raise exception 'Review history must not be mutable by admins';
  exception when insufficient_privilege then
    null;
  end;
  if (select count(*) from public.build_submission_reviews
      where work_item_id = current_setting('build_prove.other_work_item_id')::uuid) <> 1
     or (select status from public.build_assignment_members
         where id = current_setting('build_prove.other_work_item_id')::uuid) <> 'approved' then
    raise exception 'Direct SUBMITTED approval must record one review and approve the work item';
  end if;
  if (select status from public.build_assignment_members
      where id = current_setting('build_prove.test_work_item_id')::uuid) <> 'approved' then
    raise exception 'Approved work item status is incorrect';
  end if;
  begin
    perform public.cancel_build_work_item(current_setting('build_prove.test_work_item_id')::uuid);
    raise exception 'Approved work must not be cancelled';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_member_id'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.build_submissions
      where work_item_id = current_setting('build_prove.test_work_item_id')::uuid) <> 3
     or (select count(*) from public.build_submission_reviews
         where work_item_id = current_setting('build_prove.test_work_item_id')::uuid) <> 3
     or (select count(*) from public.build_submission_reviews
         where work_item_id = current_setting('build_prove.other_work_item_id')::uuid) <> 0
     or (select revision_number from public.build_submissions
         where work_item_id = current_setting('build_prove.test_work_item_id')::uuid
         order by revision_number desc limit 1) <> 3 then
    raise exception 'Member revision history must be private, chronological, and latest-revision aware';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_third_member_id'), true);
set local role authenticated;
select public.start_build_assignment(current_setting('build_prove.third_work_item_id')::uuid);
select set_config(
  'build_prove.third_submission_id',
  (public.submit_build_work(
    current_setting('build_prove.third_work_item_id')::uuid,
    'Rollback test submission', 'Used to prove approval and reward atomicity.', 'Created as the assigned member.'
  )->>'submission_id'),
  true
);
reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
do $$
declare
  v_points integer;
  v_reward_result jsonb;
begin
  select points into v_points from public.profiles
  where id = current_setting('build_prove.test_member_id')::uuid;
  if v_points::integer <> current_setting('build_prove.points_before')::integer + 35 then
    raise exception 'The approved member work item must award exactly its snapshot';
  end if;
  if (select points from public.profiles
      where id = current_setting('build_prove.test_other_member_id')::uuid)
      <> current_setting('build_prove.other_points_before')::integer + 35 then
    raise exception 'Direct approval must award exactly one work-item snapshot';
  end if;

  if (select count(*) from public.build_submission_rewards
      where work_item_id in (
        current_setting('build_prove.test_work_item_id')::uuid,
        current_setting('build_prove.other_work_item_id')::uuid
      )) <> 2
     or not exists (
       select 1 from public.build_submission_rewards
       where work_item_id = current_setting('build_prove.test_work_item_id')::uuid
         and submission_id = current_setting('build_prove.test_submission_3')::uuid
         and profile_id = current_setting('build_prove.test_member_id')::uuid
         and points_awarded = 35
         and awarded_by = current_setting('build_prove.test_admin_id')::uuid
     ) then
    raise exception 'The immutable reward ledger must record one approved revision per work item';
  end if;

  if (select count(*) from public.activities
      where build_assignment_member_id = current_setting('build_prove.test_work_item_id')::uuid
        and activity_type = 'build_prove' and points = 35) <> 1
     or (select count(*) from public.activities
         where build_assignment_member_id = current_setting('build_prove.other_work_item_id')::uuid
           and activity_type = 'build_prove' and points = 35) <> 1 then
    raise exception 'Each approved work item must create exactly one Build & Prove activity';
  end if;

  v_reward_result := public.award_build_submission_reward(
    current_setting('build_prove.test_work_item_id')::uuid
  );
  if v_reward_result->>'status' <> 'already_awarded'
     or v_reward_result->>'idempotent' <> 'true'
     or (v_reward_result->>'points_awarded')::integer <> 35 then
    raise exception 'A retry must return the existing reward without changing points';
  end if;

  if exists (
    select 1 from public.build_submissions s
    left join public.build_assignment_members am on am.id = s.work_item_id and am.member_id = s.member_id
    where am.id is null
  ) then
    raise exception 'Orphan Build & Prove submission found';
  end if;
  if exists (
    select 1 from public.build_submission_reviews r
    left join public.build_submissions s on s.id = r.submission_id and s.work_item_id = r.work_item_id
    where s.id is null
  ) then
    raise exception 'Orphan Build & Prove review found';
  end if;
  if (select count(*) from public.challenge_completions)::text <> current_setting('build_prove.challenge_count_before')
     or (select count(*) from public.projects)::text <> current_setting('build_prove.project_count_before') then
    raise exception 'Core workflow mutated an unrelated domain';
  end if;
end;
$$;

create or replace function public.build_prove_test_reject_reward_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.activity_type = 'build_prove' then
    raise exception using errcode = 'PZ001', message = 'Test-only reward activity rejection';
  end if;
  return new;
end;
$$;
create trigger build_prove_test_reject_reward_activity
before insert on public.activities
for each row execute function public.build_prove_test_reject_reward_activity();

select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
set local role authenticated;
do $$
declare
  v_result jsonb;
begin
  begin
    perform public.review_build_submission(
      current_setting('build_prove.third_submission_id')::uuid,
      'approved', 'This approval must roll back when reward activity creation fails.'
    );
    raise exception 'Reward activity failure must abort approval';
  exception when sqlstate 'PZ001' then
    null;
  end;
  if (select status from public.build_assignment_members
      where id = current_setting('build_prove.third_work_item_id')::uuid) <> 'submitted'
     or (select count(*) from public.build_submission_reviews
         where submission_id = current_setting('build_prove.third_submission_id')::uuid) <> 0
     or (select count(*) from public.build_submission_rewards
         where work_item_id = current_setting('build_prove.third_work_item_id')::uuid) <> 0
     or (select points from public.profiles
         where id = current_setting('build_prove.test_third_member_id')::uuid)
         <> current_setting('build_prove.third_points_before')::integer then
    raise exception 'Failed reward creation must roll back status, review, reward, and points';
  end if;
end;
$$;

reset role;
drop trigger build_prove_test_reject_reward_activity on public.activities;
drop function public.build_prove_test_reject_reward_activity();
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_admin_id'), true);
set local role authenticated;
do $$
declare
  v_result jsonb;
begin
  v_result := public.cancel_build_work_item(current_setting('build_prove.third_work_item_id')::uuid);
  if v_result->>'status' <> 'cancelled' or v_result->>'idempotent' <> 'false' then
    raise exception 'Admin must be able to cancel non-approved work';
  end if;
  begin
    perform public.award_build_submission_reward(
      current_setting('build_prove.third_work_item_id')::uuid
    );
    raise exception 'Cancelled work must not be rewarded';
  exception when sqlstate 'PT409' then
    null;
  end;
  v_result := public.cancel_build_work_item(current_setting('build_prove.third_work_item_id')::uuid);
  if v_result->>'status' <> 'cancelled' or v_result->>'idempotent' <> 'true' then
    raise exception 'Repeated cancellation must be idempotent';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove.test_third_member_id'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.build_assignment_members
      where id = current_setting('build_prove.third_work_item_id')::uuid) <> 1
     or (select count(*) from public.build_assignments
         where id = current_setting('build_prove.test_assignment_id')::uuid) <> 0 then
    raise exception 'Cancelled member work remains visible but assignment details are intentionally hidden by current RLS';
  end if;
  begin
    perform public.start_build_assignment(current_setting('build_prove.third_work_item_id')::uuid);
    raise exception 'Cancelled work must be terminal';
  exception when sqlstate '40001' then
    null;
  end;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform count(*) from public.build_assignments;
    raise exception 'Anonymous Build & Prove reads must fail';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.start_build_assignment(current_setting('build_prove.test_work_item_id')::uuid);
    raise exception 'Anonymous workflow RPC execution must fail';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.award_build_submission_reward(current_setting('build_prove.test_work_item_id')::uuid);
    raise exception 'Anonymous reward RPC execution must fail';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
