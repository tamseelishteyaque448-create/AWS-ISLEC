# AWS ISLEC — Project Audit & Forward Plan

**Document type:** Independent architecture review + forward plan
**Audit date:** 2026-10-04
**Revision audited:** `main` @ `99e6439` **plus uncommitted worktree** (Build & Prove admin UI + 2 new migrations)
**Auditor scope:** source, migrations, docs, configs, tests, and executed local checks
**Authority note:** this document is a *review artifact*. It does not replace [docs/BUILD_AND_PROVE.md](docs/BUILD_AND_PROVE.md) (the product contract) or [AGENTS.md](AGENTS.md) (the operating rules). Where they disagree, they win.

---

## 0. How to read this document

This file has four jobs:

1. **Understand** — what the product is and how the system is actually built (§1–§7).
2. **Verify** — what I actually executed, and what I did not (§8).
3. **Find** — prioritized defects and risks with file-level evidence (§9).
4. **Plan** — a sequenced remediation and feature roadmap with definitions of done (§10–§11).

I use the repository's own status vocabulary, deliberately:

| Word | Meaning |
| --- | --- |
| **IMPLEMENTED** | Present and readable in source. |
| **VERIFIED** | I (or a command I ran) produced executed evidence. |
| **NOT VERIFIED** | Source/config exists; no executed evidence. |
| **PLANNED** | Approved future scope, not started. |
| **BLOCKED** | Cannot proceed safely without a decision or environment. |

The biggest single message of this audit: **the repository is unusually disciplined about data-layer security, and uncharacteristically undisciplined about build integrity and release automation.** The database is defended well; the delivery pipeline is undefended.

---

## 1. What AWS ISLEC is

AWS ISLEC is a **student builder community platform for an AWS student chapter**. It is not a generic LMS; it is a community operations system with three distinct products sharing one identity, one database, and one reward economy.

**Three products, one platform:**

| Product | Who authors it | What it is | Status |
| --- | --- | --- | --- |
| **Learn / Challenges** | Admin | Quiz-style AWS missions with points, streaks, badges, stage progression | IMPLEMENTED, mature |
| **Projects** | Member | Member-created collaborative builds: join requests, skills proofs, milestones/tasks, publication review | IMPLEMENTED, mature (V2.2/V2.3) |
| **Build & Prove** | Admin | *Practical* assignments: build real work, submit proof + evidence, human review, resubmit, approve | IMPLEMENTED in DB + services + member UI; admin UI mid-flight |

**The distinguishing product insight** (and the thing that makes this codebase worth reading) is in [docs/BUILD_AND_PROVE.md](docs/BUILD_AND_PROVE.md): Build & Prove is *not* a quiz. The unit of progress is a **finished artifact with credible proof**, evaluated against requirements by a human admin. The repo enforces this separation ruthlessly — separate tables, separate RPCs, separate reward ledger, and an explicit written ban on reusing challenge-completion semantics.

**Three audiences, three trust levels:**

- **Visitor** — public marketing + discovery surfaces (`/`, `/about`, `/explore`, `/learn`, `/events`, `/projects`).
- **Member** — authenticated student (`/member/*`), the primary daily surface.
- **Admin** — allowlisted chapter operator (`/admin/*`), a separate workspace reached through a hard gate.

---

## 2. Stack (verified from source)

| Layer | Technology | Version | Notes |
| --- | --- | --- | --- |
| Framework | Next.js App Router | **16.3.3** | Turbopack build. Correctly uses the Next 16 `proxy.ts` convention (replaces `middleware.ts`) — verified against `node_modules/next/dist/docs/.../proxy.md` |
| UI runtime | React / React DOM | 19.2.8 | |
| Language | TypeScript | 6.0.3 | `strict: true`, `noEmit`, path alias `@/*` |
| Styling | Tailwind + PostCSS | latest | **Installed and imported but effectively unused** — see F7 |
| Icons | `lucide-react` | latest | Consistent usage |
| Backend | Supabase Auth + Postgres + RLS + Storage | — | 33 tables, 55 public RPCs |
| Testing | Playwright + `node:test` | ^1.63.0 | Two configs: QA and disposable-local |
| Lint | ESLint (`eslint-config-next`) | latest | |
| Deploy | Vercel-oriented | — | `.vercel/project.json` present (`prj_kg5ogcnDamC1W4f2m6oCHnspXmp3`) |

