# AWS ISLEC

AWS ISLEC is a Next.js and Supabase student builder community. Members can learn AWS, complete challenges, join events, discover projects, contribute evidence, and progress through achievements. Administrators operate the community through a separate workspace.

## Start here

1. Read [AGENTS.md](./AGENTS.md) before changing code.
2. Read [.ai/CURRENT_PHASE.md](./.ai/CURRENT_PHASE.md) and the relevant document in [docs/](./docs/).
3. Copy the documented environment template, then run `npm install`.
4. Use `npm run dev:qa` for QA development. Do not point QA at production.

The repository is a Next.js App Router application with TypeScript, React, Tailwind/PostCSS, Supabase Auth/Postgres/RLS/RPCs, and Playwright. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Documentation map

| Topic | Document |
| --- | --- |
| System shape and trust boundaries | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Local development and workflow | [DEVELOPMENT.md](./docs/DEVELOPMENT.md) |
| Production, QA, and local environments | [ENVIRONMENTS.md](./docs/ENVIRONMENTS.md) |
| Security and authorization | [SECURITY.md](./docs/SECURITY.md) |
| Schema, migrations, RLS, and RPCs | [DATABASE.md](./docs/DATABASE.md) |
| Project lifecycle and workspace | [PROJECTS.md](./docs/PROJECTS.md) |
| Member journey and participation | [MEMBER_EXPERIENCE.md](./docs/MEMBER_EXPERIENCE.md) |
| Administrator workspace | [ADMIN.md](./docs/ADMIN.md) |
| Tests and QA evidence | [TESTING.md](./docs/TESTING.md) |
| Deployment notes | [DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| Route inventory | [ROUTES.md](./docs/ROUTES.md) |
| Historical decisions and phases | [CHANGELOG.md](./docs/CHANGELOG.md) |

Status words in these documents are deliberate: **IMPLEMENTED** means present in source; **VERIFIED** means supported by an executed check; **NOT VERIFIED** means source or configuration exists but execution/parity evidence is absent; **PLANNED** means an approved future scope; **BLOCKED** means work cannot safely proceed.
