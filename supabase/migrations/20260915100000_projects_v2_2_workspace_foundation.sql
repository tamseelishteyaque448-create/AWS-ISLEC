-- Projects V2.2 — Phase A: database foundation only.
-- Workspace mutations are deliberately RPC-only. No points, activities,
-- project lifecycle changes, or direct authenticated table writes are added.

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, project_id)
);

create index project_milestones_project_sort_idx
  on public.project_milestones (project_id, sort_order);

create trigger project_milestones_set_updated_at
before update on public.project_milestones
for each row execute function public.set_updated_at();

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid not null references public.project_milestones(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'completed')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  foreign key (milestone_id, project_id)
    references public.project_milestones (id, project_id) on delete cascade
);

create index project_tasks_project_sort_idx
  on public.project_tasks (project_id, sort_order);
create index project_tasks_milestone_sort_idx
  on public.project_tasks (milestone_id, sort_order);
create index project_tasks_active_assignee_idx
  on public.project_tasks (assignee_id, project_id, sort_order)
  where assignee_id is not null and not is_archived;

create trigger project_tasks_set_updated_at
before update on public.project_tasks
for each row execute function public.set_updated_at();

alter table public.project_milestones enable row level security;
alter table public.project_tasks enable row level security;

revoke all on public.project_milestones, public.project_tasks from anon, authenticated;
grant select on public.project_milestones, public.project_tasks to authenticated;

create policy "Active members and admins can read project milestones"
on public.project_milestones
for select to authenticated
using (
  (select private.is_active_project_member(project_id, auth.uid()))
  or (select private.is_admin())
);

create policy "Active members and admins can read project tasks"
on public.project_tasks
for select to authenticated
using (
  (select private.is_active_project_member(project_id, auth.uid()))
  or (select private.is_admin())
);

