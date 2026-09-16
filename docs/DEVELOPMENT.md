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
| `npm run supabase:start` / `stop` | Start or stop local Supabase |
| `npm run supabase:reset` | Reset local Supabase and apply migrations/seed (destructive to local data) |
| `npm run supabase:db:lint` | Lint the local database |

## Change workflow

Read [AGENTS.md](../AGENTS.md), [.ai/CURRENT_PHASE.md](../.ai/CURRENT_PHASE.md), then the relevant domain document. Search for existing services, actions, validation, RPCs, and tests before adding code. Keep changes surgical, preserve security boundaries, and do not edit historical migrations.

The normal branch/PR flow is: create a focused branch, make one coherent change, run targeted validation, inspect the diff, open a PR for review, and merge only after required checks. The repository history contains both direct main-branch work and a merged feature branch; do not assume either pattern is a license to bypass review.

## Environment values

Use `.env.example` as the public template. `.env.local` and `.env.qa.local` are ignored local files. Never paste their values into issues, commits, or documentation.
