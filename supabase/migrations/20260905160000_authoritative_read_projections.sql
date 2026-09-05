-- Public learning exposes only the same published catalogue already available
-- to members. Admin overview activity is an operational-only read.
grant select on public.learning_paths, public.challenges to anon;

create policy "Public can read published learning paths"
on public.learning_paths for select to anon
using (is_published);

create policy "Public can read published challenges with published paths"
on public.challenges for select to anon
using (
  is_published
  and exists (
    select 1 from public.learning_paths lp
    where lp.id = challenges.learning_path_id and lp.is_published
  )
);

create policy "Admins can read activities"
on public.activities for select to authenticated
using ((select private.is_admin()));
