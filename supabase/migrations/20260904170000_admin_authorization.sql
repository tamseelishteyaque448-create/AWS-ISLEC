-- Administrative authorization is intentionally separate from profiles.role.
-- The allowlist is private and can only be maintained through a privileged server process
-- or directly by a trusted database administrator during bootstrap.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- This project may be connected to a database where the private allowlist was
-- bootstrapped before migration history was linked. Keep the baseline safe to
-- resume in that case; it does not alter an existing allowlist or its data.
create table if not exists private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default timezone('utc', now())
);

revoke all on private.admin_users from public, anon, authenticated;

-- This function is used by RLS policies. Keep it out of the exposed public schema.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- The public wrapper reveals only whether the current caller is an administrator.
-- It lets server code verify authorization with the caller's normal RLS-bound session.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (char_length(trim(action)) between 1 and 120),
  target_type text not null check (char_length(trim(target_type)) between 1 and 80),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

drop policy if exists "Admins can read audit logs" on public.admin_audit_log;
create policy "Admins can read audit logs"
on public.admin_audit_log
for select to authenticated
using ((select private.is_admin()));

-- Admins may manage community-owned catalogue content. Member tables retain their
-- existing owner/self-service policies; privileged member and identity management
-- will use the server-only admin client when it is introduced.
grant insert, update, delete on public.learning_paths, public.challenges, public.events, public.badges to authenticated;

drop policy if exists "Admins can manage learning paths" on public.learning_paths;
create policy "Admins can manage learning paths"
on public.learning_paths
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can manage challenges" on public.challenges;
create policy "Admins can manage challenges"
on public.challenges
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
on public.events
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can manage badges" on public.badges;
create policy "Admins can manage badges"
on public.badges
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
