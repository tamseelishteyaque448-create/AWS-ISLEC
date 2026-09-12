-- Stage Historical Evidence Fix
--
-- Phase 4C.1: Corrects the historical project evidence predicate in the
-- advance_member_stage() function.
--
-- THE FIX:
--   Phase 4C used: pm.status = 'active'
--   This excluded members whose status later advanced to 'submitted' or
--   'completed' — both of which represent legitimate post-active membership
--   states that follow from having been an active member.
--
--   The corrected predicate uses:
--     pm.status IN ('active', 'submitted', 'completed')
--
--   This ensures that a member who:
--     - was active at approval time, and
--     - later had their contribution marked submitted or completed
--   still retains the historical project evidence that earned them their stage.
--
-- MEMBERSHIP STATUS LIFECYCLE (confirmed from schema):
--   requested  → not yet approved, does not count
--   active     → approved and participating, counts
--   submitted  → submitted work for review (was active), counts
--   completed  → work accepted (was active), counts
--   declined   → never approved, does not count
--   withdrawn  → not yet in use by any RPC (no current path sets active→withdrawn)
--
-- TEMPORAL CONDITION (unchanged):
--   pm.joined_at <= pr.created_at
--   Member must have joined at or before the approval timestamp.
--   This prevents post-approval joins from inheriting historical evidence.
--
-- MEMBERSHIP DELETION (confirmed from schema):
--   No RPC deletes rows from project_members. Membership is status-only.
--   The PK (project_id, profile_id) means one row per member/project pair.
--   joined_at is re-set on re-approval (ON CONFLICT DO UPDATE).
--
-- WHAT IS NOT CHANGED:
--   - Builder evidence query (uses current active membership only — correct)
--   - profiles.stage monotonicity (unchanged)
--   - profiles.points (unchanged)
--   - All point economy RPCs (unchanged)
--   - Any other function (unchanged)
--
-- EXISTING DATA:
--   0 approved projects in production. No existing stage evidence is affected.
--   Existing profiles.stage remains correct (all 'explorer').

create or replace function public.advance_member_stage(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_ordinal  integer;
  v_computed_ordinal integer := 0;  -- 0 = explorer
  v_points           integer;

  -- Evidence counters
  v_challenge_count          integer;
  v_approved_memberships     integer;
  v_hist_approved_projects   integer;
  v_attended_events          integer;
begin
  -- Read current stage ordinal and points from the already-locked profile row.
  select
    case stage
      when 'explorer'     then 0
      when 'builder'      then 1
      when 'contributor'  then 2
      when 'innovator'    then 3
      when 'mentor'       then 4
      else 0
    end,
    points
  into v_current_ordinal, v_points
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  -- -----------------------------------------------------------------------
  -- Evidence queries (all indexed)
  -- -----------------------------------------------------------------------

  -- Challenges completed (unique constraint ensures no duplicates)
  select count(distinct challenge_id)
  into v_challenge_count
  from public.challenge_completions
  where profile_id = p_profile_id;

  -- Approved project memberships (current active only — for Builder evidence).
  -- Builder requires the member to currently be on a project.
  select count(distinct project_id)
  into v_approved_memberships
  from public.project_members
  where profile_id = p_profile_id
    and role in ('owner', 'contributor')
    and status = 'active';

  -- Historically approved projects:
  --   The project received an approval review AND the member was on the project
  --   at or before the approval timestamp (temporal membership-at-approval proof).
  --   One project counted once regardless of how many review cycles it has.
  --
  --   STATUS SET: active, submitted, completed
  --   'active'    → standard approved membership
  --   'submitted' → member submitted work (was active, progressed)
  --   'completed' → member's work was accepted (was active, progressed)
  --   'declined' / 'withdrawn' / 'requested' → never represented approved membership
  --
  --   This ensures a member who was active at approval and later progressed to
  --   submitted/completed still retains historical project evidence.
  select count(distinct pm.project_id)
  into v_hist_approved_projects
  from public.project_members pm
  join public.project_reviews pr
    on pr.project_id = pm.project_id
   and pr.decision = 'approved'
   and pm.joined_at <= pr.created_at
  where pm.profile_id = p_profile_id
    and pm.role in ('owner', 'contributor')
    and pm.status in ('active', 'submitted', 'completed');

  -- Attended events (one per event, status must be 'attended')
  select count(distinct event_id)
  into v_attended_events
  from public.event_attendees
  where profile_id = p_profile_id
    and status = 'attended';

  -- -----------------------------------------------------------------------
  -- Stage computation (highest qualifying stage)
  -- Evaluated in descending order: mentor → innovator → contributor →
  -- builder → explorer (0 is the fallback).
  -- -----------------------------------------------------------------------

  if v_points >= 5000
    and v_hist_approved_projects >= 3
    and v_attended_events >= 3
  then
    v_computed_ordinal := 4;  -- mentor

  elsif v_points >= 2000
    and v_hist_approved_projects >= 2
    and v_attended_events >= 1
  then
    v_computed_ordinal := 3;  -- innovator

  elsif v_points >= 500
    and v_hist_approved_projects >= 1
  then
    v_computed_ordinal := 2;  -- contributor

  elsif v_challenge_count >= 1
    and v_approved_memberships >= 1
  then
    v_computed_ordinal := 1;  -- builder

  else
    v_computed_ordinal := 0;  -- explorer
  end if;

  -- -----------------------------------------------------------------------
  -- Monotonic advance: only update if computed is strictly higher.
  -- -----------------------------------------------------------------------
  if v_computed_ordinal > v_current_ordinal then
    update public.profiles
    set stage = case v_computed_ordinal
      when 1 then 'builder'
      when 2 then 'contributor'
      when 3 then 'innovator'
      when 4 then 'mentor'
      else        'explorer'
    end
    where id = p_profile_id;
  end if;
end;
$$;
