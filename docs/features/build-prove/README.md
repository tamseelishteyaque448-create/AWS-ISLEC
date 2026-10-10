# Build & Prove Feature Track

## Current Status

Active. Phase 7B recognition UI is present, and the focused hosted lifecycle gate passed on commit `0e06659241204e6aae23852c4850871426184a43`. Current-worktree static checks pass. New empty-state, access-control, and responsive assertions are uncommitted and **NOT VERIFIED**. Phase 7B remains in progress.

## Source Of Truth

- [Current phase](../../../.ai/CURRENT_PHASE.md)
- [Phase 7B recognition/progression plan](../../superpowers/plans/2026-10-07-build-prove-phase-7b-recognition-progression-ui.md)
- [Build & Prove behavior and validation](../../BUILD_AND_PROVE.md)
- [Testing and hosted integration evidence](../../TESTING.md)
- Implementation: `app/member/learn/tasks/[taskId]/page.tsx`, `components/member/build-prove/BuildProveTaskDetail.tsx`, `components/cards/ActivityList.tsx`, `components/cards/ActivityTimeline.tsx`, and `app/admin/build-prove/actions.ts`

## Current Behavior

- Approved task detail derives approval and reward recognition from the server-backed member task read; recorded zero is distinct from no reward.
- Existing Build & Prove activity records render in the member overview and Activity/Journal; zero renders as `0 points`.
- Profile and Leaderboard use canonical `profiles.points`; successful approval/award actions revalidate the existing member surfaces.
- Reward authority, idempotency, and authorization remain in existing server services and RPCs.

## Decisions

- Keep recognition on the existing task detail, Activity/Journal, Profile, and Leaderboard surfaces.
- Do not add a second points balance, stage display, recognition page, badge system, schema, RPC, or historical award backfill.
- Use only the manual GitHub-hosted isolated Supabase workflow for mutation-backed integration; do not start local Docker/WSL or use QA/production for these tests.

## Known Risks

- The prior hosted run verifies only its dispatched revision; subsequently added assertions still require a successful hosted run.
- Loading and data-error fallbacks do not yet have deterministic integration failure injection.
- QA/production parity and production deployment behavior remain **NOT VERIFIED**.

## Changelog

- 2026-10-10: Recorded the focused hosted lifecycle result and added isolated E2E assertions for empty states, task access denial, and responsive recognition surfaces; new assertions await hosted verification.
