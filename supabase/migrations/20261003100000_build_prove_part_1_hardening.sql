-- Build & Prove Part 1: additive contract hardening.
-- This migration intentionally does not touch challenge, project, or event-poster state.

alter table public.build_assignments
  add column if not exists domain text not null default 'innovation_research'
    check (domain in ('innovation_research', 'event_management', 'media_design', 'documentation')),
  add column if not exists assignment_scope text not null default 'domain'
    check (assignment_scope in ('domain', 'individual')),
  add column if not exists deadline_at timestamptz,
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists requirements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(requirements) = 'array'),
  add column if not exists deliverables jsonb not null default '[]'::jsonb
    check (jsonb_typeof(deliverables) = 'array'),
  add column if not exists reward_points integer not null default 0
    check (reward_points between 0 and 10000);

alter table public.build_submissions
  add column if not exists demo_url text,
  add column if not exists reward_awarded_at timestamptz,
  add constraint build_submissions_demo_url_http_check
    check (demo_url is null or demo_url ~ '^https?://');

create table if not exists public.build_member_domains (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  domain text not null check (domain in ('innovation_research', 'event_management', 'media_design', 'documentation')),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, domain)
);

create table if not exists public.build_assignment_members (
  assignment_id uuid not null references public.build_assignments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (assignment_id, profile_id)
);

