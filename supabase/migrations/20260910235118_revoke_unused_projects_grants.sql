-- Revoke unused direct table privileges from projects table
-- 
-- The authenticated role has INSERT and UPDATE grants that cannot be used
-- because no RLS policies exist to allow these operations for non-admins.
-- Projects V1 uses SECURITY DEFINER RPCs for all mutations.

revoke insert, update on public.projects from authenticated;

-- Verification: authenticated should retain SELECT (used by RLS policies)
-- anon should retain SELECT (used by public queries)  
-- service_role retains all privileges (used by server-side operations)
