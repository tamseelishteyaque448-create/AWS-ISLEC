-- Stage Engine V1
--
-- Phase 4C: Adds the authoritative, monotonic member progression stage to
-- the system. This is the implementation of the AWS ISLEC Progression
-- Product Specification v1.1 stage engine.
--
-- STAGE DEFINITIONS (V1.1, frozen):
--
--   explorer     Account exists. All members begin here.
--
--   builder      >= 1 completed challenge
--                AND >= 1 approved project membership
--                     (owner OR active contributor)
--
--   contributor  >= 500 points
--                AND >= 1 historically approved project
--                     (member was on the project at or before approval)
--
--   innovator    >= 2,000 points
--                AND >= 2 historically approved projects
--                AND >= 1 attended event
--
--   mentor       >= 5,000 points
--                AND >= 3 historically approved projects
--                AND >= 3 attended events
--
-- MONOTONICITY:
--   profiles.stage is permanent once earned. The advance_member_stage()
--   function uses GREATEST(current_ordinal, computed_ordinal) and never
--   lowers a stored stage.
--
-- HISTORICAL PROJECT EVIDENCE:
--   A project counts toward stage only when:
--     (a) it received an approved review (project_reviews.decision='approved')
--     (b) the member was on the project at or before the approval timestamp
--         (project_members.joined_at <= project_reviews.created_at)
--   This prevents a member who joins after approval from inheriting the evidence.
--
-- SECURITY:
--   - profiles.stage is NOT in the column-level UPDATE grant for authenticated
--     (only full_name, handle, avatar_url are granted). No additional grant
--     restriction is needed.
--   - advance_member_stage() is SECURITY DEFINER, search_path='', called only
--     from within other SECURITY DEFINER RPCs that have already validated auth.
--   - No client-supplied stage value is accepted.
--
-- INTEGRATION:
--   Stage advancement is evaluated inside the five authoritative point-mutating
--   RPCs. Each RPC now calls advance_member_stage() after its points update.
--   This is the smallest set that covers all possible stage transitions.
--
-- ANTI-FARMING:
--   - Challenge completions: one per challenge (unique constraint)
--   - Approved project membership: counted distinct by project_id
--   - Historical approved projects: temporal join prevents post-approval joins
--   - Attended events: counted distinct by event_id, status='attended'
--
-- WHAT IS NOT CHANGED:
--   - profiles.role (unchanged free-text field)
--   - profiles.points logic (unchanged)
--   - badge evaluation (Phase 4D)
--   - Journey/leaderboard/admin UI (future phases)

-- ============================================================
-- 1. Add profiles.stage column
-- ============================================================

alter table public.profiles
  add column stage text not null default 'explorer'
  check (stage in ('explorer', 'builder', 'contributor', 'innovator', 'mentor'));

-- ============================================================
-- 2. advance_member_stage() — core monotonic stage engine
-- ============================================================
-- This function:
--   (a) computes the highest stage the member currently qualifies for
--   (b) compares to the stored stage
--   (c) advances only if computed > stored (NEVER downgrades)
--
-- Called from within authoritative point-mutating RPCs.
-- The caller holds a FOR UPDATE lock on the profiles row before calling
-- this function, ensuring the read and write are serialized.

