# CURRENT PHASE

## PROJECTS V2.3 — MEMBER DISCOVERY & PARTICIPATION EXPERIENCE

**Status:** ACTIVE IMPLEMENTATION
**Scope:** Member-facing project discovery, participation, and authenticated journey

Projects V2.2 Phase E — Runtime + Authenticated E2E Verification is complete to the extent supported by the evidence collected:

- `npx tsc --noEmit` passed.
- `npm run lint` passed with one existing `@next/next/no-img-element` warning in `components/layout/Sidebar.tsx`.
- `npm run build` passed.
- `git diff --check` passed.
- `npx playwright test tests/e2e/security-verify.spec.ts` passed: 1 test.
- Authenticated project flows, live database parity, RLS/grant parity, protected RPC execution, and responsive visual behavior remain **NOT VERIFIED**.

V2.3 objective:

Discover → Project Details → Request to Join → Optional Skill Proof → Pending → Owner Review → Accepted → My Projects → Workspace

### Scope

1. Member project discovery.
2. Project detail experience.
3. Relationship-aware CTA and state handling.
4. Join-request UX.
5. Applicant skill-proof UX.
6. My Projects dashboard.
7. Workspace entry behavior.
8. Archived, shipped, and recruitment-state presentation.
9. Empty, loading, and error states.
10. Responsive visual refinement.
11. Page-specific service contracts.
12. Authenticated E2E verification.
13. Documentation alignment.

### Non-goals

- No social feed, comments, likes, followers, or chat.
- No AI project matching, realtime features, or notifications.
- No GitHub integration or Jira-style project management.
- No new project domain or duplicate join-request system.
- No unnecessary database redesign.

### Dependencies and invariants

- Preserve the existing Projects V1 lifecycle and authorization behavior.
- Preserve the V2.1 URL-only skill-proof model and applicant/owner privacy rules.
- Preserve the V2.2 workspace data model, role behavior, state gates, progress rules, and RPC contract.
- RLS and authoritative RPC/server-side authorization remain the security boundary.
- Do not use client state, email comparison, hidden UI, or historical membership as authorization.
- Do not expose unpublished/private projects through discovery.
- Do not introduce direct authenticated writes to protected tables where RPCs are authoritative.
- Keep `SECURITY DEFINER` functions intentionally scoped with pinned `search_path = ''`.

### Required validation gates

Before V2.3 is complete, run and record:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`
- Targeted authenticated Playwright coverage for discovery, detail, join requests, proofs, My Projects, and workspace entry.
- Relevant existing anonymous/security Playwright coverage.
- Database migration parity, RLS and grant checks, and protected RPC authorization checks against a configured test database.
- Loading, error, empty, archived, shipped, recruitment, capacity, and responsive UI verification.

Runtime/database behavior must not be marked verified without execution evidence.
