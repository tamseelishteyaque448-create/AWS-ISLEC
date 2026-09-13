# Projects V2.2 workspace — frozen contract

Goal: answer **what are we building, who is building it, and what needs to happen next?** Workspace sections are Overview, Team, Work, and Settings. This is a contract only; V2.2 is not implemented.

Milestones require project ownership, title, ordering, archived state and timestamps/updated_at; their active-task-derived state is `EMPTY` for zero active tasks, `IN PROGRESS` if any active task is incomplete, and `COMPLETE` if all active tasks are complete. Current milestone is the first non-archived, non-complete milestone ordered `sort_order ASC, id ASC`; if all are complete, it is `NULL`.

Tasks belong to a milestone/project, have title, status, optional assignee, ordering, archive state and `completed_at`. Completion state must be represented by allowed statuses and `completed_at` consistently; archived tasks do not affect derived progress. Progress is `completed active tasks / total active tasks`; zero tasks is `0`.

State gates: `draft` writable; `pending_review` read-only; `published` writable; `changes_requested` writable; `archived` read-only. Build stage alone does not block workspace work. Permissions: only authorized current active project members may see workspace data; owner-level mutations must be explicit; former/removed/declined/withdrawn people receive no assumed access. All six core RPCs must enforce authorization, state gates, membership/assignment validity, input constraints, transactions/row locking as necessary, and concurrent changes safely: `create_project_milestone`, `archive_project_milestone`, `create_project_task`, `update_task_status`, `assign_task`, `archive_task`.

Exclusions: points, activities, build-stage changes, notifications, realtime, GitHub integration, task priority, due dates, comments, subtasks, and dependencies. This contract must not be silently broadened.
