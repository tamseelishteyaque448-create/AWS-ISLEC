"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  BuildProveEvidenceMetadata,
  BuildProveSubmissionRevision,
  BuildProveTaskDetail as Detail,
  BuildProveTaskDefinition,
} from "@/lib/services/build-prove";
import {
  saveBuildWorkDraftAction,
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

const acceptedFiles: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function jsonItems(value: BuildProveTaskDefinition["requirements"]): string[] {
  const display = (item: BuildProveTaskDefinition["requirements"] | undefined): string => {
    if (item == null) return "None";
    if (typeof item === "object") return JSON.stringify(item);
    return String(item);
  };
  if (Array.isArray(value)) return value.map(display);
  if (typeof value === "string" && value.trim()) return [value];
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key.replaceAll("_", " ")}: ${display(item)}`);
  }
  return [];
}

function DetailList({
  title,
  value,
}: {
  title: string;
  value: BuildProveTaskDefinition["requirements"];
}) {
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

function ActionMessage({
  state,
  successVisible = true,
}: {
  state: BuildProveActionState;
  successVisible?: boolean;
}) {
  if (state.error) return <p className="build-form-error" role="alert">{state.error}</p>;
  if (state.success && successVisible) return <p className="build-form-success" role="status">{state.success}</p>;
  return null;
}

function StartWorkForm({ workItemId }: { workItemId: string }) {
  const [state, action, pending] = useActionState(startBuildWorkAction, {});

  return (
    <form action={action} className="build-action-form">
      <input type="hidden" name="workItemId" value={workItemId} />
      <ActionMessage state={state} />
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start work"}
      </button>
    </form>
  );
}

function EvidenceList({
  evidence,
  editable,
}: {
  evidence: BuildProveEvidenceMetadata[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function download(item: BuildProveEvidenceMetadata) {
    setBusyId(item.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/member/build-prove/evidence/${item.id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setError("This evidence file could not be downloaded. Refresh and try again.");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      const extensionByType: Record<string, string> = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      link.download = `build-evidence-${item.id}.${extensionByType[item.contentType] ?? "bin"}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setSuccess("Evidence download started.");
    } catch {
      setError("This evidence file could not be downloaded. Check your connection and retry.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: BuildProveEvidenceMetadata) {
    if (!window.confirm("Remove this evidence file from your open draft?")) return;
    setBusyId(item.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/member/build-prove/evidence/${item.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) {
        setError("This evidence file could not be removed. Refresh and try again.");
        return;
      }
      setSuccess("Evidence removed.");
      router.refresh();
    } catch {
      setError("This evidence file could not be removed. Check your connection and retry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="build-evidence-section" aria-label="Submission evidence">
      <h4>Evidence files</h4>
      {evidence.length === 0 ? (
        <p className="muted">No evidence attached yet.</p>
      ) : (
        <ul className="build-reference-list">
          {evidence.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.caption || "Evidence file"}</strong>
                <span>{item.contentType} · {Math.ceil(item.fileSize / 1024)} KB</span>
              </div>
              <div className="build-evidence-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void download(item)}
                >
                  {busyId === item.id ? "Working…" : "Download"}
                </button>
                {editable && (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void remove(item)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="build-form-error" role="alert">{error}</p>}
      {success && <p className="build-form-success" role="status">{success}</p>}
    </section>
  );
}

function ReferenceDownloadButton({ attachment }: {
  attachment: Detail["referenceAttachments"][number];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/member/build-prove/references/${attachment.id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setError("This reference file is unavailable. Refresh the task and try again.");
        return;
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      const extensionByType: Record<string, string> = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      link.href = objectUrl;
      link.download = `build-reference-${attachment.id}.${extensionByType[attachment.contentType] ?? "bin"}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setError("This reference file could not be downloaded. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="build-reference-download">
      <button
        className="button button-secondary"
        type="button"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Downloading…" : "Download reference"}
      </button>
      {error && <p className="build-form-error" role="alert">{error}</p>}
    </div>
  );
}

function draftValues(detail: Detail) {
  const value = detail.openDraft
    ?? (detail.workItem.status === "changes_requested" ? detail.latestSubmission : null);
  return {
    projectTitle: value?.projectTitle ?? "",
    explanation: value?.explanation ?? "",
    approach: value?.approach ?? "",
    technologies: value?.technologies.join("\n") ?? "",
    challenges: value?.challenges ?? "",
    learnings: value?.learnings ?? "",
    futureImprovements: value?.futureImprovements ?? "",
    repositoryUrl: value?.repositoryUrl ?? "",
    deploymentUrl: value?.deploymentUrl ?? "",
    demoUrl: value?.demoUrl ?? "",
  };
}

function DraftWorkspace({ detail }: { detail: Detail }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [saveState, saveAction, saving] = useActionState(saveBuildWorkDraftAction, {});
  const [submitState, submitAction, submitting] = useActionState(submitBuildWorkAction, {});
  const [values, setValues] = useState(() => draftValues(detail));
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");

  const currentDraftId = detail.openDraft?.id ?? saveState.draftId;
  const isPending = saving || submitting || uploading;
  const evidence = detail.openDraft?.evidence ?? [];

  function updateField(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setEditedSinceSave(true);
    setUploadSuccess("");
  }

  async function uploadEvidence() {
    const file = fileInput.current?.files?.[0];
    if (!file || !currentDraftId) {
      setUploadError("Save your draft before choosing evidence files.");
      return;
    }
    setUploadError("");
    setUploadSuccess("");
    if (file.size === 0) {
      setUploadError("Choose a non-empty file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Evidence files must be 10 MiB or smaller.");
      return;
    }
    const extension = `.${file.name.split(".").at(-1)?.toLowerCase() ?? ""}`;
    if (!acceptedFiles[extension] || file.type !== acceptedFiles[extension]) {
      setUploadError("Choose a matching JPEG, PNG, WebP, or PDF file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.set("draftId", currentDraftId);
    formData.set("file", file);
    formData.set("caption", uploadCaption);
    try {
      const response = await fetch("/api/member/build-prove/evidence", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      if (!response.ok) {
        const messageByStatus: Record<number, string> = {
          400: "Choose a valid, non-empty supported file.",
          401: "Sign in again before uploading evidence.",
          403: "You cannot add evidence to this draft.",
          404: "This draft is no longer available. Refresh the task.",
          409: "This draft is no longer accepting evidence.",
          413: "Evidence files must be 10 MiB or smaller.",
          415: "The file contents do not match a supported JPEG, PNG, WebP, or PDF type.",
        };
        setUploadError(messageByStatus[response.status]
          ?? "The evidence upload could not be confirmed. Refresh and retry.");
        return;
      }
      setUploadSuccess("Evidence uploaded and saved.");
      setUploadCaption("");
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch {
      setUploadError("The upload could not be confirmed. Refresh the task before retrying.");
    } finally {
      setUploading(false);
    }
  }

  function confirmSubmission(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.dataset.intent === "submit") {
      if (!window.confirm("Submit this revision for admin review? You will not be able to edit it after submission.")) {
        event.preventDefault();
      }
    }
  }

  return (
    <section className="build-submission-form" aria-label="Submission workspace">
      <div>
        <h3>{detail.workItem.status === "changes_requested" ? "Prepare a new revision" : "Your work"}</h3>
        <p className="muted">
          {detail.workItem.status === "changes_requested"
            ? `Revision ${detail.openDraft?.revisionNumber ?? (detail.latestSubmission?.revisionNumber ?? 0) + 1} is a new draft. Earlier submissions and feedback remain unchanged.`
            : "Save your progress as a private draft. Submission locks this revision for review."}
        </p>
      </div>
      <form action={saveAction} className="build-submission-form" onSubmit={confirmSubmission}>
        <input type="hidden" name="workItemId" value={detail.workItem.id} />
        <label>
          Submission title
          <input
            name="projectTitle"
            value={values.projectTitle}
            onChange={(event) => updateField("projectTitle", event.target.value)}
            type="text"
            maxLength={160}
            required
          />
        </label>
        <label>
          Description / note
          <textarea
            name="explanation"
            value={values.explanation}
            onChange={(event) => updateField("explanation", event.target.value)}
            rows={4}
            maxLength={12000}
            required
          />
        </label>
        <label>
          Approach
          <textarea
            name="approach"
            value={values.approach}
            onChange={(event) => updateField("approach", event.target.value)}
            rows={4}
            maxLength={12000}
            required
          />
        </label>
        <label>
          Technologies <span className="muted">(one per line, up to 25)</span>
          <textarea
            name="technologies"
            value={values.technologies}
            onChange={(event) => updateField("technologies", event.target.value)}
            rows={3}
            maxLength={3000}
          />
        </label>
        <label>
          Challenges
          <textarea
            name="challenges"
            value={values.challenges}
            onChange={(event) => updateField("challenges", event.target.value)}
            rows={3}
            maxLength={4000}
          />
        </label>
        <label>
          Learnings
          <textarea
            name="learnings"
            value={values.learnings}
            onChange={(event) => updateField("learnings", event.target.value)}
            rows={3}
            maxLength={4000}
          />
        </label>
        <label>
          Future improvements
          <textarea
            name="futureImprovements"
            value={values.futureImprovements}
            onChange={(event) => updateField("futureImprovements", event.target.value)}
            rows={3}
            maxLength={4000}
          />
        </label>
        <label>
          Repository link <span className="muted">(optional)</span>
          <input
            name="repositoryUrl"
            value={values.repositoryUrl}
            onChange={(event) => updateField("repositoryUrl", event.target.value)}
            type="url"
            inputMode="url"
            maxLength={2048}
            placeholder="https://"
          />
        </label>
        <label>
          Deployment link <span className="muted">(optional)</span>
          <input
            name="deploymentUrl"
            value={values.deploymentUrl}
            onChange={(event) => updateField("deploymentUrl", event.target.value)}
            type="url"
            inputMode="url"
            maxLength={2048}
            placeholder="https://"
          />
        </label>
        <label>
          Demo link <span className="muted">(optional)</span>
          <input
            name="demoUrl"
            value={values.demoUrl}
            onChange={(event) => updateField("demoUrl", event.target.value)}
            type="url"
            inputMode="url"
            maxLength={2048}
            placeholder="https://"
          />
        </label>
        <ActionMessage state={saveState} successVisible={!editedSinceSave && !saving} />
        <ActionMessage state={submitState} />
        <div className="build-workspace-buttons">
          <button
            className="button button-secondary"
            type="submit"
            disabled={isPending}
            onClick={() => setEditedSinceSave(false)}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="button"
            type="submit"
            data-intent="submit"
            formAction={submitAction}
            disabled={isPending}
          >
            {submitting
              ? "Submitting…"
              : detail.workItem.status === "changes_requested"
                ? "Resubmit for review"
                : "Submit for review"}
          </button>
        </div>
      </form>

      <div className="build-evidence-uploader" aria-busy={uploading}>
        <h4>Add evidence</h4>
        <p className="muted">JPEG, PNG, WebP, or PDF · up to 10 MiB. Save the draft before uploading.</p>
        <label>
          Evidence file
          <input
            ref={fileInput}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            disabled={!currentDraftId || isPending}
          />
        </label>
        <label>
          Caption <span className="muted">(optional)</span>
          <input
            value={uploadCaption}
            onChange={(event) => setUploadCaption(event.target.value)}
            maxLength={500}
            disabled={!currentDraftId || isPending}
          />
        </label>
        {!currentDraftId && <p className="build-upload-notice">Save your draft to enable evidence uploads.</p>}
        {uploadError && <p className="build-form-error" role="alert">{uploadError}</p>}
        {uploadSuccess && <p className="build-form-success" role="status">{uploadSuccess}</p>}
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void uploadEvidence()}
          disabled={!currentDraftId || isPending}
        >
          {uploading ? "Uploading…" : "Upload evidence"}
        </button>
      </div>

      <EvidenceList evidence={evidence} editable />
    </section>
  );
}

function RevisionHistory({ revisions }: { revisions: BuildProveSubmissionRevision[] }) {
  if (revisions.length === 0) {
    return (
      <section className="build-detail-section">
        <h3>Revision history</h3>
        <p className="muted">No submitted revisions yet. Your saved draft is private to you.</p>
      </section>
    );
  }

  return (
    <section className="build-detail-section">
      <h3>Revision history</h3>
      <ol className="build-revision-list">
        {revisions.map((revision) => (
          <li key={revision.id}>
            <div className="build-revision-heading">
              <strong>Revision {revision.revisionNumber}: {revision.projectTitle}</strong>
              <time dateTime={revision.submittedAt}>{readableDate(revision.submittedAt)}</time>
            </div>
            <p>{revision.explanation}</p>
            {revision.approach && <p><strong>Approach:</strong> {revision.approach}</p>}
            {revision.technologies.length > 0 && (
              <p><strong>Technologies:</strong> {revision.technologies.join(", ")}</p>
            )}
            {revision.challenges && <p><strong>Challenges:</strong> {revision.challenges}</p>}
            {revision.learnings && <p><strong>Learnings:</strong> {revision.learnings}</p>}
            {revision.futureImprovements && (
              <p><strong>Future improvements:</strong> {revision.futureImprovements}</p>
            )}
            {[["Repository", revision.repositoryUrl], ["Deployment", revision.deploymentUrl], ["Demo", revision.demoUrl]].map(([label, rawUrl]) => {
              const url = safeWebUrl(rawUrl);
              return url ? (
                <a className="build-submission-link" key={label} href={url} target="_blank" rel="noreferrer">
                  {label} ↗
                </a>
              ) : null;
            })}
            <EvidenceList evidence={revision.evidence} editable={false} />
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
    </section>
  );
}

export function BuildProveTaskDetail({ detail }: { detail: Detail }) {
  const { task, workItem, referenceAttachments, revisionHistory } = detail;
  const latestReview = detail.latestSubmission?.reviews.at(-1);
  const editable = workItem.status === "in_progress" || workItem.status === "changes_requested";

  return (
    <div className="build-task-layout">
      <div className="build-task-main">
        <section className="build-task-summary">
          <div className="build-work-card-header">
            <span className={`build-status ${workItem.status}`} aria-label={`Work status: ${statusLabels[workItem.status]}`}>
              {statusLabels[workItem.status]}
            </span>
            <span className={`build-priority ${task.priority}`}>{task.priority} priority</span>
          </div>
          <h2>Task objective</h2>
          <p>{task.objective || "No separate objective has been provided."}</p>
          <div className="build-task-facts">
            <div><span>Deadline</span><strong>{task.deadlineAt ? readableDate(task.deadlineAt) : "No deadline"}</strong></div>
            <div><span>Reward</span><strong>{workItem.status === "approved"
              ? workItem.rewardPointsAwarded == null
                ? `${workItem.rewardPointsSnapshot} points configured · not yet recorded`
                : workItem.rewardPointsAwarded === 0
                  ? "Reward recorded · 0 points"
                  : `${workItem.rewardPointsAwarded} points awarded`
              : `${workItem.rewardPointsSnapshot} points on approval`}</strong></div>
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
                  <div>
                    <strong>{reference.label || "Reference file"}</strong>
                    <span>{reference.contentType} · {Math.ceil(reference.fileSize / 1024)} KB</span>
                  </div>
                  <ReferenceDownloadButton attachment={reference} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {detail.openDraft && editable && (
          <section className="build-detail-section">
            <h3>Saved draft · revision {detail.openDraft.revisionNumber}</h3>
            <p>Your changes and attached files are saved privately. This draft is not submitted for review.</p>
          </section>
        )}

        <RevisionHistory revisions={revisionHistory} />
      </div>

      <aside className="build-task-actions">
        {workItem.status === "assigned" && <StartWorkForm workItemId={workItem.id} />}
        {editable && <DraftWorkspace detail={detail} />}
        {["submitted", "resubmitted"].includes(workItem.status) && (
          <section className="build-action-note" aria-live="polite">
            <h2>With your reviewer</h2>
            <p>Your submitted revision is read-only and awaiting review. You’ll see feedback and the next step here.</p>
          </section>
        )}
        {workItem.status === "changes_requested" && latestReview?.decision === "changes_requested" && (
          <section className="build-action-note build-review-feedback" aria-live="polite">
            <h2>Reviewer feedback</h2>
            {latestReview.feedback && <p>{latestReview.feedback}</p>}
            <time dateTime={latestReview.createdAt}>{readableDate(latestReview.createdAt)}</time>
          </section>
        )}
        {workItem.status === "approved" && (
          <section className="build-action-note approved">
            <h2>Work approved</h2>
            {workItem.rewardPointsAwarded == null ? (
              <p>
                Your work is approved. This assignment’s configured reward of {workItem.rewardPointsSnapshot}
                {" "}points has not yet been recorded.
              </p>
            ) : workItem.rewardPointsAwarded === 0 ? (
              <p>Your work was approved. This assignment’s configured reward was 0 points, so no points were added.</p>
            ) : (
              <p>Your work was approved. You earned {workItem.rewardPointsAwarded} points.</p>
            )}
            <p>
              Any points awarded for Build &amp; Prove work are added to your existing points total on
              your profile and leaderboard.
            </p>
            {workItem.rewardPointsAwarded != null && workItem.rewardAwardedAt && (
              <p>Reward recorded on {readableDate(workItem.rewardAwardedAt)}.</p>
            )}
          </section>
        )}
        {workItem.status === "cancelled" && (
          <section className="build-action-note">
            <h2>Work unavailable</h2>
            <p>This task is no longer available. Draft and evidence details are not accessible.</p>
          </section>
        )}
        <Link className="build-secondary-link" href={`/member/learn/${task.domain.replaceAll("_", "-")}`}>
          Back to assigned tasks
        </Link>
      </aside>
    </div>
  );
}
