# Changelog and project history

This is a concise reconstruction from checked-in migrations and git history. Dates are commit/migration dates, not claims of deployment.

| Phase/decision | Evidence and status |
| --- | --- |
| Foundation | Initial Next/Supabase schema, profiles, Auth trigger/backfill, domains, and RLS migrations. IMPLEMENTED in source; live parity NOT VERIFIED. |
| Admin security | Private admin allowlist, `is_admin`, audit log, and admin policies separated authorization from profile role. IMPLEMENTED; runtime NOT VERIFIED. |
| Learning/events | Challenge completion, badges/streaks, event registration/attendance, capacity hardening, and poster delivery were added. IMPLEMENTED; runtime/storage NOT VERIFIED. |
| Projects V1 | Lifecycle, owner invariant, review, requests, protected operations, and project read projections were added. IMPLEMENTED. |
| Projects V2.1 | URL-only skill proofs for open join requests were added. IMPLEMENTED in migrations/services; runtime NOT VERIFIED. |
| Analytics/activity/progression | Admin analytics, activity indexes/idempotency, point economy, monotonic stages, and historical project evidence fixes were added. IMPLEMENTED in source; results NOT VERIFIED. |
| Projects V2.2 | Workspace foundation migration, read model, server actions, and member Overview/Team/Work surfaces were added. IMPLEMENTED in source; authenticated/runtime/database parity NOT VERIFIED. |
| Projects V2.3 | Current active phase: member project discovery and participation, including detail, join requests, proofs, My Projects, and workspace entry. ACTIVE IMPLEMENTATION. |
| UI direction | September 2026 commits refined sidebar proportions, member event cards, and leaderboard/podium hierarchy without changing data or backend behavior. IMPLEMENTED; visual runtime verification NOT VERIFIED. |

Important historical reports are not current evidence: a prior project QA claim of 57/57 was not reproducible from the inspected repository. Recent history reports TypeScript, lint, build, and anonymous/security checks passing at different points, but each must be re-run for the current revision.
