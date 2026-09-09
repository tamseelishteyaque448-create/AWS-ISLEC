-- Projects V1: project lifecycle is separate from delivery stage.  A request
-- table is necessary because project_members has one row per person/project and
-- cannot retain withdrawals, rejections, or repeat-request history.
alter table public.projects
  add column if not exists publication_state text,
  add column if not exists build_stage text,
  add column if not exists recruitment_mode text,
  add column if not exists team_capacity integer,
  add column if not exists repository_url text,
  add column if not exists demo_url text;

update public.projects
set publication_state = case when status = 'archived' then 'archived' when is_published then 'published' else 'draft' end,
    build_stage = case when status = 'shipped' then 'shipped' else 'building' end,
    recruitment_mode = 'open'
where publication_state is null or build_stage is null or recruitment_mode is null;

alter table public.projects
  alter column publication_state set default 'draft',
  alter column publication_state set not null,
  alter column build_stage set default 'idea',
  alter column build_stage set not null,
  alter column recruitment_mode set default 'open',
  alter column recruitment_mode set not null;

alter table public.projects drop constraint if exists projects_publication_state_check;
alter table public.projects add constraint projects_publication_state_check check (publication_state in ('draft', 'pending_review', 'published', 'changes_requested', 'archived'));
alter table public.projects drop constraint if exists projects_build_stage_check;
alter table public.projects add constraint projects_build_stage_check check (build_stage in ('idea', 'building', 'prototype', 'shipped'));
alter table public.projects drop constraint if exists projects_recruitment_mode_check;
alter table public.projects add constraint projects_recruitment_mode_check check (recruitment_mode in ('open', 'invite_only', 'not_recruiting'));
alter table public.projects drop constraint if exists projects_team_capacity_check;
alter table public.projects add constraint projects_team_capacity_check check (team_capacity is null or team_capacity > 0);
alter table public.projects drop constraint if exists projects_repository_url_check;
alter table public.projects add constraint projects_repository_url_check check (repository_url is null or repository_url ~ '^https?://');
alter table public.projects drop constraint if exists projects_demo_url_check;
alter table public.projects add constraint projects_demo_url_check check (demo_url is null or demo_url ~ '^https?://');

-- A legacy import can contain multiple owner flags. Keep one deterministic
-- owner (prefer created_by), then make the invariant enforceable.
with ranked_owners as (
  select pm.project_id, pm.profile_id,
    row_number() over (partition by pm.project_id order by (pm.profile_id = p.created_by) desc, pm.joined_at, pm.profile_id) as rank
  from public.project_members pm join public.projects p on p.id = pm.project_id
  where pm.role = 'owner'
)
update public.project_members pm set role = 'contributor'
from ranked_owners ro where ro.project_id = pm.project_id and ro.profile_id = pm.profile_id and ro.rank > 1;
update public.project_members pm set role = 'owner', status = 'active'
from public.projects p where pm.project_id = p.id and pm.profile_id = p.created_by
  and not exists (select 1 from public.project_members owner_row where owner_row.project_id = p.id and owner_row.role = 'owner');
create unique index if not exists project_members_one_owner_idx on public.project_members(project_id) where role = 'owner';

-- Preserve compatibility for legacy readers, but prevent it from becoming an
-- authority: publication_state is the authoritative visibility field.
create or replace function public.sync_project_legacy_state()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.status := case when new.publication_state = 'archived' then 'archived' when new.build_stage = 'shipped' then 'shipped' else 'in_progress' end;
  new.is_published := new.publication_state = 'published';
  return new;
end;
$$;
drop trigger if exists projects_sync_legacy_state on public.projects;
create trigger projects_sync_legacy_state before insert or update on public.projects for each row execute function public.sync_project_legacy_state();

create table if not exists public.project_join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_contribution text not null default '' check (char_length(trim(requested_contribution)) <= 120),
  message text not null default '' check (char_length(trim(message)) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'withdrawn', 'declined', 'approved')),
  requested_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  check ((status in ('requested', 'withdrawn')) = (resolved_at is null))
);
create unique index if not exists project_join_requests_one_open_idx on public.project_join_requests(project_id, profile_id) where status = 'requested';
create index if not exists project_join_requests_project_status_idx on public.project_join_requests(project_id, status, requested_at desc);

create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('submitted', 'approved', 'changes_requested', 'archived', 'ownership_recovered')),
  feedback text not null default '' check (char_length(trim(feedback)) <= 2000),
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists project_reviews_project_created_idx on public.project_reviews(project_id, created_at desc);

