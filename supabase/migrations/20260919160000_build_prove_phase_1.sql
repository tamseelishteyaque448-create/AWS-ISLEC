-- Build & Prove Phase 1: additive database foundation.
-- This domain remains separate from the current challenge and project systems.

create table if not exists public.build_assignments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null unique check (char_length(trim(title)) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 2000),
  objective text not null default '' check (char_length(objective) <= 10000),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'archived')),
  published boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sort_order integer not null default 0 check (sort_order >= 0),
  submission_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(submission_requirements) = 'array'),
  evaluation_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(evaluation_criteria) = 'array'),
  check ((publication_state = 'published') = published),
  check ((publication_state = 'archived') = is_archived)
);

create table if not exists public.build_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.build_assignments (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'changes_requested', 'approved', 'rejected')),
  project_title text not null default '' check (char_length(trim(project_title)) <= 160),
  explanation text not null default '' check (char_length(explanation) <= 12000),
  approach text not null default '' check (char_length(approach) <= 12000),
  technologies text[] not null default '{}'::text[] check (array_length(technologies, 1) is null or cardinality(technologies) <= 25),
  challenges text not null default '' check (char_length(challenges) <= 4000),
  learnings text not null default '' check (char_length(learnings) <= 4000),
  future_improvements text not null default '' check (char_length(future_improvements) <= 4000),
  repository_url text,
  deployment_url text,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles (id) on delete restrict,
  unique (assignment_id, member_id),
  check (repository_url is null or repository_url ~ '^https?://'),
  check (deployment_url is null or deployment_url ~ '^https?://'),
  check (reviewed_at is null or reviewer_id is not null),
  check (status <> 'approved' or reviewer_id is not null),
  check (status <> 'rejected' or reviewer_id is not null),
  check (status <> 'changes_requested' or reviewer_id is not null)
);

