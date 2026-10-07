# Build & Prove Phase 7B Recognition / Progression UI Implementation Plan

> **For agentic workers:** Implement this plan task-by-task only after the user approves the plan and a safe, isolated fixture lifecycle is available for the mutating E2E scenarios. Use test-first changes and stop before any database-mutating scenario if the fixture safety gate is not met.

**Goal:** Make Build & Prove approval and its assignment-time reward legible on the existing task detail and activity surfaces while keeping points on the canonical profile and leaderboard.

**Architecture:** Reuse the server-backed reward state already returned for member task detail, existing `build_prove` activity rows, and canonical `profiles.points` reads. Limit application changes to member presentation, consistent zero-point rendering, and cache invalidation after successful approval/award; do not add data contracts, RPCs, migrations, pages, balances, or badges.

**Tech Stack:** Next.js App Router Server Components/Server Actions, React, TypeScript, Supabase RPC-backed services, and Playwright disposable E2E.

**Spec:** This plan implements the frozen Phase 7B contract in the approved user request, reflected in [.ai/CURRENT_PHASE.md](../../../.ai/CURRENT_PHASE.md) and [docs/BUILD_AND_PROVE.md](../../BUILD_AND_PROVE.md).

## Global Constraints

- Keep Phase 7B to the approved Build & Prove task detail, existing Activity/Journal, and existing Profile/Leaderboard surfaces.
- Do not expose canonical stage, add a points balance, add a recognition page, add badges, or create a parallel progression system.
- Do not automatically backfill historical approvals or accept client-entered reward points.
- Preserve the Phase 7A RPC, reward ledger, activity insertion, canonical points update, authorization checks, and transaction semantics.
- For an approved 0-point reward, show exactly: “Your work was approved. This assignment’s configured reward was 0 points, so no points were added.”
- Preserve the existing award form’s success acknowledgement across `router.refresh()` and keep the final awarded state server-backed.
- Do not clean, delete, reverse, reset, or otherwise alter the existing local-disposable fixtures to make tests runnable.
- Do not claim QA/production parity from local-disposable evidence.
- Do not commit, push, deploy, or change credentials.

## Review Focus

1. **Approved but not yet rewarded:** render approval without claiming that points were earned until `rewardPointsAwarded` is present.
2. **Zero-point award:** show approval and recorded recognition without `+0`, “earned 0,” or any implication of a points increase.
3. **Stale canonical views:** after a successful approval or explicit award, revalidate each existing member points/history surface that can display the changed data.
4. **Duplicate/retry and concurrent mutation:** preserve the authoritative RPC's exactly-once reward/activity/points behavior; do not simulate a second client-side reward.
5. **Unauthorized or cancelled work:** keep member ownership, admin authorization, and cancelled/non-approved rejection at the existing server/RPC boundary; UI state is not authorization.

---

## A. Current Implementation Map

| Concern | Existing source |
|---|---|
| Member task page and approval/reward presentation | `app/member/learn/tasks/[taskId]/page.tsx`; `components/member/build-prove/BuildProveTaskDetail.tsx` |
| Member task-detail server contract | `lib/services/build-prove.ts`, `getMemberBuildProveTaskDetail()` and `BuildProveTaskDetail` |
| Normal review and explicit award actions | `app/admin/build-prove/actions.ts`, `reviewBuildSubmissionAction()` and `awardBuildRewardAction()` |
| Admin award/review presentation (preserve Gate 0.1 fix) | `components/admin/BuildProveReviewForm.tsx`; `components/admin/BuildProveTaskOperations.tsx` |
| Existing member Activity/Journal and overview activity list | `app/member/activities/page.tsx`; `components/cards/ActivityTimeline.tsx`; `components/cards/ActivityList.tsx`; `data/activities.ts`; `lib/services.ts` |
| Canonical Profile and Leaderboard points | `app/member/profile/page.tsx`; `app/member/leaderboard/page.tsx`; `lib/services.ts`, `getProfile()` and `getLeaderboard()` |
| Reward/approval data authority | `supabase/migrations/20261006100000_build_prove_reward_contract.sql` |
| Stage authority (read-only reference; do not expose or change) | `supabase/migrations/20260913120000_stage_engine_v1.sql` |
| Existing lifecycle/regression coverage | `tests/e2e/disposable/build-prove-phase6-review.spec.ts`; `tests/e2e/disposable/build-prove-admin-review.spec.ts`; `tests/e2e/disposable/build-prove-member.spec.ts`; `supabase/tests/build_prove_core_workflow.sql` |

