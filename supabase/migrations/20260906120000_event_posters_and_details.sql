-- Keep event media and long-form content alongside the existing event domain.
-- Object paths, rather than URLs or blobs, make media replaceable and keep the
-- private Storage bucket as the access-control boundary.
alter table public.events
  add column if not exists poster_path text,
  add column if not exists poster_alt text,
  add column if not exists details text not null default '';

alter table public.events
  drop constraint if exists events_poster_path_matches_event_id,
  add constraint events_poster_path_matches_event_id
    check (poster_path is null or poster_path like ('events/' || id::text || '/%')),
  drop constraint if exists events_poster_alt_length,
  add constraint events_poster_alt_length
    check (poster_alt is null or char_length(trim(poster_alt)) between 1 and 200),
  drop constraint if exists events_details_length,
  add constraint events_details_length
    check (char_length(details) <= 20000);

-- The bucket is intentionally private: Storage object policies decide who can
-- read a poster, and the app creates short-lived URLs only after those checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-posters',
  'event-posters',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can manage event posters" on storage.objects;
create policy "Admins can manage event posters"
on storage.objects
for all to authenticated
using (bucket_id = 'event-posters' and private.is_admin())
with check (bucket_id = 'event-posters' and private.is_admin());

-- Public visitors can obtain a signed URL only for a current public event.
-- Active registrants retain access to their own event poster if an event is
-- subsequently unpublished; no policy gives anonymous callers draft access.
drop policy if exists "Visitors can read visible event posters" on storage.objects;
create policy "Visitors can read visible event posters"
on storage.objects
for select to public
using (
  bucket_id = 'event-posters'
  and exists (
    select 1
    from public.events as event
    where event.poster_path = storage.objects.name
      and (
        (event.is_published and event.status <> 'cancelled')
        or (
          (select auth.uid()) is not null
          and exists (
            select 1
            from public.event_attendees as attendee
            where attendee.event_id = event.id
              and attendee.profile_id = (select auth.uid())
              and attendee.status in ('registered', 'attended')
          )
        )
      )
  )
);

-- Aggregate availability is a deliberately narrow, read-only projection.
-- It retains the existing registration RPC as the sole authority for writes.
create or replace function public.get_event_availability(p_event_id uuid)
returns table (registered_count integer, available_slots integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_count integer;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Event not found';
  end if;

  if not (
    (v_event.is_published and v_event.status <> 'cancelled')
    or private.is_admin()
    or exists (
      select 1 from public.event_attendees
      where event_id = p_event_id and profile_id = (select auth.uid())
    )
  ) then
    raise exception using errcode = '42501', message = 'Event access denied';
  end if;

  select count(*) into v_count
  from public.event_attendees
  where event_id = p_event_id and status in ('registered', 'attended');

  return query select v_count,
    case when v_event.capacity is null then null else greatest(v_event.capacity - v_count, 0) end;
end;
$$;

revoke all on function public.get_event_availability(uuid) from public;
grant execute on function public.get_event_availability(uuid) to anon, authenticated;
