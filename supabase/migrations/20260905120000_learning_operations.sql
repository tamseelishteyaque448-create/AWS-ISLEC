-- Close the learning/challenge operating loop without moving reward authority
-- out of the existing completion RPC.
create table public.challenge_completion_badges (
  completion_id uuid not null references public.challenge_completions (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete restrict,
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (completion_id, badge_id)
);

create index challenge_completion_badges_badge_id_idx
  on public.challenge_completion_badges (badge_id);

alter table public.challenge_completion_badges enable row level security;
revoke all on public.challenge_completion_badges from anon, authenticated;
grant select on public.challenge_completion_badges to authenticated;

create policy "Members can read their completion badge awards"
on public.challenge_completion_badges
for select to authenticated
using (exists (
  select 1 from public.challenge_completions as cc
  where cc.id = challenge_completion_badges.completion_id
    and cc.profile_id = (select auth.uid())
));

create policy "Admins can read challenge outcomes"
on public.challenge_completions
for select to authenticated
using ((select private.is_admin()));

create policy "Admins can read completion badge awards"
on public.challenge_completion_badges
for select to authenticated
using ((select private.is_admin()));

create policy "Admins can read member challenge progress"
on public.user_challenge_progress
for select to authenticated
using ((select private.is_admin()));

create or replace function public.get_admin_learning_outcome_summary()
returns table (
  completion_count bigint,
  member_count bigint,
  challenge_points_awarded bigint,
  badge_award_count bigint,
  badge_points_recorded bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  return query select
    (select count(*) from public.challenge_completions),
    (select count(distinct profile_id) from public.challenge_completions),
    (select coalesce(sum(points_awarded), 0) from public.challenge_completions),
    (select count(*) from public.challenge_completion_badges),
    (select coalesce(sum(points_awarded), 0) from public.challenge_completion_badges);
end;
$$;

revoke all on function public.get_admin_learning_outcome_summary() from public, anon, authenticated;
grant execute on function public.get_admin_learning_outcome_summary() to authenticated;

-- Catalogue changes are recorded at the database boundary, including future
-- trusted admin clients that do not use today's Server Actions.
create or replace function public.audit_admin_catalogue_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      auth.uid(),
      lower(tg_table_name) || '.' || lower(tg_op),
      case when tg_table_name = 'learning_paths' then 'learning_path' else 'challenge' end,
      new.id,
      jsonb_build_object('published', new.is_published)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.audit_admin_catalogue_change() from public, anon, authenticated;

create trigger learning_paths_audit_admin_change
after insert or update on public.learning_paths
for each row execute function public.audit_admin_catalogue_change();

create trigger challenges_audit_admin_change
after insert or update on public.challenges
for each row execute function public.audit_admin_catalogue_change();

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

  select * into v_profile from public.profiles where id = v_profile_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Member profile not found';
  end if;

  select c.* into v_challenge
  from public.challenges as c
  join public.learning_paths as lp on lp.id = c.learning_path_id
  where c.id = p_challenge_id and c.is_published and lp.is_published
  for update of c, lp;
  if not found then
    raise exception using errcode = 'P0002', message = 'Published challenge not found';
  end if;

  select id into v_completion_id from public.challenge_completions
  where profile_id = v_profile_id and challenge_id = p_challenge_id for update;
  if found then
    return jsonb_build_object('status', 'already_completed', 'challenge_id', p_challenge_id, 'points_awarded', 0, 'total_points', v_profile.points, 'streak', v_profile.streak, 'new_badges', '[]'::jsonb);
  end if;

  select * into v_progress from public.user_challenge_progress
  where profile_id = v_profile_id and challenge_id = p_challenge_id for update;
  v_has_progress := found;
  if v_has_progress and v_progress.status = 'completed' then
    return jsonb_build_object('status', 'already_completed', 'challenge_id', p_challenge_id, 'points_awarded', 0, 'total_points', v_profile.points, 'streak', v_profile.streak, 'new_badges', '[]'::jsonb);
  end if;

  v_activity_key := 'challenge-completed-' || v_profile_id::text || '-' || p_challenge_id::text;
  insert into public.challenge_completions (profile_id, challenge_id, points_awarded, activity_key, completed_at, created_at)
  values (v_profile_id, p_challenge_id, v_challenge.points, v_activity_key, v_now, v_now)
  on conflict (profile_id, challenge_id) do nothing returning id into v_completion_id;
  if v_completion_id is null then
    return jsonb_build_object('status', 'already_completed', 'challenge_id', p_challenge_id, 'points_awarded', 0, 'total_points', v_profile.points, 'streak', v_profile.streak, 'new_badges', '[]'::jsonb);
  end if;

  if v_has_progress then
    update public.user_challenge_progress set status = 'completed', progress = 100, started_at = coalesce(v_progress.started_at, v_now), completed_at = v_now
    where profile_id = v_profile_id and challenge_id = p_challenge_id;
  else
    insert into public.user_challenge_progress (profile_id, challenge_id, status, progress, started_at, completed_at, created_at, updated_at)
    values (v_profile_id, p_challenge_id, 'completed', 100, v_now, v_now, v_now, v_now);
  end if;

  if v_profile.streak_last_date is null then v_streak := v_profile.streak;
  elsif v_profile.streak_last_date = v_today then v_streak := v_profile.streak;
  elsif v_profile.streak_last_date = v_today - 1 then v_streak := v_profile.streak + 1;
  else v_streak := 1;
  end if;

  v_total_points := v_profile.points + v_challenge.points;
  for v_badge in select * from public.badges where requirement_type is not null and requirement_value is not null loop
    v_requirement_met := case v_badge.requirement_type
      when 'challenge_count' then (select count(*) >= v_badge.requirement_value from public.challenge_completions where profile_id = v_profile_id)
      when 'streak' then v_streak >= v_badge.requirement_value
      when 'points' then v_total_points >= v_badge.requirement_value
      else false
    end;
    if v_requirement_met then
      insert into public.user_badges (profile_id, badge_id, earned_at)
      values (v_profile_id, v_badge.id, v_now)
      on conflict (profile_id, badge_id) do nothing returning badge_id into v_inserted_badge_id;
      if v_inserted_badge_id is not null then
        insert into public.challenge_completion_badges (completion_id, badge_id, points_awarded, created_at)
        values (v_completion_id, v_badge.id, v_badge.points, v_now);
        v_badge_reward_points := v_badge_reward_points + v_badge.points;
        v_new_badges := v_new_badges || jsonb_build_array(jsonb_build_object('id', v_badge.id, 'slug', v_badge.slug, 'title', v_badge.title, 'points', v_badge.points));
      end if;
    end if;
  end loop;

  v_total_points := v_total_points + v_badge_reward_points;
  update public.profiles set points = v_total_points, streak = v_streak, streak_last_date = v_today where id = v_profile_id;
  insert into public.activities (activity_key, profile_id, activity_type, title, detail, points, occurred_at, learning_path_id)
  values (v_activity_key, v_profile_id, 'challenge', v_challenge.title, 'Challenge completed', v_challenge.points, v_now, v_challenge.learning_path_id);
  return jsonb_build_object('status', 'completed', 'challenge_id', p_challenge_id, 'points_awarded', v_challenge.points + v_badge_reward_points, 'total_points', v_total_points, 'streak', v_streak, 'new_badges', v_new_badges);
end;
$function$;

revoke all on function public.complete_challenge(uuid) from public, anon, authenticated;
grant execute on function public.complete_challenge(uuid) to authenticated;
