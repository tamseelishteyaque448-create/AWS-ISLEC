begin;

create temp table build_prove_admin_test_context (
  admin_id uuid not null,
  member_a_id uuid not null,
  member_b_id uuid not null,
  member_c_id uuid not null
) on commit drop;

insert into build_prove_admin_test_context(admin_id, member_a_id, member_b_id, member_c_id)
select a.user_id,
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id limit 1),
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id offset 1 limit 1),
       (select p.id from public.profiles p where p.id <> a.user_id order by p.id offset 2 limit 1)
from private.admin_users a
order by a.granted_at
limit 1;

do $$
begin
  if not exists (
    select 1
    from build_prove_admin_test_context
    where member_a_id is not null and member_b_id is not null and member_c_id is not null
  ) then
    raise exception 'Build & Prove admin test requires one admin and three non-admin profiles';
  end if;
end;
$$;

select set_config('build_prove_admin_test.admin_id', admin_id::text, true),
       set_config('build_prove_admin_test.member_a_id', member_a_id::text, true),
       set_config('build_prove_admin_test.member_b_id', member_b_id::text, true),
       set_config('build_prove_admin_test.member_c_id', member_c_id::text, true)
from build_prove_admin_test_context;

select set_config('request.jwt.claim.sub', current_setting('build_prove_admin_test.admin_id'), true);
set local role authenticated;

select set_config(
  'build_prove_admin_test.empty_assignment_id',
  (public.save_build_assignment(
    p_slug => 'build-admin-empty-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Admin assignment without members',
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'draft'
  )->>'assignment_id'),
  true
);

select set_config(
  'build_prove_admin_test.single_assignment_id',
  (public.save_build_assignment(
    p_slug => 'build-admin-single-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Admin assignment with one member',
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published',
    p_reward_points => 35,
    p_member_ids => array[current_setting('build_prove_admin_test.member_a_id')::uuid]
  )->>'assignment_id'),
  true
);

select set_config(
  'build_prove_admin_test.bulk_assignment_id',
  (public.save_build_assignment(
    p_slug => 'build-admin-bulk-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Admin bulk assignment',
    p_difficulty => 'medium',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published',
    p_reward_points => 45,
    p_member_ids => array[
      current_setting('build_prove_admin_test.member_a_id')::uuid,
      current_setting('build_prove_admin_test.member_b_id')::uuid,
      current_setting('build_prove_admin_test.member_c_id')::uuid
    ]
  )->>'assignment_id'),
  true
);

select set_config(
  'build_prove_admin_test.incremental_assignment_id',
  (public.save_build_assignment(
    p_slug => 'build-admin-incremental-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Admin assignment updated with new members',
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published',
    p_reward_points => 25,
    p_member_ids => array[current_setting('build_prove_admin_test.member_a_id')::uuid]
  )->>'assignment_id'),
  true
);

select public.save_build_assignment(
  p_assignment_id => current_setting('build_prove_admin_test.incremental_assignment_id')::uuid,
  p_slug => (select slug from public.build_assignments
             where id = current_setting('build_prove_admin_test.incremental_assignment_id')::uuid),
  p_title => 'Admin assignment updated with new members',
  p_difficulty => 'easy',
  p_domain => 'documentation',
  p_assignment_scope => 'individual',
  p_publication_state => 'published',
  p_reward_points => 30,
  p_member_ids => array[
    current_setting('build_prove_admin_test.member_a_id')::uuid,
    current_setting('build_prove_admin_test.member_b_id')::uuid,
    current_setting('build_prove_admin_test.member_c_id')::uuid
  ]
);

select set_config(
  'build_prove_admin_test.dedicated_assignment_id',
  (public.save_build_assignment(
    p_slug => 'build-admin-dedicated-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Dedicated member assignment',
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published',
    p_reward_points => 20
  )->>'assignment_id'),
  true
);

do $$
declare
  v_bulk_assignment_id uuid := current_setting('build_prove_admin_test.bulk_assignment_id')::uuid;
  v_single_assignment_id uuid := current_setting('build_prove_admin_test.single_assignment_id')::uuid;
  v_incremental_assignment_id uuid := current_setting('build_prove_admin_test.incremental_assignment_id')::uuid;
  v_empty_assignment_id uuid := current_setting('build_prove_admin_test.empty_assignment_id')::uuid;
  v_member_a_id uuid := current_setting('build_prove_admin_test.member_a_id')::uuid;
  v_member_b_id uuid := current_setting('build_prove_admin_test.member_b_id')::uuid;
  v_member_c_id uuid := current_setting('build_prove_admin_test.member_c_id')::uuid;
