# Environments

| Environment | Purpose | Status |
| --- | --- | --- |
| Local Next | UI development with a configured Supabase target | IMPLEMENTED; exact local configuration is developer-dependent |
| Local Supabase | Postgres/Auth/Storage/Studio for isolated work | CONFIGURED in `supabase/config.toml`; availability was not verified here |
| QA | Runtime and authenticated testing against a non-production Supabase project | IMPLEMENTED by `npm run dev:qa`; current QA values and connectivity are NOT VERIFIED |
| Production | Deployed application and production Supabase project | Configuration references exist; deployment/database parity is NOT VERIFIED |

`scripts/dev-qa.mjs` requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `APP_URL` in `.env.qa.local`, and refuses the known production Supabase URL. `SUPABASE_SECRET_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix.

QA must never be pointed at production. Production data and schema must not be modified for testing. Use least-privilege QA accounts and isolated test data.
