# BUILD & PROVE
## AWS-ISLEC Student Builder Community

## 1. Document Purpose

This document is the single source of truth for the future Build & Prove product. It defines the product contract, domain boundary, security model, conceptual data model, lifecycle, UI direction, rollout plan, and validation expectations.

Future implementation work must read this document first, inspect the current repository, and implement one approved phase at a time. This document does not replace migrations, current application code, or verified database behavior; those remain the implementation authority once the feature exists.

**Document status:** Architecture approved
**Version:** 1.0
**Last updated:** 2026-10-07
**Owner / authority:** AWS-ISLEC product and engineering maintainers
**Implementation status:** DATABASE CORE, SERVER-SIDE SERVICES, PHASE 4A MEMBER UI, PHASE 4B.3 MEMBER WORKBENCH, AND ADMIN AUTHORING/REVIEW UI IMPLEMENTED; HOSTED PARITY REMAINS

In scope: practical assignments, member submissions, proof, admin review, feedback, resubmission, approval, controlled recognition, security, and phased delivery.

Out of scope: redesigning the legacy learning/challenge system, replacing member-created projects, automatic AI grading, production changes, and implementation in this document.

## 2. Product Vision

Build & Prove is a practical work loop, not a course or quiz loop:

`DISCOVER -> UNDERSTAND -> BUILD -> SUBMIT -> REVIEW -> IMPROVE -> APPROVE -> RECOGNIZE`

Members discover a concrete assignment, understand what good work requires, build independently, submit evidence, receive human feedback, improve when needed, and earn controlled recognition after approval.

Unlike traditional courses, the unit of progress is a finished artifact and credible proof. Unlike quizzes and coding exercises, correctness is evaluated through requirements, evidence, and review. Unlike member-created projects, assignments originate from the community/admin catalogue and submissions are individual proof against an assignment specification.

## 3. Product Goals

- Give students practical, bounded work they can build independently.
- Encourage real implementation rather than passive completion.
- Create credible evidence of skills and decisions.
- Provide a structured feedback and improvement loop.
- Let admins recognize quality work consistently.
- Connect approved work to community progress without corrupting existing reward domains.
- Maintain a trustworthy, reviewable record of achievement.

## 4. Non-Goals

Build & Prove is not:

- a quiz system;
- a course platform;
- a learning-path progression system;
- a coding judge;
- a replacement for member-created projects;
- an automatic AI grading system;
- a client-controlled points system;
- a mechanism for creating challenge completions or changing project membership.

## 5. Domain Boundaries

| Domain | Ownership and purpose | Entities | Rewards/admin boundary | Must not do |
|---|---|---|---|---|
| Legacy Learning / Challenges | Admin-authored curriculum and quiz-style AWS missions | `learning_paths`, `challenges`, `challenge_contents`, `challenge_answer_keys`, progress/completion tables | `complete_challenge()` owns challenge answers, points, badges, activities, and streak behavior | Must not become Build & Prove submissions |
| Existing Member Projects | Member-created collaborative builds and team workspaces | `projects`, `project_members`, join requests, `project_reviews`, milestones, tasks | Project publication/team RPCs own project lifecycle and participation rewards | Must not be treated as assignment submissions |
| Build & Prove | Admin-authored practical assignments and individually reviewed proof | `build_assignments`, `build_submissions`, `build_submission_reviews`, `build_submission_evidence` | Future Build & Prove approval authority owns its rewards and recognition | Must not create challenge completions, alter project membership, or reuse project publication reviews |

## 6. User Journey

1. Member enters `/member/learn`.
2. Member sees published Build Assignments.
3. Member opens an assignment.
4. Member reads objective, requirements, deliverables, and evaluation criteria.
5. Member builds independently.
6. Member prepares explanation and proof.
7. Member creates a submission draft.
8. Member adds repository, deployment, demo, and evidence where applicable.
9. Member submits.
10. Submission becomes reviewable.
11. Admin reviews the work and evidence.
12. Admin approves, requests changes, or rejects.
13. Member sees the decision and review feedback.
14. For changes requested, member improves the work.
15. Member resubmits.
16. Admin reviews again.
17. Approval produces controlled recognition/reward.
18. Activity and future progression integrations reflect approved work.

