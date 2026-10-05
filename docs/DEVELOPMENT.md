# Development

## Prerequisites

Use a supported Node.js/npm installation and the repository lockfile. Install dependencies with:

```text
npm install
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the normal Next development server |
| `npm run dev:qa` | Start development with `.env.qa.local`; refuses the production Supabase URL |
| `npm run build` | Build the production bundle |
| `npm run start` | Serve a completed build |
| `npm run lint` | Lint `app`, `components`, `data`, `lib`, and `proxy.ts` |
| `npm run test:e2e` | Run Playwright tests |
| `npm run test:e2e:disposable:guard` | Run offline tests for the local-disposable environment guard |
| `npm run test:e2e:disposable` | Run destructive lifecycle E2E only against explicitly configured local disposable Supabase |
| `npm run supabase:start` / `stop` | Start or stop local Supabase |
| `npm run supabase:reset` | Reset local Supabase and apply migrations/seed (destructive to local data) |
| `npm run supabase:db:lint` | Lint the local database |

## Type checking

`tsconfig.json` typechecks against **generated** route types. Both `next-env.d.ts` (`./.next/dev/types/*`) and the `include` list (`./.next/types/*`) point at files that Next.js produces, not files that are committed. On a fresh clone those files do not exist yet.

The consequence is that a bare `npx tsc --noEmit` is **not** a valid gate on a clean checkout. It typechecks against route types that may predate any route you just added, and it reports phantom errors such as:

```text
error TS2344: Type '"/admin/build-prove"' does not satisfy the constraint 'AppRoutes'.
error TS2339: Property 'taskId' does not exist on type 'unknown'.
```

Those are stale-artifact errors, not real defects. They disappear as soon as the route types are regenerated.

Use one of these instead:

```bash
npx next typegen && npx tsc --noEmit   # fast: regenerate types, then typecheck
npm run build                          # authoritative: compiles, then typechecks
```

`npm run build` is the authoritative check because it regenerates the route types itself before type checking. Do not record a `tsc` result as PASS unless the route types were generated first, and do not "fix" an `AppRoutes` or `Property ... does not exist on type 'unknown'` error by editing `next-env.d.ts` or the `tsconfig` include list.

Note that `next build` and `next dev` write different paths into the generated `next-env.d.ts` (`./.next/types/*` versus `./.next/dev/types/*`), so switching between them produces an expected diff in that file. It is generated; do not hand-edit it.

## Change workflow

Read [AGENTS.md](../AGENTS.md), [.ai/CURRENT_PHASE.md](../.ai/CURRENT_PHASE.md), then the relevant domain document. Search for existing services, actions, validation, RPCs, and tests before adding code. Keep changes surgical, preserve security boundaries, and do not edit historical migrations.

The normal branch/PR flow is: create a focused branch, make one coherent change, run targeted validation, inspect the diff, open a PR for review, and merge only after required checks. The repository history contains both direct main-branch work and a merged feature branch; do not assume either pattern is a license to bypass review.

## Environment values

Use `.env.example` as the public template. `.env.local`, `.env.qa.local`, and `.env.e2e.local` are ignored local files. Never paste their values into issues, commits, or documentation. The disposable E2E command requires `.env.e2e.local` and fails closed unless it identifies the configured loopback app and local Supabase API; normal development and E2E commands do not use this destructive suite.