begin
  if exists (
    select 1 from public.admin_audit_log
    where target_type = 'build_assignment'
      and target_id = v_empty_assignment_id
      and action = 'build_member_assigned'
  ) then
    raise exception 'Creating an assignment without members must not create assignment audit rows';
  end if;

  if (select count(*) from public.build_assignment_members
      where assignment_id = v_single_assignment_id and member_id = v_member_a_id) <> 1
    or (select count(*) from public.admin_audit_log
        where target_type = 'build_assignment'
          and target_id = v_single_assignment_id
          and action = 'build_member_assigned'
          and metadata->>'member_id' = v_member_a_id::text
          and metadata ? 'work_item_id') <> 1 then
    raise exception 'Single bulk assignment must have one member- and work-item-attributed audit record';
  end if;

  if (select count(*) from public.build_assignment_members where assignment_id = v_bulk_assignment_id) <> 3
    or (select count(*) from public.admin_audit_log
        where target_type = 'build_assignment'
          and target_id = v_bulk_assignment_id
          and action = 'build_member_assigned') <> 3
    or exists (
      select 1
      from public.build_assignment_members am
      where am.assignment_id = v_bulk_assignment_id
        and not exists (
          select 1 from public.admin_audit_log al
          where al.actor_id = current_setting('build_prove_admin_test.admin_id')::uuid
            and al.target_type = 'build_assignment'
            and al.target_id = v_bulk_assignment_id
            and al.action = 'build_member_assigned'
            and al.metadata->>'member_id' = am.member_id::text
            and al.metadata->>'work_item_id' = am.id::text
        )
    ) then
    raise exception 'Each bulk-created work item must have an individual audit record with actor, member, task, and work item';
  end if;

  if (select count(*) from public.build_assignment_members
      where assignment_id = v_bulk_assignment_id and member_id in (v_member_a_id, v_member_b_id, v_member_c_id)
        and assigned_by = current_setting('build_prove_admin_test.admin_id')::uuid
        and reward_points_snapshot = 45) <> 3 then
    raise exception 'Bulk assignment must preserve assigned_by and the configured reward snapshot';
  end if;

  if (select count(*) from public.build_assignment_members where assignment_id = v_incremental_assignment_id) <> 3
    or (select count(*) from public.admin_audit_log
        where target_type = 'build_assignment'
          and target_id = v_incremental_assignment_id
          and action = 'build_member_assigned') <> 3
    or exists (
      select 1
      from public.build_assignment_members am
      where am.assignment_id = v_incremental_assignment_id
        and not exists (
          select 1 from public.admin_audit_log al
          where al.actor_id = current_setting('build_prove_admin_test.admin_id')::uuid
            and al.target_type = 'build_assignment'
            and al.target_id = v_incremental_assignment_id
            and al.action = 'build_member_assigned'
            and al.metadata->>'member_id' = am.member_id::text
            and al.metadata->>'work_item_id' = am.id::text
        )
    )
    or (select reward_points_snapshot from public.build_assignment_members
        where assignment_id = v_incremental_assignment_id and member_id = v_member_a_id) <> 25
    or (select count(*) from public.build_assignment_members
        where assignment_id = v_incremental_assignment_id
          and member_id in (v_member_b_id, v_member_c_id)
          and reward_points_snapshot = 30) <> 2 then
    raise exception 'Adding new members to an assignment must audit only actual new work and preserve each reward snapshot';
  end if;

  if (select count(*) from public.admin_audit_log
      where target_type = 'build_assignment'
        and target_id = v_single_assignment_id
        and action = 'build_member_assigned'
        and metadata->>'member_id' = v_member_a_id::text) <> 1 then
    raise exception 'Single assignment audit attribution was not recorded exactly once';
  end if;
end;
$$;

