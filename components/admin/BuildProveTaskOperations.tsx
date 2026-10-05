"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  assignBuildMemberAction,
  assignBuildMembersBulkAction,
  uploadBuildReferenceAction,
  type BuildProveAdminActionState,
} from "@/app/admin/build-prove/actions";
import { BuildProveReviewForm, CancelWorkItemForm } from "@/components/admin/BuildProveReviewForm";
import type {
  BuildDomain,
  BuildProveAdminTaskDetail,
  BuildProveAssignableMember,
  BuildProveReferenceMetadata,
  BuildProveSubmissionRevision,
  BuildProveTaskDefinition,
  BuildWorkStatus,
} from "@/lib/services/build-prove";
import type { Json } from "@/lib/types/database";

const initialState: BuildProveAdminActionState = { status: "idle" };
const domainLabels: Record<BuildDomain, string> = {
  innovation_research: "Innovation & Research",
  event_management: "Event Management",
  media_design: "Media & Design",
  documentation: "Documentation",
};
const statusLabels: Record<BuildWorkStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  cancelled: "Cancelled",
};

function jsonValues(value: Json): string[] {
  if (Array.isArray(value)) return value.map((item) => JSON.stringify(item));
  if (value === null || value === "") return [];
  return [JSON.stringify(value)];
}

