# Projects

## Lifecycle

Projects move through `draft -> pending_review -> published -> archived`; `changes_requested` supports resubmission. `build_stage` (`idea`, `building`, `prototype`, `shipped`) is separate from publication. Legacy status/publication fields are compatibility data, not the publication authority.

An active owner is required. Recruitment may be `open`, `invite_only`, or `not_recruiting`, with optional positive capacity. Members submit join requests; owners approve or decline; approved requests create/reactivate contributor membership. Applicants may attach URL-only skill proofs while the request is `requested`; applicant/owner/admin privacy is database-enforced.

Owners create and edit eligible projects, submit for review, manage requests, transfer ownership, and enter the workspace. Admins review publication, request changes, archive/re-publish where permitted, and recover exceptional ownership cases. Public/member discovery is intended to expose published projects only.

## Workspace

The implemented V2.2 foundation provides Overview, Team, Work, and Settings surfaces with milestones and tasks. Active authorized project members can access workspace data; owner-level mutations are explicit. State gates make `pending_review` and `archived` read-only while `draft`, `published`, and `changes_requested` remain writable. Archived tasks do not count toward progress.

Workspace scope intentionally excludes notifications, realtime, GitHub/Jira integration, comments, subtasks, dependencies, due dates, and task priority. V2.3 is focused on member discovery, detail, join requests, proofs, My Projects, and workspace entry.

Implementation is source-verified; authenticated E2E, live RLS/RPC behavior, and deployed parity are **NOT VERIFIED**.
