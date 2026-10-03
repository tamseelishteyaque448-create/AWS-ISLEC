-- Build & Prove core workflow: per-member work items, immutable revisions,
-- append-only reviews, and caller-scoped authorization.

-- Preserve the first prototype schema and its history rather than deleting it.
alter table public.build_submission_reviews rename to build_submission_reviews_legacy_phase1;
alter table public.build_submission_evidence rename to build_submission_evidence_legacy_phase1;
alter table public.build_submission_rewards rename to build_submission_rewards_legacy_phase1;
alter table public.build_submissions rename to build_submissions_legacy_phase1;

revoke all on public.build_submission_reviews_legacy_phase1,
  public.build_submission_evidence_legacy_phase1,
  public.build_submission_rewards_legacy_phase1,
  public.build_submissions_legacy_phase1 from public, anon, authenticated;

alter table public.build_assignment_members rename column profile_id to member_id;
alter table public.build_assignment_members
  add column id uuid not null default gen_random_uuid(),
  add column status text not null default 'assigned',
  add column reward_points_snapshot integer not null default 0,
  add column updated_at timestamptz not null default timezone('utc', now()),
  add constraint build_assignment_members_id_key unique (id),
  add constraint build_assignment_members_id_member_key unique (id, member_id),
  add constraint build_assignment_members_status_check
    check (status in ('assigned', 'in_progress', 'submitted', 'changes_requested', 'resubmitted', 'approved', 'cancelled')),
  add constraint build_assignment_members_reward_snapshot_check
    check (reward_points_snapshot >= 0);

update public.build_assignment_members am
set reward_points_snapshot = a.reward_points,
    updated_at = timezone('utc', now())
from public.build_assignments a
where a.id = am.assignment_id
  and am.reward_points_snapshot = 0
  and a.reward_points > 0;

