-- Add mutable submission staging without changing the work-item lifecycle or
-- the immutable submitted-revision contract.

create table public.build_submission_drafts (
  id uuid not null default gen_random_uuid(),
  work_item_id uuid not null,
  member_id uuid not null,
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
  state text not null default 'open' check (state in ('open', 'submitted')),
  submission_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint build_submission_drafts_pkey primary key (id),
  constraint build_submission_drafts_work_item_revision_key unique (work_item_id, revision_number),
  constraint build_submission_drafts_id_member_key unique (id, member_id),
  constraint build_submission_drafts_submission_key unique (submission_id),
  constraint build_submission_drafts_state_submission_check check (
    (state = 'open' and submission_id is null)
    or (state = 'submitted' and submission_id is not null)
  ),
  constraint build_submission_drafts_work_item_member_fkey
    foreign key (work_item_id, member_id)
    references public.build_assignment_members(id, member_id) on delete restrict,
  constraint build_submission_drafts_submission_member_fkey
    foreign key (submission_id, member_id)
    references public.build_submissions(id, member_id) on delete restrict
);

create unique index build_submission_drafts_one_open_per_work_item_idx
  on public.build_submission_drafts(work_item_id)
  where state = 'open';
create index build_submission_drafts_member_work_item_idx
  on public.build_submission_drafts(member_id, work_item_id, created_at desc);

alter table public.build_submission_evidence
  alter column submission_id drop not null,
  add column draft_id uuid;

alter table public.build_submission_evidence
  add constraint build_submission_evidence_one_parent_check
    check (num_nonnulls(submission_id, draft_id) = 1),
  add constraint build_submission_evidence_draft_owner_fkey
    foreign key (draft_id, owner_id)
    references public.build_submission_drafts(id, member_id) on delete restrict;

create index build_submission_evidence_draft_created_idx
  on public.build_submission_evidence(draft_id, created_at desc)
  where draft_id is not null;

alter table public.build_submission_drafts enable row level security;
revoke all on public.build_submission_drafts from public, anon, authenticated;
grant select on public.build_submission_drafts to authenticated;
revoke all on public.build_submission_evidence from public, anon, authenticated;
grant select on public.build_submission_evidence to authenticated;

drop policy if exists "Members and admins can read build submission drafts"
  on public.build_submission_drafts;
create policy "Members and admins can read build submission drafts"
  on public.build_submission_drafts for select to authenticated
  using (
    (select private.is_admin())
    or (
      member_id = (select auth.uid())
      and state = 'open'
      and exists (
        select 1
        from public.build_assignment_members am
        where am.id = work_item_id
          and am.member_id = (select auth.uid())
          and am.status in ('in_progress', 'changes_requested')
      )
    )
  );

drop policy if exists "Members and admins can read build evidence"
  on public.build_submission_evidence;
drop policy if exists "Owners and admins can read build evidence"
  on public.build_submission_evidence;
