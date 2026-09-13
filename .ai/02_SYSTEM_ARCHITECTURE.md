# System architecture

The application is Next.js (App Router) with TypeScript, React, Tailwind/PostCSS, Supabase Auth, Supabase Postgres, and Playwright. It is configured for Vercel deployment (`.vercel` exists); Git/GitHub are source-control workflow dependencies. Production deployment state is NOT VERIFIED — requires runtime verification.

Read paths use public browser Supabase clients (`lib/supabase/client.ts`) or request-scoped server clients (`lib/supabase/server.ts`), with RLS applied. Member/admin layouts and the `proxy.ts` matcher protect `/member` and `/admin`; the proxy refreshes Supabase session cookies. Server components/services read domain data. Public API routes serve event posters and auth-related paths.

Mutation paths use server actions (notably `app/member/**/actions.ts` and `app/admin/**/actions.ts`) and services in `lib/services/`, which call protected Postgres RPCs. Database mutations are intentionally concentrated in schema-qualified, `SECURITY DEFINER`, `search_path = ''` RPCs with grants limited to `authenticated`, or in narrowly scoped server-only secret-client work after authorization. Database constraints, triggers, RLS, grants, and RPC checks remain authoritative.

Security boundaries: browser/UI → server request boundary → Supabase session/authentication → Postgres grants → RLS → protected RPC authorization/constraints. The browser is not trusted. `createAdminClient()` is server-only and uses `SUPABASE_SECRET_KEY`; its callers must authorize first. The browser client uses only public Supabase configuration.

Do not assume services are the authority, that a route is protected merely because it is hidden, or that source migration history equals a live database. V2.2 tables/RPCs are not present in migrations.