## B. UX Plan

### Approved task detail

- Keep the current task title, work status, approval/review history, and existing AWS ISLEC card/panel layout.
- In the approved state, show a clear “Work approved” status and the reward only from the server-returned `rewardPointsAwarded` ledger value.
- For a positive award, use concise copy: “Your work was approved. You earned N points.” Retain the recorded amount and existing awarded timestamp where already shown.
- For approved-but-unrewarded state (`rewardPointsAwarded` is `null`/absent), say the work is approved and that its configured reward has not yet been recorded; do not suggest points were earned.
- For an awarded zero, render the frozen exact copy from Global Constraints. Do not present it as an unawarded/pending state.

### Activity / Journal

- Reuse the existing `Build & Prove` activity category, title, detail, date, and recorded points in `ActivityTimeline`.
- In both `ActivityTimeline` and the overview `ActivityList`, retain `+N` for positive Build & Prove points, but render a zero-point Build & Prove activity as “0 points” (not `+0`).
- Do not add activity linkage fields or a new route. The current record already identifies the category and title/detail; adding foreign keys to the client type is unnecessary for this contract.
- Keep the journal’s total points summary as a sum of activity point records; do not present it as a replacement for the canonical profile total.

### Profile / Leaderboard

- No presentation redesign or new Profile metric is needed. Both surfaces already use canonical `profiles.points`; the Profile shows the total and the Leaderboard shows the same points in the current member entry.
- Ensure both are invalidated after successful approval/award so subsequent renders can read their existing authoritative values.
- Do not show or infer stage. Stage is not in the member profile contract and its server-side criteria combine evidence beyond Build & Prove.

### Remain unchanged

- Admin review/award UI, including the Gate 0.1 stable acknowledgement and `router.refresh()`.
- Existing navigation, layout, status vocabulary outside the recognition copy, non-Build & Prove activity formatting, and stage/badge behavior.

## C. Data Contract

| Member-facing fact | Existing authoritative source | Use |
|---|---|---|
| Approval state | `detail.workItem.status` from `getMemberBuildProveTaskDetail()` | Show approved status only when server state is approved. |
| Configured reward at assignment time | `detail.workItem.rewardPointsSnapshot` | Context only; never treat this snapshot alone as proof of award. |
| Whether/when reward was recorded and amount | `detail.workItem.rewardPointsAwarded` and `detail.workItem.rewardAwardedAt` | A recorded reward exists only when the server-backed awarded amount is non-null; zero is a valid recorded amount. |
| Activity record | `getActivities()` → `activities` query → `Activity` (`type`, `title`, `detail`, `date`, `points`) | Render the existing Build & Prove event and its recorded amount. Do not invent a task ID field. |
| Canonical points | `getProfile()` and `getLeaderboard()` reading `profiles.points` | Continue showing the single canonical total. Compare before/after deltas in tests; do not require the lifetime activity sum to equal the profile total. |

The current optional/null reward fields can express pending versus recorded zero; consume them with explicit null checks. No `lib/services/build-prove.ts`, `lib/services.ts`, `data/activities.ts`, SQL type, migration, or RPC contract change is planned unless implementation uncovers a concrete mismatch.

## D. Admin Recognition

No admin UI change is required by the recognition contract. The admin already has deterministic server-backed approved/unrewarded state and an explicit award action for the assignment-time configured reward. Preserve `requireAdmin()` and the award RPC as the only authority; do not add amount entry, retry-specific client state, new status flags, or a second award path. Keep the prior Gate 0.1 acknowledgement/refresh fix intact.

## E. Test Plan

### Existing coverage to retain

