# Testing and QA

## Available checks

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`
- `npx playwright test tests/e2e/security-verify.spec.ts`
- `npm run test:e2e:disposable:guard`
- `npm run test:e2e:disposable` (requires an approved, provisioned local disposable environment)
- `npm run supabase:db:lint` when local Supabase is available
- `supabase/tests/build_prove_core_workflow.sql` against local disposable Postgres (transaction ends in `ROLLBACK`)
- `git diff --check`

Playwright is configured for Chromium, one worker, a 30-second test timeout, and `QA_BASE_URL` when testing an already-running QA server. The checked-in suites cover smoke, authentication/redirect safety, and limited invite/login behavior.

## Evidence rules

The existence of a test is not a passing result. Historical claims such as "57/57 project QA" are retained as historical reports, not current reproducible evidence. Authenticated member/admin flows, live migration parity, RLS/grants/RPC execution, storage authorization, and production behavior are **NOT VERIFIED** unless a run produces evidence.

The Build & Prove SQL workflow test exercises local role-scoped access, allowed and rejected lifecycle transitions, immutable revision flow, append-only review behavior, duplicate assignment/reward protections, and the Storage access helper. Run it with `psql` inside the local Supabase database container so its multi-statement transaction executes as one script; `supabase db query --file` uses a prepared statement and is not suitable for this test. The test rolls back all fixture writes. A SQL helper test is not a substitute for browser or live Storage authorization verification.

Use QA, not production. Do not use destructive local resets as a substitute for live parity. Record PASS/FAIL/NOT VERIFIED and the exact command/persona/environment.

## Disposable project-lifecycle E2E

Destructive project-lifecycle tests use a separate Playwright configuration and are never part of `npm run test:e2e`. Shared QA remains read-only for this lifecycle verification. Production is not an eligible test target.

### Manual GitHub-hosted Phase 7B integration

`.github/workflows/build-prove-phase7b-integration.yml` is a manual-only `workflow_dispatch` gate, restricted by its preflight to the repository's `main` revision on a fresh GitHub-hosted Ubuntu runner. Launch it from **Actions → Build & Prove Phase 7B ephemeral integration → Run workflow → main → Run workflow**. The workflow checks out the dispatch SHA, uses Node.js 22 and the lockfile-pinned Supabase CLI `2.119.0`, and runs only `tests/e2e/disposable/build-prove-phase6-review.spec.ts`.

The workflow copies the checked-in Supabase config, migrations, and seed into a new per-run directory under `RUNNER_TEMP`, substitutes a project ID derived from the GitHub run ID/attempt, starts that project with `npx supabase --workdir "$E2E_SUPABASE_WORKDIR" start`, and applies migrations/seed with `npx supabase --workdir "$E2E_SUPABASE_WORKDIR" db reset --local --yes`. Before creating test identities or running Playwright, provisioning rejects a linked project or any non-loopback API/DB target and verifies `public.build_assignment_members` and `public.build_submission_rewards` are empty and `public.activities` has no `activity_type = 'build_prove'` rows. Every project-targeting Supabase CLI command, the environment validator, the Playwright app, and the legacy SQL fixture helper use that explicit work directory. The workflow creates four temporary Auth users and an administrator allowlist entry only in that stack. Auth and Storage use the validated local API endpoint; SQL CLI calls use the same isolated work directory with `--local`.

No developer `.env` files or hosted Supabase credentials are used. Generated test credentials remain in a temporary runner-local environment file. The service-role key is read from isolated local CLI status by the provisioning process and is never written to the browser test environment; credential-bearing CLI output is captured in runner memory and withheld from Actions logs. The workflow does not upload artifacts or browser storage state and stops the stack in an `always()` cleanup step; the hosted runner is the final disposal boundary. Workflow configuration or static checks are not evidence that this integration run passed, and this gate does not establish QA/production parity.

The disposable runner requires an ignored `.env.e2e.local` file with `E2E_ENV=local-disposable`, a loopback `E2E_BASE_URL` and matching `APP_URL`, the local Supabase URL and publishable key, distinct `E2E_OWNER_*`, `E2E_CONTRIBUTOR_*`, `E2E_ADMIN_*`, and `E2E_NON_ADMIN_*` credentials, plus explicit UUIDs for `E2E_DELETE_PROJECT_ID`, `E2E_ARCHIVED_PROJECT_ID`, and `E2E_PENDING_PROJECT_ID`. No server-side database key is needed by the browser-login fixtures. Do not add credentials or fixture IDs to tracked files. The runner accepts only the local Supabase API endpoint configured by `supabase/config.toml`, blocks hosted backends, clears inherited QA/Supabase target variables, and fails before Playwright starts if required values are absent or invalid.

The disposable Playwright configuration never reuses an existing app server. Its app startup validates the target again, binds only to loopback, and exposes a no-store identity endpoint only while the validated local-disposable marker and local backend are active. Global setup verifies that endpoint before tests execute. Owner, contributor, admin, and non-admin fixtures authenticate as four distinct identities in separate browser contexts; no session state is shared.

`tests/e2e/disposable/build-prove-member.spec.ts` is the authenticated member UI viewport check. It uses the configured local contributor identity and verifies the Build & Prove overview and domain work-list shell at 320, 360, 390, 412, 768, 1024, and 1440 CSS pixels. It does not create fixtures or mutate database state. Task-detail submit/resubmit and populated work-item UI checks require a separately approved disposable Build & Prove work item and are not implied by this viewport test.

The project fixture contract requires explicit, distinct project IDs; tests must never select an arbitrary existing project. The delete test project is disposable and expected to be deleted by its positive case. Archived and pending-review cases use separate fixtures so lifecycle order and reward/audit side effects do not become implicit dependencies.

Before Phase 5D, explicit approval is required to start local Docker/Supabase, reset or initialize the disposable local database, create dedicated Auth users and profiles, create the three project fixtures and memberships, grant the E2E admin through `private.admin_users`, and configure local-only E2E credentials. Those actions are not part of Phase 5C. The disposable runner is not ready to execute until this separate provisioning approval and setup are complete.

Run `npm run test:e2e:disposable:guard` to test the pure environment guard without network access or app startup. Run `npm run test:e2e:disposable` locally only after disposable local provisioning and setup are explicitly approved and complete. The manual hosted workflow provisions its own isolated runner project and does not use the workstation's Supabase stack.