alter table public.project_join_requests enable row level security;
alter table public.project_reviews enable row level security;
revoke all on public.project_join_requests, public.project_reviews from anon, authenticated;
grant select on public.project_join_requests, public.project_reviews to authenticated;
create policy "Members can read own or managed join requests" on public.project_join_requests for select to authenticated using (
  profile_id = (select auth.uid()) or exists (select 1 from public.project_members pm where pm.project_id = project_join_requests.project_id and pm.profile_id = (select auth.uid()) and pm.role = 'owner' and pm.status = 'active') or (select private.is_admin())
);
create policy "Admins can read project reviews" on public.project_reviews for select to authenticated using ((select private.is_admin()));

drop policy if exists "Public can read published projects" on public.projects;
create policy "Public can read published projects" on public.projects for select to anon using (publication_state = 'published');
drop policy if exists "Members can read published or involved projects" on public.projects;
create policy "Members can read published or involved projects" on public.projects for select to authenticated using (
  publication_state = 'published' or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.profile_id = (select auth.uid())) or (select private.is_admin())
);
drop policy if exists "Members can read their project memberships" on public.project_members;
create policy "Members can read appropriate project memberships" on public.project_members for select to authenticated using (
  profile_id = (select auth.uid()) or exists (select 1 from public.project_members mine where mine.project_id = project_members.project_id and mine.profile_id = (select auth.uid()) and mine.status = 'active') or (select private.is_admin())
);

create or replace function public.project_is_owner(p_project_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.project_members where project_id = p_project_id and profile_id = p_profile_id and role = 'owner' and status = 'active');
$$;

create or replace function public.create_project_v1(p_title text, p_slug text, p_category text, p_description text, p_technologies text[], p_recruitment_mode text default 'open', p_team_capacity integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_actor uuid := auth.uid();
begin
 if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
 if p_title !~ '\S' or char_length(trim(p_title)) > 160 or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or p_category !~ '\S' or char_length(trim(p_category)) > 80 or char_length(coalesce(p_description,'')) > 2000 or p_recruitment_mode not in ('open','invite_only','not_recruiting') or (p_team_capacity is not null and p_team_capacity < 1) then raise exception using errcode = '22023', message = 'Invalid project input'; end if;
 insert into public.projects(id, title, slug, category, description, technologies, created_by, publication_state, build_stage, recruitment_mode, team_capacity) values(v_id, trim(p_title), p_slug, trim(p_category), coalesce(trim(p_description),''), coalesce(p_technologies,'{}'), v_actor, 'draft', 'idea', p_recruitment_mode, p_team_capacity);
 insert into public.project_members(project_id, profile_id, role, status) values(v_id, v_actor, 'owner', 'active');
 return jsonb_build_object('project_id',v_id,'slug',p_slug);
end;
$$;

create or replace function public.request_project_join(p_project_id uuid, p_contribution text default '', p_message text default '') returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_project public.projects%rowtype;
begin
 if v_actor is null then raise exception using errcode='42501',message='Authentication required'; end if;
 select * into v_project from public.projects where id=p_project_id for update;
 if not found or v_project.publication_state <> 'published' or v_project.recruitment_mode <> 'open' then raise exception using errcode='22023',message='Project is not accepting join requests'; end if;
 if public.project_is_owner(p_project_id,v_actor) then raise exception using errcode='42501',message='Owners cannot request to join their own project'; end if;
 if exists(select 1 from public.project_members where project_id=p_project_id and profile_id=v_actor and status in ('active','submitted','completed')) then raise exception using errcode='22023',message='Already a project member'; end if;
 if char_length(coalesce(p_contribution,'')) > 120 or char_length(coalesce(p_message,'')) > 1000 then raise exception using errcode='22023',message='Invalid request'; end if;
 insert into public.project_join_requests(project_id,profile_id,requested_contribution,message) values(p_project_id,v_actor,trim(coalesce(p_contribution,'')),trim(coalesce(p_message,'')));
 return jsonb_build_object('status','requested','project_id',p_project_id);
exception when unique_violation then return jsonb_build_object('status','requested','project_id',p_project_id);
end;
$$;

create or replace function public.withdraw_project_join_request(p_request_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 update public.project_join_requests set status='withdrawn' where id=p_request_id and profile_id=auth.uid() and status='requested';
 if not found then raise exception using errcode='P0002',message='Pending request not found'; end if;
 return jsonb_build_object('status','withdrawn');
end;
$$;

create or replace function public.resolve_project_join_request(p_request_id uuid, p_approve boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.project_join_requests%rowtype; v_project public.projects%rowtype; v_actor uuid:=auth.uid(); v_active integer;
begin
 select * into v_request from public.project_join_requests where id=p_request_id for update; if not found then raise exception using errcode='P0002',message='Request not found'; end if;
 select * into v_project from public.projects where id=v_request.project_id for update; if not public.project_is_owner(v_request.project_id,v_actor) then raise exception using errcode='42501',message='Owner access required'; end if;
 if v_request.status <> 'requested' then raise exception using errcode='22023',message='Request is no longer pending'; end if;
 if p_approve then
  if v_project.publication_state='archived' then raise exception using errcode='22023',message='Archived project'; end if;
  select count(*) into v_active from public.project_members where project_id=v_request.project_id and status in ('active','submitted','completed');
  if v_project.team_capacity is not null and v_active >= v_project.team_capacity then raise exception using errcode='22023',message='Project is at capacity'; end if;
  insert into public.project_members(project_id,profile_id,role,status) values(v_request.project_id,v_request.profile_id,'contributor','active') on conflict(project_id,profile_id) do update set role='contributor',status='active',joined_at=timezone('utc',now());
 update public.project_join_requests set status='approved',resolved_at=timezone('utc',now()),resolved_by=v_actor where id=p_request_id;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) values(v_actor,'project.join_request_approved','project',v_request.project_id,jsonb_build_object('profile_id',v_request.profile_id));
 else update public.project_join_requests set status='declined',resolved_at=timezone('utc',now()),resolved_by=v_actor where id=p_request_id;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) values(v_actor,'project.join_request_declined','project',v_request.project_id,jsonb_build_object('profile_id',v_request.profile_id)); end if;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'declined' end);
