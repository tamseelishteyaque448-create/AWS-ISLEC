# Administrator experience

`/admin` and its child routes are protected by the server-side admin layout. `requireAdmin()` checks a valid Supabase claim and the database `is_admin()` authority backed by `private.admin_users`; a profile role or browser flag is insufficient.

Admin areas currently include members, learning, challenges, events, projects, explore, analytics, activities, leaderboard, achievements, and settings. Admin actions include managing content and members, reviewing project publication, handling event attendance/posters, observing analytics/activity, and operating progression-facing views.

Project review is: owner creates a draft, submits it, admin reviews details in the admin project area, then approves/publicates, requests changes, or archives as supported. Published projects become eligible for public/member discovery.

Admin authorization and UI rendering are implemented in source. Live allowlist contents, audit coverage, database parity, and end-to-end admin flows are **NOT VERIFIED**.
