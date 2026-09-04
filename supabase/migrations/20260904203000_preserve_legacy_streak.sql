create or replace function public.complete_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_challenge public.challenges%rowtype;
  v_progress public.user_challenge_progress%rowtype;
  v_badge public.badges%rowtype;
  v_completion_id uuid;
  v_inserted_badge_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_today date := (timezone('UTC', now()))::date;
  v_activity_key text;
  v_streak integer;
  v_total_points integer;
  v_badge_reward_points integer := 0;
  v_has_progress boolean;
  v_requirement_met boolean;
  v_new_badges jsonb := '[]'::jsonb;
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
  where profile_id = v_profile_id
    and challenge_id = p_challenge_id
  for update;

  if found then
    return jsonb_build_object(
      'status', 'already_completed',
      'challenge_id', p_challenge_id,
      'points_awarded', 0,
      'total_points', v_profile.points,
      'streak', v_profile.streak,
      'new_badges', '[]'::jsonb
    );
  end if;

  select * into v_progress
  from public.user_challenge_progress
  where profile_id = v_profile_id
    and challenge_id = p_challenge_id
  for update;

  v_has_progress := found;

  if v_has_progress and v_progress.status = 'completed' then
    return jsonb_build_object(
      'status', 'already_completed',
      'challenge_id', p_challenge_id,
      'points_awarded', 0,
      'total_points', v_profile.points,
      'streak', v_profile.streak,
      'new_badges', '[]'::jsonb
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
      'status', 'already_completed',
      'challenge_id', p_challenge_id,
      'points_awarded', 0,
      'total_points', v_profile.points,
      'streak', v_profile.streak,
      'new_badges', '[]'::jsonb
    );
  end if;

  if v_has_progress then
    update public.user_challenge_progress
    set status = 'completed',
        progress = 100,
        started_at = coalesce(v_progress.started_at, v_now),
        completed_at = v_now
    where profile_id = v_profile_id
      and challenge_id = p_challenge_id;
  else
    insert into public.user_challenge_progress (
      profile_id, challenge_id, status, progress, started_at, completed_at, created_at, updated_at
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
    where requirement_type is not null
      and requirement_value is not null
  loop
    v_requirement_met := case v_badge.requirement_type
      when 'challenge_count' then (
        select count(*) >= v_badge.requirement_value
        from public.challenge_completions
        where profile_id = v_profile_id
      )
      when 'streak' then v_streak >= v_badge.requirement_value
      when 'points' then v_total_points >= v_badge.requirement_value
      else false
    end;

    if v_requirement_met then
      insert into public.user_badges (profile_id, badge_id, earned_at)
      values (v_profile_id, v_badge.id, v_now)
      on conflict (profile_id, badge_id) do nothing
      returning badge_id into v_inserted_badge_id;

      if v_inserted_badge_id is not null then
        v_badge_reward_points := v_badge_reward_points + v_badge.points;
        v_new_badges := v_new_badges || jsonb_build_array(jsonb_build_object(
          'id', v_badge.id,
          'slug', v_badge.slug,
          'title', v_badge.title,
          'points', v_badge.points
        ));
      end if;
    end if;
  end loop;

  v_total_points := v_total_points + v_badge_reward_points;

  update public.profiles
  set points = v_total_points,
      streak = v_streak,
      streak_last_date = v_today
  where id = v_profile_id;

  insert into public.activities (
    activity_key, profile_id, activity_type, title, detail, points, occurred_at, learning_path_id
  )
  values (
    v_activity_key, v_profile_id, 'challenge', v_challenge.title, 'Challenge completed',
    v_challenge.points, v_now, v_challenge.learning_path_id
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

revoke all on function public.complete_challenge(uuid) from public, anon, authenticated;
grant execute on function public.complete_challenge(uuid) to authenticated;