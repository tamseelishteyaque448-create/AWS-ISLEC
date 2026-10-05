import Link from "next/link";
import type { BuildProveReviewQueueItem } from "@/lib/services/build-prove";

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toISOString().slice(0, 10);
}

/**
 * Cross-task queue of submissions awaiting a decision. Each row links into the
 * task detail page, which is where the full revision, evidence, and prior
 * review history are rendered.
 */
export function BuildProveReviewQueue({ items }: { items: BuildProveReviewQueueItem[] }) {
  if (items.length === 0) {
    return (
      <section className="admin-build-operations-card">
        <h2>Nothing is waiting for review.</h2>
        <p className="admin-build-inline-note">
          Submitted and resubmitted work appears here once a member sends it for review.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-build-operations-card">
      <div className="admin-build-section-heading">
        <h2>Awaiting review</h2>
        <span className="admin-build-count">{items.length}</span>
      </div>
      <ul className="admin-build-review-list">
        {items.map((item) => (
          <li key={item.workItemId} className="admin-build-review-row">
            <div className="admin-build-review-main">
              <strong>{item.task.title}</strong>
              <span className="admin-build-review-meta">
                {item.fullName}
                {item.handle ? ` (${item.handle})` : ""}
                {" · "}
                revision {item.latestRevisionNumber}
                {" · "}
                {item.status === "resubmitted" ? "Resubmitted" : "Submitted"}
                {" · "}
                {formattedDate(item.submittedAt)}
              </span>
              <span className="admin-build-review-meta">
                {item.task.priority} priority
                {" · "}
                {item.task.deadlineAt
                  ? `Due ${formattedDate(item.task.deadlineAt)}`
                  : "No deadline"}
                {" · "}
                {item.evidenceCount} evidence file{item.evidenceCount === 1 ? "" : "s"}
              </span>
              {item.submissionSummary
                ? <p className="admin-build-review-summary">{item.submissionSummary}</p>
                : <p className="admin-build-review-summary muted">No submission summary provided.</p>}
            </div>
            <Link
              className="button button-secondary"
              href={`/admin/build-prove/tasks/${item.task.id}#review-${item.workItemId}`}
            >
              Review
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}