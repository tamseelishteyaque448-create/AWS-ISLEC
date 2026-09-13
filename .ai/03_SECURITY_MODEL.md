# Security model

Authentication is Supabase Auth, surfaced through cookie-backed SSR clients and session refresh in `proxy.ts`. Authorization is database-backed. `private.admin_users` is the admin allowlist; `private.is_admin()` is a stable `SECURITY DEFINER` function with `search_path = ''`, and `public.is_admin()` is the limited wrapper used by server code. `requireAdmin()` checks authenticated claims then calls `public.is_admin()` and safely redirects failures.

`profiles.role` is **not** authoritative admin authorization. Email comparison is **not** admin authorization. Client-side role state is **not trusted**. The browser is **not** a security boundary, and hidden UI is **not** authorization.

RLS determines row access after table privileges permit an operation; grants and RLS are separate layers. Most protected mutations are SECURITY DEFINER RPCs with explicit input/actor checks, empty search paths, revoked public execution, and execution granted to `authenticated`. `auth.uid()` identifies the caller inside policies/RPCs. Direct table writes are deliberately restricted in sensitive domains. `admin_audit_log` records many privileged project/admin actions; it is not proof that every operation has audit coverage.

The secret Supabase client is marked `server-only`, disables browser/session persistence, and must only follow an authorization check. Redirect handling has tests for unsafe `next` values; actual post-login runtime behavior remains NOT VERIFIED — requires browser verification. Profiles and member-owned activities are protected through RLS. Published projects are public; project private access is governed by current membership/admin policy and must be evaluated from the latest migrations.

Never weaken grants, RLS, SECURITY DEFINER `search_path`, or admin allowlist behavior casually. Live policy/grant/RPC parity is NOT VERIFIED — requires database verification.
