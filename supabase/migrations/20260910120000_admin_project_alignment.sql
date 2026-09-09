-- Admin Projects V1 Alignment.
--
-- Problems corrected:
--   1. The admin edit path used direct table UPDATE with legacy fields
--      (status, progress, is_published). This bypassed the sync trigger,
--      the owner invariant, capacity validation, and the audit record.
--   2. The 'Admins can manage projects' ALL policy created an open direct-
--      table write path that circumvented every domain invariant.
--   3. The audit trigger recorded only legacy fields post V1.
--   4. Legacy pre-V1 RPCs (request_project_access, submit_project_work)
--      remained granted to authenticated despite having no callers.
--
-- Changes in this migration:
--   A. Add admin_update_project_v1 — admin-authorised, SECURITY DEFINER
--      RPC that edits V1 fields, validates inputs, guards capacity, audits,
--      and allows editing projects in pending_review (owner cannot).
--   B. Drop 'Admins can manage projects' ALL policy. All admin write
--      operations now go through SECURITY DEFINER RPCs, so no direct-table
--      write path for admins is needed or safe.
--   C. Update audit_admin_project_change trigger to include V1 fields.
--   D. Revoke legacy pre-V1 RPCs from authenticated.

-- -------------------------------------------------------------------------
-- A. admin_update_project_v1
-- -------------------------------------------------------------------------
-- Admins may edit title, category, description, technologies, build_stage,
-- recruitment_mode, team_capacity, repository_url, and demo_url for any
-- non-archived project, including those currently under pending_review
-- (which the owner cannot edit).  publication_state is intentionally
-- excluded: that lifecycle is owned by review_project_publication.
create or replace function public.admin_update_project_v1(
  p_project_id    uuid,
  p_title         text,
  p_category      text,
  p_description   text,
  p_technologies  text[],
  p_build_stage   text,
  p_recruitment_mode text,
  p_team_capacity integer default null,
  p_repository_url text   default null,
  p_demo_url       text   default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := auth.uid();
  v_project public.projects%rowtype;
  v_active  integer;
begin
  -- Authorization: admin allowlist only.
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  -- Input validation mirrors update_project_v1 but is enforced independently
  -- so that member and admin paths cannot silently diverge.
  if p_title !~ '\S' or char_length(trim(p_title)) > 160
    or p_category !~ '\S' or char_length(trim(p_category)) > 80
    or char_length(coalesce(p_description, '')) > 2000
    or p_build_stage not in ('idea', 'building', 'prototype', 'shipped')
    or p_recruitment_mode not in ('open', 'invite_only', 'not_recruiting')
    or (p_team_capacity is not null and (p_team_capacity < 1 or p_team_capacity > 100))
    or (p_repository_url is not null and p_repository_url !~ '^https?://')
    or (p_demo_url       is not null and p_demo_url       !~ '^https?://')
  then
    raise exception using errcode = '22023', message = 'Invalid project input';
  end if;

  -- Lock the project row; confirm it exists and is not archived.
  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;

  if v_project.publication_state = 'archived' then
    raise exception using errcode = '22023', message = 'Archived projects cannot be edited';
  end if;

  -- Guard: new capacity must not be below the current active team size.
  if p_team_capacity is not null then
    select count(*)
    into v_active
    from public.project_members
    where project_id = p_project_id
      and status in ('active', 'submitted', 'completed');

    if p_team_capacity < v_active then
      raise exception using errcode = '22023', message = 'Capacity is below active team size';
    end if;
  end if;

  update public.projects
  set
    title            = trim(p_title),
    category         = trim(p_category),
    description      = trim(coalesce(p_description, '')),
    technologies     = coalesce(p_technologies, '{}'),
    build_stage      = p_build_stage,
    recruitment_mode = p_recruitment_mode,
    team_capacity    = p_team_capacity,
    repository_url   = nullif(trim(coalesce(p_repository_url, '')), ''),
    demo_url         = nullif(trim(coalesce(p_demo_url, '')), '')
  where id = p_project_id;

  -- Audit every admin project edit.
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    'project.admin_updated',
    'project',
    p_project_id,
    jsonb_build_object(
      'build_stage',       p_build_stage,
      'recruitment_mode',  p_recruitment_mode,
      'publication_state', v_project.publication_state
    )
  );

  return jsonb_build_object('status', 'updated', 'project_id', p_project_id);
end;
$$;

revoke all on function public.admin_update_project_v1(
  uuid, text, text, text, text[], text, text, integer, text, text
) from public, anon, authenticated;

grant execute on function public.admin_update_project_v1(
  uuid, text, text, text, text[], text, text, integer, text, text
) to authenticated;

-- -------------------------------------------------------------------------
-- B. Remove the 'Admins can manage projects' ALL policy.
--
-- This policy was the only remaining direct-table write path for admins.
-- create_project_v1, admin_update_project_v1, review_project_publication,
-- recover_project_ownership, and transfer_project_ownership are all
-- SECURITY DEFINER functions that bypass RLS internally.  No admin
-- operation needs an explicit RLS write grant.
-- -------------------------------------------------------------------------
drop policy if exists "Admins can manage projects" on public.projects;

-- -------------------------------------------------------------------------
-- C. Update the audit trigger to record V1 fields.
--
-- The previous body captured only the legacy {status, published} pair.
-- Now it records the authoritative publication_state and build_stage too.
-- -------------------------------------------------------------------------
create or replace function public.audit_admin_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      auth.uid(),
      'project.' || lower(tg_op),
      'project',
      new.id,
      jsonb_build_object(
        'publication_state', new.publication_state,
        'build_stage',       new.build_stage,
        'status',            new.status,
        'is_published',      new.is_published
      )
    );
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- D. Revoke request_project_access from authenticated.
--
-- request_project_access pre-dates Projects V1 and has no remaining callers.
-- Revoking it prevents accidental bypass of the V1 request_project_join
-- and resolve_project_join_request workflows.
--
-- submit_project_work is intentionally retained: ProjectMembershipControl
-- uses it to let active members mark their personal contribution as
-- submitted for admin review (review_project_member: complete_submission).
-- It is a distinct operation from submit_project_for_review, which submits
-- the project itself for publication review.
-- -------------------------------------------------------------------------
revoke execute on function public.request_project_access(uuid) from authenticated;
