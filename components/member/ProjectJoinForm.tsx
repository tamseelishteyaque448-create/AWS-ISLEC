"use client";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { requestProjectJoin, type ProjectMemberState } from "@/app/member/projects/actions";
import type { JoinRequestProof } from "@/lib/services/projects";
import { JoinRequestProofForm } from "@/components/member/JoinRequestProofForm";

const CONTRIBUTION_AREAS = [
  { value: "aws_cloud", label: "AWS / Cloud infrastructure" },
  { value: "backend", label: "Backend development" },
  { value: "frontend", label: "Frontend development" },
  { value: "ai_ml", label: "AI / ML" },
  { value: "ui_ux", label: "UI / UX design" },
  { value: "product", label: "Product" },
  { value: "documentation", label: "Documentation" },
  { value: "other", label: "Other" },
] as const;

const initial: ProjectMemberState = { status: "idle" };

export function ProjectJoinForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(requestProjectJoin, initial);

  return (
    <div className="project-join-form">
      <div className="eyebrow" style={{ marginBottom: 12 }}>Request to join</div>
      <form action={action} className="admin-event-fields">
        <input type="hidden" name="project_id" value={projectId} />
        <label>
          Contribution area
          <select name="contribution" required>
            <option value="">Select your contribution area…</option>
            {CONTRIBUTION_AREAS.map((area) => (
              <option key={area.value} value={area.label}>{area.label}</option>
            ))}
          </select>
        </label>
        <label className="admin-event-field-wide">
          Message (optional)
          <textarea name="message" maxLength={1000} rows={3} placeholder="Tell the project owner how you can help." />
        </label>
        <button className="button" type="submit" disabled={pending}>
          <Send size={14} aria-hidden="true" />
          {pending ? "Sending…" : "Send request"}
        </button>
        {state.message && <p className={`admin-event-message ${state.status}`}>{state.message}</p>}
      </form>
    </div>
  );
}

export function PendingRequestPanel({
  requestId,
  contribution,
  message,
  proofs,
}: {
  requestId: string;
  contribution: string;
  message: string;
  proofs: JoinRequestProof[];
}) {
  return (
    <div className="project-pending-panel panel">
      <div className="eyebrow">Your request is pending review</div>
      {contribution && <p className="muted"><strong>Contribution:</strong> {contribution}</p>}
      {message && <p className="muted">{message}</p>}
      <JoinRequestProofForm requestId={requestId} proofs={proofs} />
    </div>
  );
}