**Runtime env surface** (exhaustive, from `process.env` scan): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `APP_URL`, `QA_E2E_EMAIL`, `QA_E2E_PASSWORD`, `QA_BASE_URL`, `E2E_ENV`, `E2E_BASE_URL`, `E2E_SUPABASE_PORT`. Small and auditable — good.

---

## 3. Repository map

**264 tracked files, ~13,200 lines of TS/TSX, ~8,200 lines of SQL.** This is a small, readable codebase by design.

```
app/            84 files — routes only (thin). Public / member / admin / api / auth.
components/     52 files — presentation. admin / member / auth / layout / cards / ui.
lib/            33 files — ALL server logic. services/ (13) auth/ (4) supabase/ (5)
                validation/ (6) types/ http/ audit/
supabase/       migrations/ (40) tests/ (3 rollback-only SQL suites) config.toml seed.sql
tests/          e2e/ (15 specs, incl. disposable/) unit/ (1 guard suite)
docs/           13 documents — thorough, honest, and current
scripts/        5 — QA dev server + disposable E2E harness
data/           6 files — legacy static seed data, still imported by lib/services.ts
```

**Notable scale outliers:**

| File | Lines | Comment |
| --- | --- | --- |
| [lib/services/build-prove.ts](lib/services/build-prove.ts) | 2,048 | Largest file in the repo. Member + admin + evidence in one module — see F5 |
| [lib/types/database.ts](lib/types/database.ts) | 1,159 | Supabase-generated types, hand-committed — drift risk F6 |
| [components/member/build-prove/BuildProveTaskDetail.tsx](components/member/build-prove/BuildProveTaskDetail.tsx) | 714 | Client component; draft/evidence/submit UI |
| [app/globals.css](app/globals.css) | 1,397 | 540 top-level selectors, hand-written — see F7 |
| `supabase/migrations/20261004150000_build_prove_submission_drafts.sql` | 927 | Largest migration |

**Architecture style — the part to preserve.** The layering is disciplined and consistent:

```
Route (app/)  →  Service (lib/services/)  →  Supabase RPC (SECURITY DEFINER)  →  Postgres + RLS
                        ↑
                 Validation (lib/validation/)  +  Auth (lib/auth/)  +  Audit (lib/audit/)
```

Routes contain **no business logic**. Business rules live in services, and the *authoritative* rules live in SQL. `proxy.ts` matches only `/member/:path*` and `/admin/:path*` and only refreshes session cookies — it does not attempt authorization. This is the correct shape and the codebase follows it.

---

## 4. Request & trust architecture

```
Browser (untrusted)
   │
   ├─ proxy.ts  ── matchers: /member/*, /admin/* ──► refresh cookie-backed claims ONLY
   │
   ├─ app/member/layout.tsx ──► getAuthenticatedClaims() ──► redirect /join if absent
   │
   ├─ app/admin/layout.tsx  ──► requireAdmin() ──► is_admin() RPC ──► redirect /member if not
   │
   └─ Server Component / Route Handler / Server Action
          │
          ├─ createClient()  [lib/supabase/server.ts]  request-scoped SSR client
          │      └─ runs as the USER ⇒ Postgres grants + RLS apply
          │
          └─ createAdminClient()  [lib/supabase/admin.ts]  RLS-BYPASSING service client
                 └─ ONLY after explicit server-side authorization
                    (single call site today: lib/services/admin-member-invitations.ts)
```

**Four separate authorization authorities, cleanly separated.** This is the single strongest thing about the codebase:

| # | Authority | Mechanism | Enforced where |
| --- | --- | --- | --- |
| 1 | Identity | Supabase Auth + cookie SSR claims | [lib/auth/session.ts](lib/auth/session.ts) |
| 2 | Table visibility | Postgres grants + RLS on **all 33 tables** | 40 migrations |
| 3 | Sensitive mutations | 55 `public.*` functions (RPCs + triggers + `is_admin`); 93 `SECURITY DEFINER` bodies, 102 pinned `search_path = ''` | migrations |
| 4 | Admin authority | `private.admin_users` + `private.is_admin()` — never `profiles.role`, never email, never client state | [lib/auth/admin.ts](lib/auth/admin.ts) |