`build-prove-phase6-review.spec.ts` already covers normal approval-to-reward, explicitly awarding already-approved work, retries/idempotency and duplicate protection, concurrent award/approval behavior where configured, member visibility, activity and canonical profile/leaderboard points, authorization denials, and cancellation protection. Keep those assertions intact.

The SQL core workflow test is rollback-only per `docs/TESTING.md`. The member viewport test is documented as non-mutating and currently covers the overview/domain shell at 320, 360, 390, 412, 768, 1024, and 1440 CSS pixels.

### New/strengthened assertions

1. **Approved task positive reward:** after normal approval, task detail visibly says work was approved and names the server-recorded amount; the admin success feedback remains observable and the final state is server-backed after refresh.
2. **Explicit prior-approval award:** preserve existing path and assert the task detail, activity row, Profile, and Leaderboard reflect the one recorded award after navigating/reloading.
3. **Retry/idempotency and duplicate protection:** repeat existing award/approval calls and assert exactly one reward ledger row, one Build & Prove activity row, and one points delta.
4. **Zero-point reward:** create an assignment with a configured snapshot of zero through the existing authorized assignment RPC; submit and approve it via existing member/admin flows; assert the exact frozen task-detail sentence, one recorded reward with `points_awarded = 0`, one Build & Prove activity row rendered as “0 points” (never `+0`), and no change to canonical profile/leaderboard points.
5. **Canonical consistency:** capture member points before approval; after the positive reward, assert the profile value and that member's leaderboard value agree and their delta equals the recorded reward. Do not equate lifetime activity totals with profile points.
6. **Invalid states/cancellation:** keep existing non-approved, cancelled, and already-awarded rejection assertions; no points or activity changes on rejected attempts.
7. **Authorization:** retain anonymous/non-admin RPC and admin-route denial assertions; add/retain cross-member task-detail denial so activity/task IDs cannot bypass ownership checks.
8. **Member history:** assert the category, submission title/detail, date, and amount for the new row; assert repeated calls do not create another row.
9. **Responsive/accessibility:** check the approved detail at 320/360/390/412/768/1024/1440 widths for visible status/reward text and no horizontal overflow; use semantic role/text locators and verify status/copy is understandable without color alone or an icon.
10. **Cache invalidation:** after normal approval and explicit award, visit the affected member task detail, Activity, Profile, and Leaderboard and assert they display the current server-backed values rather than stale pre-mutation state.

### Safe execution boundaries

