# Database model

Migrations in `supabase/migrations` are the repository schema authority. The checked-in `lib/types/database.ts` is an application typing artifact, not a complete current schema authority: it lacks later additions including `profiles.stage` and `project_join_request_proofs`.

| Domain | Tables and authoritative mutation path |
| --- | --- |
| Auth / profiles | `profiles` (Auth trigger creates profile; member may update limited identity fields). `stage` is migration-backed and stage engine owned. |
| Learning / challenges | `learning_paths`, `challenges`, `challenge_contents`, `challenge_completions`, `challenge_completion_badges`, `user_challenge_progress`; completion/answer RPCs own awards. Answer-key handling is RPC-owned. |
| Events | `events`, `event_attendees`; registration/cancellation/attendance RPCs enforce availability and attendance flow. |
| Projects | `projects` owns metadata, authoritative `publication_state`, delivery `build_stage`, recruitment/capacity and legacy compatibility fields. Project creation/update/review RPCs own writes. |
| Project membership | `project_members` (one row/member/project; one active owner invariant), `project_join_requests`, `project_reviews`, `project_join_request_proofs`; join/review/transfer/recovery/proof RPCs own writes. |
| Activities / badges | `activities` has unique `activity_key`; `badges`, `user_badges`; authoritative domain transactions generate activity and awards. |
| Progression | `profiles.points`, `profiles.stage`, plus completions, attended events, project reviews/memberships are evidence; `advance_member_stage` is internal-only. |
| Admin | `private.admin_users`; `public.admin_audit_log`, readable only by admins. |
| V2.2 workspace | No `project_milestones` or `project_tasks` table/RPC exists yet. |

Important constraints include non-negative points, published/status checks, unique challenge completion, unique active project owner, one open join request, capacity checks in RPCs, URL and length validation, and stage enum-like check. RLS and grants vary by table; do not assume direct writes merely because a TypeScript insert type exists. Exact live constraints, policies, ownership data, and grants are NOT VERIFIED — requires database verification.
