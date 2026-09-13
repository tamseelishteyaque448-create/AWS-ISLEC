# AWS ISLEC project overview

AWS ISLEC is a student builder community: a Next.js and Supabase application that helps students discover opportunities, join the community, learn, build projects, connect through events, contribute evidence, prove progress, and lead. The intended journey is **Discover → Join → Learn → Build → Connect → Contribute → Prove → Lead**. Progression is **Explorer → Builder → Contributor → Innovator → Mentor**.

There are three experiences: public routes for discovery, authenticated member routes for participation, and administrator routes for community operations. Major route areas are `/(public)` (home, about, explore, learn, events, projects, join), `/member` (profile, journey, challenges, events, projects, activities, achievements, leaderboard), and `/admin` (members, learning, challenges, events, projects, analytics, activities, leaderboard, achievements, settings).

System map: `Next.js UI → server action/service or route handler → protected SECURITY DEFINER RPC or RLS-bound read → Supabase Postgres → constraints/triggers/RLS/grants → UI`.

Implemented domains are authentication and profiles; learning and challenges; events; activities and badges; progression and leaderboard; administration; Projects V1 and V2.1 skill proofs. Projects V2.2 workspace is **not implemented**; its frozen Phase A contract is in `09_PROJECTS_V2_2_WORKSPACE.md`.

Authoritative sources: the checked-in migrations for schema/security behavior, application code for invocation paths, and this frozen context for V2.2 scope. Never infer runtime state from source alone. Overall classification: **static repository reconstruction completed; runtime/database parity NOT VERIFIED — requires runtime/database verification.**
