import Link from "next/link";
import type { BuildProveMemberWorkItem } from "@/lib/services/build-prove";

const statusLabels: Record<BuildProveMemberWorkItem["status"], string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Awaiting review",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  cancelled: "Cancelled",
};

function formatDate(value: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function BuildProveWorkList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: BuildProveMemberWorkItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (!items.length) {
    return (
      <section className="build-empty panel">
        <h2>{emptyTitle}</h2>
        <p className="muted">{emptyDescription}</p>
      </section>
    );
  }

  return (
    <section className="build-work-list" aria-label="Assigned tasks">
      {items.map((item) => (
        <article className="build-work-card" key={item.workItemId}>
          <div className="build-work-card-header">
            <span className={`build-status ${item.status}`}>{statusLabels[item.status]}</span>
            <span className={`build-priority ${item.priority}`}>{item.priority} priority</span>
          </div>
          <h2>{item.title}</h2>
          <p>{item.summary || "Open this task to review its objective and expectations."}</p>
          <div className="build-work-meta">
            <span className={item.isOverdue ? "build-overdue" : undefined}>
              Due {formatDate(item.deadlineAt)}{item.isOverdue ? " · overdue" : ""}
            </span>
            <span>{item.rewardPointsSnapshot} reward points on approval</span>
          </div>
          <Link className="button button-secondary" href={`/member/learn/tasks/${item.workItemId}`}>
            Open task
          </Link>
        </article>
      ))}
    </section>
  );
}