create table if not exists public.build_submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.build_submissions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  feedback text not null default '' check (char_length(trim(feedback)) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.build_submission_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.build_submissions (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null check (char_length(trim(storage_path)) > 0),
  content_type text not null check (char_length(trim(content_type)) > 0),
  file_size integer not null check (file_size >= 0),
  caption text not null default '' check (char_length(trim(caption)) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.sync_build_assignment_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.publication_state = 'published' then
    new.published := true;
    new.is_archived := false;
  elsif new.publication_state = 'archived' then
    new.published := false;
    new.is_archived := true;
  else
    new.published := false;
    new.is_archived := false;
  end if;

  return new;
end;
$$;

create or replace function public.sync_build_submission_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at := timezone('utc', now());
  elsif new.status = 'changes_requested' and new.submitted_at is null then
    new.submitted_at := timezone('utc', now());
  end if;

  if new.status in ('approved', 'rejected') and new.reviewed_at is null then
    new.reviewed_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists build_assignments_sync_lifecycle on public.build_assignments;
create trigger build_assignments_sync_lifecycle
before insert or update of publication_state on public.build_assignments
for each row
execute function public.sync_build_assignment_lifecycle();

drop trigger if exists build_submissions_sync_state on public.build_submissions;
create trigger build_submissions_sync_state
before insert or update of status, submitted_at, reviewer_id, reviewed_at on public.build_submissions
for each row
execute function public.sync_build_submission_state();

create trigger build_assignments_set_updated_at
before update on public.build_assignments
for each row
execute function public.set_updated_at();

create trigger build_submissions_set_updated_at
before update on public.build_submissions
for each row
execute function public.set_updated_at();

create trigger build_submission_evidence_set_updated_at
before update on public.build_submission_evidence
for each row
execute function public.set_updated_at();

alter table public.build_assignments enable row level security;
alter table public.build_submissions enable row level security;
alter table public.build_submission_reviews enable row level security;
alter table public.build_submission_evidence enable row level security;

revoke all on public.build_assignments, public.build_submissions, public.build_submission_reviews, public.build_submission_evidence from public, anon, authenticated;

grant select on public.build_assignments to authenticated;
grant insert, update, delete on public.build_assignments to authenticated;
grant select, insert, update on public.build_submissions to authenticated;
grant select, insert on public.build_submission_reviews to authenticated;
grant select, insert, update, delete on public.build_submission_evidence to authenticated;

drop policy if exists "Members can read published assignments" on public.build_assignments;
create policy "Members can read published assignments"
on public.build_assignments
for select to authenticated
using (publication_state = 'published' and is_archived = false);

drop policy if exists "Admins can manage assignments" on public.build_assignments;
create policy "Admins can manage assignments"
on public.build_assignments
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Members can read own submissions" on public.build_submissions;
create policy "Members can read own submissions"
on public.build_submissions
for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Members can create own submissions" on public.build_submissions;
create policy "Members can create own submissions"
on public.build_submissions
for insert to authenticated
with check (
  member_id = (select auth.uid())
  and assignment_id is not null
  and status in ('draft', 'submitted', 'changes_requested')
  and reviewer_id is null
  and reviewed_at is null
);

drop policy if exists "Members can update own editable submissions" on public.build_submissions;
create policy "Members can update own editable submissions"
on public.build_submissions
for update to authenticated
using (member_id = (select auth.uid()) and status in ('draft', 'submitted', 'changes_requested'))
with check (
  member_id = (select auth.uid())
  and status in ('draft', 'submitted', 'changes_requested')
  and reviewer_id is null
  and reviewed_at is null
);

drop policy if exists "Admins can read any submission" on public.build_submissions;
create policy "Admins can read any submission"
on public.build_submissions
for select to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can manage submission review state" on public.build_submissions;
create policy "Admins can manage submission review state"
on public.build_submissions
for update to authenticated
using ((select private.is_admin()))
with check (
  (select private.is_admin())
  and reviewer_id = (select auth.uid())
  and status in ('draft', 'submitted', 'changes_requested', 'approved', 'rejected')
);

drop policy if exists "Admins can read submission reviews" on public.build_submission_reviews;
create policy "Admins can read submission reviews"
on public.build_submission_reviews
for select to authenticated
using ((select private.is_admin()) or exists (
  select 1
  from public.build_submissions as submission
  where submission.id = build_submission_reviews.submission_id
    and submission.member_id = (select auth.uid())
));

drop policy if exists "Admins can manage submission reviews" on public.build_submission_reviews;
create policy "Admins can manage submission reviews"
on public.build_submission_reviews
for insert to authenticated
with check ((select private.is_admin()) and reviewer_id = (select auth.uid()));

drop policy if exists "Members can read own evidence" on public.build_submission_evidence;
create policy "Members can read own evidence"
on public.build_submission_evidence
for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1
    from public.build_submissions as submission
    where submission.id = build_submission_evidence.submission_id
      and submission.member_id = (select auth.uid())
  )
  or (select private.is_admin())
);

drop policy if exists "Members can manage own evidence" on public.build_submission_evidence;
create policy "Members can manage own evidence"
on public.build_submission_evidence
for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.build_submissions as submission
    where submission.id = build_submission_evidence.submission_id
      and submission.member_id = (select auth.uid())
      and submission.status in ('draft', 'submitted', 'changes_requested')
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.build_submissions as submission
    where submission.id = build_submission_evidence.submission_id
      and submission.member_id = (select auth.uid())
      and submission.status in ('draft', 'submitted', 'changes_requested')
  )
);

drop policy if exists "Admins can manage all evidence" on public.build_submission_evidence;
create policy "Admins can manage all evidence"
on public.build_submission_evidence
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create index if not exists build_assignments_publication_state_sort_order_idx
on public.build_assignments (publication_state, sort_order);

create index if not exists build_assignments_created_by_idx
on public.build_assignments (created_by);

create index if not exists build_submissions_assignment_member_idx
on public.build_submissions (assignment_id, member_id);

create index if not exists build_submissions_member_status_idx
on public.build_submissions (member_id, status, updated_at desc);

create index if not exists build_submission_reviews_submission_created_idx
on public.build_submission_reviews (submission_id, created_at desc);

create index if not exists build_submission_evidence_submission_idx
on public.build_submission_evidence (submission_id, created_at desc);

create index if not exists build_submission_evidence_owner_idx
on public.build_submission_evidence (owner_id);
