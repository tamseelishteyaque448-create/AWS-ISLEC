-- Event management already has an admin CRUD policy on public.events.
-- This grants only the additional read access needed for administrators to
-- see aggregate registration counts; member attendance rows remain private.
create policy "Admins can read event attendance"
on public.event_attendees
for select to authenticated
using ((select private.is_admin()));
