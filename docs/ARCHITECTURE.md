# Architecture

## Status

The architecture is **IMPLEMENTED in source**. Live deployment, schema parity, and authenticated runtime behavior are **NOT VERIFIED** in this documentation pass.

## Stack

- Next.js App Router, React, TypeScript, Tailwind/PostCSS, and `lucide-react`.
- Supabase Auth, Postgres, Row Level Security (RLS), Storage, and SQL RPCs.
- Server Components and route handlers for reads; server actions and service modules for mutations.
- Playwright for browser checks; ESLint and TypeScript for static checks.
- Vercel configuration exists in the workspace; deployment state is **NOT VERIFIED**.

## Request path

`Browser UI -> Next request/proxy -> Supabase SSR client -> Auth claims -> Postgres grants/RLS -> protected RPC or read -> service/UI`

`createAdminClient()` is a server-only, RLS-bypassing client for narrowly scoped operations after authorization. The browser receives only public Supabase configuration.

`proxy.ts` matches `/member/:path*` and `/admin/:path*` to refresh session cookies. The member layout redirects unauthenticated users to `/join`; the admin layout calls `requireAdmin()`, which checks `private.admin_users` through the `is_admin` RPC.

## Design direction

The UI is a bright, spacious AWS-inspired learning and builder workspace: navy navigation/sidebar surfaces, card-based content, semantic status colors, responsive layouts, and a stronger visual hierarchy for podium/leaderboard recognition. Recent visual work intentionally changed presentation only; backend and data behavior remain unchanged.