end;
$$;

create or replace function public.submit_project_for_review(p_project_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid();
begin
 if not public.project_is_owner(p_project_id,v_actor) then raise exception using errcode='42501',message='Owner access required'; end if;
 update public.projects set publication_state='pending_review' where id=p_project_id and publication_state in ('draft','changes_requested');
 if not found then raise exception using errcode='22023',message='Project cannot be submitted'; end if;
 insert into public.project_reviews(project_id,reviewer_id,decision) values(p_project_id,v_actor,'submitted');
 return jsonb_build_object('status','pending_review');
end;
$$;

create or replace function public.review_project_publication(p_project_id uuid, p_decision text, p_feedback text default '') returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_state text;
begin
 if not private.is_admin() then raise exception using errcode='42501',message='Administrator access required'; end if;
 if p_decision not in ('approved','changes_requested','archived') or char_length(coalesce(p_feedback,'')) > 2000 then raise exception using errcode='22023',message='Invalid review'; end if;
 select publication_state into v_state from public.projects where id=p_project_id for update; if not found then raise exception using errcode='P0002',message='Project not found'; end if;
 if (p_decision in ('approved','changes_requested') and v_state <> 'pending_review') or (p_decision='archived' and v_state='archived') then raise exception using errcode='22023',message='Stale project review'; end if;
 update public.projects set publication_state=case p_decision when 'approved' then 'published' when 'changes_requested' then 'changes_requested' else 'archived' end where id=p_project_id;
 insert into public.project_reviews(project_id,reviewer_id,decision,feedback) values(p_project_id,v_actor,p_decision,trim(coalesce(p_feedback,'')));
 insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) values(v_actor,'project.'||p_decision,'project',p_project_id,jsonb_build_object('feedback_provided',p_feedback<>''));
 return jsonb_build_object('status',p_decision);
end;
$$;

create or replace function public.transfer_project_ownership(p_project_id uuid, p_new_owner_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid();
begin
 perform 1 from public.projects where id=p_project_id for update; if not found then raise exception using errcode='P0002',message='Project not found'; end if;
 if not public.project_is_owner(p_project_id,v_actor) and not private.is_admin() then raise exception using errcode='42501',message='Owner or admin access required'; end if;
 if not exists(select 1 from public.project_members where project_id=p_project_id and profile_id=p_new_owner_id and status='active') then raise exception using errcode='22023',message='New owner must be active'; end if;
 update public.project_members set role='contributor' where project_id=p_project_id and role='owner';
 update public.project_members set role='owner' where project_id=p_project_id and profile_id=p_new_owner_id;
 insert into public.admin_audit_log(actor_id,action,target_type,target_id,metadata) select v_actor,'project.ownership_transferred','project',p_project_id,jsonb_build_object('new_owner_id',p_new_owner_id) where private.is_admin();
 return jsonb_build_object('status','transferred');
end;
$$;

revoke all on function public.project_is_owner(uuid,uuid), public.create_project_v1(text,text,text,text,text[],text,integer), public.request_project_join(uuid,text,text), public.withdraw_project_join_request(uuid), public.resolve_project_join_request(uuid,boolean), public.submit_project_for_review(uuid), public.review_project_publication(uuid,text,text), public.transfer_project_ownership(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.request_project_access(uuid) from authenticated;
grant execute on function public.create_project_v1(text,text,text,text,text[],text,integer), public.request_project_join(uuid,text,text), public.withdraw_project_join_request(uuid), public.resolve_project_join_request(uuid,boolean), public.submit_project_for_review(uuid), public.review_project_publication(uuid,text,text), public.transfer_project_ownership(uuid,uuid) to authenticated;
