"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelBuildWorkItemAction,
  reviewBuildSubmissionAction,
  type BuildProveAdminActionState,
} from "@/app/admin/build-prove/actions";

const initialState: BuildProveAdminActionState = { status: "idle" };

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button button-secondary" type="submit" disabled={pending || disabled}>
    {pending ? "Working…" : label}
  </button>;
}

function Message({ state }: { state: BuildProveAdminActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <p
    className={`admin-build-message ${state.status}`}
    role={state.status === "error" ? "alert" : "status"}
  >
    {state.message}
  </p>;
}

/**
 * Review controls for one immutable submission revision. The decision is
 * chosen here but re-validated by review_build_submission in the database, so
 * the client never decides the outcome.
 */
export function BuildProveReviewForm({
  assignmentId,
  submissionId,
  disabled,
}: {
  assignmentId: string;
  submissionId: string;
  disabled?: boolean;
}) {
  const [decision, setDecision] = useState<"approved" | "changes_requested">("approved");
  const [approveState, approveAction] = useActionState(reviewBuildSubmissionAction, initialState);
  const [changesState, changesAction] = useActionState(reviewBuildSubmissionAction, initialState);

  return (
    <div className="admin-build-review">
      <fieldset className="admin-build-review-choice" disabled={disabled}>
        <legend>Review decision</legend>
        <label>
          <input
            type="radio"
            name="decisionChoice"
            value="approved"
            checked={decision === "approved"}
            onChange={() => setDecision("approved")}
          />
          Approve this submission
        </label>
        <label>
          <input
            type="radio"
            name="decisionChoice"
            value="changes_requested"
            checked={decision === "changes_requested"}
            onChange={() => setDecision("changes_requested")}
          />
          Request changes
        </label>
      </fieldset>

      {decision === "approved" ? (
        <form action={approveAction} className="admin-build-review-form">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="decision" value="approved" />
          <label>
            Optional note
            <textarea name="feedback" maxLength={2000} rows={3} />
          </label>
          <div className="admin-build-action-row">
            <SubmitButton label="Approve submission" disabled={disabled} />
          </div>
          <Message state={approveState} />
        </form>
      ) : (
        <form action={changesAction} className="admin-build-review-form">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="decision" value="changes_requested" />
          <label>
            Feedback (required)
            <textarea
              name="feedback"
              maxLength={2000}
              rows={5}
              required
              aria-required="true"
              placeholder="Explain what must improve before this can be approved."
            />
          </label>
          <div className="admin-build-action-row">
            <SubmitButton label="Request changes" disabled={disabled} />
          </div>
          <Message state={changesState} />
        </form>
      )}

      <p className="admin-build-inline-note">
        Reviews are append-only. Approving does not yet award points; recognition is a separate,
        controlled step.
      </p>
    </div>
  );
}

/** Admin-only terminal state. Cancelled work is never editable by the member. */
export function CancelWorkItemForm({
  assignmentId,
  workItemId,
  disabled,
}: {
  assignmentId: string;
  workItemId: string;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(cancelBuildWorkItemAction, initialState);

  return (
    <form action={action} className="admin-build-review-form">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="workItemId" value={workItemId} />
      <div className="admin-build-action-row">
        <SubmitButton label="Cancel this work item" disabled={disabled} />
      </div>
      <Message state={state} />
    </form>
  );
}