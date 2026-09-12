-- Projects V2.1: Skill Proofs for Join Requests
-- Adds a proof model so applicants can attach evidence to join requests.
-- The existing request lifecycle (requested/approved/declined/withdrawn) is preserved.
-- No existing tables, RPCs, or policies are modified.

create table public.project_join_request_proofs (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.project_join_requests(id) on delete cascade,
  proof_type  text not null check (proof_type in ('github','portfolio','live_demo','previous_project','certificate','achievement','other')),
  title       text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(trim(description)) <= 500),
  url         text check (url is null or url ~ '^https?://'),
  created_at  timestamptz not null default timezone('utc', now()),
  check (url is not null)  -- V1: URL proofs only; file upload is next phase
);

create index project_join_request_proofs_request_id_idx
  on public.project_join_request_proofs (request_id);

alter table public.project_join_request_proofs enable row level security;
revoke all on public.project_join_request_proofs from anon, authenticated;
grant select on public.project_join_request_proofs to authenticated;

-- Applicant can read their own proofs
create policy "Applicant can read own proofs"
on public.project_join_request_proofs for select to authenticated
using (
  exists (
    select 1 from public.project_join_requests pjr
    where pjr.id = project_join_request_proofs.request_id
      and pjr.profile_id = (select auth.uid())
  )
);

-- Project owner can read proofs for requests on their project
create policy "Project owner can read proofs"
on public.project_join_request_proofs for select to authenticated
using (
  exists (
    select 1 from public.project_join_requests pjr
    join public.project_members pm
      on pm.project_id = pjr.project_id
     and pm.profile_id = (select auth.uid())
     and pm.role = 'owner'
     and pm.status = 'active'
    where pjr.id = project_join_request_proofs.request_id
  )
);

-- Admin can read all proofs
create policy "Admins can read all proofs"
on public.project_join_request_proofs for select to authenticated
using ((select private.is_admin()));

-- Applicant adds proofs via a SECURITY DEFINER RPC (no direct INSERT grant)
create or replace function public.add_join_request_proof(
  p_request_id  uuid,
  p_proof_type  text,
  p_title       text,
  p_description text,
  p_url         text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  -- Verify the request belongs to the caller and is still open
  if not exists (
    select 1 from public.project_join_requests
    where id = p_request_id
      and profile_id = v_actor
      and status = 'requested'
  ) then
    raise exception using errcode = '42501', message = 'Request not found or not editable';
  end if;

  if p_proof_type not in ('github','portfolio','live_demo','previous_project','certificate','achievement','other') then
    raise exception using errcode = '22023', message = 'Invalid proof type';
  end if;

  if p_title is null or char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 120 then
    raise exception using errcode = '22023', message = 'Title is required (max 120 chars)';
  end if;

  if p_url is null or p_url !~ '^https?://' then
    raise exception using errcode = '22023', message = 'A valid https URL is required';
  end if;

  insert into public.project_join_request_proofs (request_id, proof_type, title, description, url)
  values (p_request_id, p_proof_type, trim(p_title), coalesce(trim(p_description), ''), p_url);

  return jsonb_build_object('status', 'added');
end;
$$;

revoke all on function public.add_join_request_proof(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.add_join_request_proof(uuid, text, text, text, text) to authenticated;

-- Applicant removes a proof from their own open request
create or replace function public.remove_join_request_proof(p_proof_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  delete from public.project_join_request_proofs pf
  using public.project_join_requests pjr
  where pf.id = p_proof_id
    and pf.request_id = pjr.id
    and pjr.profile_id = v_actor
    and pjr.status = 'requested';

  if not found then
    raise exception using errcode = 'P0002', message = 'Proof not found or not editable';
  end if;

  return jsonb_build_object('status', 'removed');
end;
$$;

revoke all on function public.remove_join_request_proof(uuid) from public, anon, authenticated;
grant execute on function public.remove_join_request_proof(uuid) to authenticated;
