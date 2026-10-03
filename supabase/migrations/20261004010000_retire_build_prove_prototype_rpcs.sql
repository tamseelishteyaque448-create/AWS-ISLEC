-- Keep the old RPC signatures visible for diagnostics, but make them fail
-- closed now that the mutable prototype tables have been retired.

create or replace function public.save_build_submission(
  p_submission_id uuid default null,
  p_assignment_id uuid default null,
  p_project_title text default '',
  p_explanation text default '',
  p_approach text default '',
  p_technologies text[] default '{}'::text[],
  p_challenges text default '',
  p_learnings text default '',
  p_future_improvements text default '',
  p_repository_url text default null,
  p_deployment_url text default null,
  p_demo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '0A000', message = 'Mutable Build & Prove submissions are retired';
end;
$$;

create or replace function public.submit_build_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '0A000', message = 'Mutable Build & Prove submissions are retired';
end;
$$;

create or replace function public.add_build_submission_evidence(
  p_submission_id uuid,
  p_storage_path text,
  p_content_type text,
  p_file_size integer,
  p_caption text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '0A000', message = 'Prototype Build & Prove evidence registration is retired';
end;
$$;

revoke all on function public.save_build_submission(uuid, uuid, text, text, text, text[], text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.submit_build_submission(uuid)
  from public, anon, authenticated;
revoke all on function public.add_build_submission_evidence(uuid, text, text, integer, text)
  from public, anon, authenticated;
