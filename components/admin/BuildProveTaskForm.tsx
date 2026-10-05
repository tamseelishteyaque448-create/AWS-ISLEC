"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveBuildTaskAction,
  type BuildProveAdminActionState,
} from "@/app/admin/build-prove/actions";
import type {
  BuildDomain,
  BuildProvePublicationState,
  BuildProveTaskDefinition,
} from "@/lib/services/build-prove";

const initialState: BuildProveAdminActionState = { status: "idle" };
const domains: Array<{ value: BuildDomain; label: string }> = [
  { value: "innovation_research", label: "Innovation & Research" },
  { value: "event_management", label: "Event Management" },
  { value: "media_design", label: "Media & Design" },
  { value: "documentation", label: "Documentation" },
];

function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function ActionButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button" type="submit" disabled={pending}>
    {pending ? "Saving…" : editing ? "Save task changes" : "Create task"}
  </button>;
}

export function BuildProveTaskForm({
  task,
}: {
  task?: BuildProveTaskDefinition;
}) {
  const [state, action] = useActionState(saveBuildTaskAction, initialState);
  const editing = Boolean(task);

  return <form action={action} className="admin-build-task-form">
    <input type="hidden" name="assignmentId" value={task?.id ?? ""} />
    <input type="hidden" name="slug" value={task?.slug ?? ""} />
    <input type="hidden" name="sortOrder" value={task?.sortOrder ?? 0} />

    <section className="admin-build-form-section">
      <div className="admin-build-section-heading">
        <div className="eyebrow">Task definition</div>
        <h2>Core details</h2>
        <p>Define the task and the domain where members will find it.</p>
      </div>
      <div className="admin-build-fields">
        <label className="admin-build-field-wide">Task title
          <input name="title" required maxLength={160} defaultValue={task?.title ?? ""} />
        </label>
        <label>Domain
          <select name="domain" defaultValue={task?.domain ?? "innovation_research"}>
            {domains.map((domain) => <option key={domain.value} value={domain.value}>{domain.label}</option>)}
          </select>
        </label>
        <label>Targeting
          <select name="assignmentScope" defaultValue={task?.assignmentScope ?? "domain"}>
            <option value="domain">Domain assignment</option>
            <option value="individual">Individual assignment</option>
          </select>
        </label>
        <label className="admin-build-field-wide">Description
          <textarea name="summary" maxLength={5000} rows={4} defaultValue={task?.summary ?? ""} />
        </label>
        <label className="admin-build-field-wide">Objective
          <textarea name="objective" maxLength={5000} rows={4} defaultValue={task?.objective ?? ""} />
        </label>
      </div>
    </section>

    <section className="admin-build-form-section">
      <div className="admin-build-section-heading">
        <div className="eyebrow">Expectations</div>
        <h2>Requirements and criteria</h2>
        <p>Each field stores a JSON array, matching the Build &amp; Prove task contract.</p>
      </div>
      <div className="admin-build-fields">
        <label>Requirements (JSON array)
          <textarea name="requirements" required rows={6} defaultValue={JSON.stringify(task?.requirements ?? [], null, 2)} />
        </label>
        <label>Deliverables (JSON array)
          <textarea name="deliverables" required rows={6} defaultValue={JSON.stringify(task?.deliverables ?? [], null, 2)} />
        </label>
        <label>Submission requirements (JSON array)
          <textarea name="submissionRequirements" required rows={6} defaultValue={JSON.stringify(task?.submissionRequirements ?? [], null, 2)} />
        </label>
        <label>Evaluation criteria (JSON array)
          <textarea name="evaluationCriteria" required rows={6} defaultValue={JSON.stringify(task?.evaluationCriteria ?? [], null, 2)} />
        </label>
      </div>
    </section>

    <section className="admin-build-form-section">
      <div className="admin-build-section-heading">
        <div className="eyebrow">Operational settings</div>
        <h2>Priority, deadline, and publication</h2>
      </div>
      <div className="admin-build-fields">
        <label>Difficulty
          <select name="difficulty" defaultValue={task?.difficulty ?? "easy"}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>Priority
          <select name="priority" defaultValue={task?.priority ?? "normal"}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label>Deadline (UTC)
          <input name="deadlineDate" type="date" defaultValue={dateInput(task?.deadlineAt ?? null)} />
        </label>
        <label>Reward points
          <input name="rewardPoints" type="number" min="0" max="10000" step="1" required defaultValue={task?.rewardPoints ?? 0} />
        </label>
        <label>Publication state
          <select name="publicationState" defaultValue={task?.publicationState ?? "draft"}>
            {(["draft", "published", "archived"] satisfies BuildProvePublicationState[]).map((stateValue) =>
              <option key={stateValue} value={stateValue}>{stateValue[0].toUpperCase() + stateValue.slice(1)}</option>)}
          </select>
        </label>
      </div>
    </section>

    <div className="admin-build-form-submit">
      <ActionButton editing={editing} />
      {state.message ? <p className={`admin-build-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </div>
  </form>;
}
