# Testing and QA

## Available checks

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`
- `npx playwright test tests/e2e/security-verify.spec.ts`
- `npm run supabase:db:lint` when local Supabase is available
- `git diff --check`

Playwright is configured for Chromium, one worker, a 30-second test timeout, and `QA_BASE_URL` when testing an already-running QA server. The checked-in suites cover smoke, authentication/redirect safety, and limited invite/login behavior.

## Evidence rules

The existence of a test is not a passing result. Historical claims such as "57/57 project QA" are retained as historical reports, not current reproducible evidence. Authenticated member/admin flows, live migration parity, RLS/grants/RPC execution, storage authorization, and production behavior are **NOT VERIFIED** unless a run produces evidence.

Use QA, not production. Do not use destructive local resets as a substitute for live parity. Record PASS/FAIL/NOT VERIFIED and the exact command/persona/environment.
