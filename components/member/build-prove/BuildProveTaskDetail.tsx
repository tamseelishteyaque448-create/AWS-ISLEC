"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { BuildProveTaskDetail as Detail, BuildProveTaskDefinition } from "@/lib/services/build-prove";
import {
  startBuildWorkAction,
  submitBuildWorkAction,
  type BuildProveActionState,
} from "@/app/member/learn/actions";

const statusLabels = {
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Awaiting review",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  cancelled: "Cancelled",
} as const;

function jsonItems(value: BuildProveTaskDefinition["requirements"]): string[] {
  const display = (item: BuildProveTaskDefinition["requirements"] | undefined): string => {
    if (item == null) return "None";
    if (typeof item === "object") return JSON.stringify(item);
    return String(item);
  };
  if (Array.isArray(value)) {
    return value.map(display);
  }
  if (typeof value === "string" && value.trim()) return [value];
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key.replaceAll("_", " ")}: ${display(item)}`);
  }
  return [];
}

function DetailList({ title, value }: { title: string; value: BuildProveTaskDefinition["requirements"] }) {
  const items = jsonItems(value);
  if (!items.length) return null;
  return (
    <section className="build-detail-section">
      <h3>{title}</h3>
      <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
    </section>
  );
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function safeWebUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function ActionMessage({ state }: { state: BuildProveActionState }) {
  if (state.error) return <p className="build-form-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="build-form-success" role="status">{state.success}</p>;
  return null;
}

function StartWorkForm({ workItemId }: { workItemId: string }) {
  const [state, action, pending] = useActionState(startBuildWorkAction, {});
  return (
    <form action={action} className="build-action-form">
      <input type="hidden" name="workItemId" value={workItemId} />
      <ActionMessage state={state} />
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start working"}
      </button>
    </form>
  );
}

function SubmissionForm({ workItemId, resubmission }: { workItemId: string; resubmission: boolean }) {
  const [state, action, pending] = useActionState(submitBuildWorkAction, {});
  return (
    <form action={action} className="build-submission-form">
      <input type="hidden" name="workItemId" value={workItemId} />
      <h3>{resubmission ? "Update your work" : "Submit your work"}</h3>
      <p className="muted">
        {resubmission
          ? "Address the latest reviewer feedback. This creates a new revision and preserves previous submissions."
          : "Summarize what you completed and include relevant project links."}
      </p>
      <label>
        Submission title
        <input name="projectTitle" type="text" maxLength={200} required />
      </label>
      <label>
        Description / note
        <textarea name="explanation" rows={4} maxLength={10000} required />
      </label>
      <label>
        Approach
        <textarea name="approach" rows={4} maxLength={10000} required />
      </label>
      <label>
        Repository link <span className="muted">(optional)</span>
        <input name="repositoryUrl" type="url" inputMode="url" placeholder="https://" />
      </label>
      <label>
        Deployment link <span className="muted">(optional)</span>
        <input name="deploymentUrl" type="url" inputMode="url" placeholder="https://" />
      </label>
      <label>
        Demo link <span className="muted">(optional)</span>
        <input name="demoUrl" type="url" inputMode="url" placeholder="https://" />
      </label>
      <p className="build-upload-notice">File uploads are not available in this phase; use links above for now.</p>
      <ActionMessage state={state} />
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Submitting…" : resubmission ? "Resubmit for review" : "Submit for review"}
      </button>
    </form>
  );
}

export function BuildProveTaskDetail({ detail }: { detail: Detail }) {
  const { task, workItem, referenceAttachments, revisionHistory } = detail;
  return (
    <div className="build-task-layout">
      <div className="build-task-main">
        <section className="build-task-summary">
          <div className="build-work-card-header">
            <span className={`build-status ${workItem.status}`}>{statusLabels[workItem.status]}</span>
            <span className={`build-priority ${task.priority}`}>{task.priority} priority</span>
          </div>
          <h2>Task objective</h2>
          <p>{task.objective || "No separate objective has been provided."}</p>
          <div className="build-task-facts">
            <div><span>Deadline</span><strong>{task.deadlineAt ? readableDate(task.deadlineAt) : "No deadline"}</strong></div>
            <div><span>Reward</span><strong>{workItem.rewardPointsSnapshot} points after approval</strong></div>
            <div><span>Difficulty</span><strong>{task.difficulty}</strong></div>
          </div>
        </section>

        <DetailList title="Requirements" value={task.requirements} />
        <DetailList title="Expected deliverables" value={task.deliverables} />
        <DetailList title="Submission expectations" value={task.submissionRequirements} />
        <DetailList title="Evaluation criteria" value={task.evaluationCriteria} />

        {referenceAttachments.length > 0 && (
          <section className="build-detail-section">
            <h3>Reference materials</h3>
            <ul className="build-reference-list">
              {referenceAttachments.map((reference) => (
                <li key={reference.id}>
                  <strong>{reference.label || "Reference file"}</strong>
                  <span>{reference.contentType} · {Math.ceil(reference.fileSize / 1024)} KB</span>
                </li>
              ))}
            </ul>
            <p className="build-upload-notice">Reference file downloads are not available in this phase.</p>
          </section>
        )}

        <section className="build-detail-section">
          <h3>Submission history</h3>
          {revisionHistory.length === 0 ? (
            <p className="muted">No submissions yet.</p>
          ) : (
            <ol className="build-revision-list">
              {revisionHistory.map((revision) => (
                <li key={revision.id}>
                  <div className="build-revision-heading">
                    <strong>Revision {revision.revisionNumber}: {revision.projectTitle}</strong>
                    <time dateTime={revision.submittedAt}>{readableDate(revision.submittedAt)}</time>
                  </div>
                  <p>{revision.explanation}</p>
                  {revision.approach && <p><strong>Approach:</strong> {revision.approach}</p>}
                  {[["Repository", revision.repositoryUrl], ["Deployment", revision.deploymentUrl], ["Demo", revision.demoUrl]].map(([label, rawUrl]) => {
                    const url = safeWebUrl(rawUrl);
                    return url ? (
                      <a className="build-submission-link" key={label} href={url} target="_blank" rel="noreferrer">
                        {label} ↗
                      </a>
                    ) : null;
                  })}
                  {revision.evidence.length > 0 && (
                    <ul className="build-reference-list">
                      {revision.evidence.map((evidence) => (
                        <li key={evidence.id}>
                          <strong>{evidence.caption || "Submitted file"}</strong>
                          <span>{evidence.contentType} · {Math.ceil(evidence.fileSize / 1024)} KB</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {revision.reviews.length > 0 && (
                    <div className="build-review-history">
                      {revision.reviews.map((review) => (
                        <article key={review.id}>
                          <strong>{review.decision === "changes_requested" ? "Changes requested" : "Approved"}</strong>
                          <time dateTime={review.createdAt}>{readableDate(review.createdAt)}</time>
                          {review.feedback && <p>{review.feedback}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="build-task-actions">
        {workItem.status === "assigned" && <StartWorkForm workItemId={workItem.id} />}
        {workItem.status === "in_progress" && <SubmissionForm workItemId={workItem.id} resubmission={false} />}
        {workItem.status === "changes_requested" && <SubmissionForm workItemId={workItem.id} resubmission />}
        {["submitted", "resubmitted"].includes(workItem.status) && (
          <section className="build-action-note">
            <h2>With your reviewer</h2>
            <p>Your submission is awaiting review. You’ll see feedback and the next step here.</p>
          </section>
        )}
        {workItem.status === "approved" && (
          <section className="build-action-note approved">
            <h2>Work approved</h2>
            <p>This task has been approved. Its configured reward is handled by the system.</p>
          </section>
        )}
        <Link className="build-secondary-link" href={`/member/learn/${task.domain.replaceAll("_", "-")}`}>
          Back to assigned tasks
        </Link>
      </aside>
    </div>
  );
}