**Safe to run after implementation without touching existing fixture records:**

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e:disposable:guard`
- `supabase/tests/build_prove_core_workflow.sql` only against local disposable Postgres using the documented one-transaction/rollback procedure.
- Read-only member viewport E2E, only when its local-disposable target guard passes and the test remains fixture-free.
- Read-only admin authorization/denial E2E only after confirming the selected spec performs no writes.

**Can be authored now, but do not execute until an approved isolated/reversible fixture lifecycle exists:**

- Any E2E that creates assignments, work items, submissions, approvals, rewards, activities, or storage objects, including the existing phase6 review flow and workbench tests.
- The new zero-point award scenario and any revalidation scenario that needs a fresh award/approval.
- Do not use the existing dirty disposable database as a reason to delete fixtures, reset data, reverse points/stage, or weaken tests.

No tests or runtime checks are run as part of this planning turn.

## F. File-Level Change Plan

| File | Why / exact change | Must not change |
|---|---|---|
| `components/member/build-prove/BuildProveTaskDetail.tsx` | Refine approved state copy using `workItem.status`, `rewardPointsAwarded`, and the existing snapshot/timestamp. Explicitly distinguish positive, zero, and approved-but-unrewarded states. | Do not derive an award from the snapshot alone, add client reward state, display stage, or alter non-approved workflows. |
| `components/cards/ActivityTimeline.tsx` | Render zero-point Build & Prove entries as “0 points”; keep `+N` for positive events and retain existing `build_prove` metadata. | Do not change other categories, add navigation/data fields, or suppress a valid zero-point record. |
| `components/cards/ActivityList.tsx` | Match zero-point Build & Prove formatting in the member overview’s recent activity list. | Do not change non-Build & Prove point labels or introduce a separate activity source. |
| `app/admin/build-prove/actions.ts` | After successful approval, revalidate `/member`, `/member/activities`, `/member/profile`, `/member/leaderboard`, and the task-detail route pattern `/member/learn/tasks/[taskId]` with type `"page"`. On explicit award, add the missing `/member` and `/member/profile` revalidation while preserving existing invalidations. The pattern is supported by the installed Next.js `revalidatePath` guide. | Do not change RPC calls, authorization, form inputs, reward semantics, or Gate 0.1 feedback. |
| `tests/e2e/disposable/build-prove-phase6-review.spec.ts` | Preserve existing lifecycle assertions; add assertions for recognition, route freshness, and the zero-point flow using the current authorized RPC/UI paths. | Do not delete/relax existing assertions, modify DB behavior, add cleanup against protected rows, or run without the safe fixture gate. |
| `tests/e2e/disposable/build-prove-member.spec.ts` | If needed, add a read-only responsive/accessibility check only where an already-approved stable fixture is provided; otherwise keep existing viewport test unchanged and cover the detail in the gated lifecycle test. | Do not create/mutate fixtures in the viewport suite or assume arbitrary existing rows are test fixtures. |

**Read-only references, not planned edits:** `lib/services/build-prove.ts`, `lib/services.ts`, `data/activities.ts`, `app/member/activities/page.tsx`, `app/member/profile/page.tsx`, `app/member/leaderboard/page.tsx`, both Phase 7A migrations, admin review components, SQL types, and all migrations/RPCs.

## G. Implementation Order

### Task 1: Pin member task-detail recognition states

**Files:** `components/member/build-prove/BuildProveTaskDetail.tsx`; `tests/e2e/disposable/build-prove-phase6-review.spec.ts`.

- [ ] Add the assertions first for positive awarded points, approved-but-unrewarded state, and the exact zero-point sentence.
- [ ] Run the focused test only after the isolated/reversible fixture gate is approved; confirm the new assertion fails for the missing presentation, not for setup.
- [ ] Implement the three display branches from server-provided fields; keep `rewardPointsAwarded === 0` distinct from `null`/absent.
- [ ] Re-run the focused test in the approved disposable environment and confirm all existing lifecycle assertions remain.

### Task 2: Make activity recognition truthful for zero points

**Files:** `components/cards/ActivityTimeline.tsx`; `components/cards/ActivityList.tsx`; `tests/e2e/disposable/build-prove-phase6-review.spec.ts`.

- [ ] Add the zero Build & Prove activity assertions before rendering changes; positive rewards retain `+N`, zero renders `0 points`.
- [ ] Implement category-scoped zero formatting in both renderers, preserving all other categories.
- [ ] Run the focused UI assertions in the approved fixture environment; run the fixture-free member viewport E2E only if the local target guard validates.

### Task 3: Revalidate the existing member recognition/points surfaces

**Files:** `app/admin/build-prove/actions.ts`; `tests/e2e/disposable/build-prove-phase6-review.spec.ts`.

- [ ] Add an integration assertion that a successful normal approval and explicit award are reflected on subsequent task detail, Activity, Profile, and Leaderboard visits.
- [ ] After successful approval, invalidate `/member`, `/member/activities`, `/member/profile`, `/member/leaderboard`, and `/member/learn/tasks/[taskId]` with type `"page"`; do not invalidate on a rejected mutation.
- [ ] Extend explicit-award invalidation with `/member` and `/member/profile`, preserving existing member/admin route invalidations.
- [ ] Run the focused mutation E2E only in the approved isolated/reversible environment and verify the canonical values come from server reads.

### Task 4: Complete regression and accessibility acceptance

**Files:** `tests/e2e/disposable/build-prove-phase6-review.spec.ts`; only if applicable, `tests/e2e/disposable/build-prove-member.spec.ts`.

- [ ] Preserve existing retry, concurrency, cancellation, member/admin/anonymous authorization, no-duplicate activity, and canonical points checks.
- [ ] Add the zero-point end-to-end path through assignment creation, member submission, admin approval, member detail, and journal; assert zero ledger amount, one activity, no points delta, and exact copy.
- [ ] Check detail/status usability at 320–1440 CSS pixels, semantic locator access, and no color-only recognition.
- [ ] Run the applicable safe static/rollback/read-only checks; run mutating suites only after the disposable fixture safety gate is cleared.

## H. Security Review

- **Client trust:** reward amount, approval, and reward existence come only from authenticated server reads; do not accept a submitted amount or treat UI state as proof.
- **Authorization:** member task reads remain ownership-scoped in the service/RLS; admin approval/award remain behind `requireAdmin()` and the authoritative RPC's role check. Do not widen policies or return other members' activity.
- **Integrity/idempotency:** RPC remains the only reward writer. UI revalidation changes cache visibility only and must not issue reward/activity/points writes.
- **Stale state:** invalidate the task detail and all existing member points/history surfaces after successful mutations; test server-backed values after navigation/refresh.
- **Leakage:** activity is already member-scoped; expose no admin-only review, storage path, identity, or ledger fields beyond the current member contract.
- **Invalid states:** preserve rejection for cancelled, not-approved, stale-revision, and already-awarded operations; zero is valid only when the server ledger records zero.
- **Data integrity boundary:** do not change the immutable/append-only reward and activity design or canonical profile points/stage triggers.

## I. Acceptance Criteria

Phase 7B is **PASS** only when all criteria are objectively demonstrated:

- Approved member task detail distinguishes positive awarded, zero awarded, and approved-but-not-yet-awarded states using server-backed fields.
- Zero-point task detail contains the exact frozen sentence; an awarded zero is still represented as a recorded reward.
- Build & Prove activity is visible in existing history; zero displays “0 points”, never `+0`, while positive and non-Build & Prove formatting remain unchanged.
- Profile and Leaderboard continue to show one canonical `profiles.points` value; a positive award increases it by the recorded amount, and zero leaves it unchanged.
- Approval and award refresh all affected member surfaces without removing the stable admin success feedback or replacing authoritative server state with client state.
- Existing authorization, retry/idempotency, concurrency, cancellation, and duplicate reward/activity assertions remain intact.
- No stage UI, second balance, new page, badge system, historical backfill, schema, or RPC change is introduced.
- Focused UI/integration E2E passes in an approved isolated disposable environment; typecheck, lint, build, and applicable safe regression checks pass.

Until a safe fixture lifecycle is available, those mutating runtime criteria remain **NOT VERIFIED**, not PASS.

## J. Stop Conditions

- Stop before implementation/runtime acceptance if no approved isolated/reversible disposable fixture lifecycle is available. Do not work around this by touching existing fixtures or resetting the database.
- Stop and reassess if the task service cannot distinguish `rewardPointsAwarded: 0` from `null`/missing using its existing authoritative response.
- Stop if accurate recognition requires a migration, RPC, RLS/grant change, reward-semantic change, new points source, stage exposure, or historical backfill; that exceeds this frozen contract.
- Stop if successful approval cannot safely invalidate the dynamic task route using the installed Next.js route-pattern API; do not inject a client-supplied ID as an authorization substitute.
- Stop if a regression test requires weakening existing approval, award, authorization, cancellation, or duplicate assertions.

## K. Final Recommendation

The implementation plan is ready and follows the frozen Phase 7B contract. The proposed code scope is small: one member task-detail presentation, two existing activity renderers, successful-action cache invalidation, and focused extensions to existing disposable E2E coverage. There is no planned service, schema, RPC, stage, or admin UI redesign.

The implementation itself should begin only when an approved isolated/reversible fixture lifecycle is available for test-first execution of the reward-bearing E2E. Static checks, the pure disposable guard, documented rollback SQL test, and fixture-free read-only member viewport test can be run without mutating the existing scoped fixtures. Until the mutating E2E gate is available, end-to-end acceptance remains blocked/NOT VERIFIED.
