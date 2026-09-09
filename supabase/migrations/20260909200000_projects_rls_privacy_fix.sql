-- Projects privacy: avoid policy recursion by moving membership checks into
-- narrowly scoped SECURITY DEFINER helpers. A direct project_members query in
-- a project_members policy recursively invokes the same policy under RLS.
create or replace function private.is_active_project_member(
  p_project_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = p_project_id
      and profile_id = p_profile_id
      and status in ('active', 'submitted', 'completed')
  );
$$;

create or replace function private.is_active_project_owner(
  p_project_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = p_project_id
      and profile_id = p_profile_id
      and role = 'owner'
      and status = 'active'
  );
$$;

revoke all on function private.is_active_project_member(uuid, uuid), private.is_active_project_owner(uuid, uuid) from public, anon;
grant execute on function private.is_active_project_member(uuid, uuid), private.is_active_project_owner(uuid, uuid) to authenticated;

drop policy if exists "Public can read published projects" on public.projects;
create policy "Public can read published projects"
on public.projects
for select to anon
using (publication_state = 'published' and status <> 'archived');

drop policy if exists "Members can read published or involved projects" on public.projects;
create policy "Members can read published or involved projects"
on public.projects
for select to authenticated
using (
  (publication_state = 'published' and status <> 'archived')
  or (select private.is_active_project_member(projects.id, auth.uid()))
  or (select private.is_admin())
);

drop policy if exists "Members can read appropriate project memberships" on public.project_members;
create policy "Members can read appropriate project memberships"
on public.project_members
for select to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.is_active_project_member(project_members.project_id, auth.uid()))
  or (select private.is_admin())
);

drop policy if exists "Members can read own or managed join requests" on public.project_join_requests;
create policy "Members can read own or managed join requests"
on public.project_join_requests
for select to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.is_active_project_owner(project_join_requests.project_id, auth.uid()))
  or (select private.is_admin())
);

drop policy if exists "Admins and owners can read project reviews" on public.project_reviews;
create policy "Admins and owners can read project reviews"
on public.project_reviews
for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_active_project_owner(project_reviews.project_id, auth.uid()))
);
