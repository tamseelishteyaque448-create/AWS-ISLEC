# Security

## Authoritative boundaries

- Supabase Auth establishes identity and cookie-backed SSR sessions.
- Postgres grants and RLS control table visibility and operation eligibility.
- Protected `SECURITY DEFINER` RPCs own sensitive mutations and enforce actor/input/state checks.
- `private.admin_users` and `is_admin()` are the administrator authority. `profiles.role`, email comparison, hidden UI, and client state are not authorization.
- `SUPABASE_SECRET_KEY` is server-only. Its client bypasses RLS and may be created only after the caller is authorized.

The browser is untrusted. Client-side checks improve UX only; they are never an authorization boundary. Preserve empty/pinned `search_path` on security-definer functions, explicit grants, input validation, ownership checks, and transaction/locking behavior.

## Operational rules

Never document or commit actual secrets, passwords, tokens, API keys, database dumps, or secret key values. Do not run QA against production or alter production data for tests. Report live RLS, grant, RPC, and deployment results only when actually executed.

The code includes safe-login redirect handling and anonymous protection tests. Full authenticated authorization, live policy parity, storage access, and production security posture are **NOT VERIFIED**.