Members may create and edit only their own eligible drafts or change-requested submissions. They cannot set status, approval, reviewer identity, or reward values. Approved submissions become immutable except for explicitly defined administrative corrections.

## 7. Assignment Concept

A Build Assignment is the specification for practical work. It is not a member project and not a quiz.

Conceptual fields:

- title and slug;
- summary and objective;
- problem/task statement;
- difficulty;
- required conditions;
- required features;
- optional improvements;
- suggested/allowed technologies;
- restrictions;
- deliverables;
- submission requirements;
- evaluation criteria;
- publication state and ordering;
- creator/admin ownership;
- created and updated timestamps.

An assignment defines what should be built. A submission defines what one member actually built and how they proved it.

## 8. Difficulty Model

The initial catalogue target is 15 practical assignments:

- 5 easy;
- 5 medium;
- 5 hard.

This is a product catalogue target, not a database constraint. Difficulty should describe expected scope, ambiguity, integration depth, and proof burden. Numerical scoring is intentionally open.

## 9. Assignment Example

### Build a Personal Portfolio

**Objective:** Build a deployed portfolio that communicates a student's skills, projects, and learning clearly.

**Problem:** Employers and collaborators need a concise way to understand what the builder can make and how they think.

**Required features:**

- responsive home/about/project sections;
- at least one real project with context and links;
- accessible navigation and readable content;
- deployed public URL;
- source repository with a useful README.

**Optional improvements:**

- contact workflow;
- project filtering;
- analytics or performance evidence;
- tests and automated deployment;
- accessibility audit evidence.

**Suggested technologies:** Next.js/React, TypeScript, HTML/CSS, a static host or Vercel. Equivalent technologies are allowed unless an assignment says otherwise.

**Deliverables:** repository URL, deployed URL, explanation, approach, technologies, challenges, and learnings.

**Submission evidence:** screenshots or other proof showing the required experience, plus links that reviewers can inspect.

**Evaluation criteria:** requirements met, deployment works, repository is inspectable, implementation choices are explained, evidence is credible, and the result demonstrates independent practical work.

## 10. Submission Concept

A Build Submission represents one member's implementation and proof for one assignment.

Required conceptually:

- assignment relationship;
- authenticated member ownership;
- explanation of the result;
- approach and decisions;
- technologies used;
- challenges faced;
- learnings;
- submission status;
- submission timestamps.

Conditionally required or optional depending on assignment:

- GitHub repository URL;
- deployed/live URL;
- demo URL;
- screenshots/evidence;
- additional relevant information.

Approval metadata, reviewer identity, approval time, and reward state are server/database-owned and must not be member-controlled.

## 11. Submission Lifecycle

The per-member work item owns the current lifecycle status:

`ASSIGNED -> IN_PROGRESS -> SUBMITTED -> CHANGES_REQUESTED -> RESUBMITTED -> APPROVED`

`CANCELLED` is an optional admin-only terminal state. Each submission or resubmission creates a new immutable revision. Review decisions are append-only and limited to `CHANGES_REQUESTED` and `APPROVED`; `REJECTED` is not a workflow state.

The database allows an assigned member to start and submit their own work item; only an admin may assign, review, approve, or cancel. The database rejects direct status changes, review mutation, duplicate revisions for a work item/revision number, approval before submission, member approval, and transitions out of terminal states. Review conflicts use PostgREST's `PT409` status code rather than PostgreSQL's retryable serialization code, so stale revisions are returned promptly as conflicts.

## 12. Review System

