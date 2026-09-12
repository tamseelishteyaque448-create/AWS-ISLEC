-- Point Economy V1
--
-- Phase 4B: Implements the authoritative V1.1 point economy by adding
-- point mutations to four domain RPCs that previously recorded activity
-- but awarded zero points.
--
-- V1.1 POINT SCHEDULE (FROZEN):
--   challenge completed      → challenge.points (unchanged)
--   badge earned             → badge.points (unchanged)
--   event registration       → 0 (unchanged, correct)
--   event attended           → +20 to the attendee (p_profile_id)
--   project created          → 0 (unchanged, correct)
--   project submitted        → +50 to the owner (first submission only)
--   project published        → +150 to the owner (first approval only)
--   project joining approved → +30 to the approved member (once per member/project)
--
-- IDEMPOTENCY:
--   event attendance:   event_attendees.status = 'attended' gate (one per member/event).
--   project submission: NOT EXISTS(prior 'submitted' review) before award.
--   project publication: NOT EXISTS(prior 'approved' review with created_at < v_now).
--   project joining:    NOT EXISTS(activity_key) before INSERT and award.
--
-- SECURITY:
--   All functions: SECURITY DEFINER, search_path = '', schema-qualified.
--   Point amounts hardcoded server-side — no caller-controlled values.
--   Attendee points go to p_profile_id, NOT auth.uid() (the admin).
--   Publication points go to project owner only, not contributors.
--
-- NOT CHANGED:
--   complete_challenge(), create_project_v1(), register_for_event()
--   profiles.stage (Phase 4C), badge evaluation (Phase 4D)

-- ============================================================
-- 1. record_event_attendance — add +20 points to the attendee
-- ============================================================

create or replace function public.record_event_attendance(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event    public.events%rowtype;
  v_attendee public.event_attendees%rowtype;
  v_now      timestamptz := timezone('utc', now());
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found
    or v_event.status = 'cancelled'
    or (v_event.status = 'upcoming' and v_event.starts_at > v_now)
  then
    raise exception using errcode = 'P0001', message = 'Attendance cannot be recorded yet';
  end if;

  select * into v_attendee
  from public.event_attendees
  where event_id = p_event_id and profile_id = p_profile_id
  for update;

  if not found or v_attendee.status = 'cancelled' then
    raise exception using errcode = 'P0002', message = 'Active registration not found';
  end if;

  -- Idempotency: already_attended early-return prevents double award.
  if v_attendee.status = 'attended' then
    return jsonb_build_object(
      'status', 'already_attended',
      'event_id', p_event_id,
      'profile_id', p_profile_id
    );
  end if;

  update public.event_attendees
  set status = 'attended'
  where event_id = p_event_id and profile_id = p_profile_id;

  -- +20 points to the attendee (p_profile_id), NOT to the admin (auth.uid()).
  update public.profiles
  set points = points + 20
  where id = p_profile_id;

  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, event_id
  )
  values (
    'event-attended-' || p_profile_id::text || '-' || p_event_id::text,
    p_profile_id,
    'event',
    v_event.title,
    'Attended event',
    20,
    v_now,
    p_event_id
  )
  on conflict (activity_key) do nothing;

  return jsonb_build_object(
    'status', 'attended',
    'event_id', p_event_id,
    'profile_id', p_profile_id
  );
end;
$$;

-- ============================================================
-- 2. submit_project_for_review — add +50 points to the owner
--    First submission only. Re-submissions after changes_requested award 0.
-- ============================================================

