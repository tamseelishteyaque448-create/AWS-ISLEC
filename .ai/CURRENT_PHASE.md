# Current phase

## Projects V2.3 - Member discovery and participation

**Status:** ACTIVE IMPLEMENTATION.

Scope: published-project discovery, project details, relationship-aware CTAs, join requests, optional URL-only skill proofs, owner review states, My Projects, workspace entry, empty/loading/error states, archived/shipped/recruitment presentation, responsive refinement, and authenticated E2E verification.

Dependencies: preserve the Projects V1 lifecycle, V2.1 proof/privacy model, and V2.2 workspace state gates, role rules, progress rules, RLS, grants, and protected RPCs.

Required validation before this phase is complete:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`
- Targeted authenticated and anonymous Playwright coverage
- QA database migration parity, RLS/grant checks, and protected RPC authorization checks
- Loading, error, empty, lifecycle, capacity, and responsive runtime checks

Current repository source may be implemented beyond individual historical notes. Live database, authenticated runtime, and production behavior are **NOT VERIFIED** until executed against QA.