select public.save_build_assignment(
  p_assignment_id => current_setting('build_prove_admin_test.bulk_assignment_id')::uuid,
  p_slug => (select slug from public.build_assignments
             where id = current_setting('build_prove_admin_test.bulk_assignment_id')::uuid),
  p_title => 'Admin bulk assignment updated',
  p_difficulty => 'medium',
  p_domain => 'documentation',
  p_assignment_scope => 'individual',
  p_publication_state => 'published',
  p_reward_points => 60,
  p_member_ids => array[
    current_setting('build_prove_admin_test.member_a_id')::uuid,
    current_setting('build_prove_admin_test.member_b_id')::uuid,
    current_setting('build_prove_admin_test.member_c_id')::uuid
  ]
);

do $$
declare
  v_assignment_id uuid := current_setting('build_prove_admin_test.bulk_assignment_id')::uuid;
begin
  if (select count(*) from public.build_assignment_members
      where assignment_id = v_assignment_id) <> 3
    or (select count(*) from public.admin_audit_log
        where target_type = 'build_assignment'
          and target_id = v_assignment_id
          and action = 'build_member_assigned') <> 3
    or (select count(*) from public.build_assignment_members
        where assignment_id = v_assignment_id and reward_points_snapshot = 45) <> 3 then
    raise exception 'Repeated update with existing members must not duplicate assignment audit or alter snapshots';
  end if;
end;
$$;

select public.save_build_assignment(
  p_assignment_id => current_setting('build_prove_admin_test.bulk_assignment_id')::uuid,
  p_slug => (select slug from public.build_assignments
             where id = current_setting('build_prove_admin_test.bulk_assignment_id')::uuid),
  p_title => 'Admin bulk assignment updated',
  p_difficulty => 'medium',
  p_domain => 'documentation',
  p_assignment_scope => 'individual',
  p_publication_state => 'published',
  p_reward_points => 60,
  p_member_ids => array[
    current_setting('build_prove_admin_test.member_a_id')::uuid,
    current_setting('build_prove_admin_test.member_b_id')::uuid
  ]
);

do $$
declare
  v_assignment_id uuid := current_setting('build_prove_admin_test.bulk_assignment_id')::uuid;
  v_member_a_id uuid := current_setting('build_prove_admin_test.member_a_id')::uuid;
  v_member_b_id uuid := current_setting('build_prove_admin_test.member_b_id')::uuid;
  v_member_c_id uuid := current_setting('build_prove_admin_test.member_c_id')::uuid;
begin
  if (select count(*) from public.build_assignment_members
      where assignment_id = v_assignment_id) <> 3
    or (select count(*) from public.admin_audit_log
        where target_type = 'build_assignment'
          and target_id = v_assignment_id
          and action = 'build_member_assigned') <> 3
    or exists (
      select 1 from public.build_assignment_members am
      where am.assignment_id = v_assignment_id
        and not exists (
          select 1 from public.admin_audit_log al
          where al.target_id = v_assignment_id
            and al.action = 'build_member_assigned'
            and al.metadata->>'member_id' = am.member_id::text
            and al.metadata->>'work_item_id' = am.id::text
        )
    )
    or (select count(*) from public.build_assignment_members
        where assignment_id = v_assignment_id
          and member_id in (v_member_a_id, v_member_b_id)
          and reward_points_snapshot = 45) <> 2
    or (select reward_points_snapshot from public.build_assignment_members
        where assignment_id = v_assignment_id and member_id = v_member_c_id) <> 45 then
    raise exception 'Existing-plus-new member update must audit only actual new assignments and preserve snapshots';
  end if;
end;
$$;

select set_config(
  'build_prove_admin_test.rollback_assignment_id',
  (public.save_build_assignment(
    p_slug => 'build-admin-rollback-' || replace(gen_random_uuid()::text, '-', ''),
    p_title => 'Assignment for rollback check',
    p_difficulty => 'easy',
    p_domain => 'documentation',
    p_assignment_scope => 'individual',
    p_publication_state => 'published'
  )->>'assignment_id'),
  true
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove_admin_test.member_a_id'), true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.admin_audit_log
    where target_type = 'build_assignment'
      and target_id = current_setting('build_prove_admin_test.bulk_assignment_id')::uuid
      and action = 'build_member_assigned'
  ) then
    raise exception 'Non-admin members must not read Build & Prove assignment audit rows';
  end if;

  begin
    perform public.save_build_assignment(
      p_assignment_id => current_setting('build_prove_admin_test.rollback_assignment_id')::uuid,
      p_slug => (select slug from public.build_assignments
                 where id = current_setting('build_prove_admin_test.rollback_assignment_id')::uuid),
      p_title => 'Unauthorized bulk assignment',
      p_difficulty => 'easy',
      p_domain => 'documentation',
      p_assignment_scope => 'individual',
      p_publication_state => 'published',
      p_member_ids => array[current_setting('build_prove_admin_test.member_b_id')::uuid]
    );
    raise exception 'Member must not invoke bulk assignment';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('build_prove_admin_test.admin_id'), true);
