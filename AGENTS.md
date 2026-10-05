# Agent guidance

This repository is maintained by Codex, Copilot, Kiro, and human developers. Read [README.md](./README.md), [.ai/CURRENT_PHASE.md](./.ai/CURRENT_PHASE.md), and the relevant [docs/](./docs/) file before coding.

## Safe working rules

- Work on one phase and one requested scope at a time. Avoid scope creep and duplicate domain systems.
- Treat checked-in migrations and current application code as the source of truth. Do not infer live database parity from source.
- Preserve existing behavior, route contracts, state transitions, RLS, grants, RPC authorization, and `SECURITY DEFINER` functions with pinned `search_path`.
- Never use client state, hidden UI, email comparisons, profile display roles, or historical membership as authorization.
- `SUPABASE_SECRET_KEY` is server-only. Never log, commit, paste, or document secrets or private data.
- Use QA for runtime checks. Never test QA against production, modify production data for testing, or use destructive resets casually.
- Read the relevant migration before changing a database-backed feature. Database changes require explicit scope; do not edit old migrations.
- Prefer existing services, validation, server actions, and RPCs. Do not add direct table writes where an authoritative RPC exists.
- Run focused validation before completion and report **PASS**, **FAIL**, and **NOT VERIFIED** honestly.
- Inspect `git diff`, `git diff --check`, and `git status` before reporting completion.
- Never commit, push, deploy, or change secrets unless the user explicitly instructs it.
- Never add any AI or Codebuff attribution footer to a commit message. See [Commit attribution](#commit-attribution).

## Commit attribution

**Never write a Codebuff footer, or any AI-generated attribution trailer, into a commit message. This is absolute and applies to every commit in this repository.**

Prohibited in commit subjects and bodies, including trailers:

- `Co-authored-by:` referencing Codebuff, an AI agent, a bot, or an assistant account.
- `Generated with Codebuff`, `Generated with Copilot`, or any similar "generated with" line.
- Any robot emoji (for example 🤖) used as a signature or attribution.
- Any other line that credits an AI tool or agent as an author or co-author.

Commit messages must be plain, human-readable project history. Write them in your own words, explaining *why* a change was made. If a tool, an agent, or a contributor convention would otherwise inject a footer, omit it rather than pass it through.

Verify before committing:

```bash
git log -1 --format='%B' | grep -iE "co-authored-by|generated with|codebuff|copilot|claude|🤖"
```

A match is a violation. Remove the line and amend or re-commit before it reaches the repository.

## Required completion report

List changed files, behavior/database objects affected, validation commands and results, runtime checks not run, and remaining risks. Documentation must not claim a test or deployment that was not actually executed.

See [docs/SECURITY.md](./docs/SECURITY.md), [docs/DATABASE.md](./docs/DATABASE.md), [docs/TESTING.md](./docs/TESTING.md), and [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for detail.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
