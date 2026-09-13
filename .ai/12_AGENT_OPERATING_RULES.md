# Agent operating rules

Before coding, read in order:

1. `.ai/00_PROJECT_OVERVIEW.md`
2. `.ai/02_SYSTEM_ARCHITECTURE.md`
3. `.ai/03_SECURITY_MODEL.md`
4. `.ai/11_CHANGE_CONTROL.md`
5. `.ai/CURRENT_PHASE.md`
6. The relevant domain document.

Then inspect the existing implementation; identify dependencies, invariants, security boundaries, and contradictions; propose changes; implement only approved scope. Do not guess or create a second implementation because the first is inconvenient.

After coding, inspect `git diff`; run relevant validation; inspect migration and security changes; report every changed file, every database object changed, and anything unexpected. If uncertain, stop. Never place secrets, credentials, private member data, or database dumps in `.ai`.