**Verified positively:** I found **zero** direct table writes from any non-admin module. The only `.insert()`/`.update()`/`.delete()` calls in `app/` and `lib/` outside `admin_audit_log` are inside admin server actions that call `requireAdmin()` first. Route handlers that touch Storage (event posters, Build & Prove evidence) all re-derive identity from claims server-side.

---

## 5. Data architecture

**33 tables across 2 schemas**, all with RLS enabled. Domains are namespaced to prevent semantic collision:

| Schema/domain | Tables |
| --- | --- |
| Identity & admin | `profiles`, `private.admin_users`, `admin_audit_log` |
| Legacy learning | `learning_paths`, `challenges`, `challenge_contents`, `challenge_answer_keys`, `challenge_completions`, `challenge_completion_badges`, `user_challenge_progress`, `badges`, `user_badges`, `activities` |
| Events | `events`, `event_attendees` |
| Projects | `projects`, `project_members`, `project_join_requests`, `project_join_request_proofs`, `project_reviews`, `project_milestones`, `project_tasks` |
| Build & Prove | `build_assignments`, `build_assignment_attachments`, `build_assignment_members`, `build_member_domains`, `build_submissions`, `build_submission_drafts`, `build_submission_reviews`, `build_submission_evidence`, `build_submission_rewards` |

**Notable correct decisions:**

- `challenge_answer_keys` has RLS enabled and **no policies at all** — deny-by-default, RPC-only access. Correct for an answers table.
- Every `SECURITY DEFINER` function pins `search_path = ''` (102 pins vs 93 definer bodies).
- Sensitive tables (answers, drafts, rewards) are reachable only through parameterized RPCs.
- Storage has **two separated buckets**: `event-posters` (public-read, filtered to published events) and `build-prove-private` (private, `for all` policies gated by an authorization helper). Evidence deliberately never reuses event-poster storage.

**Migration discipline:** 40 migrations, additively numbered `YYYYMMDDHHMMSS_name.sql`, oldest 2026-08-30 → newest 2026-10-04. Existing migrations are never edited; hardening arrives as new files (`..._hardening.sql`, `..._privacy_fix.sql`). That is the right habit.

---

## 6. Route inventory (from source, not docs)

I verified the route tree against [docs/ROUTES.md](docs/ROUTES.md). The docs are **stale in one direction only**: they omit all Build & Prove routes added since. Current reality:

**Public (11)** — `/`, `/about`, `/explore`, `/join`, `/learn`, `/events`, `/events/[slug]`, `/projects`, `/projects/[slug]`, `/auth/invite`, `/auth/callback`

**Member (16)** — `/member`, `/profile`, `/journey`, `/learn` **(now Build & Prove home)**, `/learn/[domain]`, `/learn/tasks/[taskId]`, `/challenges`, `/challenges/[slug]`, `/events`, `/events/[slug]`, `/explore`, `/projects`, `/projects/[id]`, `/activities`, `/achievements`, `/leaderboard`

**Admin (16)** — `/admin`, `/members`, `/learning`, `/challenges`, `/events`, `/projects`, `/explore`, `/analytics`, `/activities`, `/leaderboard`, `/achievements`, `/settings`, **`/build-prove`**, **`/build-prove/tasks/new`**, **`/build-prove/tasks/[taskId]`**, **`/build-prove/tasks/[taskId]/edit`**

**API handlers (7)** — `POST /api/auth`, `GET /api/events/[slug]/poster`, `GET /api/admin/events/[id]/poster`, `GET /api/e2e/environment` (gated, 404s unless local-disposable + loopback), `POST/DELETE /api/member/build-prove/evidence`, `DELETE /api/member/build-prove/evidence/[evidenceId]`, `GET /api/member/build-prove/references/[attachmentId]`

The three `/api/member/build-prove/*` handlers are correct by design: uploads validate magic bytes server-side ([lib/validation/build-prove-evidence.ts](lib/validation/build-prove-evidence.ts) checks JPEG/PNG/WebP/PDF signatures, not just the client-declared MIME type); downloads are authenticated streams rather than public or signed URLs; and no Storage object path is ever exposed to the client. (The bytes *do* transit the Next runtime — which is exactly the problem in F3.)

---

## 7. Subsystem maturity

