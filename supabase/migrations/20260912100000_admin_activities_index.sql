-- Admin Activity Oversight V1
--
-- Adds a composite covering index to support community-wide activity queries
-- ordered by occurred_at descending (used by the admin activity overview).
-- The per-member index (profile_id, occurred_at desc) already exists and is
-- preserved. This index is strictly additive — no data is modified.
--
-- The index also covers activity_type so the admin type-filter query can use
-- an index-only scan.

create index if not exists activities_occurred_at_type_idx
  on public.activities (occurred_at desc, activity_type, profile_id);
