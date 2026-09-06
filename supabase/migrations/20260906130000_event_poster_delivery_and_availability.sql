-- Poster reads are current-state checks, never a durable grant to attendees.
drop policy if exists "Visitors can read visible event posters" on storage.objects;
create policy "Visitors can read current public event posters"
on storage.objects
for select to public
using (
  bucket_id = 'event-posters'
  and exists (
    select 1
    from public.events as event
    where event.poster_path = storage.objects.name
      and event.is_published
      and event.status <> 'cancelled'
  )
);

-- Batch the existing availability projection for calendar pages. It returns
-- rows only for events the caller is already entitled to read.
create or replace function public.get_event_availabilities(p_event_ids uuid[])
returns table (event_id uuid, registered_count integer, available_slots integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    count(attendee.profile_id) filter (where attendee.status in ('registered', 'attended'))::integer,
    case
      when event.capacity is null then null
      else greatest(event.capacity - count(attendee.profile_id) filter (where attendee.status in ('registered', 'attended'))::integer, 0)
    end
  from public.events as event
  left join public.event_attendees as attendee on attendee.event_id = event.id
  where event.id = any(p_event_ids)
    and (
      (event.is_published and event.status <> 'cancelled')
      or private.is_admin()
      or exists (
        select 1 from public.event_attendees as own_attendee
        where own_attendee.event_id = event.id
          and own_attendee.profile_id = (select auth.uid())
      )
    )
  group by event.id, event.capacity;
$$;

revoke all on function public.get_event_availabilities(uuid[]) from public;
grant execute on function public.get_event_availabilities(uuid[]) to anon, authenticated;
