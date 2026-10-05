create or replace function public.award_build_submission_reward(p_work_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.build_assignment_members%rowtype;
  v_submission public.build_submissions%rowtype;
  v_reward public.build_submission_rewards%rowtype;
  v_activity_key text;
  v_now timestamptz := timezone('utc', now());
  v_total_points integer;
begin
  if v_actor is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select * into v_item
  from public.build_assignment_members
  where id = p_work_item_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;
  if v_item.status <> 'approved' then
    raise exception using errcode = 'PT409', message = 'Build work item is not approved';
  end if;

  select * into v_submission
  from public.build_submissions
  where work_item_id = v_item.id
  order by revision_number desc
  limit 1;
  if not found or not exists (
    select 1
    from public.build_submission_reviews r
    where r.work_item_id = v_item.id
      and r.submission_id = v_submission.id
      and r.decision = 'approved'
  ) then
    raise exception using errcode = 'PT409', message = 'Latest submission has no approval';
  end if;

  v_activity_key := 'build-prove-approved-' || v_item.id::text;
  select * into v_reward
  from public.build_submission_rewards
  where work_item_id = v_item.id;
  if found then
    if v_reward.submission_id <> v_submission.id
      or v_reward.profile_id <> v_item.member_id
      or v_reward.points_awarded <> v_item.reward_points_snapshot
      or v_reward.activity_key <> v_activity_key then
      raise exception using errcode = 'P0001', message = 'Existing Build & Prove reward does not match its approved work item';
    end if;
    return jsonb_build_object(
      'work_item_id', v_item.id,
      'submission_id', v_submission.id,
      'reward_id', v_reward.id,
      'activity_key', v_reward.activity_key,
      'status', 'already_awarded',
      'idempotent', true,
      'points_awarded', v_reward.points_awarded
    );
  end if;

  insert into public.build_submission_rewards(
    work_item_id, submission_id, profile_id, points_awarded, activity_key, awarded_by, awarded_at
  ) values (
    v_item.id, v_submission.id, v_item.member_id, v_item.reward_points_snapshot,
    v_activity_key, v_actor, v_now
  ) returning * into v_reward;

  update public.profiles
  set points = points + v_item.reward_points_snapshot
  where id = v_item.member_id
  returning points into v_total_points;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build member profile not found';
  end if;

  insert into public.activities(
    activity_key, profile_id, activity_type, title, detail, points, occurred_at,
    build_assignment_member_id
  ) values (
    v_activity_key, v_item.member_id, 'build_prove', v_submission.project_title,
    'Approved Build & Prove submission', v_item.reward_points_snapshot, v_now, v_item.id
  );

  perform public.advance_member_stage(v_item.member_id);

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (
    v_actor, 'build_submission_reward_awarded', 'build_assignment_member', v_item.id,
    jsonb_build_object(
      'submission_id', v_submission.id,
      'member_id', v_item.member_id,
      'points_awarded', v_item.reward_points_snapshot,
      'activity_key', v_activity_key
    )
  );

  return jsonb_build_object(
    'work_item_id', v_item.id,
    'submission_id', v_submission.id,
    'reward_id', v_reward.id,
    'activity_key', v_activity_key,
    'status', 'awarded',
    'idempotent', false,
    'points_awarded', v_item.reward_points_snapshot,
    'total_points', v_total_points
  );
end;
$$;

revoke all on function public.award_build_submission_reward(uuid) from public, anon;
grant execute on function public.award_build_submission_reward(uuid) to authenticated;

create or replace function public.review_build_submission(
  p_submission_id uuid,
  p_decision text,
  p_feedback text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_submission public.build_submissions%rowtype;
  v_item public.build_assignment_members%rowtype;
  v_reward public.build_submission_rewards%rowtype;
  v_reward_result jsonb;
  v_review_id uuid;
  v_next_status text;
  v_reward_status text := 'not_applicable';
  v_points_awarded integer := 0;
begin
  if v_actor is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if p_decision is null or p_decision not in ('approved', 'changes_requested')
    or char_length(trim(coalesce(p_feedback, ''))) > 2000
    or (p_decision = 'changes_requested' and char_length(trim(coalesce(p_feedback, ''))) = 0) then
    raise exception using errcode = '22023', message = 'Invalid build review';
  end if;

  select * into v_submission
  from public.build_submissions
  where id = p_submission_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build submission not found';
  end if;
  select * into v_item
  from public.build_assignment_members
  where id = v_submission.work_item_id
    and member_id = v_submission.member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;

  if v_item.status = 'approved' and p_decision = 'approved'
    and exists (
      select 1 from public.build_submission_reviews r
      where r.submission_id = p_submission_id and r.decision = 'approved'
    ) then
    select * into v_reward
    from public.build_submission_rewards
    where work_item_id = v_item.id;
    return jsonb_build_object(
      'submission_id', p_submission_id,
      'status', 'approved',
      'idempotent', true,
      'reward_status', case when v_reward.id is null then 'not_awarded' else 'already_awarded' end,
      'points_awarded', coalesce(v_reward.points_awarded, 0)
    );
  end if;
  if v_item.status = 'changes_requested' and p_decision = 'changes_requested'
    and exists (
      select 1 from public.build_submission_reviews r
      where r.submission_id = p_submission_id and r.decision = 'changes_requested'
    ) then
    return jsonb_build_object(
      'submission_id', p_submission_id,
      'status', 'changes_requested',
      'idempotent', true,
      'reward_status', 'not_applicable',
      'points_awarded', 0
    );
  end if;
  if v_item.status not in ('submitted', 'resubmitted') then
    raise exception using errcode = 'PT409', message = 'Build work item is not awaiting review';
  end if;
  if not exists (
    select 1
    from public.build_submissions latest
    where latest.work_item_id = v_submission.work_item_id
      and latest.id = p_submission_id
      and latest.revision_number = (
        select max(s.revision_number)
        from public.build_submissions s
        where s.work_item_id = v_submission.work_item_id
      )
  ) then
    raise exception using errcode = 'PT409', message = 'Only the latest revision can be reviewed';
  end if;

  v_next_status := p_decision;
  insert into public.build_submission_reviews(
    submission_id, work_item_id, reviewer_id, decision, feedback
  ) values (
    p_submission_id, v_submission.work_item_id, v_actor, p_decision, trim(coalesce(p_feedback, ''))
  ) returning id into v_review_id;

  update public.build_assignment_members
  set status = v_next_status, updated_at = timezone('utc', now())
  where id = v_item.id;

  if p_decision = 'approved' then
    v_reward_result := public.award_build_submission_reward(v_item.id);
    v_reward_status := v_reward_result->>'status';
    v_points_awarded := (v_reward_result->>'points_awarded')::integer;
  end if;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    'build_submission_' || p_decision,
    'build_submission',
    p_submission_id,
    jsonb_build_object(
      'assignment_id', v_item.assignment_id,
      'member_id', v_item.member_id,
      'points_awarded', v_points_awarded
    )
  );
  return jsonb_build_object(
    'submission_id', p_submission_id,
    'review_id', v_review_id,
    'status', v_next_status,
    'idempotent', false,
    'reward_status', v_reward_status,
    'points_awarded', v_points_awarded
  );
end;
$$;

revoke all on function public.review_build_submission(uuid, text, text) from public, anon;
grant execute on function public.review_build_submission(uuid, text, text) to authenticated;