create table public.build_submissions (
  id uuid not null default gen_random_uuid(),
  work_item_id uuid not null references public.build_assignment_members(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  project_title text not null check (char_length(trim(project_title)) between 1 and 160),
  explanation text not null default '' check (char_length(explanation) <= 12000),
  approach text not null default '' check (char_length(approach) <= 12000),
  technologies text[] not null default '{}'::text[] check (cardinality(technologies) <= 25),
  challenges text not null default '' check (char_length(challenges) <= 4000),
  learnings text not null default '' check (char_length(learnings) <= 4000),
  future_improvements text not null default '' check (char_length(future_improvements) <= 4000),
  repository_url text check (repository_url is null or repository_url ~ '^https?://'),
  deployment_url text check (deployment_url is null or deployment_url ~ '^https?://'),
  demo_url text check (demo_url is null or demo_url ~ '^https?://'),
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint build_submissions_core_pkey primary key (id),
  constraint build_submissions_core_work_item_revision_key unique (work_item_id, revision_number),
  constraint build_submissions_core_id_work_item_key unique (id, work_item_id),
  constraint build_submissions_core_id_member_key unique (id, member_id),
  foreign key (work_item_id, member_id)
    references public.build_assignment_members(id, member_id) on delete restrict
);

create table public.build_submission_reviews (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null,
  work_item_id uuid not null references public.build_assignment_members(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('changes_requested', 'approved')),
  feedback text not null default '' check (char_length(trim(feedback)) <= 2000),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (submission_id, work_item_id)
    references public.build_submissions(id, work_item_id) on delete restrict,
  constraint build_submission_reviews_core_pkey primary key (id),
  check (decision <> 'changes_requested' or char_length(trim(feedback)) > 0)
);

create table public.build_submission_evidence (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null references public.build_submissions(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null check (storage_path like 'submissions/%'),
  content_type text not null check (char_length(trim(content_type)) between 1 and 120),
  file_size integer not null check (file_size between 1 and 10485760),
  caption text not null default '' check (char_length(trim(caption)) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  constraint build_submission_evidence_core_pkey primary key (id),
  constraint build_submission_evidence_core_storage_path_key unique (storage_path),
  foreign key (submission_id, owner_id)
    references public.build_submissions(id, member_id) on delete restrict
);

create table public.build_submission_rewards (
  id uuid not null default gen_random_uuid(),
  work_item_id uuid not null references public.build_assignment_members(id) on delete restrict,
  submission_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  points_awarded integer not null check (points_awarded >= 0),
  activity_key text not null unique check (activity_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  awarded_by uuid not null references public.profiles(id) on delete restrict,
  awarded_at timestamptz not null default timezone('utc', now()),
  constraint build_submission_rewards_core_pkey primary key (id),
  constraint build_submission_rewards_core_work_item_key unique (work_item_id),
  constraint build_submission_rewards_core_submission_key unique (submission_id),
  constraint build_submission_rewards_core_activity_key unique (activity_key),
  foreign key (submission_id, work_item_id)
    references public.build_submissions(id, work_item_id) on delete restrict,
  foreign key (work_item_id, profile_id)
    references public.build_assignment_members(id, member_id) on delete restrict
);

comment on table public.build_submissions is
  'Immutable submitted revision. One row per revision of a member work item.';
comment on table public.build_submission_reviews is
  'Append-only admin decision and feedback for one exact submitted revision.';
comment on table public.build_submission_rewards is
  'Future approval reward ledger; unique per member work item, not per revision.';
comment on column public.build_assignment_members.reward_points_snapshot is
  'Reward configured when this member work item is assigned; later task edits do not change it.';

-- Retain compatible prototype records as revision 1. Drafts and rejected
-- submissions remain preserved in the legacy tables, not exposed as workflow states.
insert into public.build_assignment_members (
  assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at
)
select s.assignment_id, s.member_id, a.created_by, s.created_at,
       case s.status
         when 'draft' then 'in_progress'
         when 'submitted' then 'submitted'
         when 'changes_requested' then 'changes_requested'
         when 'approved' then 'approved'
         when 'rejected' then 'cancelled'
       end,
       a.reward_points, timezone('utc', now())
from public.build_submissions_legacy_phase1 s
join public.build_assignments a on a.id = s.assignment_id
on conflict (assignment_id, member_id) do nothing;

update public.build_assignment_members am
set status = case s.status
      when 'draft' then 'in_progress'
      when 'submitted' then 'submitted'
      when 'changes_requested' then 'changes_requested'
      when 'approved' then 'approved'
      when 'rejected' then 'cancelled'
    end,
    reward_points_snapshot = greatest(am.reward_points_snapshot, a.reward_points),
    updated_at = timezone('utc', now())
from public.build_submissions_legacy_phase1 s
join public.build_assignments a on a.id = s.assignment_id
where am.assignment_id = s.assignment_id
  and am.member_id = s.member_id;

insert into public.build_submissions (
  id, work_item_id, member_id, revision_number, project_title, explanation, approach,
  technologies, challenges, learnings, future_improvements, repository_url, deployment_url,
  demo_url, submitted_at, created_at
)
select s.id, am.id, s.member_id, 1, coalesce(nullif(trim(s.project_title), ''), 'Legacy submission'),
       s.explanation, s.approach, s.technologies, s.challenges, s.learnings, s.future_improvements,
       s.repository_url, s.deployment_url, s.demo_url,
       coalesce(s.submitted_at, s.created_at), s.created_at
from public.build_submissions_legacy_phase1 s
join public.build_assignment_members am
  on am.assignment_id = s.assignment_id and am.member_id = s.member_id
where s.status in ('submitted', 'changes_requested', 'approved');

insert into public.build_submission_reviews (
  id, submission_id, work_item_id, reviewer_id, decision, feedback, created_at
)
select r.id, r.submission_id, am.id, r.reviewer_id, r.decision, r.feedback, r.created_at
from public.build_submission_reviews_legacy_phase1 r
join public.build_submissions_legacy_phase1 s on s.id = r.submission_id
join public.build_assignment_members am
  on am.assignment_id = s.assignment_id and am.member_id = s.member_id
where s.status in ('submitted', 'changes_requested', 'approved')
  and r.decision in ('approved', 'changes_requested');

insert into public.build_submission_evidence (
  id, submission_id, owner_id, storage_path, content_type, file_size, caption, created_at
)
select e.id, e.submission_id, e.owner_id, e.storage_path, e.content_type, e.file_size, e.caption, e.created_at
from public.build_submission_evidence_legacy_phase1 e
join public.build_submissions s on s.id = e.submission_id and s.member_id = e.owner_id;

insert into public.build_submission_rewards (
  id, work_item_id, submission_id, profile_id, points_awarded, activity_key, awarded_by, awarded_at
)
select r.id, s.work_item_id, s.id, r.profile_id, r.points_awarded, r.activity_key, r.awarded_by, r.awarded_at
from public.build_submission_rewards_legacy_phase1 r
join public.build_submissions s on s.id = r.submission_id and s.member_id = r.profile_id;

alter table public.activities
  add column build_assignment_member_id uuid
    references public.build_assignment_members(id) on delete set null;
alter table public.activities drop constraint if exists activities_one_domain_reference_check;
alter table public.activities add constraint activities_one_domain_reference_check
  check (num_nonnulls(project_id, learning_path_id, badge_id, event_id, build_submission_id, build_assignment_member_id) <= 1);
create unique index activities_build_work_item_reward_unique
  on public.activities(build_assignment_member_id)
  where build_assignment_member_id is not null;

create index build_assignment_members_member_status_idx
  on public.build_assignment_members(member_id, status, assigned_at desc);
create index build_submissions_work_item_revision_idx
  on public.build_submissions(work_item_id, revision_number desc);
create index build_submission_reviews_work_item_created_idx
  on public.build_submission_reviews(work_item_id, created_at desc);
create index build_submission_reviews_submission_idx
  on public.build_submission_reviews(submission_id, created_at desc);
create index build_submission_evidence_revision_created_idx
  on public.build_submission_evidence(submission_id, created_at desc);

create or replace function private.is_build_assignment_member(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.build_assignment_members am
    where am.assignment_id = p_assignment_id
      and am.member_id = auth.uid()
      and am.status <> 'cancelled'
  );
$$;
revoke all on function private.is_build_assignment_member(uuid) from public, anon, authenticated;
grant execute on function private.is_build_assignment_member(uuid) to authenticated;

create or replace function private.can_access_build_storage_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment_id uuid;
  v_submission_id uuid;
begin
  if v_actor is null or p_object_name is null then
    return false;
  end if;

  if p_object_name ~ '^assignments/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$' then
    v_assignment_id := split_part(p_object_name, '/', 2)::uuid;
    return exists (
      select 1
      from public.build_assignment_members am
      join public.build_assignments a on a.id = am.assignment_id
      where am.assignment_id = v_assignment_id
        and am.member_id = v_actor
        and am.status <> 'cancelled'
    );
  end if;

  if p_object_name ~ ('^submissions/' || v_actor::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$') then
    v_submission_id := split_part(p_object_name, '/', 3)::uuid;
    return exists (
      select 1
      from public.build_submission_evidence e
      join public.build_submissions s on s.id = e.submission_id
      join public.build_assignment_members am
        on am.id = s.work_item_id and am.member_id = s.member_id
      where e.submission_id = v_submission_id
        and e.owner_id = v_actor
        and am.member_id = v_actor
    );
  end if;

  return false;
end;
$$;
revoke all on function private.can_access_build_storage_object(text) from public, anon, authenticated;
grant execute on function private.can_access_build_storage_object(text) to authenticated;

drop policy if exists "Eligible members can read published build assignments" on public.build_assignments;
drop policy if exists "Eligible members can read build assignment attachments" on public.build_assignment_attachments;
drop function if exists private.can_access_build_assignment(uuid, uuid);

alter table public.build_assignments enable row level security;
alter table public.build_assignment_members enable row level security;
alter table public.build_submissions enable row level security;
alter table public.build_submission_reviews enable row level security;
alter table public.build_submission_evidence enable row level security;
alter table public.build_submission_rewards enable row level security;
alter table public.build_assignment_attachments enable row level security;

revoke all on public.build_assignments, public.build_assignment_members, public.build_submissions,
  public.build_submission_reviews, public.build_submission_evidence, public.build_submission_rewards,
  public.build_assignment_attachments from public, anon, authenticated;
grant select on public.build_assignments, public.build_assignment_members, public.build_submissions,
  public.build_submission_reviews, public.build_submission_evidence, public.build_submission_rewards,
  public.build_assignment_attachments to authenticated;

drop policy if exists "Eligible members can read published build assignments" on public.build_assignments;
drop policy if exists "Members can read published assignments" on public.build_assignments;
create policy "Assigned members and admins can read build assignments"
  on public.build_assignments for select to authenticated
  using ((select private.is_admin()) or (select private.is_build_assignment_member(id)));

drop policy if exists "Members can read their individual build assignments" on public.build_assignment_members;
create policy "Members and admins can read build work items"
  on public.build_assignment_members for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));

create policy "Members and admins can read build submissions"
  on public.build_submissions for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));

create policy "Members and admins can read build reviews"
  on public.build_submission_reviews for select to authenticated
  using ((select private.is_admin()) or exists (
    select 1 from public.build_submissions s
    where s.id = submission_id and s.member_id = (select auth.uid())
  ));

create policy "Members and admins can read build evidence"
  on public.build_submission_evidence for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));

