# Change control

Core principle: **one phase at a time.** Workflow: Research → Freeze contract → Implement → Validate → Audit → Approve → Next phase.

Do not silently expand scope, rebuild stable features without a reason, modify old migrations, introduce parallel domain systems, duplicate authorization logic, casually change security boundaries, introduce unnecessary infrastructure, or claim runtime verification without evidence. Prefer additive migrations. Treat the existing protected RPC/RLS/grant model as a dependency, not an inconvenience.

If repository implementation contradicts the frozen contract, stop and report it. Do not repair it implicitly. Inspect the current migration chain and code call sites before proposing changes. For any database change, identify table grants, RLS, RPC grants, SECURITY DEFINER/search path, ownership, lock/concurrency behavior, and type/client impact.