create table if not exists public.build_assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.build_assignments(id) on delete cascade,
  storage_path text not null unique check (storage_path like 'assignments/%'),
  content_type text not null check (char_length(trim(content_type)) between 1 and 120),
  file_size integer not null check (file_size between 1 and 10485760),
  label text not null default '' check (char_length(trim(label)) <= 200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.build_submission_rewards (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.build_submissions(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  points_awarded integer not null check (points_awarded >= 0),
  activity_key text not null unique check (activity_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  awarded_by uuid not null references public.profiles(id) on delete restrict,
  awarded_at timestamptz not null default timezone('utc', now())
);

alter table public.activities
  add column if not exists build_submission_id uuid references public.build_submissions(id) on delete set null;
alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check
  check (activity_type in ('project', 'lesson', 'badge', 'event', 'challenge', 'build_prove'));
alter table public.activities drop constraint if exists activities_one_domain_reference_check;
alter table public.activities add constraint activities_one_domain_reference_check
  check (num_nonnulls(project_id, learning_path_id, badge_id, event_id, build_submission_id) <= 1);

create index if not exists build_member_domains_profile_idx on public.build_member_domains(profile_id, domain);
create index if not exists build_assignment_members_profile_idx on public.build_assignment_members(profile_id, assignment_id);
create index if not exists build_assignment_attachments_assignment_idx on public.build_assignment_attachments(assignment_id, created_at);
create index if not exists build_submissions_review_queue_idx on public.build_submissions(status, submitted_at) where status = 'submitted';

alter table public.build_member_domains enable row level security;
alter table public.build_assignment_members enable row level security;
alter table public.build_assignment_attachments enable row level security;
alter table public.build_submission_rewards enable row level security;

revoke all on public.build_assignments, public.build_submissions, public.build_submission_reviews,
  public.build_submission_evidence, public.build_member_domains, public.build_assignment_members,
  public.build_assignment_attachments, public.build_submission_rewards from public, anon, authenticated;
grant select on public.build_assignments, public.build_submissions, public.build_submission_reviews,
  public.build_submission_evidence, public.build_member_domains, public.build_assignment_members,
  public.build_assignment_attachments, public.build_submission_rewards to authenticated;

-- The private helper is shared by RLS and RPCs. A domain-targeted assignment is
-- eligible only to a current member of that Build & Prove domain.
create or replace function private.can_access_build_assignment(p_assignment_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.build_assignments a
    where a.id = p_assignment_id and a.publication_state = 'published'
      and ((a.assignment_scope = 'domain' and exists (
        select 1 from public.build_member_domains d
        where d.profile_id = p_profile_id and d.domain = a.domain
      )) or (a.assignment_scope = 'individual' and exists (
        select 1 from public.build_assignment_members m
        where m.assignment_id = a.id and m.profile_id = p_profile_id
      )))
  );
$$;
revoke all on function private.can_access_build_assignment(uuid, uuid) from public, anon, authenticated;

drop policy if exists "Members can read published assignments" on public.build_assignments;
create policy "Eligible members can read published build assignments" on public.build_assignments
for select to authenticated using (
  (select private.is_admin()) or private.can_access_build_assignment(id, (select auth.uid()))
);
drop policy if exists "Admins can manage assignments" on public.build_assignments;

drop policy if exists "Members can read own submissions" on public.build_submissions;
drop policy if exists "Admins can read any submission" on public.build_submissions;
create policy "Owners and admins can read build submissions" on public.build_submissions
for select to authenticated using (member_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "Members can create own submissions" on public.build_submissions;
drop policy if exists "Members can update own editable submissions" on public.build_submissions;
drop policy if exists "Admins can manage submission review state" on public.build_submissions;

drop policy if exists "Admins can manage submission reviews" on public.build_submission_reviews;
drop policy if exists "Admins can read submission reviews" on public.build_submission_reviews;
create policy "Owners and admins can read build reviews" on public.build_submission_reviews
for select to authenticated using ((select private.is_admin()) or exists (
  select 1 from public.build_submissions s where s.id = submission_id and s.member_id = (select auth.uid())
));

drop policy if exists "Members can read own evidence" on public.build_submission_evidence;
drop policy if exists "Members can manage own evidence" on public.build_submission_evidence;
drop policy if exists "Admins can manage all evidence" on public.build_submission_evidence;
create policy "Owners and admins can read build evidence" on public.build_submission_evidence
for select to authenticated using ((select private.is_admin()) or exists (
  select 1 from public.build_submissions s where s.id = submission_id and s.member_id = (select auth.uid())
));

create policy "Members can read their build domains" on public.build_member_domains
for select to authenticated using (profile_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members can read their individual build assignments" on public.build_assignment_members
for select to authenticated using (profile_id = (select auth.uid()) or (select private.is_admin()));
create policy "Eligible members can read build assignment attachments" on public.build_assignment_attachments
for select to authenticated using ((select private.is_admin()) or private.can_access_build_assignment(assignment_id, (select auth.uid())));
create policy "Owners and admins can read build rewards" on public.build_submission_rewards
for select to authenticated using ((select private.is_admin()) or profile_id = (select auth.uid()));

-- Keep Build & Prove files in an independently private bucket. Object paths are
-- scoped to the authenticated member/submission; admins retain review access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('build-prove-private', 'build-prove-private', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Build members manage private evidence objects" on storage.objects;
create policy "Build members manage private evidence objects" on storage.objects for all to authenticated
using (bucket_id = 'build-prove-private' and name like ('submissions/' || (select auth.uid())::text || '/%'))
with check (bucket_id = 'build-prove-private' and name like ('submissions/' || (select auth.uid())::text || '/%'));
drop policy if exists "Build members read private evidence objects" on storage.objects;
create policy "Build members read private evidence objects" on storage.objects for select to authenticated
using (bucket_id = 'build-prove-private' and (select private.is_admin() or name like ('submissions/' || (select auth.uid())::text || '/%')));
drop policy if exists "Admins manage build assignment attachments" on storage.objects;
create policy "Admins manage build assignment attachments" on storage.objects for all to authenticated
using (bucket_id = 'build-prove-private' and name like 'assignments/%' and (select private.is_admin()))
with check (bucket_id = 'build-prove-private' and name like 'assignments/%' and (select private.is_admin()));

create or replace function public.save_build_assignment(
  p_assignment_id uuid default null, p_slug text default null, p_title text default null,
  p_summary text default '', p_objective text default '', p_difficulty text default 'easy',
  p_domain text default 'innovation_research', p_assignment_scope text default 'domain',
  p_publication_state text default 'draft', p_deadline_at timestamptz default null,
  p_priority text default 'normal', p_requirements jsonb default '[]'::jsonb,
  p_deliverables jsonb default '[]'::jsonb, p_submission_requirements jsonb default '[]'::jsonb,
  p_evaluation_criteria jsonb default '[]'::jsonb, p_reward_points integer default 0,
  p_sort_order integer default 0, p_member_ids uuid[] default '{}'::uuid[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_id uuid; v_scope text := lower(coalesce(p_assignment_scope, ''));
begin
  if v_actor is null or not private.is_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(trim(coalesce(p_title, ''))) not between 1 and 160
    or p_difficulty not in ('easy','medium','hard') or p_domain not in ('innovation_research','event_management','media_design','documentation')
    or v_scope not in ('domain','individual') or p_publication_state not in ('draft','published','archived')
    or p_priority not in ('low','normal','high','urgent') or p_reward_points not between 0 and 10000 or p_sort_order < 0
    or jsonb_typeof(p_requirements) <> 'array' or jsonb_typeof(p_deliverables) <> 'array'
    or jsonb_typeof(p_submission_requirements) <> 'array' or jsonb_typeof(p_evaluation_criteria) <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid build assignment'; end if;
  if v_scope = 'individual' and cardinality(coalesce(p_member_ids, '{}'::uuid[])) = 0 then
    raise exception using errcode = '22023', message = 'Individual assignments require at least one member'; end if;
  if p_assignment_id is null then
    insert into public.build_assignments (slug,title,summary,objective,difficulty,domain,assignment_scope,publication_state,deadline_at,priority,requirements,deliverables,submission_requirements,evaluation_criteria,reward_points,sort_order,created_by)
    values (p_slug,trim(p_title),coalesce(p_summary,''),coalesce(p_objective,''),p_difficulty,p_domain,v_scope,p_publication_state,p_deadline_at,p_priority,p_requirements,p_deliverables,p_submission_requirements,p_evaluation_criteria,p_reward_points,p_sort_order,v_actor) returning id into v_id;
  else
    update public.build_assignments set slug=p_slug,title=trim(p_title),summary=coalesce(p_summary,''),objective=coalesce(p_objective,''),difficulty=p_difficulty,domain=p_domain,assignment_scope=v_scope,publication_state=p_publication_state,deadline_at=p_deadline_at,priority=p_priority,requirements=p_requirements,deliverables=p_deliverables,submission_requirements=p_submission_requirements,evaluation_criteria=p_evaluation_criteria,reward_points=p_reward_points,sort_order=p_sort_order where id=p_assignment_id returning id into v_id;
    if not found then raise exception using errcode = 'P0002', message = 'Build assignment not found'; end if;
  end if;
  delete from public.build_assignment_members where assignment_id = v_id;
  if v_scope = 'individual' then
    insert into public.build_assignment_members (assignment_id,profile_id,assigned_by)
    select v_id, member_id, v_actor from unnest(p_member_ids) as member_id join public.profiles p on p.id = member_id on conflict do nothing;
    if not exists (select 1 from public.build_assignment_members where assignment_id = v_id) then raise exception using errcode = '22023', message = 'Individual assignments require valid members'; end if;
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) values (v_actor,case when p_assignment_id is null then 'build_assignment_created' else 'build_assignment_updated' end,'build_assignment',v_id,jsonb_build_object('publication_state',p_publication_state,'assignment_scope',v_scope));
  return jsonb_build_object('assignment_id',v_id,'publication_state',p_publication_state);
end; $$;

create or replace function public.set_build_member_domain(p_profile_id uuid, p_domain text, p_assigned boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.is_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  if p_domain not in ('innovation_research','event_management','media_design','documentation') or not exists (select 1 from public.profiles where id=p_profile_id) then raise exception using errcode = '22023', message = 'Invalid member domain'; end if;
  if p_assigned then
    insert into public.build_member_domains(profile_id,domain,assigned_by) values(p_profile_id,p_domain,v_actor) on conflict(profile_id,domain) do nothing;
  else
    delete from public.build_member_domains where profile_id=p_profile_id and domain=p_domain;
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) values(v_actor,case when p_assigned then 'build_member_domain_assigned' else 'build_member_domain_removed' end,'profile',p_profile_id,jsonb_build_object('domain',p_domain));
  return jsonb_build_object('profile_id',p_profile_id,'domain',p_domain,'assigned',p_assigned);
end; $$;

create or replace function public.add_build_assignment_attachment(p_assignment_id uuid, p_storage_path text, p_content_type text, p_file_size integer, p_label text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null or not private.is_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  if p_storage_path !~ ('^assignments/' || p_assignment_id::text || '/.+') or char_length(trim(coalesce(p_content_type,''))) not between 1 and 120 or p_file_size not between 1 and 10485760 or char_length(trim(coalesce(p_label,''))) > 200 then raise exception using errcode='22023',message='Invalid assignment attachment'; end if;
  if not exists (select 1 from public.build_assignments where id=p_assignment_id) or not exists (select 1 from storage.objects where bucket_id='build-prove-private' and name=p_storage_path) then raise exception using errcode='P0002',message='Assignment attachment object not found'; end if;
  insert into public.build_assignment_attachments(assignment_id,storage_path,content_type,file_size,label,created_by) values(p_assignment_id,p_storage_path,p_content_type,p_file_size,trim(coalesce(p_label,'')),v_actor) returning id into v_id;
  return jsonb_build_object('attachment_id',v_id);
end; $$;

create or replace function public.save_build_submission(
  p_submission_id uuid default null, p_assignment_id uuid default null, p_project_title text default '',
  p_explanation text default '', p_approach text default '', p_technologies text[] default '{}'::text[],
  p_challenges text default '', p_learnings text default '', p_future_improvements text default '',
  p_repository_url text default null, p_deployment_url text default null, p_demo_url text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if char_length(trim(coalesce(p_project_title,''))) > 160 or char_length(coalesce(p_explanation,'')) > 12000 or char_length(coalesce(p_approach,'')) > 12000
    or cardinality(coalesce(p_technologies,'{}'::text[])) > 25 or char_length(coalesce(p_challenges,'')) > 4000 or char_length(coalesce(p_learnings,'')) > 4000 or char_length(coalesce(p_future_improvements,'')) > 4000
    or (p_repository_url is not null and p_repository_url !~ '^https?://') or (p_deployment_url is not null and p_deployment_url !~ '^https?://') or (p_demo_url is not null and p_demo_url !~ '^https?://') then raise exception using errcode = '22023', message = 'Invalid build submission'; end if;
  if p_submission_id is null then
    if p_assignment_id is null or not private.can_access_build_assignment(p_assignment_id, v_actor) then raise exception using errcode = '42501', message = 'Assignment access denied'; end if;
    insert into public.build_submissions (assignment_id,member_id,project_title,explanation,approach,technologies,challenges,learnings,future_improvements,repository_url,deployment_url,demo_url)
    values (p_assignment_id,v_actor,trim(p_project_title),coalesce(p_explanation,''),coalesce(p_approach,''),coalesce(p_technologies,'{}'),coalesce(p_challenges,''),coalesce(p_learnings,''),coalesce(p_future_improvements,''),nullif(p_repository_url,''),nullif(p_deployment_url,''),nullif(p_demo_url,'')) returning id into v_id;
  else
    update public.build_submissions set project_title=trim(p_project_title),explanation=coalesce(p_explanation,''),approach=coalesce(p_approach,''),technologies=coalesce(p_technologies,'{}'),challenges=coalesce(p_challenges,''),learnings=coalesce(p_learnings,''),future_improvements=coalesce(p_future_improvements,''),repository_url=nullif(p_repository_url,''),deployment_url=nullif(p_deployment_url,''),demo_url=nullif(p_demo_url,'')
    where id=p_submission_id and member_id=v_actor and status in ('draft','changes_requested') returning id into v_id;
    if not found then raise exception using errcode = '22023', message = 'Submission is not editable'; end if;
  end if;
  return jsonb_build_object('submission_id',v_id,'status','draft');
end; $$;

create or replace function public.submit_build_submission(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_submission public.build_submissions%rowtype;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_submission from public.build_submissions where id=p_submission_id and member_id=v_actor for update;
  if not found or v_submission.status not in ('draft','changes_requested') then raise exception using errcode = '22023', message = 'Submission cannot be submitted'; end if;
  if not private.can_access_build_assignment(v_submission.assignment_id, v_actor) then raise exception using errcode = '42501', message = 'Assignment access denied'; end if;
  if char_length(trim(v_submission.project_title)) = 0 or char_length(trim(v_submission.explanation)) = 0 or char_length(trim(v_submission.approach)) = 0 then raise exception using errcode = '22023', message = 'Required submission fields are missing'; end if;
  update public.build_submissions set status='submitted', reviewer_id=null, reviewed_at=null where id=p_submission_id;
  return jsonb_build_object('submission_id',p_submission_id,'status','submitted');
end; $$;

create or replace function public.review_build_submission(p_submission_id uuid, p_decision text, p_feedback text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_submission public.build_submissions%rowtype; v_assignment public.build_assignments%rowtype; v_reward_id uuid; v_now timestamptz := timezone('utc',now()); v_key text;
begin
  if v_actor is null or not private.is_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  if p_decision not in ('approved','changes_requested','rejected') or char_length(trim(coalesce(p_feedback,''))) > 2000 or (p_decision in ('changes_requested','rejected') and char_length(trim(coalesce(p_feedback,''))) = 0) then raise exception using errcode = '22023', message = 'Invalid review'; end if;
  select * into v_submission from public.build_submissions where id=p_submission_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Build submission not found'; end if;
  if v_submission.status = 'approved' and p_decision = 'approved' then return jsonb_build_object('submission_id',p_submission_id,'status','approved','reward_status','already_awarded'); end if;
  if v_submission.status <> 'submitted' then raise exception using errcode = '40001', message = 'Submission is not awaiting review'; end if;
  select * into v_assignment from public.build_assignments where id=v_submission.assignment_id;
  update public.build_submissions set status=p_decision,reviewer_id=v_actor,reviewed_at=v_now where id=p_submission_id;
  insert into public.build_submission_reviews(submission_id,reviewer_id,decision,feedback) values(p_submission_id,v_actor,p_decision,trim(coalesce(p_feedback,'')));
  if p_decision = 'approved' then
    v_key := 'build-prove-approved-' || v_submission.member_id::text || '-' || p_submission_id::text;
    insert into public.build_submission_rewards(submission_id,profile_id,points_awarded,activity_key,awarded_by,awarded_at)
    values(p_submission_id,v_submission.member_id,v_assignment.reward_points,v_key,v_actor,v_now) on conflict (submission_id) do nothing returning id into v_reward_id;
    if v_reward_id is not null then
      update public.profiles set points=points+v_assignment.reward_points where id=v_submission.member_id;
      insert into public.activities(activity_key,profile_id,activity_type,title,detail,points,occurred_at,build_submission_id)
      values(v_key,v_submission.member_id,'build_prove',v_assignment.title,'Build & Prove assignment approved',v_assignment.reward_points,v_now,p_submission_id) on conflict (activity_key) do nothing;
      update public.build_submissions set reward_awarded_at=v_now where id=p_submission_id;
    end if;
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) values(v_actor,'build_submission_' || p_decision,'build_submission',p_submission_id,jsonb_build_object('member_id',v_submission.member_id,'reward_points',case when p_decision='approved' then v_assignment.reward_points else 0 end));
  return jsonb_build_object('submission_id',p_submission_id,'status',p_decision,'reward_status',case when p_decision='approved' and v_reward_id is not null then 'awarded' when p_decision='approved' then 'already_awarded' else 'not_applicable' end);
end; $$;

create or replace function public.add_build_submission_evidence(p_submission_id uuid, p_storage_path text, p_content_type text, p_file_size integer, p_caption text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if p_storage_path !~ ('^submissions/' || v_actor::text || '/' || p_submission_id::text || '/.+') or char_length(trim(coalesce(p_content_type,''))) > 120 or p_file_size not between 1 and 10485760 or char_length(trim(coalesce(p_caption,''))) > 500 then raise exception using errcode='22023',message='Invalid evidence'; end if;
  if not exists (select 1 from public.build_submissions where id=p_submission_id and member_id=v_actor and status in ('draft','changes_requested')) then raise exception using errcode='42501',message='Evidence access denied'; end if;
  if not exists (select 1 from storage.objects where bucket_id='build-prove-private' and name=p_storage_path) then raise exception using errcode='P0002',message='Evidence object not found'; end if;
  insert into public.build_submission_evidence(submission_id,owner_id,storage_path,content_type,file_size,caption) values(p_submission_id,v_actor,p_storage_path,p_content_type,p_file_size,trim(coalesce(p_caption,''))) returning id into v_id;
  return jsonb_build_object('evidence_id',v_id);
end; $$;

revoke all on function public.save_build_assignment(uuid,text,text,text,text,text,text,text,text,timestamptz,text,jsonb,jsonb,jsonb,jsonb,integer,integer,uuid[]) from public, anon;
revoke all on function public.save_build_submission(uuid,uuid,text,text,text,text[],text,text,text,text,text,text) from public, anon;
revoke all on function public.submit_build_submission(uuid) from public, anon;
revoke all on function public.review_build_submission(uuid,text,text) from public, anon;
revoke all on function public.add_build_submission_evidence(uuid,text,text,integer,text) from public, anon;
revoke all on function public.set_build_member_domain(uuid,text,boolean) from public, anon;
revoke all on function public.add_build_assignment_attachment(uuid,text,text,integer,text) from public, anon;
grant execute on function public.save_build_assignment(uuid,text,text,text,text,text,text,text,text,timestamptz,text,jsonb,jsonb,jsonb,jsonb,integer,integer,uuid[]) to authenticated;
grant execute on function public.save_build_submission(uuid,uuid,text,text,text,text[],text,text,text,text,text,text) to authenticated;
grant execute on function public.submit_build_submission(uuid) to authenticated;
grant execute on function public.review_build_submission(uuid,text,text) to authenticated;
grant execute on function public.add_build_submission_evidence(uuid,text,text,integer,text) to authenticated;
grant execute on function public.set_build_member_domain(uuid,text,boolean) to authenticated;
grant execute on function public.add_build_assignment_attachment(uuid,text,text,integer,text) to authenticated;