A Build Submission Review is an append-only record of a meaningful administrative decision. Reviews must not overwrite prior history.

Conceptual fields:

- submission ID;
- authorized reviewer/admin profile ID;
- decision;
- feedback;
- decision metadata where needed;
- timestamp.

Members can read reviews for their own submissions. Admins can read all reviews. Members cannot create, update, or delete reviews.

## 13. Admin Review Experience

The admin queue should show assignment, member, status, submitted date, difficulty, and current review state.

The detail view should show member information, assignment requirements, explanation, approach, technologies, repository, deployment, demo, evidence, prior reviews, and current status.

Actions:

- **Approve:** approve submitted work. Reward processing is not wired yet.
- **Request changes:** requires clear feedback and preserves the reviewed revision.

## 14. Member Submission Experience

Members need to start assigned work, submit it, see status, read feedback, resubmit a new revision after changes are requested, and see final approval.

After approval, the submission and its approval history should be immutable to the member. Any administrative correction must preserve the original review history and be auditable.

## 15. Evidence System

Evidence may include screenshots, images, documents, and demo proof. URL-based proof includes repository, deployed site, and optional demo URLs.

Evidence must be private by default, owned by the submission, validated by type/size/URL rules, and exposed through authorized access or short-lived signed URLs where appropriate.

The local schema has a private `build-prove-private` bucket restricted to images and PDFs up to 10 MiB. Admins can manage reference objects under assignment paths; authenticated assignees and admins can read authorized Build & Prove objects through Storage RLS. Member upload, protected download, and open-draft evidence removal use authenticated application endpoints with server-side signature validation. Downloads do not use public or signed URLs. These application flows are verified only against local disposable Supabase; hosted parity is **NOT VERIFIED**. Do not reuse event-poster storage for Build & Prove.

## 16. Database Domain Model

### `build_assignments`

Purpose: admin-authored practical work specifications. Owned by an admin creator. Related to many submissions. Published records are member-visible; drafts are admin-only. Integrity requires valid publication state and stable identity/slug.

### `build_assignment_members`

Purpose: one member's work item for an assignment, including status, reward snapshot, assignment actor, and timestamps. The `(assignment_id, member_id)` relationship is unique and work-item status changes are RPC-controlled.

### `build_submissions`

Purpose: immutable member submission revision for one work item. A work item may have multiple numbered revisions, each authored by its assigned member. It does not own workflow status; that remains on the work item.

### `build_submission_reviews`

Purpose: append-only admin decisions and feedback. Belongs to exactly one submission and one reviewer. Admin-created; owner-readable. Integrity requires authorized reviewer and immutable historical records.

### `build_submission_evidence`

Purpose: proof attachments or evidence metadata belonging to exactly one submission. Member-owned through the submission; admin-readable. Integrity requires authorized object ownership and validated evidence references.

### `build_submission_rewards`

Purpose: immutable reward ledger uniquely keyed by work item. Approval awards the assignment-time points snapshot in the same transaction as the approval; uniqueness and work-item locking prevent duplicate awards.

## 17. Relationships

```text
ADMIN
  |
  v
BUILD ASSIGNMENT
  |
  +----< ASSIGNED WORK ITEM >---- MEMBER
                  |
                  +----< SUBMISSION REVISION
                  |
                  +----< REVIEW (each review refers to a revision)
                  |
                  +----< EVIDENCE
                  |
                  +----< REWARD LEDGER ENTRY (approval processing)
```

An assignment defines the work. A submission is one member's proof against that assignment. Reviews belong to the submission and preserve decisions. Evidence belongs to the submission and must not become a general public file store.

## 18. Member Access Model

Members can:

- view published assignments;
- view their own submissions;
- start their own assigned work item;
- submit work for their own assigned item;
- resubmit eligible submissions;
- view their own review history;
- manage eligible evidence attached to their own editable submission.

