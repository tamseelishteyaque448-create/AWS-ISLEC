# Database

## Source of truth

The ordered files in `supabase/migrations/` are the repository schema/security authority. `lib/types/database.ts` is an application typing artifact and may lag later migrations. `supabase/seed.sql` supplies local seed data. `supabase/config.toml` configures local Postgres 17, Auth, Storage, Realtime, Studio, and seed application.

## Domains

| Domain | Main objects and behavior |
| --- | --- |
| Auth/profile | Supabase Auth plus `profiles`; profile creation/backfill and limited member updates |
| Learning | Learning paths, challenges, content, completions, progress, streaks, and challenge-answer/completion RPCs |
| Events | Events, attendees, publication/status, capacity, registration/cancellation, attendance, and poster delivery |
| Projects | Projects, members, reviews, join requests, URL-only skill proofs, workspace milestones/tasks, lifecycle RPCs |
| Progression | Points, monotonic `profiles.stage`, activities, badges, achievements, and leaderboard read projections |
| Build & Prove | Admin-authored assignments, member work items, immutable numbered submission revisions, append-only reviews, private evidence metadata, and an approval-bound per-work-item reward ledger |
| Admin | `private.admin_users` and public audit log with admin-only access |

RLS is enabled on protected tables. Sensitive writes are deliberately concentrated in schema-qualified RPCs with explicit authenticated grants; direct table privileges are not implied by TypeScript types. Activity generation and point awards are designed to be transactional and idempotent.

The source migration chain includes Projects V2.2 workspace foundation (`20260915100000_projects_v2_2_workspace_foundation.sql`). Whether the deployed database exactly matches this chain, and whether all policies/RPCs execute correctly there, is **NOT VERIFIED**.

## Build & Prove core

The additive Build & Prove workflow is defined by `20261004003000_build_prove_core_workflow.sql`; `20261004010000_retire_build_prove_prototype_rpcs.sql` retires old mutable prototype RPC behavior. The member work item in `build_assignment_members` owns its lifecycle status. Each submission is a numbered immutable revision in `build_submissions`; reviews are append-only and refer to a revision. Direct authenticated table mutations are not the workflow interface; guarded RPCs enforce ownership, admin review, legal transitions, and idempotent operation behavior.

The `build-prove-private` Storage bucket is non-public. Admins manage assignment reference objects; assignee/admin read authorization is checked by Storage policies and a caller-scoped helper. The admin-only `review_build_submission()` RPC records the immutable approval and calls `award_build_submission_reward()` in the same transaction. The reward RPC locks the approved work item, validates the latest approved revision, uses `reward_points_snapshot`, and atomically writes one immutable ledger row, one unique `build_prove` activity, the member's `profiles.points` total, and stage advancement. A retry returns the existing reward without repeating those mutations. The migration does not backfill historical approvals. QA/production parity is **NOT VERIFIED**.

The migration and database behavior have been applied and tested only in local disposable Supabase for this phase. Hosted migration parity and production behavior are **NOT VERIFIED**.