create or replace function public.create_project_milestone(
  p_project_id uuid,
  p_title text,
  p_description text default '',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_milestone_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if not private.is_active_project_owner(p_project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;
  if v_project.publication_state not in ('draft', 'published', 'changes_requested') then
    raise exception using errcode = '22023', message = 'Project workspace is read-only';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120
    or char_length(coalesce(p_description, '')) > 500
    or p_sort_order is null or p_sort_order < 0 then
    raise exception using errcode = '22023', message = 'Invalid milestone input';
  end if;

  insert into public.project_milestones (project_id, title, description, sort_order, created_by)
  values (p_project_id, trim(p_title), coalesce(p_description, ''), p_sort_order, v_actor)
  returning id into v_milestone_id;

  return jsonb_build_object('milestone_id', v_milestone_id, 'project_id', p_project_id);
end;
$$;

create or replace function public.archive_project_milestone(
  p_project_id uuid,
  p_milestone_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_milestone public.project_milestones%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if not private.is_active_project_owner(p_project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;
  if v_project.publication_state not in ('draft', 'published', 'changes_requested') then
    raise exception using errcode = '22023', message = 'Project workspace is read-only';
  end if;

  select * into v_milestone
  from public.project_milestones
  where id = p_milestone_id and project_id = p_project_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Milestone not found for project';
  end if;
  if v_milestone.is_archived then
    raise exception using errcode = '22023', message = 'Milestone is already archived';
  end if;

  update public.project_milestones set is_archived = true where id = p_milestone_id;
  return jsonb_build_object('status', 'archived', 'milestone_id', p_milestone_id);
end;
$$;

create or replace function public.create_project_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text default '',
  p_assignee_id uuid default null,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_milestone public.project_milestones%rowtype;
  v_current_milestone_id uuid;
  v_is_owner boolean;
  v_task_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if v_project.publication_state not in ('draft', 'published', 'changes_requested') then
    raise exception using errcode = '22023', message = 'Project workspace is read-only';
  end if;
  if not private.is_active_project_member(p_project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Active project membership required';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 200
    or char_length(coalesce(p_description, '')) > 2000
    or p_sort_order is null or p_sort_order < 0 then
    raise exception using errcode = '22023', message = 'Invalid task input';
  end if;

  select * into v_milestone
  from public.project_milestones
  where id = p_milestone_id and project_id = p_project_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Milestone not found for project';
  end if;
  if v_milestone.is_archived then
    raise exception using errcode = '22023', message = 'Milestone is archived';
  end if;

  v_is_owner := private.is_active_project_owner(p_project_id, v_actor);
  if not v_is_owner then
    select m.id into v_current_milestone_id
    from public.project_milestones m
    where m.project_id = p_project_id
      and not m.is_archived
      and not exists (
        select 1
        from public.project_tasks t
        where t.milestone_id = m.id
          and t.project_id = m.project_id
          and not t.is_archived
        group by t.milestone_id
        having bool_and(t.status = 'completed')
      )
    order by m.sort_order asc, m.id asc
    limit 1
    for update;

    if v_current_milestone_id is null then
      raise exception using errcode = '22023', message = 'No current milestone is available';
    end if;
    if p_milestone_id <> v_current_milestone_id then
      raise exception using errcode = '42501', message = 'Contributors may create tasks only in the current milestone';
    end if;
    if p_assignee_id is not null and p_assignee_id <> v_actor then
      raise exception using errcode = '42501', message = 'Contributors may assign only themselves';
    end if;
  end if;

  if p_assignee_id is not null and not private.is_active_project_member(p_project_id, p_assignee_id) then
    raise exception using errcode = '22023', message = 'Assignee must be an active project member';
  end if;

  insert into public.project_tasks (
    project_id, milestone_id, title, description, assignee_id, status, sort_order, created_by, completed_at
  ) values (
    p_project_id, p_milestone_id, trim(p_title), coalesce(p_description, ''), p_assignee_id,
    'todo', p_sort_order, v_actor, null
  ) returning id into v_task_id;

  return jsonb_build_object('task_id', v_task_id, 'project_id', p_project_id, 'milestone_id', p_milestone_id);
end;
$$;

create or replace function public.update_task_status(
  p_project_id uuid,
  p_task_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_task public.project_tasks%rowtype;
  v_milestone_archived boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_status is null or p_status not in ('todo', 'in_progress', 'blocked', 'completed') then
    raise exception using errcode = '22023', message = 'Invalid task status';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if v_project.publication_state not in ('draft', 'published', 'changes_requested') then
    raise exception using errcode = '22023', message = 'Project workspace is read-only';
  end if;

  select t.* into v_task
  from public.project_tasks t
  join public.project_milestones m on m.id = t.milestone_id
  where t.id = p_task_id and t.project_id = p_project_id and m.project_id = p_project_id
  for update of t, m;
  if not found then
    raise exception using errcode = 'P0002', message = 'Task not found for project';
  end if;
  select m.is_archived into v_milestone_archived
  from public.project_milestones m
  where m.id = v_task.milestone_id and m.project_id = p_project_id;
  if v_task.is_archived or v_milestone_archived then
    raise exception using errcode = '22023', message = 'Archived tasks or milestones cannot be changed';
  end if;
  if not private.is_active_project_owner(p_project_id, v_actor)
    and (v_task.assignee_id is distinct from v_actor or not private.is_active_project_member(p_project_id, v_actor)) then
    raise exception using errcode = '42501', message = 'Owner or current active assignee access required';
  end if;

  update public.project_tasks
  set status = p_status,
      completed_at = case when p_status = 'completed' then timezone('utc', now()) else null end
  where id = p_task_id;

  return jsonb_build_object('status', p_status, 'task_id', p_task_id);
end;
$$;

create or replace function public.assign_task(
  p_project_id uuid,
  p_task_id uuid,
  p_assignee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_task public.project_tasks%rowtype;
  v_milestone_archived boolean;
  v_is_owner boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if v_project.publication_state not in ('draft', 'published', 'changes_requested') then
    raise exception using errcode = '22023', message = 'Project workspace is read-only';
  end if;

  select t.* into v_task
  from public.project_tasks t
  join public.project_milestones m on m.id = t.milestone_id
  where t.id = p_task_id and t.project_id = p_project_id and m.project_id = p_project_id
  for update of t, m;
  if not found then
    raise exception using errcode = 'P0002', message = 'Task not found for project';
  end if;
  select m.is_archived into v_milestone_archived
  from public.project_milestones m
  where m.id = v_task.milestone_id and m.project_id = p_project_id;
  if v_task.is_archived or v_milestone_archived then
    raise exception using errcode = '22023', message = 'Archived tasks or milestones cannot be assigned';
  end if;

  v_is_owner := private.is_active_project_owner(p_project_id, v_actor);
  if not v_is_owner and not private.is_active_project_member(p_project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Active project membership required';
  end if;
  if p_assignee_id is not null and not private.is_active_project_member(p_project_id, p_assignee_id) then
    raise exception using errcode = '22023', message = 'Assignee must be an active project member';
  end if;

  if v_is_owner then
    update public.project_tasks set assignee_id = p_assignee_id where id = p_task_id;
  else
    if p_assignee_id is distinct from v_actor then
      raise exception using errcode = '42501', message = 'Contributors may only self-assign';
    end if;
    update public.project_tasks
    set assignee_id = v_actor
    where id = p_task_id and assignee_id is null and not is_archived;
    if not found then
      raise exception using errcode = '40001', message = 'Task was claimed by another member';
    end if;
  end if;

  return jsonb_build_object('status', 'assigned', 'task_id', p_task_id, 'assignee_id', p_assignee_id);
end;
$$;

create or replace function public.archive_task(
  p_project_id uuid,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_task public.project_tasks%rowtype;
  v_milestone_archived boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if not private.is_active_project_owner(p_project_id, v_actor) then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;
  if v_project.publication_state not in ('draft', 'published', 'changes_requested') then
    raise exception using errcode = '22023', message = 'Project workspace is read-only';
  end if;

  select t.* into v_task
  from public.project_tasks t
  join public.project_milestones m on m.id = t.milestone_id
  where t.id = p_task_id and t.project_id = p_project_id and m.project_id = p_project_id
  for update of t, m;
  if not found then
    raise exception using errcode = 'P0002', message = 'Task not found for project';
  end if;
  select m.is_archived into v_milestone_archived
  from public.project_milestones m
  where m.id = v_task.milestone_id and m.project_id = p_project_id;
  if v_task.is_archived then
    raise exception using errcode = '22023', message = 'Task is already archived';
  end if;
  if v_milestone_archived then
    raise exception using errcode = '22023', message = 'Milestone is archived';
  end if;

  update public.project_tasks set is_archived = true where id = p_task_id;
  return jsonb_build_object('status', 'archived', 'task_id', p_task_id);
end;
$$;

revoke all on function public.create_project_milestone(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.archive_project_milestone(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_project_task(uuid, uuid, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.update_task_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.assign_task(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.archive_task(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_project_milestone(uuid, text, text, integer) to authenticated;
grant execute on function public.archive_project_milestone(uuid, uuid) to authenticated;
grant execute on function public.create_project_task(uuid, uuid, text, text, uuid, integer) to authenticated;
grant execute on function public.update_task_status(uuid, uuid, text) to authenticated;
grant execute on function public.assign_task(uuid, uuid, uuid) to authenticated;
grant execute on function public.archive_task(uuid, uuid) to authenticated;
