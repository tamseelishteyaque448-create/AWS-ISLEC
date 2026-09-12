-- Admin Analytics V1
--
-- Provides a single, admin-only read function that aggregates community
-- intelligence from authoritative sources. All sub-queries are read-only;
-- no data is written or modified.
--
-- Authoritative sources:
--   profiles             → member counts, points distribution, streak
--   activities           → activity type breakdown (last 30 days)
--   challenge_completions → completion totals
--   challenge_completion_badges → badge award totals
--   events               → event counts and status
--   event_attendees      → registration totals
--   projects             → project pipeline by build_stage
--
-- Security: SECURITY DEFINER with pinned search_path = '' ensures this
-- function runs under the definer's privileges with no schema injection
-- surface. The is_admin() check is the first executed statement.

create or replace function public.get_admin_analytics_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz := timezone('utc', now()) - interval '30 days';
  v_now          timestamptz := timezone('utc', now());
  v_result       jsonb;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select jsonb_build_object(
    -- -----------------------------------------------------------------------
    -- Community health
    -- -----------------------------------------------------------------------
    'member_count',
      (select count(*) from public.profiles),

    'active_member_count',
      (select count(distinct profile_id)
       from public.activities
       where occurred_at >= v_window_start),

    'total_points_awarded',
      (select coalesce(sum(points), 0) from public.profiles),

    'avg_points_per_member',
      (select case when count(*) = 0 then 0
              else round(avg(points))
              end
       from public.profiles),

    'max_streak',
      (select coalesce(max(streak), 0) from public.profiles),

    -- -----------------------------------------------------------------------
    -- Learning outcomes (mirrors get_admin_learning_outcome_summary)
    -- -----------------------------------------------------------------------
    'completion_count',
      (select count(*) from public.challenge_completions),

    'distinct_completers',
      (select count(distinct profile_id) from public.challenge_completions),

    'challenge_points_awarded',
      (select coalesce(sum(points_awarded), 0) from public.challenge_completions),

    'badge_award_count',
      (select count(*) from public.challenge_completion_badges),

    'badge_points_recorded',
      (select coalesce(sum(points_awarded), 0) from public.challenge_completion_badges),

    -- -----------------------------------------------------------------------
    -- Event engagement
    -- -----------------------------------------------------------------------
    'total_event_count',
      (select count(*) from public.events where is_published),

    'upcoming_event_count',
      (select count(*) from public.events
       where status = 'upcoming' and starts_at > v_now and is_published),

    'total_registrations',
      (select count(*) from public.event_attendees),

    'recent_registrations',
      (select count(*) from public.event_attendees
       where registered_at >= v_window_start),

    -- -----------------------------------------------------------------------
    -- Project pipeline
    -- -----------------------------------------------------------------------
    'published_project_count',
      (select count(*) from public.projects
       where publication_state = 'published'),

    'projects_by_stage',
      (select jsonb_object_agg(build_stage, cnt)
       from (
         select build_stage, count(*) as cnt
         from public.projects
         where publication_state = 'published'
         group by build_stage
       ) s),

    'open_recruitment_count',
      (select count(*) from public.projects
       where publication_state = 'published'
         and recruitment_mode = 'open'
         and build_stage <> 'shipped'),

    'pending_review_count',
      (select count(*) from public.projects
       where publication_state = 'pending_review'),

    -- -----------------------------------------------------------------------
    -- Activity breakdown (last 30 days)
    -- -----------------------------------------------------------------------
    'recent_activity_count',
      (select count(*) from public.activities
       where occurred_at >= v_window_start),

    'activity_breakdown',
      (select jsonb_object_agg(activity_type, cnt)
       from (
         select activity_type, count(*) as cnt
         from public.activities
         where occurred_at >= v_window_start
         group by activity_type
       ) a),

    -- -----------------------------------------------------------------------
    -- Top members by points (up to 5)
    -- -----------------------------------------------------------------------
    'top_members',
      (select jsonb_agg(jsonb_build_object(
         'id',         id,
         'full_name',  full_name,
         'handle',     handle,
         'points',     points,
         'streak',     streak
       ) order by points desc, created_at asc)
       from (
         select id, full_name, handle, points, streak, created_at
         from public.profiles
         order by points desc, created_at asc
         limit 5
       ) t)

  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_analytics_v1() from public, anon, authenticated;
grant execute on function public.get_admin_analytics_v1() to authenticated;