create or replace function public.advance_member_stage(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_ordinal  integer;
  v_computed_ordinal integer := 0;  -- 0 = explorer
  v_points           integer;

  -- Evidence counters
  v_challenge_count          integer;
  v_approved_memberships     integer;
  v_hist_approved_projects   integer;
  v_attended_events          integer;
begin
  -- Read current stage ordinal and points from the already-locked profile row.
  select
    case stage
      when 'explorer'     then 0
      when 'builder'      then 1
      when 'contributor'  then 2
      when 'innovator'    then 3
      when 'mentor'       then 4
      else 0
    end,
    points
  into v_current_ordinal, v_points
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  -- -----------------------------------------------------------------------
  -- Evidence queries (all indexed)
  -- -----------------------------------------------------------------------

  -- Challenges completed (unique constraint ensures no duplicates)
  select count(distinct challenge_id)
  into v_challenge_count
  from public.challenge_completions
  where profile_id = p_profile_id;

  -- Approved project memberships:
  --   owner (any active owner row) OR
  --   active contributor
  --   Counts distinct projects only.
  select count(distinct project_id)
  into v_approved_memberships
  from public.project_members
  where profile_id = p_profile_id
    and role in ('owner', 'contributor')
    and status = 'active';

  -- Historically approved projects:
  --   The project received an approval review AND
  --   the member was on the project at or before the approval timestamp.
  --   One project counted once regardless of how many reviews it has.
  select count(distinct pm.project_id)
  into v_hist_approved_projects
  from public.project_members pm
  join public.project_reviews pr
    on pr.project_id = pm.project_id
   and pr.decision = 'approved'
   and pm.joined_at <= pr.created_at
  where pm.profile_id = p_profile_id
    and pm.role in ('owner', 'contributor')
    and pm.status = 'active';

  -- Attended events (one per event, status must be 'attended')
  select count(distinct event_id)
  into v_attended_events
  from public.event_attendees
  where profile_id = p_profile_id
    and status = 'attended';

  -- -----------------------------------------------------------------------
  -- Stage computation (highest qualifying stage)
  -- Evaluated in descending order: mentor → innovator → contributor →
  -- builder → explorer (0 is the fallback).
  -- -----------------------------------------------------------------------

  if v_points >= 5000
    and v_hist_approved_projects >= 3
    and v_attended_events >= 3
  then
    v_computed_ordinal := 4;  -- mentor

  elsif v_points >= 2000
    and v_hist_approved_projects >= 2
    and v_attended_events >= 1
  then
    v_computed_ordinal := 3;  -- innovator

  elsif v_points >= 500
    and v_hist_approved_projects >= 1
  then
    v_computed_ordinal := 2;  -- contributor

  elsif v_challenge_count >= 1
    and v_approved_memberships >= 1
  then
    v_computed_ordinal := 1;  -- builder

  else
    v_computed_ordinal := 0;  -- explorer
  end if;

  -- -----------------------------------------------------------------------
  -- Monotonic advance: only update if computed is strictly higher.
  -- -----------------------------------------------------------------------
  if v_computed_ordinal > v_current_ordinal then
    update public.profiles
    set stage = case v_computed_ordinal
      when 1 then 'builder'
      when 2 then 'contributor'
      when 3 then 'innovator'
      when 4 then 'mentor'
      else        'explorer'
    end
    where id = p_profile_id;
  end if;
end;
$$;

revoke all on function public.advance_member_stage(uuid) from public, anon, authenticated;

-- ============================================================
-- 3. Integrate stage advancement into the five authoritative RPCs
-- ============================================================
-- Each RPC already holds a FOR UPDATE lock on the profiles row
-- (either directly or via the points UPDATE). Calling
-- advance_member_stage() after the points mutation is safe and atomic.

-- 3a. complete_challenge
-- Already locks profiles row FOR UPDATE. Calls advance after points update.

create or replace function public.complete_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile_id         uuid := auth.uid();
  v_profile            public.profiles%rowtype;
  v_challenge          public.challenges%rowtype;
  v_progress           public.user_challenge_progress%rowtype;
  v_badge              public.badges%rowtype;
  v_completion_id      uuid;
  v_inserted_badge_id  uuid;
  v_now                timestamptz := timezone('utc', now());
  v_today              date        := (timezone('UTC', now()))::date;
  v_activity_key       text;
  v_streak             integer;
  v_total_points       integer;
  v_badge_reward_points integer := 0;
  v_has_progress       boolean;
  v_requirement_met    boolean;
  v_new_badges         jsonb := '[]'::jsonb;
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_profile_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Member profile not found';
  end if;

  select c.* into v_challenge
  from public.challenges as c
  join public.learning_paths as lp on lp.id = c.learning_path_id
  where c.id = p_challenge_id
    and c.is_published
    and lp.is_published
  for update of c, lp;
  if not found then
    raise exception using errcode = 'P0002', message = 'Published challenge not found';
  end if;

  select id into v_completion_id
  from public.challenge_completions
  where profile_id = v_profile_id and challenge_id = p_challenge_id
  for update;
  if found then
    return jsonb_build_object(
      'status', 'already_completed', 'challenge_id', p_challenge_id,
      'points_awarded', 0, 'total_points', v_profile.points,
      'streak', v_profile.streak, 'new_badges', '[]'::jsonb
    );
  end if;

  select * into v_progress
  from public.user_challenge_progress
  where profile_id = v_profile_id and challenge_id = p_challenge_id
  for update;
  v_has_progress := found;
  if v_has_progress and v_progress.status = 'completed' then
    return jsonb_build_object(
      'status', 'already_completed', 'challenge_id', p_challenge_id,
      'points_awarded', 0, 'total_points', v_profile.points,
      'streak', v_profile.streak, 'new_badges', '[]'::jsonb
    );
  end if;

  v_activity_key := 'challenge-completed-' || v_profile_id::text || '-' || p_challenge_id::text;

  insert into public.challenge_completions (
    profile_id, challenge_id, points_awarded, activity_key, completed_at, created_at
  )
  values (v_profile_id, p_challenge_id, v_challenge.points, v_activity_key, v_now, v_now)
  on conflict (profile_id, challenge_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    return jsonb_build_object(
      'status', 'already_completed', 'challenge_id', p_challenge_id,
      'points_awarded', 0, 'total_points', v_profile.points,
      'streak', v_profile.streak, 'new_badges', '[]'::jsonb
    );
  end if;

  if v_has_progress then
    update public.user_challenge_progress
    set status = 'completed', progress = 100,
        started_at = coalesce(v_progress.started_at, v_now), completed_at = v_now
    where profile_id = v_profile_id and challenge_id = p_challenge_id;
  else
    insert into public.user_challenge_progress (
      profile_id, challenge_id, status, progress,
      started_at, completed_at, created_at, updated_at
    )
    values (v_profile_id, p_challenge_id, 'completed', 100, v_now, v_now, v_now, v_now);
  end if;

  if v_profile.streak_last_date is null then
    v_streak := v_profile.streak;
  elsif v_profile.streak_last_date = v_today then
    v_streak := v_profile.streak;
  elsif v_profile.streak_last_date = v_today - 1 then
    v_streak := v_profile.streak + 1;
  else
    v_streak := 1;
  end if;

  v_total_points := v_profile.points + v_challenge.points;

  for v_badge in
    select * from public.badges
    where requirement_type is not null and requirement_value is not null
  loop
    v_requirement_met := case v_badge.requirement_type
      when 'challenge_count' then (
        select count(*) >= v_badge.requirement_value
        from public.challenge_completions
        where profile_id = v_profile_id
      )
      when 'streak'  then v_streak >= v_badge.requirement_value
      when 'points'  then v_total_points >= v_badge.requirement_value
      else false
    end;

    if v_requirement_met then
      insert into public.user_badges (profile_id, badge_id, earned_at)
      values (v_profile_id, v_badge.id, v_now)
      on conflict (profile_id, badge_id) do nothing
      returning badge_id into v_inserted_badge_id;

      if v_inserted_badge_id is not null then
        insert into public.challenge_completion_badges (completion_id, badge_id, points_awarded, created_at)
        values (v_completion_id, v_badge.id, v_badge.points, v_now);

        v_badge_reward_points := v_badge_reward_points + v_badge.points;
        v_new_badges := v_new_badges || jsonb_build_array(jsonb_build_object(
          'id', v_badge.id, 'slug', v_badge.slug,
          'title', v_badge.title, 'points', v_badge.points
        ));

        insert into public.activities (
          activity_key, profile_id, activity_type, title, detail, points, occurred_at, badge_id
        )
        values (
          'badge-earned-' || v_profile_id::text || '-' || v_badge.id::text,
          v_profile_id, 'badge', v_badge.title, 'Badge earned', v_badge.points, v_now, v_badge.id
        )
        on conflict (activity_key) do nothing;
      end if;
    end if;
  end loop;

  v_total_points := v_total_points + v_badge_reward_points;
  update public.profiles
  set points = v_total_points, streak = v_streak, streak_last_date = v_today
  where id = v_profile_id;

  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, learning_path_id
  )
  values (
    v_activity_key, v_profile_id, 'challenge',
    v_challenge.title, 'Challenge completed', v_challenge.points, v_now,
    v_challenge.learning_path_id
  );

  -- Advance stage after all points and evidence are committed.
  perform public.advance_member_stage(v_profile_id);

  return jsonb_build_object(
    'status', 'completed',
    'challenge_id', p_challenge_id,
    'points_awarded', v_challenge.points + v_badge_reward_points,
    'total_points', v_total_points,
    'streak', v_streak,
    'new_badges', v_new_badges
  );
end;
$function$;

-- 3b. record_event_attendance — advance after +20 pts

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

  update public.profiles
  set points = points + 20
  where id = p_profile_id;

  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, event_id
  )
  values (
    'event-attended-' || p_profile_id::text || '-' || p_event_id::text,
    p_profile_id, 'event', v_event.title, 'Attended event', 20, v_now, p_event_id
  )
  on conflict (activity_key) do nothing;

  perform public.advance_member_stage(p_profile_id);

  return jsonb_build_object(
    'status', 'attended',
    'event_id', p_event_id,
    'profile_id', p_profile_id
  );