| Subsystem | DB | Services | UI | E2E | Verdict |
| --- | --- | --- | --- | --- | --- |
| Legacy challenges / rewards | ✅ | ✅ | ✅ | smoke | Mature |
| Events | ✅ | ✅ | ✅ | — | Mature |
| Projects (V2.2 workspace, V2.3 discovery) | ✅ | ✅ | ✅ | disposable specs | Mature |
| **Build & Prove — member** | ✅ | ✅ | ✅ | workbench + storage specs | Advanced for its age |
| **Build & Prove — admin** | ✅ RPCs | ✅ reads/saves | ⚠️ **in worktree, uncommitted** | NOT written | **The active gap** |
| Build & Prove — reward/activity integration | ledger only | — | — | — | PLANNED (Phase 11–12) |
| Hosting parity (QA/production) | ? | ? | ? | ? | **NOT VERIFIED anywhere** |

**The reward ledger is the interesting open thread.** `build_submission_rewards` exists as a uniqueness barrier so that approval cannot double-award — but **approval does not currently award anything.** The table is a lock waiting for a mechanism. This is deliberate and documented, and it is the right order of operations: build the idempotency barrier first, the awarding logic second. But it means "approved Build & Prove work currently earns a member nothing," which is a product-visible gap.

---

## 8. Verification log — what I actually ran

Everything below was executed in this audit against this worktree. I did not infer any of it.

