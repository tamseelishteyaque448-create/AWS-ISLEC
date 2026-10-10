# Current phase

## Build & Prove Phase 7B - Recognition / Progression UI

**Status:** IN PROGRESS; VALIDATION BLOCKED.

Phase 7A's reward flow and explicit award for previously approved work passed the focused local-disposable E2E (1 passed, 0 failed). The admin success acknowledgement now remains visible across `router.refresh()`, and the final awarded state remains server-backed. This is local evidence only; QA/production parity is **NOT VERIFIED**.

Local-disposable cleanup is **BLOCKED**: no repository-approved reversible cleanup procedure exists for the protected reward/history data and resulting point/stage effects. Fixture status is **NOT VERIFIED** because the local Docker/WSL environment is unavailable. Do not manually delete protected history, subtract points, reverse stage changes, or assume the environment is clean.

Phase 7B member presentation and cache invalidation work is in progress. TypeScript, production build, lint, and the safe unit/environment-guard checks passed on 2026-10-10. Mutation-backed E2E and local Supabase integration verification are **NOT VERIFIED**; do not start Docker/WSL or run the disposable suite for this gate.

Phase 7B scope: communicate approved work and its configured reward on the existing Build & Prove task detail; reflect recognition in existing Activity/Journal history; keep points on the canonical Profile/Leaderboard progression surfaces. Do not create a parallel points balance, a new recognition page, or a new badge system. Do not expose canonical stage in this phase; Build & Prove points alone do not determine stage, and the current member profile contract does not expose the authoritative stage.

The unfinished/unchecked status of Projects V2.3 is not changed or represented as complete by this phase selection. Its completion and QA validation remain **NOT VERIFIED**; it is not the active development phase for this gate.

Required validation before Phase 7B is complete:

- Focused member/admin E2E for approval-to-recognition, history visibility, and canonical points integration
- Authorization and duplicate/retry regression coverage, without changing Phase 7A reward authority
- Loading, empty, error, success, permission-denied, and responsive UI checks on the affected surfaces
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`
- QA database migration parity, RLS/grant checks, and protected RPC authorization checks before making any hosted-parity claim

Do not begin Phase 8 until Phase 7B is implemented and validated. Current database/runtime claims remain environment-specific; production behavior is **NOT VERIFIED**.