end;
$$;

-- 3c. submit_project_for_review — advance after +50 pts (first submission)

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

  select not exists (
    select 1 from public.project_reviews
    where project_id = p_project_id and decision = 'submitted'
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
      v_actor, 'project', p.title, 'Project submitted for review', 50, v_now, p_project_id
    from public.projects p
    where p.id = p_project_id
    on conflict (activity_key) do nothing;

    perform public.advance_member_stage(v_actor);
  end if;

  return jsonb_build_object('status', 'pending_review');
end;
$$;

-- 3d. review_project_publication — advance owner after +150 pts

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

  select not exists (
    select 1 from public.project_reviews
    where project_id = p_project_id and decision = 'approved'
  ) into v_is_first_approval;

  insert into public.project_reviews (project_id, reviewer_id, decision, feedback)
  values (p_project_id, v_actor, p_decision, trim(coalesce(p_feedback, '')));

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    v_actor, 'project.' || p_decision, 'project', p_project_id,
    jsonb_build_object('feedback_provided', p_feedback <> '')
  );

  if p_decision = 'approved' and v_is_first_approval then
    select profile_id into v_owner_id
    from public.project_members
    where project_id = p_project_id and role = 'owner' and status = 'active'
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
        v_owner_id, 'project', p.title, 'Project published', 150, v_now, p_project_id
      from public.projects p
      where p.id = p_project_id
      on conflict (activity_key) do nothing;

      perform public.advance_member_stage(v_owner_id);
    end if;
  end if;

  return jsonb_build_object('status', p_decision);
