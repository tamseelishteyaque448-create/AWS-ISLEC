-- Projects are a community-operated domain. Publication controls discovery;
-- project membership owns the member work/review lifecycle.
alter table public.projects add column is_published boolean not null default false;
alter table public.project_members
  add column status text not null default 'requested' check (status in ('requested', 'active', 'submitted', 'completed', 'declined', 'withdrawn')),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz;

-- Existing rows predate the request workflow and represent active teams.
update public.project_members set status = 'active' where status = 'requested';
update public.projects set is_published = true where status <> 'archived';

create index project_members_project_status_idx on public.project_members (project_id, status);

-- Replace permissive creator/team policies with a published-or-involved model.
drop policy if exists "Authenticated members can read projects" on public.projects;
drop policy if exists "Members can create projects" on public.projects;
drop policy if exists "Project creators can update projects" on public.projects;
drop policy if exists "Project creators can delete projects" on public.projects;
drop policy if exists "Authenticated members can read project members" on public.project_members;
drop policy if exists "Project creators can add members" on public.project_members;
drop policy if exists "Project creators can remove members" on public.project_members;

revoke insert, update, delete on public.projects from authenticated;
revoke insert, update, delete on public.project_members from authenticated;
grant insert, update on public.projects to authenticated;

create policy "Public can read published projects"
on public.projects for select to anon
using (is_published and status <> 'archived');

create policy "Members can read published or involved projects"
on public.projects for select to authenticated
using (
  (is_published and status <> 'archived')
  or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.profile_id = (select auth.uid()))
  or (select private.is_admin())
);

create policy "Admins can manage projects"
on public.projects for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Members can read their project memberships"
on public.project_members for select to authenticated
using (profile_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.projects to anon;

create or replace function public.request_project_access(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_member public.project_members%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if v_profile_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not v_project.is_published or v_project.status <> 'in_progress' then raise exception using errcode = 'P0002', message = 'Project is not accepting members'; end if;
  select * into v_member from public.project_members where project_id = p_project_id and profile_id = v_profile_id for update;
  if found and v_member.status in ('requested', 'active', 'submitted', 'completed') then
    return jsonb_build_object('status', v_member.status, 'project_id', p_project_id);
  end if;
  if found then
    update public.project_members set status = 'requested', submitted_at = null, reviewed_at = null where project_id = p_project_id and profile_id = v_profile_id;
  else
    insert into public.project_members (project_id, profile_id, role, status, joined_at) values (p_project_id, v_profile_id, 'contributor', 'requested', v_now);
  end if;
  return jsonb_build_object('status', 'requested', 'project_id', p_project_id);
end;
$$;

create or replace function public.submit_project_work(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_member public.project_members%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if v_profile_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.status <> 'in_progress' then raise exception using errcode = 'P0002', message = 'Project is not open for submissions'; end if;
  select * into v_member from public.project_members where project_id = p_project_id and profile_id = v_profile_id for update;
  if not found or v_member.status not in ('active', 'submitted') then raise exception using errcode = '42501', message = 'Active project membership required'; end if;
  if v_member.status = 'submitted' then return jsonb_build_object('status', 'already_submitted', 'project_id', p_project_id); end if;
  update public.project_members set status = 'submitted', submitted_at = v_now, reviewed_at = null where project_id = p_project_id and profile_id = v_profile_id;
  return jsonb_build_object('status', 'submitted', 'project_id', p_project_id);
end;
$$;

create or replace function public.review_project_member(p_project_id uuid, p_profile_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_member public.project_members%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  if p_action not in ('approve_request', 'decline_request', 'complete_submission', 'return_submission') then raise exception using errcode = '22023', message = 'Invalid review action'; end if;
  select * into v_member from public.project_members where project_id = p_project_id and profile_id = p_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Project membership not found'; end if;
  if p_action = 'approve_request' and v_member.status = 'requested' then
    update public.project_members set status = 'active', reviewed_at = v_now, joined_at = v_now where project_id = p_project_id and profile_id = p_profile_id;
  elsif p_action = 'decline_request' and v_member.status = 'requested' then
    update public.project_members set status = 'declined', reviewed_at = v_now where project_id = p_project_id and profile_id = p_profile_id;
  elsif p_action = 'complete_submission' and v_member.status = 'submitted' then
    update public.project_members set status = 'completed', reviewed_at = v_now where project_id = p_project_id and profile_id = p_profile_id;
  elsif p_action = 'return_submission' and v_member.status = 'submitted' then
    update public.project_members set status = 'active', reviewed_at = v_now where project_id = p_project_id and profile_id = p_profile_id;
  else
    return jsonb_build_object('status', 'already_reviewed', 'project_id', p_project_id, 'membership_status', v_member.status);
  end if;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata) values (auth.uid(), 'project_member.' || p_action, 'project', p_project_id, jsonb_build_object('profile_id', p_profile_id));
  return jsonb_build_object('status', p_action, 'project_id', p_project_id, 'profile_id', p_profile_id);
end;
$$;

revoke all on function public.request_project_access(uuid) from public, anon, authenticated;
revoke all on function public.submit_project_work(uuid) from public, anon, authenticated;
revoke all on function public.review_project_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.request_project_access(uuid), public.submit_project_work(uuid), public.review_project_member(uuid, uuid, text) to authenticated;

create or replace function public.audit_admin_project_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'project.' || lower(tg_op), 'project', new.id, jsonb_build_object('status', new.status, 'published', new.is_published));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_admin_project_change() from public, anon, authenticated;
create trigger projects_audit_admin_change after insert or update on public.projects for each row execute function public.audit_admin_project_change();
