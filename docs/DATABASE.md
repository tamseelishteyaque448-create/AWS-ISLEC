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
| Admin | `private.admin_users` and public audit log with admin-only access |

RLS is enabled on protected tables. Sensitive writes are deliberately concentrated in schema-qualified RPCs with explicit authenticated grants; direct table privileges are not implied by TypeScript types. Activity generation and point awards are designed to be transactional and idempotent.

The source migration chain includes Projects V2.2 workspace foundation (`20260915100000_projects_v2_2_workspace_foundation.sql`). Whether the deployed database exactly matches this chain, and whether all policies/RPCs execute correctly there, is **NOT VERIFIED**.
