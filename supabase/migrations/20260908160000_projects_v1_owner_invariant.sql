-- Projects V1 follow-up: the partial unique index guarantees at most one
-- owner. This deferred trigger additionally guarantees that every changed
-- project finishes its transaction with an owner, while preserving legacy
-- rows for explicit admin recovery.
create or replace function public.enforce_project_owner_invariant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid := coalesce(new.project_id, old.project_id);
begin
  if exists (select 1 from public.projects where id = v_project_id)
    and not exists (select 1 from public.project_members where project_id = v_project_id and role = 'owner' and status = 'active') then
    raise exception using errcode = '23514', message = 'A project must retain exactly one active owner';
  end if;
  return null;
end;
$$;

drop trigger if exists project_members_owner_invariant on public.project_members;
create constraint trigger project_members_owner_invariant
after insert or update or delete on public.project_members
deferrable initially deferred
for each row execute function public.enforce_project_owner_invariant();

create or replace function public.recover_project_ownership(p_project_id uuid, p_new_owner_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  if char_length(coalesce(p_reason, '')) > 1000 then raise exception using errcode = '22023', message = 'Invalid recovery reason'; end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Project not found'; end if;
  perform 1 from public.profiles where id = p_new_owner_id;
  if not found then raise exception using errcode = 'P0002', message = 'New owner not found'; end if;
  update public.project_members set role = 'contributor' where project_id = p_project_id and role = 'owner';
  insert into public.project_members(project_id, profile_id, role, status)
  values (p_project_id, p_new_owner_id, 'owner', 'active')
  on conflict(project_id, profile_id) do update set role = 'owner', status = 'active', joined_at = timezone('utc', now());
  insert into public.project_reviews(project_id, reviewer_id, decision, feedback)
  values (p_project_id, v_actor, 'ownership_recovered', trim(coalesce(p_reason, '')));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, metadata)
  values (v_actor, 'project.ownership_recovered', 'project', p_project_id, jsonb_build_object('new_owner_id', p_new_owner_id));
  return jsonb_build_object('status', 'ownership_recovered');
end;
$$;

revoke all on function public.enforce_project_owner_invariant(), public.recover_project_ownership(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.recover_project_ownership(uuid, uuid, text) to authenticated;