Members cannot see another member's private submission, modify reviews, approve/reject/request changes, modify reward values, or directly alter protected status.

## 19. Admin Access Model

Admins can manage assignments, publish/unpublish assignments, view submissions/evidence, assign members, review submissions, request changes, approve, inspect review history, cancel eligible work items, and explicitly award an approved but unrewarded work item.

Authorization must reuse `requireAdmin()`, `private.is_admin()`, `private.admin_users`, and `admin_audit_log`. No second admin role system is permitted.

## 20. RLS / Security Contract

Separate four authorities:

- **Read authorization:** RLS controls member-owned versus admin-wide reads.
- **Write authorization:** server actions and protected RPCs validate actor identity and ownership.
- **State transitions:** database/server authority controls lifecycle transitions and concurrency.
- **Reward authority:** approval processing controls points and recognition.

The client must never be trusted for admin authorization, approval/rejection, points, reward values, approval timestamps, reviewer identity, or protected status transitions.

## 21. Reward / Recognition Model

Approval atomically records the assignment-time reward snapshot in `build_submission_rewards`, updates the member's points, creates one `build_prove` activity, and invokes the existing monotonic stage engine. The reward RPC is admin-authorized, idempotent, and rejects work that is not approved or whose latest revision lacks an approval. Historical approvals are not automatically backfilled; an authorized admin may explicitly award an approved, previously unrewarded work item.

Build & Prove approval must not call `complete_challenge()`, create `challenge_completions`, reuse challenge streak logic, or masquerade as a challenge. It must not alter project membership.

Reward processing is server/database authoritative, retry-safe, and protected against duplicate rewards by transaction locks and the unique per-work-item ledger. It does not use challenge completion or streak behavior.

## 22. Activity Integration

Approved Build & Prove work creates one `activity_type = build_prove` activity with a stable per-work-item key and the points recorded in the reward ledger. It is not represented as a challenge completion.

## 23. Achievement / Stage Integration

Rewarded approvals invoke the existing monotonic stage engine after updating points. Build & Prove does not alter badges or streaks, and no new stage rules are introduced.

## 24. Route Architecture

Recommended member routes:

- `/member/learn` - four-domain Build & Prove overview
- `/member/learn/[domain]` - member-assigned work with status and priority filters
- `/member/learn/tasks/[workItemId]` - task brief, revision/review history, and state-aware member actions
- `/member/submissions` - member submissions
- `/member/submissions/[id]` - submission detail/status/history

Recommended admin routes:

- `/admin/build-prove` - assignment overview and catalogue
- `/admin/build-prove/tasks/new` - create an assignment
- `/admin/build-prove/tasks/[taskId]` - assignment detail and review history
- `/admin/build-prove/tasks/[taskId]/edit` - edit an assignment
- `/admin/build-prove/review` - active latest-revision review queue

The three member routes above are implemented. Phase 4B.3 integrates authenticated draft editing, private evidence upload/download/removal, submission, resubmission, revision history, feedback, and protected assignment-reference downloads into the existing task detail route. The dedicated Build & Prove admin authoring and review surfaces are implemented; the Phase 6 end-to-end gate remains blocked because the local disposable stale-revision RPC request timed out before the approval and cancellation portions could be verified. `/admin/learning` remains the legacy learning-path surface and must not be repurposed.

## 25. `/member/learn` Product Contract

The `/member/learn` entry page communicates **BUILD & PROVE** and links to the four domains. Domain pages show assigned work and status/priority filters. Work-item detail includes the objective, requirements, deadline, reward snapshot, reference metadata, revision history, feedback, and only the member action permitted by the current state.

It must not become a grid of challenge/quiz cards or learning-path cards. The legacy challenge system remains available at `/member/challenges`. The member task detail now supports state-driven draft editing, evidence upload/download/removal, protected reference downloads, submission, resubmission, and immutable revision/review history. Cancelled work remains unavailable to member task reads and does not expose draft/evidence details. No Build & Prove admin UI is included in this phase.

