"use client";
import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addJoinRequestProof, removeJoinRequestProof, type ProjectMemberState } from "@/app/member/projects/actions";
import type { JoinRequestProof } from "@/lib/services/projects";

const PROOF_TYPES = [
  { value: "github", label: "GitHub repository" },
  { value: "portfolio", label: "Portfolio" },
  { value: "live_demo", label: "Live demo" },
  { value: "previous_project", label: "Previous project" },
  { value: "certificate", label: "Certificate" },
  { value: "achievement", label: "Achievement" },
  { value: "other", label: "Other" },
] as const;

const initial: ProjectMemberState = { status: "idle" };

export function JoinRequestProofForm({ requestId, proofs }: { requestId: string; proofs: JoinRequestProof[] }) {
  const [addState, addAction, addPending] = useActionState(addJoinRequestProof, initial);
  const [removeState, removeAction] = useActionState(removeJoinRequestProof, initial);

  return (
    <div className="proof-section">
      <div className="eyebrow" style={{ marginBottom: 12 }}>Skill proofs</div>

      {proofs.length > 0 && (
        <div className="proof-list">
          {proofs.map((proof) => (
            <div className="proof-item" key={proof.id}>
              <div className="proof-item-content">
                <span className="tag">{PROOF_TYPES.find((t) => t.value === proof.proofType)?.label ?? proof.proofType}</span>
                <strong>{proof.title}</strong>
                {proof.description && <span className="muted">{proof.description}</span>}
                {proof.url && <a href={proof.url} target="_blank" rel="noopener noreferrer" className="section-action">{proof.url}</a>}
              </div>
              <form action={removeAction}>
                <input type="hidden" name="proof_id" value={proof.id} />
                <button className="button button-secondary" type="submit" aria-label={`Remove proof: ${proof.title}`}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </form>
            </div>
          ))}
          {removeState.message && <p className={`admin-event-message ${removeState.status}`}>{removeState.message}</p>}
        </div>
      )}

      <details className="admin-event-edit">
        <summary>
          <Plus size={14} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />
          Add a proof
        </summary>
        <form action={addAction} className="admin-event-fields proof-add-form">
          <input type="hidden" name="request_id" value={requestId} />
          <label>
            Proof type
            <select name="proof_type" required>
              {PROOF_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input name="title" required maxLength={120} placeholder="e.g. My AWS project on GitHub" />
          </label>
          <label>
            URL
            <input name="url" type="url" required placeholder="https://" />
          </label>
          <label className="admin-event-field-wide">
            Description (optional)
            <input name="description" maxLength={500} placeholder="Brief description of this proof" />
          </label>
          <button className="button" type="submit" disabled={addPending}>
            {addPending ? "Adding…" : "Add proof"}
          </button>
          {addState.message && <p className={`admin-event-message ${addState.status}`}>{addState.message}</p>}
        </form>
      </details>
    </div>
  );
}
