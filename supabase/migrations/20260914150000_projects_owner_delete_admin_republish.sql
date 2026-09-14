-- Projects V2.3 ownership lifecycle:
-- owners may permanently delete their own project; admins may republish archives.

create or replace function public.delete_project_v1(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  perform 1
  from public.projects p
  where p.id = p_project_id
    and public.project_is_owner(p.id, v_actor)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;

  delete from public.projects where id = p_project_id;
  return jsonb_build_object('status', 'deleted', 'project_id', p_project_id);
end;
$$;

revoke all on function public.delete_project_v1(uuid) from public, anon, authenticated;
grant execute on function public.delete_project_v1(uuid) to authenticated;

-- Archived projects remain hidden from discovery but can be explicitly
-- republished by an administrator without changing ownership or history.
create or replace function public.review_project_publication(
  p_project_id uuid,
  p_decision text,
  p_feedback text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor             uuid := auth.uid();
  v_state             text;
  v_owner_id          uuid;
  v_now               timestamptz := timezone('utc', now());
  v_is_first_approval boolean;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_decision not in ('approved', 'changes_requested', 'archived')
    or char_length(coalesce(p_feedback, '')) > 2000
  then
    raise exception using errcode = '22023', message = 'Invalid review';
  end if;

  select publication_state into v_state
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;

  if (p_decision = 'approved' and v_state not in ('pending_review', 'archived'))
    or (p_decision = 'changes_requested' and v_state <> 'pending_review')
    or (p_decision = 'archived' and v_state = 'archived')
  then
    raise exception using errcode = '22023', message = 'Stale project review';
  end if;

  update public.projects
  set publication_state = case p_decision
    when 'approved' then 'published'
    when 'changes_requested' then 'changes_requested'
    else 'archived'
  end
  where id = p_project_id;

  select not exists (
    select 1
    from public.project_reviews
    where project_id = p_project_id
      and decision = 'approved'
  ) into v_is_first_approval;

  insert into public.project_reviews (project_id, reviewer_id, decision, feedback)
  values (p_project_id, v_actor, p_decision, trim(coalesce(p_feedback, '')));

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    'project.' || p_decision,
    'project',
    p_project_id,
    jsonb_build_object('feedback_provided', p_feedback <> '')
  );

  if p_decision = 'approved' and v_is_first_approval then
    select profile_id into v_owner_id
    from public.project_members
    where project_id = p_project_id
      and role = 'owner'
      and status = 'active'
    limit 1;

    if v_owner_id is not null then
      update public.profiles
      set points = points + 150
      where id = v_owner_id;

      insert into public.activities (
        activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id
      )
      select
        'project-published-' || v_owner_id::text || '-' || p_project_id::text,
        v_owner_id,
        'project',
        p.title,
        'Project published',
        150,
        v_now,
        p_project_id
      from public.projects p
      where p.id = p_project_id
      on conflict (activity_key) do nothing;

      perform public.advance_member_stage(v_owner_id);
    end if;
  end if;

  return jsonb_build_object('status', p_decision);
end;
$$;

revoke all on function public.review_project_publication(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_project_publication(uuid, text, text) to authenticated;