## 26. Admin Learning Architecture

Current `/admin/learning` uses `requireAdmin()`, `getAdminLearningPaths()`, and `LearningPathManagement` to create/update legacy learning paths. `/admin/challenges` separately manages legacy challenges and learning outcomes.

Build & Prove administration uses the separate `/admin/build-prove` surface, its server-side services, and authoritative RPCs. It does not reinterpret legacy learning-path records as assignments.

## 27. Storage Architecture

Build & Prove uses the existing private `build-prove-private` bucket and its assignment-reference and submission-evidence policies. Authenticated member evidence upload validates file size, MIME type, and byte signature before Storage upload and evidence registration. Member downloads and removals use authenticated server endpoints; UI/read models do not expose object paths or public/signed URLs. Assignment references also download through an authenticated endpoint that verifies current non-cancelled assignment membership. Local disposable Storage and member-workbench behavior is covered by focused E2E; hosted parity remains **NOT VERIFIED**.

## 28. Validation Rules

Conceptual rules:

- assignment must be published before member submission;
- submission must belong to the authenticated member;
- only draft/change-requested submissions are member-editable;
- approved submissions cannot be silently rewritten;
- changes-requested decisions require feedback;
- changes-requested decisions require meaningful admin feedback; `REJECTED` is not a workflow state;
- approval cannot be duplicated;
- rewards cannot be client-controlled;
- evidence must belong to the correct submission;
- repository/deployment/demo URLs require safe validation;
- unpublished assignments remain inaccessible to members.

## 29. Idempotency / Transaction Safety

Prevent duplicate approval rewards, activities, reviews, and submissions through unique keys, transactions, row locks, authoritative RPCs, and conflict-safe inserts. Approval and reward processing must be atomic or have a durable retry state. Concurrent admin actions must detect stale status rather than overwrite one another.

## 30. Auditability

Audit at minimum:

- assignment create/update/publication changes;
- submission review decisions;
- approval, rejection, and changes requested;
- reward/recognition decisions;
- administrative corrections.

Reuse `admin_audit_log`, whose current architecture records actor, action, target, metadata, and timestamp.

## 31. Error Handling

Use safe user-facing messages for unavailable assignments/submissions, unauthorized access, invalid or expired states, review failures, reward failures, storage failures, invalid URLs/evidence, and concurrent changes. Never expose raw database or Supabase errors.

## 32. UI States

Required states:

- Assignment catalogue: loading, populated, empty, unavailable.
- Assignment detail: loading, populated, unavailable, unpublished/not accessible.
- Submission: draft, submitted, changes requested, approved, rejected.
- Admin queue: loading, populated, empty, unavailable.
- Admin review: reviewable, processing, success, error.

## 33. Responsive / Accessibility Requirements

Support desktop, tablet, and mobile layouts without horizontal overflow. Use semantic links/buttons, visible focus states, readable forms, sufficient contrast, and accessible status announcements. Status and review feedback must not rely on color alone.

## 34. Data Integrity Rules

- Every submission belongs to exactly one assignment and one member.
- Every review belongs to exactly one submission and authorized reviewer.
- Every evidence record belongs to exactly one submission.
- Approved/rejected state changes require authorized admins.
- Reward approval is tied to the approved submission.
- Historical reviews remain intact.
- Assignment publication and submission eligibility are server/database controlled.

## 35. Implementation Phases

Each phase must be completed and validated before the next begins.