create policy "Members and admins can read build rewards"
  on public.build_submission_rewards for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Eligible members can read build assignment attachments" on public.build_assignment_attachments;
create policy "Assigned members and admins can read build assignment attachments"
  on public.build_assignment_attachments for select to authenticated
  using ((select private.is_admin()) or (select private.is_build_assignment_member(assignment_id)));

-- Workflow rows are append-only. RPCs may change work-item state, but never an
-- existing submission revision or review.
create or replace function private.reject_build_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Build & Prove history is immutable';
end;
$$;
revoke all on function private.reject_build_history_mutation() from public, anon, authenticated;

create trigger build_submissions_immutable
  before update or delete on public.build_submissions
  for each row execute function private.reject_build_history_mutation();
create trigger build_submission_reviews_immutable
  before update or delete on public.build_submission_reviews
  for each row execute function private.reject_build_history_mutation();
create trigger build_submission_rewards_immutable
  before update or delete on public.build_submission_rewards
  for each row execute function private.reject_build_history_mutation();

create or replace function private.create_build_submission_revision(
  p_work_item_id uuid,
  p_expected_status text,
  p_next_status text,
  p_project_title text,
  p_explanation text,
  p_approach text,
  p_technologies text[],
  p_challenges text,
  p_learnings text,
  p_future_improvements text,
  p_repository_url text,
  p_deployment_url text,
  p_demo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.build_assignment_members%rowtype;
  v_revision integer;
  v_submission_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Work item access denied';
  end if;
  if p_expected_status is null or p_next_status is null
    or p_expected_status not in ('in_progress', 'changes_requested')
    or p_next_status not in ('submitted', 'resubmitted') then
    raise exception using errcode = '22023', message = 'Invalid submission transition';
  end if;
  if char_length(trim(coalesce(p_project_title, ''))) not between 1 and 160
    or char_length(coalesce(p_explanation, '')) > 12000
    or char_length(coalesce(p_approach, '')) > 12000
    or cardinality(coalesce(p_technologies, '{}'::text[])) > 25
    or char_length(coalesce(p_challenges, '')) > 4000
    or char_length(coalesce(p_learnings, '')) > 4000
    or char_length(coalesce(p_future_improvements, '')) > 4000
    or (p_repository_url is not null and p_repository_url !~ '^https?://')
    or (p_deployment_url is not null and p_deployment_url !~ '^https?://')
    or (p_demo_url is not null and p_demo_url !~ '^https?://') then
    raise exception using errcode = '22023', message = 'Invalid build submission';
  end if;

  select * into v_item
  from public.build_assignment_members am
  where am.id = p_work_item_id and am.member_id = v_actor
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;

  if v_item.status = p_next_status then
    select s.id, s.revision_number into v_submission_id, v_revision
    from public.build_submissions s
    where s.work_item_id = p_work_item_id
      and s.member_id = v_actor
    order by s.revision_number desc limit 1;
    if v_submission_id is not null and not exists (
      select 1 from public.build_submission_reviews r where r.submission_id = v_submission_id
    ) then
      return jsonb_build_object(
        'submission_id', v_submission_id, 'revision_number', v_revision,
        'status', p_next_status, 'idempotent', true
      );
    end if;
  end if;

  if v_item.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'Build work item is not in a submittable state';
  end if;
  if p_next_status = 'submitted' and exists (
    select 1 from public.build_submissions s where s.work_item_id = p_work_item_id
  ) then
    raise exception using errcode = '40001', message = 'Initial submission already exists';
  end if;
  if p_next_status = 'resubmitted' and not exists (
    select 1
    from public.build_submissions s
    join public.build_submission_reviews r on r.submission_id = s.id
    where s.work_item_id = p_work_item_id
      and r.decision = 'changes_requested'
      and s.revision_number = (
        select max(current_revision.revision_number)
        from public.build_submissions current_revision
        where current_revision.work_item_id = p_work_item_id
      )
  ) then
    raise exception using errcode = '40001', message = 'A changes-requested revision is required';
  end if;

  select coalesce(max(s.revision_number), 0) + 1 into v_revision
  from public.build_submissions s
  where s.work_item_id = p_work_item_id;

  insert into public.build_submissions (
    work_item_id, member_id, revision_number, project_title, explanation, approach,
    technologies, challenges, learnings, future_improvements, repository_url, deployment_url, demo_url
  ) values (
    p_work_item_id, v_actor, v_revision, trim(p_project_title),
    coalesce(p_explanation, ''), coalesce(p_approach, ''), coalesce(p_technologies, '{}'::text[]),
    coalesce(p_challenges, ''), coalesce(p_learnings, ''), coalesce(p_future_improvements, ''),
    nullif(p_repository_url, ''), nullif(p_deployment_url, ''), nullif(p_demo_url, '')
  ) returning id into v_submission_id;

  update public.build_assignment_members
  set status = p_next_status, updated_at = timezone('utc', now())
  where id = p_work_item_id;

  return jsonb_build_object(
    'submission_id', v_submission_id, 'revision_number', v_revision,
    'status', p_next_status, 'idempotent', false
  );
end;
$$;
revoke all on function private.create_build_submission_revision(uuid, text, text, text, text, text, text[], text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.save_build_assignment(
  p_assignment_id uuid default null, p_slug text default null, p_title text default null,
  p_summary text default '', p_objective text default '', p_difficulty text default 'easy',
  p_domain text default 'innovation_research', p_assignment_scope text default 'domain',
  p_publication_state text default 'draft', p_deadline_at timestamptz default null,
  p_priority text default 'normal', p_requirements jsonb default '[]'::jsonb,
  p_deliverables jsonb default '[]'::jsonb, p_submission_requirements jsonb default '[]'::jsonb,
  p_evaluation_criteria jsonb default '[]'::jsonb, p_reward_points integer default 0,
  p_sort_order integer default 0, p_member_ids uuid[] default '{}'::uuid[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_existing public.build_assignments%rowtype;
begin
  if v_actor is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(coalesce(p_title, ''))) not between 1 and 160
    or p_difficulty not in ('easy', 'medium', 'hard')
    or p_domain not in ('innovation_research', 'event_management', 'media_design', 'documentation')
    or p_assignment_scope not in ('domain', 'individual')
    or p_publication_state not in ('draft', 'published', 'archived')
    or p_priority not in ('low', 'normal', 'high', 'urgent')
    or p_reward_points not between 0 and 10000 or p_sort_order < 0
    or jsonb_typeof(coalesce(p_requirements, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_deliverables, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_submission_requirements, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_evaluation_criteria, '[]'::jsonb)) <> 'array'
    or cardinality(coalesce(p_member_ids, '{}'::uuid[])) <>
       (select count(distinct id) from unnest(coalesce(p_member_ids, '{}'::uuid[])) as ids(id)) then
    raise exception using errcode = '22023', message = 'Invalid build assignment';
  end if;

  if p_assignment_id is null then
    insert into public.build_assignments (
      slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state,
      deadline_at, priority, requirements, deliverables, submission_requirements,
      evaluation_criteria, reward_points, sort_order, created_by
    ) values (
      p_slug, trim(p_title), coalesce(p_summary, ''), coalesce(p_objective, ''), p_difficulty,
      p_domain, p_assignment_scope, p_publication_state, p_deadline_at, p_priority,
      coalesce(p_requirements, '[]'::jsonb), coalesce(p_deliverables, '[]'::jsonb),
      coalesce(p_submission_requirements, '[]'::jsonb), coalesce(p_evaluation_criteria, '[]'::jsonb),
      p_reward_points, p_sort_order, v_actor
    ) returning id into v_id;
  else
    select * into v_existing from public.build_assignments where id = p_assignment_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Build assignment not found';
    end if;
    if exists (
      select 1 from public.build_assignment_members am
      where am.assignment_id = p_assignment_id
    ) and (v_existing.domain <> p_domain or v_existing.assignment_scope <> p_assignment_scope) then
      raise exception using errcode = '40001', message = 'Cannot change assignment targeting after work has started';
    end if;
    update public.build_assignments
    set slug = p_slug, title = trim(p_title), summary = coalesce(p_summary, ''),
        objective = coalesce(p_objective, ''), difficulty = p_difficulty, domain = p_domain,
        assignment_scope = p_assignment_scope, publication_state = p_publication_state,
        deadline_at = p_deadline_at, priority = p_priority,
        requirements = coalesce(p_requirements, '[]'::jsonb),
        deliverables = coalesce(p_deliverables, '[]'::jsonb),
        submission_requirements = coalesce(p_submission_requirements, '[]'::jsonb),
        evaluation_criteria = coalesce(p_evaluation_criteria, '[]'::jsonb),
        reward_points = p_reward_points, sort_order = p_sort_order,
        updated_at = timezone('utc', now())
    where id = p_assignment_id
    returning id into v_id;
  end if;

  if cardinality(coalesce(p_member_ids, '{}'::uuid[])) > 0 then
    if p_publication_state <> 'published' then
      raise exception using errcode = '22023', message = 'Members can only be assigned to a published task';
    end if;
    if p_assignment_scope = 'domain' and exists (
      select 1 from unnest(p_member_ids) as ids(id)
      where not exists (
        select 1 from public.build_member_domains d where d.profile_id = ids.id and d.domain = p_domain
      )
    ) then
      raise exception using errcode = '22023', message = 'Every domain assignee must be assigned to that domain';
    end if;
    if exists (
      select 1 from unnest(p_member_ids) as ids(id)
      where not exists (select 1 from public.profiles p where p.id = ids.id)
    ) then
      raise exception using errcode = '22023', message = 'Every assignee must have a member profile';
    end if;
    insert into public.build_assignment_members (
      assignment_id, member_id, assigned_by, status, reward_points_snapshot
    )
    select v_id, ids.id, v_actor, 'assigned', p_reward_points
    from unnest(p_member_ids) as ids(id)
    on conflict (assignment_id, member_id) do nothing;
  end if;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (v_actor, case when p_assignment_id is null then 'build_assignment_created' else 'build_assignment_updated' end,
          'build_assignment', v_id, jsonb_build_object('publication_state', p_publication_state));
  return jsonb_build_object('assignment_id', v_id, 'publication_state', p_publication_state);
end;
$$;

create or replace function public.assign_build_member(p_assignment_id uuid, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_assignment public.build_assignments%rowtype;
  v_inserted uuid;
begin
  if v_actor is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  select * into v_assignment from public.build_assignments where id = p_assignment_id for update;
  if not found or v_assignment.publication_state <> 'published' then
    raise exception using errcode = 'P0002', message = 'Published build assignment not found';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_member_id) then
    raise exception using errcode = '22023', message = 'Member profile not found';
  end if;
  if v_assignment.assignment_scope = 'domain' and not exists (
    select 1 from public.build_member_domains d
    where d.profile_id = p_member_id and d.domain = v_assignment.domain
  ) then
    raise exception using errcode = '42501', message = 'Member is not assigned to this domain';
  end if;

  insert into public.build_assignment_members (
    assignment_id, member_id, assigned_by, status, reward_points_snapshot
  ) values (
    p_assignment_id, p_member_id, v_actor, 'assigned', v_assignment.reward_points
  )
  on conflict (assignment_id, member_id) do nothing
  returning member_id into v_inserted;

  if v_inserted is not null then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
    values (v_actor, 'build_member_assigned', 'build_assignment', p_assignment_id,
            jsonb_build_object('member_id', p_member_id));
  end if;
  return jsonb_build_object(
    'assignment_id', p_assignment_id, 'member_id', p_member_id,
    'created', v_inserted is not null
  );
end;
$$;

create or replace function public.start_build_assignment(p_work_item_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_item public.build_assignment_members%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Work item access denied';
  end if;
  select * into v_item from public.build_assignment_members
  where id = p_work_item_id and member_id = v_actor for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;
  if v_item.status = 'in_progress' then
    return jsonb_build_object('status', 'in_progress', 'idempotent', true);
  end if;
  if v_item.status <> 'assigned' then
    raise exception using errcode = '40001', message = 'Build work item cannot be started from its current state';
  end if;
  update public.build_assignment_members
  set status = 'in_progress', updated_at = timezone('utc', now())
  where id = p_work_item_id;
  return jsonb_build_object('status', 'in_progress', 'idempotent', false);
end;
$$;

create or replace function public.submit_build_work(
  p_work_item_id uuid, p_project_title text, p_explanation text,
  p_approach text, p_technologies text[] default '{}'::text[], p_challenges text default '',
  p_learnings text default '', p_future_improvements text default '',
  p_repository_url text default null, p_deployment_url text default null, p_demo_url text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.create_build_submission_revision(
    p_work_item_id, 'in_progress', 'submitted', p_project_title,
    p_explanation, p_approach, p_technologies, p_challenges, p_learnings,
    p_future_improvements, p_repository_url, p_deployment_url, p_demo_url
  );
end;
$$;

create or replace function public.resubmit_build_work(
  p_work_item_id uuid, p_project_title text, p_explanation text,
  p_approach text, p_technologies text[] default '{}'::text[], p_challenges text default '',
  p_learnings text default '', p_future_improvements text default '',
  p_repository_url text default null, p_deployment_url text default null, p_demo_url text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.create_build_submission_revision(
    p_work_item_id, 'changes_requested', 'resubmitted', p_project_title,
    p_explanation, p_approach, p_technologies, p_challenges, p_learnings,
    p_future_improvements, p_repository_url, p_deployment_url, p_demo_url
  );
end;
$$;

create or replace function public.review_build_submission(p_submission_id uuid, p_decision text, p_feedback text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  select * into v_submission from public.build_submissions where id = p_submission_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build submission not found';
  end if;
  select * into v_item from public.build_assignment_members
  where id = v_submission.work_item_id
    and member_id = v_submission.member_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;

  if v_item.status = 'approved' and p_decision = 'approved'
    and exists (select 1 from public.build_submission_reviews r
      where r.submission_id = p_submission_id and r.decision = 'approved') then
    return jsonb_build_object('submission_id', p_submission_id, 'status', 'approved', 'idempotent', true);
  end if;
  if v_item.status = 'changes_requested' and p_decision = 'changes_requested'
    and exists (select 1 from public.build_submission_reviews r
      where r.submission_id = p_submission_id and r.decision = 'changes_requested') then
    return jsonb_build_object('submission_id', p_submission_id, 'status', 'changes_requested', 'idempotent', true);
  end if;
  if v_item.status not in ('submitted', 'resubmitted') then
    raise exception using errcode = '40001', message = 'Build work item is not awaiting review';
  end if;
  if not exists (
    select 1 from public.build_submissions latest
    where latest.work_item_id = v_submission.work_item_id
      and latest.id = p_submission_id
      and latest.revision_number = (
        select max(s.revision_number) from public.build_submissions s
        where s.work_item_id = v_submission.work_item_id
      )
  ) then
    raise exception using errcode = '40001', message = 'Only the latest revision can be reviewed';
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
  values (v_actor, 'build_submission_' || p_decision, 'build_submission', p_submission_id,
          jsonb_build_object('assignment_id', v_item.assignment_id, 'member_id', v_item.member_id));
  return jsonb_build_object(
    'submission_id', p_submission_id, 'review_id', v_review_id,
    'status', v_next_status, 'idempotent', false
  );
end;
$$;

create or replace function public.cancel_build_work_item(p_work_item_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_item public.build_assignment_members%rowtype;
begin
  if v_actor is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  select * into v_item from public.build_assignment_members
  where id = p_work_item_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;
  if v_item.status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled', 'idempotent', true);
  end if;
  if v_item.status = 'approved' then
    raise exception using errcode = '40001', message = 'Approved build work cannot be cancelled';
  end if;
  update public.build_assignment_members
  set status = 'cancelled', updated_at = timezone('utc', now())
  where id = p_work_item_id;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (v_actor, 'build_work_cancelled', 'build_assignment', v_item.assignment_id,
          jsonb_build_object('member_id', v_item.member_id));
  return jsonb_build_object('status', 'cancelled', 'idempotent', false);
end;
$$;

-- Disable the prototype mutation entry points that do not satisfy this contract.
revoke all on function public.save_build_submission(uuid, uuid, text, text, text, text[], text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.submit_build_submission(uuid) from public, anon, authenticated;
revoke all on function public.add_build_submission_evidence(uuid, text, text, integer, text) from public, anon, authenticated;

revoke all on function public.save_build_assignment(uuid, text, text, text, text, text, text, text, text, timestamptz, text, jsonb, jsonb, jsonb, jsonb, integer, integer, uuid[]) from public, anon;
revoke all on function public.assign_build_member(uuid, uuid) from public, anon;
revoke all on function public.start_build_assignment(uuid) from public, anon;
revoke all on function public.submit_build_work(uuid, text, text, text, text[], text, text, text, text, text, text) from public, anon;
revoke all on function public.resubmit_build_work(uuid, text, text, text, text[], text, text, text, text, text, text) from public, anon;
revoke all on function public.review_build_submission(uuid, text, text) from public, anon;
revoke all on function public.cancel_build_work_item(uuid) from public, anon;
grant execute on function public.save_build_assignment(uuid, text, text, text, text, text, text, text, text, timestamptz, text, jsonb, jsonb, jsonb, jsonb, integer, integer, uuid[]) to authenticated;
grant execute on function public.assign_build_member(uuid, uuid) to authenticated;
grant execute on function public.start_build_assignment(uuid) to authenticated;
grant execute on function public.submit_build_work(uuid, text, text, text, text[], text, text, text, text, text, text) to authenticated;
grant execute on function public.resubmit_build_work(uuid, text, text, text, text[], text, text, text, text, text, text) to authenticated;
grant execute on function public.review_build_submission(uuid, text, text) to authenticated;
grant execute on function public.cancel_build_work_item(uuid) to authenticated;

drop policy if exists "Build members manage private evidence objects" on storage.objects;
drop policy if exists "Build members read private evidence objects" on storage.objects;
drop policy if exists "Admins manage build assignment attachments" on storage.objects;
create policy "Authorized members and admins read private build objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'build-prove-private'
    and ((select private.is_admin()) or (select private.can_access_build_storage_object(name)))
  );
create policy "Admins manage build assignment reference objects"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'build-prove-private'
    and name like 'assignments/%'
    and (select private.is_admin())
  )
  with check (
    bucket_id = 'build-prove-private'
    and name like 'assignments/%'
    and (select private.is_admin())
  );

comment on table public.build_assignment_members is
  'One member-specific work item per assignment; status is changed only by guarded workflow RPCs.';
comment on table public.build_submission_reviews_legacy_phase1 is
  'Preserved, retired prototype review history; new workflow uses build_submission_reviews.';
comment on table public.build_submissions_legacy_phase1 is
  'Preserved, retired mutable prototype submissions; new workflow uses immutable build_submissions revisions.';
