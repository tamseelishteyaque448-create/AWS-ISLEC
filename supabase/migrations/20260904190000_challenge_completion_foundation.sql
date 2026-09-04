alter table public.profiles
  add column if not exists streak_last_date date;

alter table public.activities
  drop constraint if exists activities_activity_type_check;

alter table public.activities
  add constraint activities_activity_type_check
  check (activity_type in ('project', 'lesson', 'badge', 'event', 'challenge'));

create table public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete restrict,
  points_awarded integer not null check (points_awarded >= 0),
  activity_key text not null unique check (activity_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, challenge_id)
);

create index challenge_completions_profile_completed_at_idx
  on public.challenge_completions (profile_id, completed_at desc);

create index challenge_completions_challenge_id_idx
  on public.challenge_completions (challenge_id);

alter table public.challenge_completions enable row level security;

revoke all on public.challenge_completions from anon, authenticated;
grant select on public.challenge_completions to authenticated;

create policy "Members can read their challenge completions"
on public.challenge_completions
for select to authenticated
using ((select auth.uid()) = profile_id);

revoke insert, update, delete on public.user_challenge_progress from authenticated;

drop policy if exists "Members can start their challenge progress" on public.user_challenge_progress;
drop policy if exists "Members can update their challenge progress" on public.user_challenge_progress;
drop policy if exists "Members can delete their challenge progress" on public.user_challenge_progress;

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
  v_completion_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_today date := (timezone('UTC', now()))::date;
  v_activity_key text;
  v_streak integer;
  v_has_progress boolean;
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_profile_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Member profile not found';
  end if;

  select c.*
  into v_challenge
  from public.challenges as c
  join public.learning_paths as lp on lp.id = c.learning_path_id
  where c.id = p_challenge_id
    and c.is_published
    and lp.is_published
  for update of c, lp;

  if not found then
    raise exception using errcode = 'P0002', message = 'Published challenge not found';
  end if;

  select id
  into v_completion_id
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
      'streak', v_profile.streak
    );
  end if;

  select *
  into v_progress
  from public.user_challenge_progress
  where profile_id = v_profile_id
    and challenge_id = p_challenge_id
  for update;

  v_has_progress := found;

  -- Completed progress that predates the reward ledger is legacy state.
  -- It is intentionally acknowledged without receiving retroactive points.
  if v_has_progress and v_progress.status = 'completed' then
    return jsonb_build_object(
      'status', 'already_completed',
      'challenge_id', p_challenge_id,
      'points_awarded', 0,
      'total_points', v_profile.points,
      'streak', v_profile.streak
    );
  end if;

  v_activity_key := 'challenge-completed-' || v_profile_id::text || '-' || p_challenge_id::text;

  insert into public.challenge_completions (
    profile_id,
    challenge_id,
    points_awarded,
    activity_key,
    completed_at,
    created_at
  )
  values (
    v_profile_id,
    p_challenge_id,
    v_challenge.points,
    v_activity_key,
    v_now,
    v_now
  )
  on conflict (profile_id, challenge_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    return jsonb_build_object(
      'status', 'already_completed',
      'challenge_id', p_challenge_id,
      'points_awarded', 0,
      'total_points', v_profile.points,
      'streak', v_profile.streak
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
      profile_id,
      challenge_id,
      status,
      progress,
      started_at,
      completed_at,
      created_at,
      updated_at
    )
    values (
      v_profile_id,
      p_challenge_id,
      'completed',
      100,
      v_now,
      v_now,
      v_now,
      v_now
    );
  end if;

  if v_profile.streak_last_date = v_today then
    v_streak := v_profile.streak;
  elsif v_profile.streak_last_date = v_today - 1 then
    v_streak := v_profile.streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
  set points = points + v_challenge.points,
      streak = v_streak,
      streak_last_date = v_today
  where id = v_profile_id;

  insert into public.activities (
    activity_key,
    profile_id,
    activity_type,
    title,
    detail,
    points,
    occurred_at,
    learning_path_id
  )
  values (
    v_activity_key,
    v_profile_id,
    'challenge',
    v_challenge.title,
    'Challenge completed',
    v_challenge.points,
    v_now,
    v_challenge.learning_path_id
  );

  return jsonb_build_object(
    'status', 'completed',
    'challenge_id', p_challenge_id,
    'points_awarded', v_challenge.points,
    'total_points', v_profile.points + v_challenge.points,
    'streak', v_streak
  );
end;
$function$;

revoke all on function public.complete_challenge(uuid) from public, anon, authenticated;
grant execute on function public.complete_challenge(uuid) to authenticated;