| Phase | Objective | Main scope | Definition of done |
|---|---|---|---|
| 0 - Documentation / Contract | Freeze product/security contract | This document, open decisions | Contract reviewed and accepted |
| 1 - Database Schema | Add additive Build & Prove entities | Assignment, submission, review foundations | Migration applies; constraints reviewed |
| 2 - RLS & Security | Enforce ownership/admin boundaries | RLS, grants, protected transitions | Unauthorized tests pass |
| 3 - Assignment Admin Management | Manage assignment catalogue | Admin CRUD/publication | Admin CRUD and audit checks pass |
| 4 - Member Assignment Catalogue | Expose published work | `/member/learn` replacement surface | Catalogue states and visibility pass |
| 5 - Assignment Detail | Explain requirements | Detail route and all assignment content | Detail access/state tests pass |
| 6 - Submission Creation / Draft | Create/edit drafts | Member form and validation | Draft ownership/status tests pass |
| 7 - Submission Evidence | Attach URLs/files safely | Evidence metadata/storage | Storage policy and validation pass |
| 8 - Admin Submission Queue | Surface reviewable work | Queue/filter/detail entry | Admin visibility tests pass |
| 9 - Admin Review Workflow | Decide outcomes | Approve/change/reject | Review transitions/audit pass |
| 10 - Resubmission / Feedback | Support improvement | Change-request edit/resubmit | History and transition tests pass |
| 11 - Approval / Recognition / Reward | Controlled recognition | Idempotent reward authority | Retry/double-award tests pass |
| 12 - Activity Integration | Record approved work | Distinct activity identity | Activity regression tests pass |
| 13 - Future Achievement / Stage Integration | Extend progression deliberately | Explicit future rules only | Separate approved contract exists |
| 14 - Full QA / E2E | Verify end-to-end behavior | Member/admin/security/regression | Required suites pass |
| 15 - Replace `/member/learn` | Production transition | Retire/retain legacy entry decision | Rollout and rollback verified |

Every phase must document database, backend, frontend, security, validation, Definition of Done, and out-of-scope work before implementation.

## 36. Definition of Done

The system is complete only when members can discover assignments, understand requirements, submit real work and proof, receive feedback, resubmit, and see approval/rejection; admins can review with durable history; rewards are controlled and idempotent; activities are correct; RLS/admin authorization are verified; responsive UI and E2E tests pass; and legacy learning plus member projects remain safe.

## 37. Testing Strategy