| # | Command | Result | Detail |
| --- | --- | --- | --- |
| 1 | `npx tsc --noEmit` | **FAIL** | 6 errors on the very first run; 5 were stale-artifact noise (see the note below). After route-type regeneration: **1 real error**, re-confirmed at audit close (exit code 2). |
| 2 | `npm run lint` | **PASS** | 0 errors, 1 warning — pre-existing `<img>` in [components/layout/Sidebar.tsx:5](components/layout/Sidebar.tsx#L5) |
| 3 | `npm run build` | **FAIL** | Compiles in 41s (Turbopack), then **fails type check** at [lib/services/build-prove.ts:1198](lib/services/build-prove.ts#L1198) |
| 4 | `npm run test:e2e:disposable:guard` | **PASS** | 15/15, 330ms. Includes a test asserting `.env.e2e.local` stays git-ignored |
| 5 | `npm run test:e2e` | **NOT RUN** | Not runnable: its Playwright `webServer` runs `npm run build && npm run start`, and the build fails. |
| 6 | Supabase SQL suites (3 files, 1,920 lines) | **NOT RUN** | Requires a provisioned local disposable Postgres; none running in this audit |
| 7 | Browser / runtime / responsive checks | **NOT RUN** | Requires a running app; blocked by the build failure |
| 8 | `supabase db lint` | **NOT RUN** | Requires local Supabase |

**One methodological finding worth keeping:** `tsconfig.json` includes `.next/types/**/*.ts`, and [next-env.d.ts](next-env.d.ts) additionally imports `./.next/dev/types/*` — both **generated**. On a clean checkout, `npx tsc --noEmit` typechecks against route types that do not exist yet. My first run reported 5 phantom `AppRoutes` errors for the brand-new `/admin/build-prove/*` pages; those vanished the moment the route types were regenerated. **A bare `tsc --noEmit` is not a valid gate on a fresh clone.** Use `next typegen && tsc --noEmit`, or rely on `next build`.

---

## 9. Findings, prioritized

### P0 — Blocking release

**F1 · The production build is broken.** `npm run build` fails type checking.

- **Where:** [lib/services/build-prove.ts:1193-1198](lib/services/build-prove.ts#L1193)
- **Cause:** `assignBuildMembersBulk` selects 17 columns from `build_assignments`, but passes the row to `mapTask()`, which requires the full `BuildAssignmentRow` (19 columns incl. `created_at`, `updated_at`). Two other call sites of the same select correctly include both columns.
- **Fix:** add `created_at, updated_at` to that `.select(...)` string.
- **Secondary smell:** the function then re-calls `saveBuildAssignment` with the assignment's own unchanged values just to reach the RPC's `p_member_ids` parameter. That is *why the DB has no bulk-assign RPC* — `save_build_assignment` owns both concerns. It works, and it is audited, but it means every bulk assignment is a full assignment rewrite. Worth a comment, or a dedicated `assign_build_members` RPC.
- **Impact:** nothing else in the quality chain runs. Lint can't be trusted as a release gate because the build never reaches runtime.

**F2 · No CI.** There is no `.github/` directory and no other pipeline definition.

- Every check in §8 is manual, local, and unremembered. The build has been sitting broken in a worktree across at least one commit boundary.
- **Impact:** F1 shipped to `main`'s working state undetected. Nothing enforces `tsc`, `lint`, `build`, or the disposable-env guard on push or PR.

**F2b · `next-env.d.ts` flip-flops.** Running `next build` rewrites its type imports from `./.next/dev/types/…` to `./.next/types/…`; running `next dev` flips them back. It is Next-managed and committed, so every build leaves a spurious diff that a careless `git add -A` would sweep in. Consider gitignoring it. *(Observed directly: my audit's `next build` modified it; I restored the file to its committed state.)*

### P1 — Production correctness

**F3 · Evidence uploads will fail on Vercel above ~4.5 MB.** *(Deployment-gated, invisible to local tests.)*

- The app accepts evidence up to **10 MiB** ([lib/validation/build-prove-evidence.ts](lib/validation/build-prove-evidence.ts): `MAX_EVIDENCE_SIZE = 10 * 1024 * 1024`), matching the `build-prove-private` bucket limit.
- Uploads POST multipart bodies to Next **route handlers** — `fetch()` from [BuildProveTaskDetail.tsx:341](components/member/build-prove/BuildProveTaskDetail.tsx#L341) to `/api/member/build-prove/evidence`.
- **Vercel Functions impose a hard 4.5 MB request-body limit** (confirmed against Vercel's published limits). Route handlers run as Vercel Functions.
- **Why no test caught it:** the disposable E2E app runs via `next start` on loopback with no platform proxy in front. The storage spec tests a 10 MiB file only to assert it is *rejected*; it never asserts a *successful* upload of 4.5–10 MB.
- **Fix options:** (a) drop the app-level cap to ~4 MB and state the platform ceiling in `BUILD_AND_PROVE.md`; (b) direct-to-Supabase client upload with a short-lived signed upload token, so bytes bypass the Next runtime — architecturally better and preserves the 10 MiB promise; (c) move to Vercel Blob. I recommend (b).
- Related: [next.config.ts](next.config.ts) sets `experimental.serverActions.bodySizeLimit: "11mb"`, but no evidence upload traverses a server action — that setting may be vestigial. Also note Next 16 buffers proxy-matched bodies at a **10 MB default** (`proxyClientMaxBodySize`); the current matchers exclude `/api/*`, so this is latent, not active.

**F4 · Two "domains," one route.** `/member/learn` was repurposed from legacy learning to Build & Prove.

- Implemented as documented ([docs/BUILD_AND_PROVE.md](docs/BUILD_AND_PROVE.md) §25, ADR-003), with legacy challenges relocated to `/member/challenges`. Defensible, but the legacy `/learn` public page and the new `/member/learn` now mean different things with similar names.
- **Action:** none urgent; a nav-label disambiguation pass and a migration-aware redirect would reduce member confusion. Note that `components/navigation/NavLinks.tsx` is already modified in this worktree, so someone is on it.

### P2 — Maintainability

**F5 · `lib/services/build-prove.ts` is 2,048 lines** covering member reads, admin reads, assignment authoring, drafts, evidence upload/download/delete, submission, resubmission, review, and bulk assignment. It is well-written — typed error codes, validated UUIDs, defensive RPC result checks — but it is the repo's largest module and the most likely source of the next accidental cross-domain coupling. Split into `build-prove/member.ts`, `build-prove/admin.ts`, `build-prove/evidence.ts`.

**F6 · `lib/types/database.ts` is committed generated output (1,159 lines).** Nothing regenerates or verifies it. After a new migration lands, this file can silently disagree with the live schema — and it is the type source for every `.from(...)` call. Add a `npm run types:check` that diffs regenerated output.

**F7 · Tailwind is installed, imported, and unused.** [app/globals.css](app/globals.css) does `@import "tailwindcss"` and then declares 540 hand-written selectors across 1,397 lines of minified CSS, with 53 hand-authored `@media` breakpoints. Zero Tailwind utility classes exist in any `className`. Every new feature grows this file by hand. Decide: adopt utilities and delete the sheet, or drop Tailwind + PostCSS from the toolchain. **Leaving both is the worst option and is the status quo.**

**F8 · Dead and scratch files in the tracked tree.**
- `lib/services/projects.ts.backup`, `components/admin/AdminOverview.tsx.backup` — stale copies.
- `mockRepository` in [lib/services.ts:203](lib/services.ts#L203) returns **hardcoded fake data** (`data/users.ts`: "Alex Morgan", "@alexm", 1840 points). It is currently unimported — but it is exported and type-compatible with `supabaseRepository`, so it is a loaded trap for the next developer.
- Root scratch: `implementation-log.txt` (UTF-16, 1 line), `remote_public_schema.sql` (0 bytes), `privilege_check.sql`.
- `components/*/.gitkeep` placeholders for empty component dirs (badges, events, hero, leaderboard, navigation, profile, projects).

**F9 · `.env.example` ships a live project URL and publishable key.**
`https://xokpzusmtmcfeqxjovbz.supabase.co` + `sb_publishable_…`. Publishable keys are *designed* to be public, so this is not a secret leak — but it points a fresh `cp .env.example .env.local` at a real hosted database, which is exactly the class of accident the repo's own rules forbid. Use obvious placeholders.

**F10 · `playwright.config.ts` has a UTF-8 BOM** before `import`. Harmless to esbuild, but it is the kind of thing that breaks a stricter tool later.

### P3 — Deliberately open

**F11 · Reward/activity integration is unbuilt.** `build_submission_rewards` is a uniqueness barrier with no writer. `docs/BUILD_AND_PROVE.md` §21–§23 correctly forbids routing this through `complete_challenge()`. Phase 11–12 remain PLANNED.

**F12 · Everything about hosting is NOT VERIFIED.** No migration has been confirmed applied to QA or production; no hosted RLS, grant, RPC, or Storage-policy execution has been observed; no authenticated browser flow has been run against any hosted environment. The docs are commendably honest about this — but it means the repo's true state is **local-only**.

---

## 10. Phased plan

The roadmap is split into **six phases**. Each has a single goal, a task list with a "done when" per task, and an **exit gate** — a concrete, executable condition. A phase is not finished until its gate passes.

### How to read this

- **Gate** — the executable condition that closes the phase. Do not start the next phase until it passes.
- **Blocked on** — a decision only the owner can make. Phases marked this way cannot start without it.
- **Cross-phase rule** — every phase updates the docs it touches in the same change. Documentation drift (already present, §6) is what makes the next audit expensive.

### Sequencing

```
Phase 0  Unblock          ── must be first; everything downstream depends on it
   │
Phase 1  Lock it in       ── prevents the same class of regression
   │
Phase 2  Admin UI         ── the declared product next step; RPCs already exist
   │
Phase 3  Deployment       ── blocked on: hosting target decision
   │
Phase 4  Rewards          ── blocked on: reward policy decision

Phase 5  Retire the debt  ── independent; run any time, in parallel with 2–4
```

| Phase | Goal | Depends on | Blocked on | Effort | Exit gate |
| --- | --- | --- | --- | --- | --- |
| **0 · Unblock** | Fix the broken build | — | — | ~1 hour | `npm run build` exits 0 |
| **1 · Lock it in** | Make regressions impossible to merge | Phase 0 | — | ~half day | CI runs on push/PR and red-lights the tree |
| **2 · Admin UI** | Complete Build & Prove for admins | Phase 1 | — | ~2 days | SQL suite + admin E2E recorded PASS |
| **3 · Deployment** | Make hosting behaviour truthful | Phase 1 | **Hosting target** | ~1 day | Parity evidence recorded for QA |
| **4 · Rewards** | Make approval actually pay | Phase 2 | **Reward policy** | ~2 days | Double-award + retry tests pass |
| **5 · Debt** | Reduce maintenance cost | none | Tailwind decision (partly) | ~3 hours | Lint clean, no dead code |

---

### Phase 0 — Unblock *(do this first)*

**Why first:** the build is red, so every other phase's verification is meaningless. `npm run test:e2e` cannot even boot, because its Playwright `webServer` runs the build.

| # | Task | Done when |
| --- | --- | --- |
| 0.1 | Fix F1 — add `created_at, updated_at` to the `.select(...)` at [build-prove.ts:1193](lib/services/build-prove.ts#L1193) | `npx tsc --noEmit` → 0 errors |
| 0.2 | Document the generated-types trap: typecheck is `next typegen && tsc --noEmit`, not bare `tsc` | Note added to [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| 0.3 | Re-run the full §8 gate list | build PASS · lint PASS · guard 15/15 |

**Exit gate:** `npm run build` exits 0, and `npx tsc --noEmit` reports 0 errors.

**Residual risk:** 0.1 removes the symptom. `assignBuildMembersBulk` still rewrites the whole assignment to reach the RPC's `p_member_ids` (§9 F1). That is defensible but deserves a comment or a dedicated `assign_build_members` RPC.

---

### Phase 1 — Lock it in

**Why:** F1 sat undetected with no CI. Fixing it once is worth little if the next break is also silent.

| # | Task | Done when |
| --- | --- | --- |
| 1.1 | Add `.github/workflows/ci.yml`: `typegen + tsc --noEmit`, `lint`, `build`, `test:e2e:disposable:guard` | Runs on every push and PR |
| 1.2 | Verify the workflow **fails** on a deliberately broken build, then revert | Red run observed, then green |
| 1.3 | Fix the `<img>` warning in [Sidebar.tsx](components/layout/Sidebar.tsx) via `next/image` | `npm run lint` → 0 errors, **0 warnings** |
| 1.4 | Generated-types drift check (F6) | Stale `database.ts` fails CI |
| 1.5 | Guard test asserting `.env.example` holds no live project ref (F9) | Guard fails on a real ref |
| 1.6 | Gitignore `next-env.d.ts` (F2b) | `next build` leaves no spurious diff |

**Exit gate:** a deliberately broken commit turns CI red, and merge is blocked.

---

### Phase 2 — Finish Build & Prove (admin) *(the declared product next step)*

**Why here:** [docs/BUILD_AND_PROVE.md](docs/BUILD_AND_PROVE.md) §44 names this the next action. The RPC layer is already IMPLEMENTED, so this is UI work over finished contracts — the highest-value phase per hour. It needs no external decision.

| # | Task | Done when |
| --- | --- | --- |
| 2.1 | Resolve the in-flight `/admin/build-prove` worktree: commit or shelve | A deliberate decision, not drift |
| 2.2 | Assignment CRUD, publication, bulk assignment | Covers `/build-prove/tasks/new`, `/[taskId]`, `/[taskId]/edit` |
| 2.3 | Review queue + detail: request changes / approve | Append-only history renders; illegal transitions rejected by RPC |
| 2.4 | Run [build_prove_admin_authoring.sql](supabase/tests/build_prove_admin_authoring.sql) (481 lines) | PASS with `ROLLBACK` confirmed |
| 2.5 | Admin E2E on disposable: cross-member denial, non-admin denial, lifecycle | Recorded PASS per scenario |

**Exit gate:** admin SQL suite passes with rollback, and every admin authorization scenario is recorded.

**Maps to** [docs/BUILD_AND_PROVE.md](docs/BUILD_AND_PROVE.md) Phases 3, 8, 9.

---

### Phase 3 — Make deployment honest

**Blocked on your decision:** is Vercel still the target? The correct fix for F3 differs by host.

| # | Task | Done when |
| --- | --- | --- |
| 3.1 | Decide hosting; write it into [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Decision recorded with its rationale |
| 3.2 | Resolve F3 — direct-to-Supabase upload, **or** lower the cap to the platform ceiling | Enforced, documented, and covered by a test that **successfully** uploads at the new maximum |
| 3.3 | Apply all 40 migrations to QA; run `supabase db lint`; verify grants/RLS/RPC parity | Recorded PASS/FAIL with exact command and environment |
| 3.4 | Run the 3 SQL suites (1,920 lines) against local disposable Postgres | All pass with `ROLLBACK` |
| 3.5 | Run authenticated Playwright suites against QA with real personas | Recorded evidence, per suite |
| 3.6 | Reconcile [docs/ROUTES.md](docs/ROUTES.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for Build & Prove routes | Docs match source |

**Exit gate:** QA parity is *evidenced*, not asserted. The words NOT VERIFIED in §7 are replaced by recorded results or by an explicit, accepted reason.

**Note:** 3.3–3.5 need the local-disposable provisioning that [docs/TESTING.md](docs/TESTING.md) says requires **separate explicit approval**. Request it before starting this phase.

---

### Phase 4 — Reward authority *(the product payoff)*

**Blocked on your decision:** point values and the reward contract. The uniqueness barrier exists; the mechanism does not.

| # | Task | Done when |
| --- | --- | --- |
| 4.1 | Approve the written reward contract | Documented before any code |
| 4.2 | Idempotent approval → reward processing, server/database-authoritative | Double-approve and retry tests pass; ledger stays unique |
| 4.3 | Distinct activity identity for approved Build & Prove work | Activity regression passes; **not** `activity_type = challenge` |
| 4.4 | Stage/achievement integration — only with its own explicit contract | Explicitly scoped, or explicitly declined and recorded |

**Exit gate:** an approved submission awards exactly once, ever — proven by a retry test, not by inspection.

**Hard constraint (from the product contract):** must never call `complete_challenge()`, create `challenge_completions`, reuse streak logic, or touch project membership.

**Maps to** [docs/BUILD_AND_PROVE.md](docs/BUILD_AND_PROVE.md) Phases 11–13.

---

### Phase 5 — Retire the debt *(independent; any time)*

Unblocks nothing and depends on nothing. Run it alongside Phases 2–4, or as a cleanup pass.

| # | Task | Finding | Done when |
| --- | --- | --- | --- |
| 5.1 | Delete `.backup` files, `mockRepository`, root scratch files, empty `.gitkeep` dirs | F8 | No tracked dead code; the fake-data repository can no longer be imported |
| 5.2 | Split [lib/services/build-prove.ts](lib/services/build-prove.ts) into member / admin / evidence | F5 | Largest service under ~600 lines |
| 5.3 | Strip the BOM from [playwright.config.ts](playwright.config.ts) | F10 | First byte is `#`/`i` of `import`, no BOM |
| 5.4 | Decide Tailwind: adopt utilities, or drop the dependency | F7 | Only one styling system remains |

**Exit gate:** 5.1–5.3 complete; 5.4 has a recorded decision and the codebase matches it.

**Note:** 5.2 is best done *after* Phase 2, so the admin UI is not refactored twice.

---

## 11. Verification protocol

Per [AGENTS.md](AGENTS.md) and [docs/TESTING.md](docs/TESTING.md), and reinforced by this audit:

1. **A test existing is not a test passing.** Every claim needs an executed command, named environment, and named persona.
2. **Never test against production.** QA for runtime; local-disposable for destructive lifecycles.
3. **Source is not parity.** A migration file proves intent, never that it was applied or that its policies behave.
4. **Typecheck after route-type generation.** `next typegen && tsc --noEmit`.
5. **Report honestly.** PASS / FAIL / NOT VERIFIED / BLOCKED — never a soft claim.
6. **Secrets stay server-side.** `SUPABASE_SECRET_KEY` is never logged, committed, or documented.

---

## 12. Open questions for the owner

1. **Hosting target — is Vercel still the plan?** F3 has a different correct answer on Vercel vs a container host with no 4.5 MB ceiling. This is the single highest-leverage unknown.
2. **Tailwind: adopt or remove?** (F7) Every future feature is affected by this answer.
3. **Is `/member/learn` → Build & Prove a permanent rename?** (F4) If yes, retire the confusing `/learn` public page naming.
4. **Reward policy for Build & Prove approval** — the product promise "earn controlled recognition" is currently unbacked.
5. **Should the in-flight `/admin/build-prove` work be committed or discarded?** 10 modified + 14 untracked paths (plus `plan.md` from this audit), including 2 untracked migrations.
6. **Is a 15-assignment catalogue (5/5/5 easy/medium/hard) authored yet?** §8 of the contract targets it; I found only schema and code.

---

## Appendix A — Commands

```bash
npm install
npx next typegen && npx tsc --noEmit        # typecheck (regenerate route types first!)
npm run lint
npm run build
npm run test:e2e                            # needs QA_BASE_URL or a successful build
npm run test:e2e:disposable:guard           # 15/15 PASS, no network, no server
npm run test:e2e:disposable                 # BLOCKED until local-disposable provisioning is approved
npm run supabase:db:lint                    # needs local Supabase
git diff --check
```

## Appendix B — Glossary

**Assignment** — admin-authored practical work spec (`build_assignments`). **Work item** — one member's assignment instance (`build_assignment_members`); owns lifecycle status. **Draft** — the member's editable pre-submission payload (`build_submission_drafts`). **Submission / revision** — an immutable numbered snapshot (`build_submissions`). **Review** — an append-only admin decision (`build_submission_reviews`; `approved` | `changes_requested` only). **Evidence** — private proof attachments (`build_submission_evidence`) in the `build-prove-private` bucket. **Reward ledger** — per-work-item uniqueness barrier (`build_submission_rewards`); no writer yet.