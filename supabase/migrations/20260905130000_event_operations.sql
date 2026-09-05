-- Events become a shared domain: publication is explicit and all attendee
-- state transitions are owned by trusted database functions.
alter table public.events
  add column is_published boolean not null default false;

-- Before publication existed, non-cancelled events were the visible catalogue.
update public.events set is_published = true where status <> 'cancelled';

drop policy if exists "Authenticated members can read events" on public.events;
create policy "Public can read published events"
on public.events for select to anon
using (is_published and status <> 'cancelled');

create policy "Members can read published or registered events"
on public.events for select to authenticated
using (
  (is_published and status <> 'cancelled')
  or exists (
    select 1 from public.event_attendees as ea
    where ea.event_id = events.id and ea.profile_id = (select auth.uid())
  )
  or (select private.is_admin())
);

grant select on public.events to anon;

revoke insert, update, delete on public.event_attendees from authenticated;
drop policy if exists "Members can register for events" on public.event_attendees;
drop policy if exists "Members can update their event attendance" on public.event_attendees;
drop policy if exists "Members can cancel their event attendance" on public.event_attendees;

create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_attendee public.event_attendees%rowtype;
  v_registered_count integer;
  v_now timestamptz := timezone('utc', now());
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  -- Locking the event serializes registration attempts for its capacity.
  select * into v_event from public.events where id = p_event_id for update;
  if not found or not v_event.is_published or v_event.status <> 'upcoming' or v_event.starts_at <= v_now then
    raise exception using errcode = 'P0002', message = 'This event is not open for registration';
  end if;

  select * into v_attendee from public.event_attendees
  where event_id = p_event_id and profile_id = v_profile_id for update;
  if found and v_attendee.status in ('registered', 'attended') then
    return jsonb_build_object('status', 'already_registered', 'event_id', p_event_id, 'attendance_status', v_attendee.status);
  end if;

  if v_event.capacity is not null then
    select count(*) into v_registered_count from public.event_attendees
    where event_id = p_event_id and status in ('registered', 'attended');
    if v_registered_count >= v_event.capacity then
      raise exception using errcode = 'P0001', message = 'This event is at capacity';
    end if;
  end if;

  if found then
    update public.event_attendees
    set status = 'registered', registered_at = v_now
    where event_id = p_event_id and profile_id = v_profile_id;
  else
    insert into public.event_attendees (event_id, profile_id, status, registered_at, updated_at)
    values (p_event_id, v_profile_id, 'registered', v_now, v_now);
  end if;

  return jsonb_build_object('status', 'registered', 'event_id', p_event_id, 'attendance_status', 'registered');
end;
$$;

create or replace function public.cancel_event_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_attendee public.event_attendees%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'upcoming' or v_event.starts_at <= v_now then
    raise exception using errcode = 'P0002', message = 'This registration can no longer be cancelled';
  end if;
  select * into v_attendee from public.event_attendees
  where event_id = p_event_id and profile_id = v_profile_id for update;
  if not found or v_attendee.status = 'cancelled' then
    return jsonb_build_object('status', 'already_cancelled', 'event_id', p_event_id, 'attendance_status', 'cancelled');
  end if;
  if v_attendee.status = 'attended' then
    raise exception using errcode = 'P0001', message = 'Attendance has already been recorded';
  end if;
  update public.event_attendees set status = 'cancelled', updated_at = v_now
  where event_id = p_event_id and profile_id = v_profile_id;
  return jsonb_build_object('status', 'cancelled', 'event_id', p_event_id, 'attendance_status', 'cancelled');
end;
$$;

create or replace function public.record_event_attendance(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_attendee public.event_attendees%rowtype;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status = 'cancelled' or (v_event.status = 'upcoming' and v_event.starts_at > timezone('utc', now())) then
    raise exception using errcode = 'P0001', message = 'Attendance cannot be recorded yet';
  end if;
  select * into v_attendee from public.event_attendees
  where event_id = p_event_id and profile_id = p_profile_id for update;
  if not found or v_attendee.status = 'cancelled' then
    raise exception using errcode = 'P0002', message = 'Active registration not found';
  end if;
  if v_attendee.status = 'attended' then
    return jsonb_build_object('status', 'already_attended', 'event_id', p_event_id, 'profile_id', p_profile_id);
  end if;
  update public.event_attendees set status = 'attended' where event_id = p_event_id and profile_id = p_profile_id;
  return jsonb_build_object('status', 'attended', 'event_id', p_event_id, 'profile_id', p_profile_id);
end;
$$;

revoke all on function public.register_for_event(uuid) from public, anon, authenticated;
revoke all on function public.cancel_event_registration(uuid) from public, anon, authenticated;
revoke all on function public.record_event_attendance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.cancel_event_registration(uuid) to authenticated;
grant execute on function public.record_event_attendance(uuid, uuid) to authenticated;

create or replace function public.audit_admin_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'event.' || lower(tg_op), 'event', new.id, jsonb_build_object('status', new.status, 'published', new.is_published));
  end if;
  return new;
end;
$$;

revoke all on function public.audit_admin_event_change() from public, anon, authenticated;
create trigger events_audit_admin_change
after insert or update on public.events
for each row execute function public.audit_admin_event_change();