Static: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`.

Database: migration validation, grants/RLS checks, unauthorized access, state-transition, concurrency, duplicate/retry, and reward-idempotency tests.

Member E2E: catalogue, detail, draft, submit, status, feedback, resubmit, approval, and rejection visibility.

Admin E2E: queue, detail, request changes, reject, approve, and reward retry behavior.

Security: cross-member submission denial, member/admin separation, client-manipulation resistance, and unpublished-assignment protection.

Regression: legacy challenges, projects, dashboard, profile, activities, leaderboard, achievements, and journey.

## 38. Migration / Rollout Strategy

Use additive-first migrations. Do not delete legacy challenge tables, rewrite project tables, migrate historical challenges into assignments, or migrate member-created projects into assignments. Introduce Build & Prove independently, test it independently, and replace `/member/learn` only after independent runtime coverage and an explicit rollout decision.

## 39. Known Risks

| Risk | Status |
|---|---|
| Naming collision with projects/challenges | MITIGATED by `build_*` namespace |
| Duplicate approval rewards | MITIGATED by the unique work-item ledger, row locks, and verified retry/concurrency tests; hosted parity NOT VERIFIED |
| Cross-member submission/evidence exposure | MITIGATED by RLS and ownership checks; hosted parity NOT VERIFIED |
| Client-controlled status/rewards | MITIGATED by protected RPC transitions; reward awarding remains server/database-owned |
| Reusing event-poster storage | MITIGATED by explicit separation |
| Accidental challenge/streak coupling | MITIGATED by the distinct `build_prove` activity and existing challenge isolation |
| Accidental project-membership coupling | MITIGATED by separate domain decision |
| Stage/reward inconsistency | MITIGATED locally by updating points before invoking the existing monotonic stage engine; hosted parity NOT VERIFIED |
| Live schema/deployment parity | NOT VERIFIED |
| Hosted Build & Prove Storage parity | NOT VERIFIED |

## 40. Open Questions

- Point values are snapshotted when a member is assigned; an authorized admin may explicitly award a previously approved, unrewarded work item, with no automatic historical backfill.
- Exact evidence file types and limits.
- Whether one member may have multiple active submissions for one assignment.
- Future badge criteria.
- Future stage criteria.
- Exact assignment catalogue content.
- Exact visual design.
- Whether approved work becomes publicly discoverable.
- Hosted QA/production parity for the reward migration and approval transaction.

## 41. Architecture Decisions

### ADR-001: Build & Prove is a separate domain

**Context:** Projects already represent member-created collaborative work and challenges represent quiz-style learning.

**Decision:** Use separate Build & Prove entities.

**Reason:** Prevent semantic, lifecycle, RLS, and reward collisions.

**Consequence:** Additional services, migrations, and policies are required.

### ADR-002: Use `build_*` entity naming

**Decision:** Use `build_assignments`, `build_submissions`, `build_submission_reviews`, and `build_submission_evidence`.

**Reason:** Avoid collisions with `projects`, `project_reviews`, and `challenges`.

### ADR-003: `/member/learn` becomes the Build & Prove entry point

**Decision:** Replace the current member learn experience only after independent Build & Prove validation.

**Consequence:** Legacy challenge routes/data remain during transition.

### ADR-004: Legacy challenges remain separate

**Decision:** Do not redesign or merge learning paths/challenges.

### ADR-005: Member projects remain separate

**Decision:** Do not use member projects as assignment or submission records.

### ADR-006: Reuse existing admin authorization

**Decision:** Use `requireAdmin()`, `private.is_admin()`, `admin_users`, and `admin_audit_log`.

### ADR-007: Rewards require authoritative idempotent processing

**Decision:** Approval rewards must be server/database controlled and retry-safe.

## 42. Glossary

- **Assignment:** Admin-authored practical work specification.
- **Submission:** One member's implementation and proof for one assignment.
- **Evidence:** Screenshot, document, image, or URL supporting a submission.
- **Review:** Admin decision and feedback record.
- **Approval:** Admin acceptance that may trigger controlled recognition.
- **Changes Requested:** Review outcome requiring member improvement and resubmission.
- **Cancelled:** Admin-only terminal state for an assignment work item; not a review decision.
- **Recognition:** Activity, points, badge, or future progression signal derived from approved work.
- **Build & Prove:** The practical assignment-to-proof product domain.
- **Legacy Challenge:** Existing quiz-style learning mission and completion system.
- **Member Project:** Existing member-created collaborative project/workspace.

## 43. Implementation Rules for Future Copilot Prompts

1. Read this document before implementation.
2. Inspect current code before modifying it.
3. Never assume schema or live parity.
4. Never mix Build & Prove with challenges.
5. Never mix Build & Prove with member-created projects.
6. Never bypass RLS or server authorization.
7. Never trust client-provided rewards.
8. Never modify unrelated domains during a phase.
9. Work on one phase at a time.
10. Run focused validation after every phase.
11. Stop when the phase Definition of Done is satisfied.
12. Report PASS, FAIL, BLOCKED, or NOT VERIFIED honestly.
13. Do not proceed until the current phase is validated.

## 44. Current Status

```text
BUILD & PROVE
Architecture: APPROVED
Database core: IMPLEMENTED; local disposable database validated
RLS/RPC foundation: IMPLEMENTED; focused rollback-only local test passes
Application mutation and read/query services: IMPLEMENTED
Member frontend Phase 4A: IMPLEMENTED
Member workbench Phase 4B.3: IMPLEMENTED; local authenticated draft/save/refresh, private evidence, reference download, submit/review/resubmit/approval, cancellation, and cross-member checks passed
Responsive member UI: local disposable viewport checks passed at 320, 360, 390, 412, 768, 1024, and 1440px
Admin Build & Prove authoring frontend: IMPLEMENTED; Phase 5B runtime-verified
Admin review queue/detail frontend: IMPLEMENTED; complete review lifecycle verified locally
Admin review RPCs: IMPLEMENTED and used through the server-side authorization boundary
Private evidence and reference Storage flow: IMPLEMENTED and verified against local disposable Supabase
Reward contract: IMPLEMENTED and verified locally; approval atomically creates one immutable work-item reward, one activity, and one points mutation from the assignment-time snapshot
Explicit award for previously approved, unrewarded work: locally verified; no historical approval backfill
Reward retry, duplicate protection, authorization, activity/points integration, and cancellation protection: locally verified by the focused disposable E2E
Admin award acknowledgement and router refresh: locally verified; acknowledgement remains visible and the final awarded state remains server-backed
Focused local E2E: `npm run test:e2e:disposable -- tests/e2e/disposable/build-prove-phase6-review.spec.ts` — previously reported 1 passed, 0 failed
Phase 7B focused hosted lifecycle integration: **PASS** on commit `0e06659241204e6aae23852c4850871426184a43`; [GitHub Actions run #2](https://github.com/tamseelishteyaque448-create/AWS-ISLEC/actions/runs/38035643278) — 1 Playwright test passed, isolated migrations and seed applied, Auth isolation preflight passed, and Supabase cleanup passed. This is not QA/production parity or full Phase 7B release validation.
Disposable fixture cleanup: BLOCKED; 9 assignments, 9 work items, 12 submissions, 9 reviews, 6 rewards, 6 activities, 12 drafts, and 6 evidence rows/storage objects remain from failed and passing focused runs; 222 reward points were applied
Hosted QA/production parity: NOT VERIFIED
```

**Next action:**

`RUN THE UPDATED PHASE 7B HOSTED GATE, THEN CLOSE THE REMAINING CHECKS`: the focused E2E has unexecuted assertions for empty states, anonymous/cross-member denial, and responsive recognition/points surfaces. The previous hosted pass predates these assertions. Loading and data-error fallback states also need deterministic runtime evidence. Static validation on the current worktree passed; rerun it after any further code changes. Phase 7B remains in progress. Do not run the disposable suite or start Docker/WSL on this workstation.

The local disposable database is not reported as clean. The repository has no approved reversible cleanup procedure for these protected Build & Prove history/reward records and their point/stage effects. Do not delete history, subtract points, or reverse stage as cleanup.

Phase 7B uses only the existing approved Build & Prove task detail, Activity/Journal history, and canonical Profile/Leaderboard points surfaces. Do not add another points balance, a new recognition page, or a badge system. Do not expose canonical member stage in Phase 7B: Build & Prove points alone do not determine stage, and the current member profile service/type does not expose the authoritative stage. A zero-point snapshot remains a valid recorded reward: communicate approval and that the configured reward was 0 points, with no points added; do not describe it as an unawarded item.

The service layer exposes member-scoped domain/work-item/detail/revision reads and admin-scoped overview/task/detail/review-queue reads. Member reads derive identity from authenticated claims and omit cancelled tasks; existing RLS remains authoritative. Read models expose attachment metadata only, never Storage object paths or public URLs. The member workbench and admin authoring/review surfaces use server-side services and authoritative RPCs. The Phase 6 lifecycle preserves changes-requested feedback, immutable resubmission, latest-revision queue behavior, stale-revision rejection, cancellation protection, and protected evidence download. Phase 7A integrates approval with the reward ledger, member points total, progression stage advancement, and a `build_prove` activity in one transaction. A retry returns the recorded reward; an approved task is never automatically backfilled by the migration. Local rollback-only SQL proves assignment-snapshot use, authorization, idempotency, cancelled-work rejection, and rollback on activity failure. Hosted QA/production parity remains unverified.
