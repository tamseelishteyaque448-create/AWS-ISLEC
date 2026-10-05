create or replace function public.save_build_assignment(
  p_assignment_id uuid default null, p_slug text default null, p_title text default null,
  p_summary text default '', p_objective text default '', p_difficulty text default 'easy',
  p_domain text default 'innovation_research', p_assignment_scope text default 'domain',
  p_publication_state text default 'draft', p_deadline_at timestamptz default null,
  p_priority text default 'normal', p_requirements jsonb default '[]'::jsonb,
  p_deliverables jsonb default '[]'::jsonb, p_submission_requirements jsonb default '[]'::jsonb,
  p_evaluation_criteria jsonb default '[]'::jsonb, p_reward_points integer default 0,
  p_sort_order integer default 0, p_member_ids uuid[] default '{}'::uuid[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_existing public.build_assignments%rowtype;
begin
  if v_actor is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(coalesce(p_title, ''))) not between 1 and 160
    or p_difficulty not in ('easy', 'medium', 'hard')
    or p_domain not in ('innovation_research', 'event_management', 'media_design', 'documentation')
    or p_assignment_scope not in ('domain', 'individual')
    or p_publication_state not in ('draft', 'published', 'archived')
    or p_priority not in ('low', 'normal', 'high', 'urgent')
    or p_reward_points not between 0 and 10000 or p_sort_order < 0
    or jsonb_typeof(coalesce(p_requirements, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_deliverables, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_submission_requirements, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_evaluation_criteria, '[]'::jsonb)) <> 'array'
    or cardinality(coalesce(p_member_ids, '{}'::uuid[])) <>
       (select count(distinct id) from unnest(coalesce(p_member_ids, '{}'::uuid[])) as ids(id)) then
    raise exception using errcode = '22023', message = 'Invalid build assignment';
  end if;

  if p_assignment_id is null then
    insert into public.build_assignments (
      slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state,
      deadline_at, priority, requirements, deliverables, submission_requirements,
      evaluation_criteria, reward_points, sort_order, created_by
    ) values (
      p_slug, trim(p_title), coalesce(p_summary, ''), coalesce(p_objective, ''), p_difficulty,
      p_domain, p_assignment_scope, p_publication_state, p_deadline_at, p_priority,
      coalesce(p_requirements, '[]'::jsonb), coalesce(p_deliverables, '[]'::jsonb),
      coalesce(p_submission_requirements, '[]'::jsonb), coalesce(p_evaluation_criteria, '[]'::jsonb),
      p_reward_points, p_sort_order, v_actor
    ) returning id into v_id;
  else
    select * into v_existing from public.build_assignments where id = p_assignment_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Build assignment not found';
    end if;
    if exists (
      select 1 from public.build_assignment_members am
      where am.assignment_id = p_assignment_id
    ) and (v_existing.domain <> p_domain or v_existing.assignment_scope <> p_assignment_scope) then
      raise exception using errcode = '40001', message = 'Cannot change assignment targeting after work has started';
    end if;
    update public.build_assignments
    set slug = p_slug, title = trim(p_title), summary = coalesce(p_summary, ''),
        objective = coalesce(p_objective, ''), difficulty = p_difficulty, domain = p_domain,
        assignment_scope = p_assignment_scope, publication_state = p_publication_state,
        deadline_at = p_deadline_at, priority = p_priority,
        requirements = coalesce(p_requirements, '[]'::jsonb),
        deliverables = coalesce(p_deliverables, '[]'::jsonb),
        submission_requirements = coalesce(p_submission_requirements, '[]'::jsonb),
        evaluation_criteria = coalesce(p_evaluation_criteria, '[]'::jsonb),
        reward_points = p_reward_points, sort_order = p_sort_order,
        updated_at = timezone('utc', now())
    where id = p_assignment_id
    returning id into v_id;
  end if;

  if cardinality(coalesce(p_member_ids, '{}'::uuid[])) > 0 then
    if p_publication_state <> 'published' then
      raise exception using errcode = '22023', message = 'Members can only be assigned to a published task';
    end if;
    if p_assignment_scope = 'domain' and exists (
      select 1 from unnest(p_member_ids) as ids(id)
      where not exists (
        select 1 from public.build_member_domains d where d.profile_id = ids.id and d.domain = p_domain
      )
    ) then
      raise exception using errcode = '22023', message = 'Every domain assignee must be assigned to that domain';
    end if;
    if exists (
      select 1 from unnest(p_member_ids) as ids(id)
      where not exists (select 1 from public.profiles p where p.id = ids.id)
    ) then
      raise exception using errcode = '22023', message = 'Every assignee must have a member profile';
    end if;
    with inserted_members as (
      insert into public.build_assignment_members (
        assignment_id, member_id, assigned_by, status, reward_points_snapshot
      )
      select v_id, ids.id, v_actor, 'assigned', p_reward_points
      from unnest(p_member_ids) as ids(id)
      on conflict (assignment_id, member_id) do nothing
      returning id, member_id
    )
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
    select v_actor, 'build_member_assigned', 'build_assignment', v_id,
           jsonb_build_object('member_id', inserted_members.member_id,
                              'work_item_id', inserted_members.id)
    from inserted_members;
  end if;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (v_actor, case when p_assignment_id is null then 'build_assignment_created' else 'build_assignment_updated' end,
          'build_assignment', v_id, jsonb_build_object('publication_state', p_publication_state));
  return jsonb_build_object('assignment_id', v_id, 'publication_state', p_publication_state);
end;
$$;

revoke all on function public.save_build_assignment(
  uuid, text, text, text, text, text, text, text, text, timestamptz, text,
  jsonb, jsonb, jsonb, jsonb, integer, integer, uuid[]
) from public, anon;
grant execute on function public.save_build_assignment(
  uuid, text, text, text, text, text, text, text, text, timestamptz, text,
  jsonb, jsonb, jsonb, jsonb, integer, integer, uuid[]
) to authenticated;
