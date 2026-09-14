# Context timeline

| Phase | What / why / outcome | Verification status |
| --- | --- | --- |
| Foundation | Initial Next/Supabase schema, profiles, domains, triggers and RLS established. | Migration source present; live parity NOT VERIFIED. |
| Auth/Admin Security | Private admin allowlist, `is_admin`, audit log and admin policies separated authorization from profile role. | Source inspected; runtime NOT VERIFIED. |
| Events | Event operations, hardening, posters/delivery and attendance work added. | Source inspected; runtime/storage NOT VERIFIED. |
| Learning/Challenges | Completion foundation, badge requirements, streak preservation, seeded missions and answer operations added. | Source inspected; runtime NOT VERIFIED. |
| Projects V1 | Lifecycle, reviews, requests, owner invariant and protected operations added. | Historical reported project QA: 57/57 passed; not re-executed/reproducible here. |
| Projects Security | Privacy policy fix, admin alignment and unused grant revocation hardened project access. | Source inspected; live policy parity NOT VERIFIED. |
| Projects V2.1 | Join-request URL skill proofs with owner/applicant/admin reads added. | Source inspected; runtime NOT VERIFIED. |
| Full-System Audit | Historical reference only; no distinct auditable artifact found beyond migrations/tests. | NOT VERIFIED. |
| Admin Analytics | Analytics and activity overview migrations/services/components added. | Source inspected; runtime NOT VERIFIED. |
| Activity Intelligence | Activity-oriented admin visibility added. | Source inspected; runtime NOT VERIFIED. |
| Activity Generation Integrity | Idempotent transactional generation across core domain events added. | Source inspected; runtime NOT VERIFIED. |
| Progression / Points / Stages | Point economy, monotonic stage engine and integration into authoritative mutations added. | Source inspected; runtime NOT VERIFIED. |
| Historical Evidence Hardening | Historical approved-project predicate corrected for submitted/completed memberships. | Source inspected; runtime NOT VERIFIED. |
| Projects V2.2 Research/Frozen Contract | Future workspace Phase A contract frozen; no implementation migration exists. | Contract documented; implementation NOT VERIFIED/not started. |
| Projects V2.2 Phase A — Database Foundation | Milestones/tasks schema, RLS, table grants, and the six protected workspace RPCs added. | Approved; authenticated runtime/database verification gap remains. |
| Projects V2.2 Phase B — Service / Read Model | Workspace read model and service integration added. | Approved; authenticated runtime verification gap remains. |
| Projects V2.2 Phase C — Server Actions | Server-action mutation bridge for the workspace RPCs added. | Approved; authenticated runtime verification gap remains. |
| Projects V2.2 Phase D — Member Workspace UI | Member workspace Overview, Team, and Work integration completed. | Static validation passed; authenticated runtime verification gap remains. |
| Projects V2.2 Phase E — Runtime + Authenticated E2E Verification | Verification phase completed to the extent supported by executed evidence; no implementation changes made during verification. | TypeScript, lint, build, diff check, and targeted redirect-security Playwright passed; authenticated project flows, live database parity, RLS/grant parity, protected RPC execution, and responsive visual behavior remain NOT VERIFIED. |
| Projects V2.3 — Member Discovery & Participation Experience | Active implementation phase approved to complete the member journey from published project discovery through relationship-aware detail, join request, optional proof, acceptance, My Projects, and workspace entry. V1, V2.1, and V2.2 contracts remain frozen dependencies. | ACTIVE IMPLEMENTATION; required validation gates are defined in `CURRENT_PHASE.md`. |