create policy "Members and admins can read build evidence"
  on public.build_submission_evidence for select to authenticated
  using (
    (select private.is_admin())
    or (
      owner_id = (select auth.uid())
      and (
        exists (
          select 1
          from public.build_submission_drafts d
          join public.build_assignment_members am on am.id = d.work_item_id
          where d.id = draft_id
            and d.member_id = (select auth.uid())
            and d.state = 'open'
            and am.member_id = (select auth.uid())
            and am.status in ('in_progress', 'changes_requested')
        )
        or exists (
          select 1
          from public.build_submissions s
          join public.build_assignment_members am
            on am.id = s.work_item_id and am.member_id = s.member_id
          where s.id = submission_id
            and s.member_id = (select auth.uid())
            and am.status <> 'cancelled'
        )
      )
    )
  );

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
begin
  if v_actor is null or p_object_name is null then
    return false;
  end if;

  if p_object_name ~ '^assignments/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$' then
    v_assignment_id := split_part(p_object_name, '/', 2)::uuid;
    return exists (
      select 1
      from public.build_assignment_members am
      where am.assignment_id = v_assignment_id
        and am.member_id = v_actor
        and am.status <> 'cancelled'
    );
  end if;

  return exists (
    select 1
    from public.build_submission_evidence e
    join public.build_submission_drafts d
      on d.id = e.draft_id and d.member_id = e.owner_id
    join public.build_assignment_members am
      on am.id = d.work_item_id and am.member_id = d.member_id
    where e.storage_path = p_object_name
      and e.owner_id = v_actor
      and d.member_id = v_actor
      and d.state = 'open'
      and am.status in ('in_progress', 'changes_requested')
      and p_object_name ~ (
        '^submissions/' || v_actor::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' ||
        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  ) or exists (
    select 1
    from public.build_submission_evidence e
    join public.build_submissions s on s.id = e.submission_id
    join public.build_assignment_members am
      on am.id = s.work_item_id and am.member_id = s.member_id
    where e.storage_path = p_object_name
      and e.owner_id = v_actor
      and s.member_id = v_actor
      and am.status <> 'cancelled'
      and (
        p_object_name ~ (
          '^submissions/' || v_actor::text ||
          '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
        and exists (
          select 1
          from public.build_submission_drafts d
          where d.id::text = split_part(p_object_name, '/', 3)
            and d.state = 'submitted'
            and d.submission_id = s.id
            and d.member_id = v_actor
        )
        or p_object_name ~ (
          '^submissions/' || v_actor::text || '/' || s.id::text || '/.+$'
        )
      )
  );
end;
$$;
revoke all on function private.can_access_build_storage_object(text)
  from public, anon, authenticated;
grant execute on function private.can_access_build_storage_object(text)
  to authenticated;

create or replace function private.can_upload_build_draft_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_draft_id uuid;
begin
  if v_actor is null
    or p_object_name !~ (
      '^submissions/' || v_actor::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' ||
      '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
    return false;
  end if;

  v_draft_id := split_part(p_object_name, '/', 3)::uuid;
  return exists (
    select 1
    from public.build_submission_drafts d
    join public.build_assignment_members am
      on am.id = d.work_item_id and am.member_id = d.member_id
    where d.id = v_draft_id
      and d.member_id = v_actor
      and d.state = 'open'
      and am.status in ('in_progress', 'changes_requested')
  );
end;
$$;
revoke all on function private.can_upload_build_draft_object(text)
  from public, anon, authenticated;
grant execute on function private.can_upload_build_draft_object(text)
  to authenticated;

create or replace function private.can_delete_build_draft_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.can_upload_build_draft_object(p_object_name)
    and exists (
      select 1
      from public.build_submission_evidence e
      join public.build_submission_drafts d on d.id = e.draft_id
      where e.storage_path = p_object_name
        and e.owner_id = auth.uid()
        and d.member_id = auth.uid()
    );
$$;
revoke all on function private.can_delete_build_draft_object(text)
  from public, anon, authenticated;
grant execute on function private.can_delete_build_draft_object(text)
  to authenticated;

create or replace function private.guard_build_submission_draft()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_submission public.build_submissions%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.state <> 'open'
      or old.member_id <> auth.uid()
      or not exists (
        select 1 from public.build_assignment_members am
        where am.id = old.work_item_id
          and am.member_id = old.member_id
          and am.status in ('in_progress', 'changes_requested')
      ) then
      raise exception using errcode = '55000', message = 'Build submission draft is immutable or unavailable';
    end if;
    return old;
  end if;

  select am.status into v_status
  from public.build_assignment_members am
  where am.id = new.work_item_id and am.member_id = new.member_id;

  if tg_op = 'INSERT' then
    if new.member_id <> auth.uid()
      or new.state <> 'open'
      or new.submission_id is not null
      or v_status not in ('in_progress', 'changes_requested') then
      raise exception using errcode = '42501', message = 'Build submission draft access denied';
    end if;
    return new;
  end if;

  if old.state <> 'open'
    or new.id <> old.id
    or new.work_item_id <> old.work_item_id
    or new.member_id <> old.member_id
    or new.revision_number <> old.revision_number
    or new.created_at <> old.created_at
    or new.member_id <> auth.uid()
    or v_status not in ('in_progress', 'changes_requested') then
    raise exception using errcode = '55000', message = 'Build submission draft is immutable or unavailable';
  end if;

  if new.state = 'submitted' then
    select * into v_submission
    from public.build_submissions s
    where s.id = new.submission_id
      and s.work_item_id = new.work_item_id
      and s.member_id = new.member_id
      and s.revision_number = new.revision_number;
    if not found
      or new.project_title <> v_submission.project_title
      or new.explanation <> v_submission.explanation
      or new.approach <> v_submission.approach
      or new.technologies <> v_submission.technologies
      or new.challenges <> v_submission.challenges
      or new.learnings <> v_submission.learnings
      or new.future_improvements <> v_submission.future_improvements
      or new.repository_url is distinct from v_submission.repository_url
      or new.deployment_url is distinct from v_submission.deployment_url
      or new.demo_url is distinct from v_submission.demo_url then
      raise exception using errcode = '55000', message = 'Draft does not match its submitted revision';
    end if;
  elsif new.submission_id is not null then
    raise exception using errcode = '55000', message = 'Open draft cannot reference a submitted revision';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_build_submission_draft() from public, anon, authenticated;

create trigger build_submission_drafts_guard
  before insert or update or delete on public.build_submission_drafts
  for each row execute function private.guard_build_submission_draft();

create or replace function private.guard_build_submission_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_draft public.build_submission_drafts%rowtype;
  v_status text;
begin
  if tg_op = 'INSERT' then
    if new.draft_id is null or new.submission_id is not null then
      raise exception using errcode = '23514', message = 'Evidence must be staged on an open draft';
    end if;
    select d.* into v_draft
    from public.build_submission_drafts d
    where d.id = new.draft_id and d.member_id = new.owner_id;
    select am.status into v_status
    from public.build_assignment_members am
    where am.id = v_draft.work_item_id and am.member_id = v_draft.member_id;
    if not found or v_draft.state <> 'open'
      or v_status not in ('in_progress', 'changes_requested')
      or new.owner_id <> auth.uid() then
      raise exception using errcode = '42501', message = 'Build draft evidence access denied';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.submission_id is not null
      or old.draft_id is null
      or old.owner_id <> auth.uid()
      or not exists (
        select 1
        from public.build_submission_drafts d
        join public.build_assignment_members am
          on am.id = d.work_item_id and am.member_id = d.member_id
        where d.id = old.draft_id
          and d.member_id = old.owner_id
          and d.state = 'open'
          and am.status in ('in_progress', 'changes_requested')
      ) then
      raise exception using errcode = '55000', message = 'Submitted or unavailable evidence is immutable';
    end if;
    return old;
  end if;

  if old.submission_id is not null
    or old.draft_id is null
    or new.draft_id is not null
    or new.submission_id is null
    or new.id <> old.id
    or new.owner_id <> old.owner_id
    or new.storage_path <> old.storage_path
    or new.content_type <> old.content_type
    or new.file_size <> old.file_size
    or new.caption <> old.caption
    or new.created_at <> old.created_at
    or old.owner_id <> auth.uid() then
    raise exception using errcode = '55000', message = 'Build evidence is immutable';
  end if;

  select d.* into v_draft
  from public.build_submission_drafts d
  where d.id = old.draft_id
    and d.member_id = old.owner_id
    and d.state = 'submitted'
    and d.submission_id = new.submission_id;
  if not found
    or not exists (
      select 1 from public.build_submissions s
      where s.id = new.submission_id
        and s.work_item_id = v_draft.work_item_id
        and s.member_id = v_draft.member_id
        and s.revision_number = v_draft.revision_number
    ) then
    raise exception using errcode = '55000', message = 'Evidence does not match its submitted draft';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_build_submission_evidence()
  from public, anon, authenticated;

create trigger build_submission_evidence_guard
  before insert or update or delete on public.build_submission_evidence
  for each row execute function private.guard_build_submission_evidence();

create or replace function public.save_build_submission_draft(
  p_work_item_id uuid,
  p_project_title text,
  p_explanation text,
  p_approach text,
  p_technologies text[] default '{}'::text[],
  p_challenges text default '',
  p_learnings text default '',
  p_future_improvements text default '',
  p_repository_url text default null,
  p_deployment_url text default null,
  p_demo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.build_assignment_members%rowtype;
  v_draft public.build_submission_drafts%rowtype;
  v_latest integer;
  v_revision integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
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
    raise exception using errcode = '22023', message = 'Invalid build submission draft';
  end if;

  select * into v_item
  from public.build_assignment_members am
  where am.id = p_work_item_id and am.member_id = v_actor
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;
  if v_item.status = 'in_progress' then
    select max(s.revision_number) into v_latest
    from public.build_submissions s where s.work_item_id = p_work_item_id;
    if v_latest is not null then
      raise exception using errcode = '40001', message = 'Initial submission already exists';
    end if;
    v_revision := 1;
  elsif v_item.status = 'changes_requested' then
    select max(s.revision_number) into v_latest
    from public.build_submissions s where s.work_item_id = p_work_item_id;
    if v_latest is null or not exists (
      select 1
      from public.build_submissions s
      join public.build_submission_reviews r on r.submission_id = s.id
      where s.work_item_id = p_work_item_id
        and s.revision_number = v_latest
        and r.decision = 'changes_requested'
    ) then
      raise exception using errcode = '40001', message = 'Latest revision has no changes-requested review';
    end if;
    v_revision := v_latest + 1;
  else
    raise exception using errcode = '40001', message = 'Build work item is not editable';
  end if;

  select * into v_draft
  from public.build_submission_drafts d
  where d.work_item_id = p_work_item_id
    and d.member_id = v_actor
    and d.state = 'open'
  for update;

  if found then
    if v_draft.revision_number <> v_revision then
      raise exception using errcode = '40001', message = 'Open draft is stale';
    end if;
    update public.build_submission_drafts
    set project_title = trim(p_project_title),
        explanation = coalesce(p_explanation, ''),
        approach = coalesce(p_approach, ''),
        technologies = coalesce(p_technologies, '{}'::text[]),
        challenges = coalesce(p_challenges, ''),
        learnings = coalesce(p_learnings, ''),
        future_improvements = coalesce(p_future_improvements, ''),
        repository_url = nullif(p_repository_url, ''),
        deployment_url = nullif(p_deployment_url, ''),
        demo_url = nullif(p_demo_url, ''),
        updated_at = timezone('utc', now())
    where id = v_draft.id
    returning * into v_draft;
  else
    insert into public.build_submission_drafts(
      work_item_id, member_id, revision_number, project_title, explanation, approach,
      technologies, challenges, learnings, future_improvements, repository_url,
      deployment_url, demo_url
    ) values (
      p_work_item_id, v_actor, v_revision, trim(p_project_title),
      coalesce(p_explanation, ''), coalesce(p_approach, ''),
      coalesce(p_technologies, '{}'::text[]), coalesce(p_challenges, ''),
      coalesce(p_learnings, ''), coalesce(p_future_improvements, ''),
      nullif(p_repository_url, ''), nullif(p_deployment_url, ''), nullif(p_demo_url, '')
    ) returning * into v_draft;
  end if;

  return jsonb_build_object(
    'draft_id', v_draft.id,
    'revision_number', v_draft.revision_number,
    'state', v_draft.state,
    'idempotent', false
  );
end;
$$;

create or replace function public.register_build_draft_evidence(
  p_draft_id uuid,
  p_object_uuid uuid,
  p_caption text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_draft public.build_submission_drafts%rowtype;
  v_item public.build_assignment_members%rowtype;
  v_path text;
  v_object storage.objects%rowtype;
  v_size integer;
  v_type text;
  v_existing public.build_submission_evidence%rowtype;
  v_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_object_uuid is null
    or char_length(trim(coalesce(p_caption, ''))) > 500 then
    raise exception using errcode = '22023', message = 'Invalid build evidence';
  end if;

  select * into v_draft
  from public.build_submission_drafts d
  where d.id = p_draft_id and d.member_id = v_actor;
  if not found then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;
  select * into v_item
  from public.build_assignment_members am
  where am.id = v_draft.work_item_id and am.member_id = v_actor
  for update;
  if not found or v_item.status not in ('in_progress', 'changes_requested') then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;
  select * into v_draft
  from public.build_submission_drafts d
  where d.id = p_draft_id and d.member_id = v_actor
  for update;
  if not found or v_draft.state <> 'open' then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;

  v_path := 'submissions/' || v_actor::text || '/' || v_draft.id::text || '/' || p_object_uuid::text;
  select * into v_object
  from storage.objects o
  where o.bucket_id = 'build-prove-private' and o.name = v_path;
  if not found then
    raise exception using errcode = 'P0002', message = 'Evidence object not found';
  end if;
  if coalesce(v_object.owner_id, v_object.owner::text) is distinct from v_actor::text
    or coalesce(v_object.metadata->>'size', '') !~ '^[0-9]+$'
    or coalesce(v_object.metadata->>'mimetype', '') not in
       ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception using errcode = '22023', message = 'Invalid evidence object metadata';
  end if;
  v_size := (v_object.metadata->>'size')::integer;
  v_type := v_object.metadata->>'mimetype';
  if v_size not between 1 and 10485760 then
    raise exception using errcode = '22023', message = 'Evidence exceeds the allowed file size';
  end if;

  select * into v_existing
  from public.build_submission_evidence e
  where e.storage_path = v_path
  for update;
  if found then
    if v_existing.draft_id = v_draft.id
      and v_existing.submission_id is null
      and v_existing.owner_id = v_actor
      and v_existing.content_type = v_type
      and v_existing.file_size = v_size
      and v_existing.caption = trim(coalesce(p_caption, '')) then
      return jsonb_build_object(
        'evidence_id', v_existing.id,
        'content_type', v_existing.content_type,
        'file_size', v_existing.file_size,
        'caption', v_existing.caption,
        'created_at', v_existing.created_at,
        'idempotent', true
      );
    end if;
    raise exception using errcode = '23505', message = 'Evidence object is already registered';
  end if;

  insert into public.build_submission_evidence(
    submission_id, draft_id, owner_id, storage_path, content_type, file_size, caption
  ) values (
    null, v_draft.id, v_actor, v_path, v_type, v_size, trim(coalesce(p_caption, ''))
  ) returning id into v_id;

  return jsonb_build_object(
    'evidence_id', v_id,
    'content_type', v_type,
    'file_size', v_size,
    'caption', trim(coalesce(p_caption, '')),
    'created_at', timezone('utc', now()),
    'idempotent', false
  );
end;
$$;

create or replace function public.remove_build_draft_evidence(p_evidence_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_work_item_id uuid;
  v_item public.build_assignment_members%rowtype;
  v_draft public.build_submission_drafts%rowtype;
  v_evidence public.build_submission_evidence%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select d.work_item_id into v_work_item_id
  from public.build_submission_evidence e
  join public.build_submission_drafts d on d.id = e.draft_id
  where e.id = p_evidence_id and e.owner_id = v_actor;
  if not found then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;
  select * into v_item
  from public.build_assignment_members am
  where am.id = v_work_item_id and am.member_id = v_actor
  for update;
  if not found or v_item.status not in ('in_progress', 'changes_requested') then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;
  select * into v_draft
  from public.build_submission_drafts d
  where d.work_item_id = v_item.id
    and d.member_id = v_actor
  for update;
  if not found or v_draft.state <> 'open' then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;

  select e.* into v_evidence
  from public.build_submission_evidence e
  where e.id = p_evidence_id
    and e.owner_id = v_actor
    and e.draft_id = v_draft.id
    and e.submission_id is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Build draft evidence access denied';
  end if;

  delete from public.build_submission_evidence e where e.id = v_evidence.id;
  return jsonb_build_object('evidence_id', v_evidence.id, 'removed', true);
end;
$$;

create or replace function public.submit_build_submission_draft(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_work_item_id uuid;
  v_draft public.build_submission_drafts%rowtype;
  v_item public.build_assignment_members%rowtype;
  v_latest integer;
  v_expected_state text;
  v_submission_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select d.work_item_id into v_work_item_id
  from public.build_submission_drafts d
  where d.id = p_draft_id and d.member_id = v_actor;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build submission draft not found';
  end if;

  select * into v_item
  from public.build_assignment_members am
  where am.id = v_work_item_id and am.member_id = v_actor
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build work item not found';
  end if;
  select * into v_draft
  from public.build_submission_drafts d
  where d.id = p_draft_id
    and d.work_item_id = v_item.id
    and d.member_id = v_actor
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Build submission draft not found';
  end if;
  if v_item.status = 'cancelled' or v_item.status = 'approved' then
    raise exception using errcode = '40001', message = 'Build work item is terminal';
  end if;

  if v_draft.state = 'submitted' then
    if v_item.status not in ('submitted', 'resubmitted', 'changes_requested')
      or not exists (
        select 1
        from public.build_submissions s
        where s.id = v_draft.submission_id
          and s.work_item_id = v_item.id
          and s.member_id = v_actor
          and s.revision_number = v_draft.revision_number
          and s.revision_number = (
            select max(current_revision.revision_number)
            from public.build_submissions current_revision
            where current_revision.work_item_id = v_item.id
          )
      ) then
      raise exception using errcode = '40001', message = 'Build submission draft is stale';
    end if;
    return jsonb_build_object(
      'submission_id', v_draft.submission_id,
      'revision_number', v_draft.revision_number,
      'status', v_item.status,
      'idempotent', true
    );
  end if;

  if v_item.status = 'in_progress' then
    v_expected_state := 'submitted';
    if v_draft.revision_number <> 1
      or exists (select 1 from public.build_submissions s where s.work_item_id = v_item.id) then
      raise exception using errcode = '40001', message = 'Initial draft is stale';
    end if;
  elsif v_item.status = 'changes_requested' then
    v_expected_state := 'resubmitted';
    select max(s.revision_number) into v_latest
    from public.build_submissions s where s.work_item_id = v_item.id;
    if v_latest is null
      or v_draft.revision_number <> v_latest + 1
      or not exists (
        select 1
        from public.build_submissions s
        join public.build_submission_reviews r on r.submission_id = s.id
        where s.work_item_id = v_item.id
          and s.revision_number = v_latest
          and r.decision = 'changes_requested'
      ) then
      raise exception using errcode = '40001', message = 'Resubmission draft is stale';
    end if;
  else
    raise exception using errcode = '40001', message = 'Build work item is not submittable';
  end if;

  if v_draft.state <> 'open' then
    raise exception using errcode = '40001', message = 'Build submission draft is not open';
  end if;
  if exists (
    select 1
    from public.build_submission_evidence e
    left join storage.objects o
      on o.bucket_id = 'build-prove-private' and o.name = e.storage_path
    where e.draft_id = v_draft.id
      and (
        o.id is null
        or coalesce(o.owner_id, o.owner::text) is distinct from v_actor::text
        or coalesce(o.metadata->>'size', '') !~ '^[0-9]+$'
        or (o.metadata->>'size')::integer <> e.file_size
        or o.metadata->>'mimetype' <> e.content_type
        or e.file_size not between 1 and 10485760
        or e.content_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
      )
  ) then
    raise exception using errcode = '22023', message = 'Draft evidence is missing or inconsistent';
  end if;

  insert into public.build_submissions(
    work_item_id, member_id, revision_number, project_title, explanation, approach,
    technologies, challenges, learnings, future_improvements, repository_url,
    deployment_url, demo_url
  ) values (
    v_draft.work_item_id, v_actor, v_draft.revision_number, v_draft.project_title,
    v_draft.explanation, v_draft.approach, v_draft.technologies, v_draft.challenges,
    v_draft.learnings, v_draft.future_improvements, v_draft.repository_url,
    v_draft.deployment_url, v_draft.demo_url
  ) returning id into v_submission_id;

  update public.build_submission_drafts
  set state = 'submitted',
      submission_id = v_submission_id,
      updated_at = timezone('utc', now())
  where id = v_draft.id;

  update public.build_submission_evidence
  set submission_id = v_submission_id,
      draft_id = null
  where draft_id = v_draft.id;

  update public.build_assignment_members
  set status = v_expected_state,
      updated_at = timezone('utc', now())
  where id = v_item.id;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'revision_number', v_draft.revision_number,
    'status', v_expected_state,
    'idempotent', false
  );
end;
$$;

revoke all on function public.save_build_submission_draft(
  uuid, text, text, text, text[], text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.register_build_draft_evidence(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.remove_build_draft_evidence(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_build_submission_draft(uuid)
  from public, anon, authenticated;
grant execute on function public.save_build_submission_draft(
  uuid, text, text, text, text[], text, text, text, text, text, text
) to authenticated;
grant execute on function public.register_build_draft_evidence(uuid, uuid, text)
  to authenticated;
grant execute on function public.remove_build_draft_evidence(uuid)
  to authenticated;
grant execute on function public.submit_build_submission_draft(uuid)
  to authenticated;

drop policy if exists "Authorized members and admins read private build objects"
  on storage.objects;
drop policy if exists "Build members manage private evidence objects"
  on storage.objects;
drop policy if exists "Build members read private evidence objects"
  on storage.objects;
drop policy if exists "Admins manage build assignment attachments"
  on storage.objects;
drop policy if exists "Admins manage build assignment reference objects"
  on storage.objects;

create policy "Authorized members and admins read private build objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'build-prove-private'
    and ((select private.is_admin()) or (select private.can_access_build_storage_object(name)))
  );
create policy "Build members upload own open draft evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'build-prove-private'
    and (select private.can_upload_build_draft_object(name))
  );
create policy "Build members delete own open draft evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'build-prove-private'
    and (select private.can_delete_build_draft_object(name))
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