function TaskList({ title, value }: { title: string; value: Json }) {
  const values = jsonValues(value);
  return <section className="admin-build-detail-section">
    <h3>{title}</h3>
    {values.length
      ? <ul>{values.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      : <p className="muted">Not specified.</p>}
  </section>;
}

function formattedDate(value: string | null) {
  return value
    ? `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))} UTC`
    : "No deadline";
}

function readableSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ActionButton({
  idleLabel,
  pendingLabel,
  className = "button",
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending}>
    {pending ? pendingLabel : idleLabel}
  </button>;
}

function Message({ state }: { state: BuildProveAdminActionState }) {
  return state.message
    ? <p className={`admin-build-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
    : null;
}

function BulkAssignmentForm({
  assignmentId,
  members,
  published,
}: {
  assignmentId: string;
  members: BuildProveAssignableMember[];
  published: boolean;
}) {
  const [state, action] = useActionState(assignBuildMembersBulkAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.message, state.status]);

  return <form action={action} ref={formRef} className="admin-build-assignment-form">
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <div>
      <h3>Assign a group</h3>
      <p>Select eligible members. Existing assignments remain unchanged if selected again.</p>
    </div>
    {members.length
      ? <fieldset className="admin-build-member-options" disabled={!published}>
        <legend>Eligible members</legend>
        {members.map((member) => <label key={member.id}>
          <input type="checkbox" name="memberIds" value={member.id} />
          <span><strong>{member.fullName}</strong><small>@{member.handle}</small></span>
          {member.existingStatus
            ? <span className={`admin-build-status ${member.existingStatus}`}>{statusLabels[member.existingStatus]} · already assigned</span>
            : null}
        </label>)}
      </fieldset>
      : <p className="admin-build-inline-note">No eligible members are available for this task.</p>}
    {!published ? <p className="admin-build-inline-note">Publish the task before assigning members.</p> : null}
    <div className="admin-build-action-row">
      <ActionButton idleLabel="Assign selected members" pendingLabel="Assigning…" />
      <Message state={state} />
    </div>
  </form>;
}

function SingleAssignmentForm({
  assignmentId,
  members,
  published,
}: {
  assignmentId: string;
  members: BuildProveAssignableMember[];
  published: boolean;
}) {
  const [state, action] = useActionState(assignBuildMemberAction, initialState);
  return <form action={action} className="admin-build-assignment-form">
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <div>
      <h3>Assign one member</h3>
      <p>Re-selecting an existing member is safe and does not create a second work item.</p>
    </div>
    <label>Eligible member
      <select name="memberId" required defaultValue="" disabled={!published || members.length === 0}>
        <option value="" disabled>Select a member</option>
        {members.map((member) => <option value={member.id} key={member.id}>
          {member.fullName} (@{member.handle}){member.existingStatus ? ` · already ${statusLabels[member.existingStatus].toLowerCase()}` : ""}
        </option>)}
      </select>
    </label>
    {!published ? <p className="admin-build-inline-note">Publish the task before assigning members.</p> : null}
    <div className="admin-build-action-row">
      <ActionButton idleLabel="Assign member" pendingLabel="Assigning…" />
      <Message state={state} />
    </div>
  </form>;
}

function ReferenceUploadForm({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(uploadBuildReferenceAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.message, state.status]);
  return <form action={action} ref={formRef} className="admin-build-reference-form">
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <label>Reference label
      <input name="label" maxLength={200} required placeholder="Example: AWS architecture guide" />
    </label>
    <label>Reference file
      <input name="referenceFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
      <small>Private JPEG, PNG, WebP, or PDF · maximum 10 MiB</small>
    </label>
    <div className="admin-build-action-row">
      <ActionButton idleLabel="Add reference" pendingLabel="Uploading…" />
      <Message state={state} />
    </div>
  </form>;
}

function References({ references, assignmentId }: {
  references: BuildProveReferenceMetadata[];
  assignmentId: string;
}) {
  return <section className="admin-build-operations-card">
    <div className="admin-build-section-heading">
      <div className="eyebrow">Private task materials</div>
      <h2>References</h2>
      <p>Stored in the existing private Build &amp; Prove bucket; object paths are never exposed here.</p>
    </div>
    {references.length
      ? <ul className="admin-build-reference-list">{references.map((reference) =>
        <li key={reference.id}>
          <strong>{reference.label || "Reference file"}</strong>
          <span>{reference.contentType} · {readableSize(reference.fileSize)}</span>
        </li>)}</ul>
      : <p className="admin-build-inline-note">No reference files have been added.</p>}
    <details className="admin-build-reference-add">
      <summary>Add a private reference</summary>
      <ReferenceUploadForm assignmentId={assignmentId} />
    </details>
  </section>;
}

function RevisionDetail({ revision }: { revision: BuildProveSubmissionRevision }) {
  return <div className="admin-build-revision">
    <div className="admin-build-section-heading">
      <h4>Revision {revision.revisionNumber} · {formattedDate(revision.submittedAt)}</h4>
      <span className="admin-build-count">{revision.evidence.length} evidence</span>
    </div>
    <p className="admin-build-revision-title">{revision.projectTitle}</p>
    <TaskList title="Explanation" value={revision.explanation} />
    <TaskList title="Approach" value={revision.approach} />
    <TaskList title="Technologies" value={revision.technologies} />
    <TaskList title="Challenges" value={revision.challenges} />
    <TaskList title="Learnings" value={revision.learnings} />
    <TaskList title="Future improvements" value={revision.futureImprovements} />
    <section className="admin-build-detail-section">
      <h3>Evidence</h3>
      {revision.evidence.length
        ? <ul className="admin-build-reference-list">{revision.evidence.map((item) =>
          <li key={item.id}>
            <strong>{item.caption || "Evidence file"}</strong>
            <span>{item.contentType} · {readableSize(item.fileSize)}</span>
            <a
              className="button button-secondary"
              href={`/api/member/build-prove/evidence/${item.id}`}
            >
              Download evidence
            </a>
          </li>)}</ul>
        : <p className="muted">No evidence attached to this revision.</p>}
    </section>
    <ul className="admin-build-link-list">
      {[
        { label: "Repository", href: revision.repositoryUrl },
        { label: "Deployment", href: revision.deploymentUrl },
        { label: "Demo", href: revision.demoUrl },
      ].filter((link) => link.href).map((link) => <li key={link.label}>
        <a href={link.href ?? undefined} target="_blank" rel="noreferrer noopener">{link.label}</a>
      </li>)}
    </ul>
    {revision.reviews.length
      ? <ul className="admin-build-review-history">{revision.reviews.map((review) => <li key={review.id}>
        <strong>{review.decision === "approved" ? "Approved" : "Changes requested"}</strong>
        <span>{formattedDate(review.createdAt)}</span>
        {review.feedback ? <p>{review.feedback}</p> : null}
      </li>)}</ul>
      : <p className="admin-build-inline-note">No review history for this revision.</p>}
  </div>;
}

/**
 * Per-member review surface. Only work in a submitted/resubmitted state is
 * decidable; approved and cancelled items are terminal and are shown read-only.
 */
function MemberReview({
  assignmentId,
  member,
}: {
  assignmentId: string;
  member: BuildProveAdminTaskDetail["members"][number];
}) {
  const { workItem, latestSubmission, revisionHistory } = member;
  const decidable = workItem.status === "submitted" || workItem.status === "resubmitted";
  // Matches getAdminBuildProveReviewQueue: the latest revision with no review
  // at all is the one awaiting a decision.
  const pendingRevision = decidable && latestSubmission && latestSubmission.reviews.length === 0
    ? latestSubmission
    : null;
  const terminal = workItem.status === "approved" || workItem.status === "cancelled";

  return <article className="admin-build-operations-card" id={`review-${workItem.id}`}>
    <div className="admin-build-section-heading">
      <div>
        <div className="eyebrow">Member work item</div>
        <h3>{workItem.fullName} <small>@{workItem.handle}</small></h3>
      </div>
      <span className={`admin-build-status ${workItem.status}`}>{statusLabels[workItem.status]}</span>
    </div>
    <p className="admin-build-inline-note">
      {workItem.rewardPointsSnapshot} points snapshot · updated {formattedDate(workItem.updatedAt)}
    </p>

    {revisionHistory.length === 0
      ? <p className="admin-build-inline-note">No submission has been sent for this member yet.</p>
      : <div className="admin-build-revision-list">
        {revisionHistory.map((revision) => <RevisionDetail key={revision.id} revision={revision} />)}
      </div>}

    {pendingRevision
      ? <BuildProveReviewForm
        assignmentId={assignmentId}
        submissionId={pendingRevision.id}
      />
      : <p className="admin-build-inline-note">
        {decidable
          ? "This revision has already been reviewed."
          : "No decision is available in the current state."}
      </p>}

    {terminal ? null : <details className="admin-build-reference-add">
      <summary>Cancel this work item</summary>
      <p className="admin-build-inline-note">
        Cancelling is terminal. Member drafts and evidence stop being editable, but the review
        history is preserved.
      </p>
      <CancelWorkItemForm assignmentId={assignmentId} workItemId={workItem.id} />
    </details>}
  </article>;
}

export function BuildProveTaskOperations({
  task,
  referenceAttachments,
  members,
  assignableMembers,
}: {
  task: BuildProveTaskDefinition;
  referenceAttachments: BuildProveAdminTaskDetail["referenceAttachments"];
  members: BuildProveAdminTaskDetail["members"];
  assignableMembers: BuildProveAssignableMember[];
}) {
  const statusCounts = members.reduce<Record<BuildWorkStatus, number>>((counts, member) => {
    counts[member.workItem.status] += 1;
    return counts;
  }, {
    assigned: 0,
    in_progress: 0,
    submitted: 0,
    changes_requested: 0,
    resubmitted: 0,
    approved: 0,
    cancelled: 0,
  });
  const published = task.publicationState === "published";

  return <div className="admin-build-prove">
    <section className="admin-build-detail-hero">
      <div className="admin-build-badges">
        <span className="admin-build-badge domain">{domainLabels[task.domain]}</span>
        <span className={`admin-build-badge publication ${task.publicationState}`}>{task.publicationState}</span>
        <span className={`admin-build-badge priority ${task.priority}`}>{task.priority}</span>
        <span className="admin-build-badge">{task.assignmentScope} assignment</span>
      </div>
      <h2>{task.title}</h2>
      <p>{task.summary || "No description provided."}</p>
      <div className="admin-build-detail-facts">
        <span>Deadline: {formattedDate(task.deadlineAt)}</span>
        <span>{task.rewardPoints} reward points configured</span>
        <span>{task.difficulty} difficulty</span>
      </div>
      <Link className="button" href={`/admin/build-prove/tasks/${task.id}/edit`}>Edit task</Link>
    </section>

    <div className="admin-build-detail-grid">
      <section className="admin-build-operations-card">
        <div className="admin-build-section-heading">
          <div className="eyebrow">Task brief</div>
          <h2>What members need to do</h2>
        </div>
        <p className="admin-build-objective">{task.objective || "No objective provided."}</p>
        <TaskList title="Requirements" value={task.requirements} />
        <TaskList title="Deliverables" value={task.deliverables} />
        <TaskList title="Submission requirements" value={task.submissionRequirements} />
        <TaskList title="Evaluation criteria" value={task.evaluationCriteria} />
      </section>

      <div className="admin-build-detail-side">
        <section className="admin-build-operations-card">
          <div className="admin-build-section-heading">
            <div className="eyebrow">Assigned work</div>
            <h2>{members.length} member{members.length === 1 ? "" : "s"}</h2>
            <p>Current state totals for this task.</p>
          </div>
          <div className="admin-build-status-summary">
            {(Object.keys(statusCounts) as BuildWorkStatus[]).filter((status) => statusCounts[status] > 0)
              .map((status) => <div key={status}>
                <span className={`admin-build-status ${status}`}>{statusLabels[status]}</span>
                <strong>{statusCounts[status]}</strong>
              </div>)}
            {members.length === 0 ? <p>No members are assigned yet.</p> : null}
          </div>
          {members.length
            ? <div className="admin-build-member-list">{members.map(({ workItem }) =>
              <article key={workItem.id}>
                <div><strong>{workItem.fullName}</strong><small>@{workItem.handle}</small></div>
                <span className={`admin-build-status ${workItem.status}`}>{statusLabels[workItem.status]}</span>
              </article>)}</div>
            : null}
        </section>
        <References references={referenceAttachments} assignmentId={task.id} />
      </div>
    </div>

    {members.some((member) => member.revisionHistory.length > 0) ? (
      <section className="admin-build-assignment-area">
        <div className="admin-build-section-heading">
          <div className="eyebrow">Review</div>
          <h2>Submitted proof and decisions.</h2>
          <p>
            Each revision is immutable. Reviews are append-only, and the database rejects illegal
            transitions such as approving work that was never submitted.
          </p>
        </div>
        <div className="admin-build-review-grid">
          {members.filter((member) => member.revisionHistory.length > 0)
            .map((member) => <MemberReview key={member.workItem.id} assignmentId={task.id} member={member} />)}
        </div>
      </section>
    ) : null}

    <section className="admin-build-assignment-area">
      <div className="admin-build-section-heading">
        <div className="eyebrow">Member assignment</div>
        <h2>Put the work in motion.</h2>
        <p>The database enforces published-state and domain eligibility; duplicate assignment requests remain idempotent.</p>
      </div>
      <div className="admin-build-assignment-grid">
        <BulkAssignmentForm assignmentId={task.id} members={assignableMembers} published={published} />
        <SingleAssignmentForm assignmentId={task.id} members={assignableMembers} published={published} />
      </div>
    </section>
  </div>;
}
