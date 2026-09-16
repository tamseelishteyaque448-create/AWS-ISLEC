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

## Required completion report

List changed files, behavior/database objects affected, validation commands and results, runtime checks not run, and remaining risks. Documentation must not claim a test or deployment that was not actually executed.

See [docs/SECURITY.md](./docs/SECURITY.md), [docs/DATABASE.md](./docs/DATABASE.md), [docs/TESTING.md](./docs/TESTING.md), and [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for detail.
