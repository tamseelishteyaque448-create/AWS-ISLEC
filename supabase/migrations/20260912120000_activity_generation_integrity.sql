-- Activity Generation Integrity
--
-- Phase 3: Closes the cross-domain activity generation gaps identified in the
-- Phase 2 admin activity audit.
--
-- GAPS CLOSED:
--   1. create_project_v1      → 'project' activity when a new project is created
--   2. resolve_project_join_request (approve) → 'project' activity when a member joins
--   3. register_for_event     → 'event' activity when a member registers
--   4. record_event_attendance → 'event' activity when attendance is recorded
--   5. complete_challenge (badge path) → 'badge' activity for each badge earned
--
-- ACTIVITY KEYS (all unique to prevent duplicates):
--   project-created-<profile_id>-<project_id>
--   project-joined-<profile_id>-<project_id>
--   event-registered-<profile_id>-<event_id>
--   event-attended-<profile_id>-<event_id>
--   badge-earned-<profile_id>-<badge_id>
--
-- IDEMPOTENCY:
--   Every INSERT uses ON CONFLICT (activity_key) DO NOTHING.
--   The activities.activity_key column has a UNIQUE constraint.
--   Repeated calls produce exactly one activity record.
--
-- TRANSACTIONAL SAFETY:
--   Each activity INSERT occurs inside the same SECURITY DEFINER transaction
--   as the authoritative domain state mutation. A failure in either rolls back
--   the whole transaction.
--
-- SECURITY:
--   All modified functions retain SECURITY DEFINER + set search_path = ''.
--   All objects are schema-qualified.
--   No new grants are introduced.
--   Direct member INSERT/UPDATE/DELETE on activities remains blocked.
--
-- LESSON ACTIVITY:
--   The 'lesson' activity_type is reserved in the constraint but no lesson-
--   completion domain action exists. It is documented here as unused/reserved
--   and is NOT implemented.
--
-- BADGE ACTIVITY NOTE:
--   Badge activity is generated inside complete_challenge(), not as a
--   separate trigger. This preserves the single-transaction guarantee and
--   avoids any risk of double-awarding.
--
-- CANCELLATION ACTIVITY:
--   Event cancellation does NOT generate activity. Cancellation is a reversal
--   of intent, not a meaningful positive community action.
--
-- JOIN REQUEST ACTIVITY:
--   A join request alone does NOT generate activity. Only the approval
--   (when the member's status becomes 'active') generates a 'project' activity.
--   Declined requests do not generate activity.

-- ============================================================
-- 1. create_project_v1 — add project-created activity
-- ============================================================

create or replace function public.create_project_v1(
  p_title text,
  p_slug text,
  p_category text,
  p_description text,
  p_technologies text[],
  p_recruitment_mode text default 'open',
  p_team_capacity integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid := gen_random_uuid();
  v_actor uuid := auth.uid();
  v_now  timestamptz := timezone('utc', now());
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_title !~ '\S'
    or char_length(trim(p_title)) > 160
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_category !~ '\S'
    or char_length(trim(p_category)) > 80
    or char_length(coalesce(p_description, '')) > 2000
    or p_recruitment_mode not in ('open', 'invite_only', 'not_recruiting')
    or (p_team_capacity is not null and p_team_capacity < 1)
  then
    raise exception using errcode = '22023', message = 'Invalid project input';
  end if;

  insert into public.projects (
    id, title, slug, category, description, technologies,
    created_by, publication_state, build_stage, recruitment_mode, team_capacity
  )
  values (
    v_id, trim(p_title), p_slug, trim(p_category),
    coalesce(trim(p_description), ''), coalesce(p_technologies, '{}'),
    v_actor, 'draft', 'idea', p_recruitment_mode, p_team_capacity
  );

  insert into public.project_members (project_id, profile_id, role, status)
  values (v_id, v_actor, 'owner', 'active');

  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id
  )
  values (
    'project-created-' || v_actor::text || '-' || v_id::text,
    v_actor,
    'project',
    trim(p_title),
    'Project created',
    0,
    v_now,
    v_id
  )
  on conflict (activity_key) do nothing;

  return jsonb_build_object('project_id', v_id, 'slug', p_slug);
end;
$$;

-- ============================================================
-- 2. resolve_project_join_request — add project-joined activity on approval
-- ============================================================

create or replace function public.resolve_project_join_request(
  p_request_id uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.project_join_requests%rowtype;
  v_project public.projects%rowtype;
  v_actor   uuid := auth.uid();
  v_active  integer;
  v_now     timestamptz := timezone('utc', now());
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

    -- Activity for the member who was approved (not the approver)
    insert into public.activities (
      activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id
    )
    values (
      'project-joined-' || v_request.profile_id::text || '-' || v_request.project_id::text,
      v_request.profile_id,
      'project',
      v_project.title,
      'Joined project',
      0,
      v_now,
      v_request.project_id
    )
    on conflict (activity_key) do nothing;

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
-- 3. register_for_event — add event-registered activity
-- ============================================================

create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id      uuid := auth.uid();
  v_event           public.events%rowtype;
  v_attendee        public.event_attendees%rowtype;
  v_registered_count integer;
  v_now             timestamptz := timezone('utc', now());
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or not v_event.is_published
    or v_event.status <> 'upcoming'
    or v_event.starts_at <= v_now
  then
    raise exception using errcode = 'P0002', message = 'This event is not open for registration';
  end if;

  select * into v_attendee
  from public.event_attendees
  where event_id = p_event_id and profile_id = v_profile_id
  for update;

  if found and v_attendee.status in ('registered', 'attended') then
    return jsonb_build_object(
      'status', 'already_registered',
      'event_id', p_event_id,
      'attendance_status', v_attendee.status
    );
  end if;

  if v_event.capacity is not null then
    select count(*) into v_registered_count
    from public.event_attendees
    where event_id = p_event_id and status in ('registered', 'attended');
    if v_registered_count >= v_event.capacity then
      raise exception using errcode = 'P0001', message = 'This event is at capacity';
    end if;
  end if;

  if found then
    update public.event_attendees
    set status = 'registered', registered_at = v_now
    where event_id = p_event_id and profile_id = v_profile_id;
  else
    insert into public.event_attendees (event_id, profile_id, status, registered_at, updated_at)
    values (p_event_id, v_profile_id, 'registered', v_now, v_now);
  end if;

  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, event_id
  )
  values (
    'event-registered-' || v_profile_id::text || '-' || p_event_id::text,
    v_profile_id,
    'event',
    v_event.title,
    'Registered for event',
    0,
    v_now,
    p_event_id
  )
  on conflict (activity_key) do nothing;

  return jsonb_build_object(
    'status', 'registered',
    'event_id', p_event_id,
    'attendance_status', 'registered'
  );
end;
$$;

-- ============================================================
-- 4. record_event_attendance — add event-attended activity
-- ============================================================

create or replace function public.record_event_attendance(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event   public.events%rowtype;
  v_attendee public.event_attendees%rowtype;
  v_now     timestamptz := timezone('utc', now());
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

  -- Activity belongs to the attendee (p_profile_id), not the admin recording it
  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, event_id
  )
  values (
    'event-attended-' || p_profile_id::text || '-' || p_event_id::text,
    p_profile_id,
    'event',
    v_event.title,
    'Attended event',
    0,
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
-- 5. complete_challenge — add badge-earned activity for each new badge
-- ============================================================
-- This replaces the existing complete_challenge function and is authoritative.
-- The only change from the previous version (20260908140000) is:
--   a. badge INSERT now writes challenge_completion_badges (was already in
--      20260908140000 but NOT in 20260905120000 — the remote has the newer one)
--   b. a 'badge' activity is inserted for each newly awarded badge
-- All other logic (points, streak, challenge activity) is preserved exactly.

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

        -- Badge activity — one record per newly earned badge, idempotent
        insert into public.activities (
          activity_key, profile_id, activity_type, title, detail, points, occurred_at, badge_id
        )
        values (
          'badge-earned-' || v_profile_id::text || '-' || v_badge.id::text,
          v_profile_id,
          'badge',
          v_badge.title,
          'Badge earned',
          v_badge.points,
          v_now,
          v_badge.id
        )
        on conflict (activity_key) do nothing;
      end if;
    end if;
  end loop;

  v_total_points := v_total_points + v_badge_reward_points;
  update public.profiles
  set points = v_total_points, streak = v_streak, streak_last_date = v_today
  where id = v_profile_id;

  -- Challenge activity (unchanged from existing behaviour)
  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, learning_path_id
  )
  values (
    v_activity_key, v_profile_id, 'challenge',
    v_challenge.title, 'Challenge completed', v_challenge.points, v_now,
    v_challenge.learning_path_id
  );

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
