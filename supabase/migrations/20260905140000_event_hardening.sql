-- Keep a capacity reduction from making an event overbooked. The event row
-- lock used by registration serializes this check with concurrent sign-ups.
create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count integer;
begin
  if new.capacity is not null and (tg_op = 'INSERT' or new.capacity is distinct from old.capacity) then
    select count(*) into v_active_count
    from public.event_attendees
    where event_id = new.id and status in ('registered', 'attended');

    if v_active_count > new.capacity then
      raise exception using errcode = '23514', message = 'Event capacity cannot be lower than active registrations';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_event_capacity() from public, anon, authenticated;

create trigger events_enforce_capacity
before insert or update of capacity on public.events
for each row execute function public.enforce_event_capacity();

-- Cancellation preserves the event and its registration/attendance history.
-- Do not permit a direct delete to bypass that lifecycle and cascade history.
revoke delete on public.events from authenticated;

-- Attendance is only valid after the scheduled start, regardless of whether
-- an administrator has manually moved the lifecycle status to "past".
create or replace function public.record_event_attendance(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_attendee public.event_attendees%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status = 'cancelled' or v_event.starts_at > v_now then
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
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'event.attendance_recorded', 'event_attendee', p_event_id, jsonb_build_object('profile_id', p_profile_id));
  return jsonb_build_object('status', 'attended', 'event_id', p_event_id, 'profile_id', p_profile_id);
end;
$$;