create or replace function public.submit_project_for_review(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor               uuid := auth.uid();
  v_now                 timestamptz := timezone('utc', now());
  v_is_first_submission boolean;
begin
  if not public.project_is_owner(p_project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;

  update public.projects
  set publication_state = 'pending_review'
  where id = p_project_id
    and publication_state in ('draft', 'changes_requested');

  if not found then
    raise exception using errcode = '22023', message = 'Project cannot be submitted';
  end if;

  -- Check BEFORE inserting the new review row whether a prior submission exists.
  select not exists (
    select 1 from public.project_reviews
    where project_id = p_project_id
      and decision = 'submitted'
  ) into v_is_first_submission;

  insert into public.project_reviews (project_id, reviewer_id, decision)
  values (p_project_id, v_actor, 'submitted');

  if v_is_first_submission then
    update public.profiles
    set points = points + 50
    where id = v_actor;

    insert into public.activities (
      activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id
    )
    select
      'project-submitted-' || v_actor::text || '-' || p_project_id::text,
      v_actor,
      'project',
      p.title,
      'Project submitted for review',
      50,
      v_now,
      p_project_id
    from public.projects p
    where p.id = p_project_id
    on conflict (activity_key) do nothing;
  end if;

  return jsonb_build_object('status', 'pending_review');
end;
$$;

-- ============================================================
-- 3. review_project_publication — add +150 points to the owner
--    First approval only. Archive-then-reapprove does not farm +150.
-- ============================================================

create or replace function public.review_project_publication(
  p_project_id uuid,
  p_decision   text,
  p_feedback   text default ''
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

  if (p_decision in ('approved', 'changes_requested') and v_state <> 'pending_review')
    or (p_decision = 'archived' and v_state = 'archived')
  then
    raise exception using errcode = '22023', message = 'Stale project review';
  end if;

  update public.projects
  set publication_state = case p_decision
    when 'approved'          then 'published'
    when 'changes_requested' then 'changes_requested'
    else 'archived'
  end
  where id = p_project_id;

  -- Check BEFORE inserting the new review row whether a prior approval exists.
  select not exists (
    select 1 from public.project_reviews
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
      -- +150 points to the project owner only.
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
    end if;
  end if;

  return jsonb_build_object('status', p_decision);
end;
$$;

-- ============================================================
-- 4. resolve_project_join_request — add +30 points to the approved member
--    Once per member/project. Repeated request/withdraw/re-approve cycles
--    cannot farm additional points.
-- ============================================================

create or replace function public.resolve_project_join_request(
  p_request_id uuid,
  p_approve    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request      public.project_join_requests%rowtype;
  v_project      public.projects%rowtype;
  v_actor        uuid := auth.uid();
  v_active       integer;
  v_now          timestamptz := timezone('utc', now());
  v_activity_key text;
  v_is_new_join  boolean;
begin
  select * into v_request
  from public.project_join_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  select * into v_project
  from public.projects
  where id = v_request.project_id
  for update;

  if not public.project_is_owner(v_request.project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;

  if v_request.status <> 'requested' then
    raise exception using errcode = '22023', message = 'Request is no longer pending';
  end if;

  if p_approve then
    if v_project.publication_state = 'archived' then
      raise exception using errcode = '22023', message = 'Archived project';
    end if;

    select count(*) into v_active
    from public.project_members
    where project_id = v_request.project_id
      and status in ('active', 'submitted', 'completed');

    if v_project.team_capacity is not null and v_active >= v_project.team_capacity then
      raise exception using errcode = '22023', message = 'Project is at capacity';
    end if;

    insert into public.project_members (project_id, profile_id, role, status)
    values (v_request.project_id, v_request.profile_id, 'contributor', 'active')
    on conflict (project_id, profile_id)
    do update set role = 'contributor', status = 'active', joined_at = v_now;

    update public.project_join_requests
    set status = 'approved', resolved_at = v_now, resolved_by = v_actor
    where id = p_request_id;

    insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      v_actor, 'project.join_request_approved', 'project',
      v_request.project_id,
      jsonb_build_object('profile_id', v_request.profile_id)
    );

    v_activity_key := 'project-joined-' || v_request.profile_id::text || '-' || v_request.project_id::text;

    -- Check BEFORE inserting whether this join activity already exists.
    -- The activity_key is globally unique and deterministic for this member/project pair.
    -- A prior join (e.g. withdraw + re-request + re-approve) would have the same key.
    select not exists (
      select 1 from public.activities where activity_key = v_activity_key
    ) into v_is_new_join;

    insert into public.activities (
      activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id
    )
    values (
      v_activity_key,
      v_request.profile_id,
      'project',
      v_project.title,
      'Joined project',
      30,
      v_now,
      v_request.project_id
    )
    on conflict (activity_key) do nothing;

    -- Award +30 only if this is the first time this member has joined this project.
    if v_is_new_join then
      update public.profiles
      set points = points + 30
      where id = v_request.profile_id;
    end if;

  else
    update public.project_join_requests
    set status = 'declined', resolved_at = v_now, resolved_by = v_actor
    where id = p_request_id;

    insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      v_actor, 'project.join_request_declined', 'project',
      v_request.project_id,
      jsonb_build_object('profile_id', v_request.profile_id)
    );
  end if;

  return jsonb_build_object('status', case when p_approve then 'approved' else 'declined' end);
end;
$$;
