-- Workspace-only follow-up: owner editing remains an authoritative operation;
-- review feedback is visible to the affected project's active owner.
drop policy if exists "Admins can read project reviews" on public.project_reviews;
create policy "Admins and owners can read project reviews"
on public.project_reviews for select to authenticated using (
  (select private.is_admin()) or exists (
    select 1 from public.project_members pm
    where pm.project_id = project_reviews.project_id and pm.profile_id = (select auth.uid())
      and pm.role = 'owner' and pm.status = 'active'
  )
);

create or replace function public.update_project_v1(
  p_project_id uuid, p_title text, p_category text, p_description text,
  p_technologies text[], p_build_stage text, p_recruitment_mode text,
  p_team_capacity integer default null, p_repository_url text default null, p_demo_url text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_project public.projects%rowtype; v_active integer;
begin
  if not public.project_is_owner(p_project_id, v_actor) then raise exception using errcode = '42501', message = 'Owner access required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.publication_state in ('pending_review', 'archived') then raise exception using errcode = '22023', message = 'Project cannot be edited'; end if;
  if p_title !~ '\S' or char_length(trim(p_title)) > 160 or p_category !~ '\S' or char_length(trim(p_category)) > 80
    or char_length(coalesce(p_description, '')) > 2000 or p_build_stage not in ('idea','building','prototype','shipped')
    or p_recruitment_mode not in ('open','invite_only','not_recruiting') or (p_team_capacity is not null and (p_team_capacity < 1 or p_team_capacity > 100))
    or (p_repository_url is not null and p_repository_url !~ '^https?://') or (p_demo_url is not null and p_demo_url !~ '^https?://') then
    raise exception using errcode = '22023', message = 'Invalid project input';
  end if;
  select count(*) into v_active from public.project_members where project_id = p_project_id and status in ('active','submitted','completed');
  if p_team_capacity is not null and p_team_capacity < v_active then raise exception using errcode = '22023', message = 'Capacity is below active team size'; end if;
  update public.projects set title = trim(p_title), category = trim(p_category), description = trim(coalesce(p_description,'')),
    technologies = coalesce(p_technologies,'{}'), build_stage = p_build_stage, recruitment_mode = p_recruitment_mode,
    team_capacity = p_team_capacity, repository_url = nullif(trim(coalesce(p_repository_url,'')),''), demo_url = nullif(trim(coalesce(p_demo_url,'')), '')
  where id = p_project_id;
  return jsonb_build_object('status', 'updated', 'project_id', p_project_id);
end;
$$;
revoke all on function public.update_project_v1(uuid,text,text,text,text[],text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.update_project_v1(uuid,text,text,text,text[],text,text,integer,text,text) to authenticated;
