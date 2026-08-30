-- AWS ISLEC database foundation. Application data lives in public; identities live in auth.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  handle text not null unique check (handle ~ '^@[A-Za-z0-9_]{3,32}$'),
  role text not null default 'Member' check (char_length(trim(role)) between 1 and 80),
  avatar_url text,
  points integer not null default 0 check (points >= 0),
  streak integer not null default 0 check (streak >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null unique check (char_length(trim(title)) between 1 and 160),
  description text not null default '',
  level text not null check (level in ('starter', 'builder', 'architect')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  points integer not null default 0 check (points >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null unique check (char_length(trim(title)) between 1 and 160),
  detail text not null default '',
  level text not null check (level in ('starter', 'builder', 'architect')),
  points integer not null check (points >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (learning_path_id, sort_order)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null unique check (char_length(trim(title)) between 1 and 160),
  category text not null check (char_length(trim(category)) between 1 and 80),
  status text not null default 'in_progress' check (status in ('in_progress', 'shipped', 'archived')),
  description text not null default '',
  progress integer not null default 0 check (progress between 0 and 100),
  technologies text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'contributor' check (role in ('owner', 'contributor')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, profile_id)
);

create table public.user_challenge_progress (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, challenge_id),
  check ((status <> 'completed' or (progress = 100 and completed_at is not null))),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null unique check (char_length(trim(title)) between 1 and 160),
  event_type text not null check (char_length(trim(event_type)) between 1 and 80),
  status text not null default 'upcoming' check (status in ('upcoming', 'past', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  context text not null default '',
  attendance_label text,
  capacity integer check (capacity is null or capacity > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or ends_at > starts_at)
);

create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'attended', 'cancelled')),
  registered_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, profile_id)
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  icon text not null check (char_length(trim(icon)) between 1 and 32),
  title text not null unique check (char_length(trim(title)) between 1 and 120),
  detail text not null default '',
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, badge_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_key text not null unique check (activity_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null check (activity_type in ('project', 'lesson', 'badge', 'event')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  detail text not null default '',
  points integer not null default 0 check (points >= 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  project_id uuid references public.projects (id) on delete set null,
  learning_path_id uuid references public.learning_paths (id) on delete set null,
  badge_id uuid references public.badges (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (num_nonnulls(project_id, learning_path_id, badge_id, event_id) <= 1)
);

create index projects_created_by_idx on public.projects (created_by);
create index project_members_profile_id_idx on public.project_members (profile_id);
create index challenges_learning_path_id_idx on public.challenges (learning_path_id);
create index user_challenge_progress_profile_id_idx on public.user_challenge_progress (profile_id);
create index events_starts_at_idx on public.events (starts_at);
create index events_status_starts_at_idx on public.events (status, starts_at);
create index event_attendees_profile_id_idx on public.event_attendees (profile_id);
create index user_badges_profile_id_idx on public.user_badges (profile_id);
create index activities_profile_occurred_at_idx on public.activities (profile_id, occurred_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger learning_paths_set_updated_at before update on public.learning_paths for each row execute function public.set_updated_at();
create trigger challenges_set_updated_at before update on public.challenges for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger user_challenge_progress_set_updated_at before update on public.user_challenge_progress for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger event_attendees_set_updated_at before update on public.event_attendees for each row execute function public.set_updated_at();
create trigger badges_set_updated_at before update on public.badges for each row execute function public.set_updated_at();
create trigger activities_set_updated_at before update on public.activities for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, handle)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(new.email, '@', 1), ''), 'New member'),
    case
      when coalesce(new.raw_user_meta_data ->> 'handle', '') ~ '^@[A-Za-z0-9_]{3,32}$' then new.raw_user_meta_data ->> 'handle'
      else '@member_' || substring(new.id::text from 1 for 8)
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.learning_paths enable row level security;
alter table public.challenges enable row level security;
alter table public.user_challenge_progress enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.activities enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;

grant select on public.profiles, public.projects, public.project_members, public.learning_paths, public.challenges, public.events, public.badges to authenticated;
grant update (full_name, handle, avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.projects to authenticated;
grant insert, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.user_challenge_progress to authenticated;
grant select, insert, update, delete on public.event_attendees to authenticated;
grant select on public.user_badges, public.activities to authenticated;

create policy "Authenticated members can read profiles" on public.profiles for select to authenticated using ((select auth.uid()) is not null);
create policy "Members can update their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Authenticated members can read projects" on public.projects for select to authenticated using ((select auth.uid()) is not null);
create policy "Members can create projects" on public.projects for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "Project creators can update projects" on public.projects for update to authenticated using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
create policy "Project creators can delete projects" on public.projects for delete to authenticated using ((select auth.uid()) = created_by);

create policy "Authenticated members can read project members" on public.project_members for select to authenticated using ((select auth.uid()) is not null);
create policy "Project creators can add members" on public.project_members for insert to authenticated with check (exists (select 1 from public.projects where projects.id = project_members.project_id and projects.created_by = (select auth.uid())));
create policy "Project creators can remove members" on public.project_members for delete to authenticated using (exists (select 1 from public.projects where projects.id = project_members.project_id and projects.created_by = (select auth.uid())));

create policy "Authenticated members can read published learning paths" on public.learning_paths for select to authenticated using (is_published);
create policy "Authenticated members can read published challenges" on public.challenges for select to authenticated using (is_published);

create policy "Members can read their challenge progress" on public.user_challenge_progress for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Members can start their challenge progress" on public.user_challenge_progress for insert to authenticated with check ((select auth.uid()) = profile_id);
create policy "Members can update their challenge progress" on public.user_challenge_progress for update to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "Members can delete their challenge progress" on public.user_challenge_progress for delete to authenticated using ((select auth.uid()) = profile_id);

create policy "Authenticated members can read events" on public.events for select to authenticated using ((select auth.uid()) is not null);
create policy "Members can read their event attendance" on public.event_attendees for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Members can register for events" on public.event_attendees for insert to authenticated with check ((select auth.uid()) = profile_id);
create policy "Members can update their event attendance" on public.event_attendees for update to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "Members can cancel their event attendance" on public.event_attendees for delete to authenticated using ((select auth.uid()) = profile_id);

create policy "Authenticated members can read badges" on public.badges for select to authenticated using ((select auth.uid()) is not null);
create policy "Members can read their badges" on public.user_badges for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Members can read their activities" on public.activities for select to authenticated using ((select auth.uid()) = profile_id);
