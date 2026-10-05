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
  v_review_id uuid;
  v_next_status text;
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
    return jsonb_build_object(
      'submission_id', p_submission_id,
      'status', 'approved',
      'idempotent', true
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
      'idempotent', true
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
  where assignment_id = v_item.assignment_id and member_id = v_item.member_id;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    'build_submission_' || p_decision,
    'build_submission',
    p_submission_id,
    jsonb_build_object('assignment_id', v_item.assignment_id, 'member_id', v_item.member_id)
  );
  return jsonb_build_object(
    'submission_id', p_submission_id,
    'review_id', v_review_id,
    'status', v_next_status,
    'idempotent', false
  );
end;
$$;