end;
$$;

-- 3e. resolve_project_join_request — advance the approved member

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

    select not exists (
      select 1 from public.activities where activity_key = v_activity_key
    ) into v_is_new_join;

    insert into public.activities (
      activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id
    )
    values (
      v_activity_key, v_request.profile_id, 'project',
      v_project.title, 'Joined project', 30, v_now, v_request.project_id
    )
    on conflict (activity_key) do nothing;

    if v_is_new_join then
      update public.profiles
      set points = points + 30
      where id = v_request.profile_id;
    end if;

    -- Advance stage: project membership change can unlock Builder.
    perform public.advance_member_stage(v_request.profile_id);

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

-- ============================================================
-- 4. Initialize existing members
-- ============================================================
-- Compute the correct stage for every existing member from
-- authoritative evidence. No data is fabricated.
-- All production members currently have 0 approved project memberships
-- and 0 attended events, so the maximum reachable stage from existing
-- evidence alone is 'explorer' (no member has approved project membership
-- or historical approved project participation).
-- This UPDATE is safe and sets a correct initial state.

update public.profiles
set stage = case
  when (
    -- mentor: 5000 pts + 3 hist-approved projects + 3 attended events
    points >= 5000
    and (
      select count(distinct pm.project_id)
      from public.project_members pm
      join public.project_reviews pr
        on pr.project_id = pm.project_id
       and pr.decision = 'approved'
       and pm.joined_at <= pr.created_at
      where pm.profile_id = profiles.id
        and pm.role in ('owner', 'contributor')
        and pm.status = 'active'
    ) >= 3
    and (
      select count(distinct event_id)
      from public.event_attendees
      where profile_id = profiles.id and status = 'attended'
    ) >= 3
  ) then 'mentor'

  when (
    -- innovator: 2000 pts + 2 hist-approved projects + 1 attended event
    points >= 2000
    and (
      select count(distinct pm.project_id)
      from public.project_members pm
      join public.project_reviews pr
        on pr.project_id = pm.project_id
       and pr.decision = 'approved'
       and pm.joined_at <= pr.created_at
      where pm.profile_id = profiles.id
        and pm.role in ('owner', 'contributor')
        and pm.status = 'active'
    ) >= 2
    and (
      select count(distinct event_id)
      from public.event_attendees
      where profile_id = profiles.id and status = 'attended'
    ) >= 1
  ) then 'innovator'

  when (
    -- contributor: 500 pts + 1 hist-approved project
    points >= 500
    and (
      select count(distinct pm.project_id)
      from public.project_members pm
      join public.project_reviews pr
        on pr.project_id = pm.project_id
       and pr.decision = 'approved'
       and pm.joined_at <= pr.created_at
      where pm.profile_id = profiles.id
        and pm.role in ('owner', 'contributor')
        and pm.status = 'active'
    ) >= 1
  ) then 'contributor'

  when (
    -- builder: 1+ challenge + 1+ approved project membership
    (
      select count(*) from public.challenge_completions
      where profile_id = profiles.id
    ) >= 1
    and (
      select count(distinct project_id)
      from public.project_members
      where profile_id = profiles.id
        and role in ('owner', 'contributor')
        and status = 'active'
    ) >= 1
  ) then 'builder'

  else 'explorer'
end;
