# Deployment

The application has a standard Next build/start path and a `.vercel` directory, indicating Vercel-oriented deployment configuration. Production deployment status, environment values, domain configuration, migration application, and rollback readiness are **NOT VERIFIED**.

Before a release, build and lint the exact revision, run relevant Playwright checks against QA, verify database migration/RLS/RPC parity in a non-production environment, and confirm server-only secret configuration. Apply database migrations through the approved Supabase workflow, never by editing production manually for testing.

Do not deploy or change production from an agent session unless explicitly instructed.