set local role authenticated;

reset role;
alter table public.admin_audit_log
  add constraint build_prove_test_reject_assignment_audit
  check (action <> 'build_member_assigned') not valid;
set local role authenticated;

do $$
declare
  v_assignment_id uuid := current_setting('build_prove_admin_test.rollback_assignment_id')::uuid;
begin
  begin
    perform public.save_build_assignment(
      p_assignment_id => v_assignment_id,
      p_slug => (select slug from public.build_assignments where id = v_assignment_id),
      p_title => 'Assignment whose audit is rejected',
      p_difficulty => 'easy',
      p_domain => 'documentation',
      p_assignment_scope => 'individual',
      p_publication_state => 'published',
      p_member_ids => array[current_setting('build_prove_admin_test.member_a_id')::uuid]
    );
    raise exception 'Injected audit failure must abort bulk assignment';
  exception when check_violation then
    null;
  end;

  if exists (
    select 1 from public.build_assignment_members
    where assignment_id = v_assignment_id
  ) or exists (
    select 1 from public.admin_audit_log
    where target_type = 'build_assignment'
      and target_id = v_assignment_id
      and action = 'build_member_assigned'
  ) or not exists (
    select 1 from public.build_assignments
    where id = v_assignment_id and title = 'Assignment for rollback check'
  ) then
    raise exception 'Failed assignment/audit must roll back work items, audit rows, and task edits together';
  end if;
end;
$$;

reset role;
alter table public.admin_audit_log
  drop constraint build_prove_test_reject_assignment_audit;
set local role authenticated;

select set_config(
  'build_prove_admin_test.dedicated_result',
  (public.assign_build_member(
    current_setting('build_prove_admin_test.dedicated_assignment_id')::uuid,
    current_setting('build_prove_admin_test.member_a_id')::uuid
  )->>'created'),
  true
);

do $$
declare
  v_duplicate_result jsonb;
begin
  v_duplicate_result := public.assign_build_member(
    current_setting('build_prove_admin_test.dedicated_assignment_id')::uuid,
    current_setting('build_prove_admin_test.member_a_id')::uuid
  );
  if current_setting('build_prove_admin_test.dedicated_result') <> 'true'
    or v_duplicate_result->>'created' <> 'false'
    or v_duplicate_result->>'member_id' <> current_setting('build_prove_admin_test.member_a_id') then
    raise exception 'Dedicated assignment RPC must preserve create and duplicate results';
  end if;

  if (select count(*) from public.build_assignment_members
      where assignment_id = current_setting('build_prove_admin_test.dedicated_assignment_id')::uuid
        and member_id = current_setting('build_prove_admin_test.member_a_id')::uuid) <> 1
    or (select count(*) from public.admin_audit_log
        where target_type = 'build_assignment'
          and target_id = current_setting('build_prove_admin_test.dedicated_assignment_id')::uuid
          and action = 'build_member_assigned'
          and metadata->>'member_id' = current_setting('build_prove_admin_test.member_a_id')) <> 1 then
    raise exception 'Dedicated assignment RPC audit behavior must remain unchanged and idempotent';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  if has_function_privilege(
    'anon',
    'public.save_build_assignment(uuid,text,text,text,text,text,text,text,text,timestamptz,text,jsonb,jsonb,jsonb,jsonb,integer,integer,uuid[])',
    'execute'
  ) then
    raise exception 'Anonymous users must not execute the bulk assignment RPC';
  end if;

  begin
    perform public.save_build_assignment(
      p_slug => 'anonymous-must-not-assign',
      p_title => 'Unauthorized bulk assignment',
      p_difficulty => 'easy',
      p_domain => 'documentation',
      p_assignment_scope => 'individual',
      p_publication_state => 'published',
      p_member_ids => array[current_setting('build_prove_admin_test.member_a_id')::uuid]
    );
    raise exception 'Anonymous users must not invoke bulk assignment';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
