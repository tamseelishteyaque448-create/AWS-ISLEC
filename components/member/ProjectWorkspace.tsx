"use client";
import { useActionState } from "react";
import { resolveProjectJoinRequest, submitProjectForReview, transferProjectOwnership, updateMemberProject, withdrawProjectJoinRequest, type ProjectMemberState } from "@/app/member/projects/actions";
import type { ProjectWorkspace as Workspace, WorkspaceJoinRequest } from "@/lib/services/projects";
import { JoinRequestProofForm } from "@/components/member/JoinRequestProofForm";

const initial: ProjectMemberState = { status: "idle" };

function Message({ state }: { state: ProjectMemberState }) {
  return state.message ? <p className={`admin-event-message ${state.status}`}>{state.message}</p> : null;
}

function RequestCard({ request, onAction, pending }: { request: WorkspaceJoinRequest; onAction: (formData: FormData) => void; pending: boolean }) {
  const PROOF_TYPE_LABELS: Record<string, string> = { github: "GitHub", portfolio: "Portfolio", live_demo: "Live demo", previous_project: "Previous project", certificate: "Certificate", achievement: "Achievement", other: "Other" };
  return (
    <div className="admin-event-attendee project-request-card">
      <div className="project-request-info">
        <strong>{request.fullName}</strong>
        <span className="muted">{request.handle}{request.contribution ? ` · ${request.contribution}` : ""}</span>
        {request.message && <p className="muted" style={{ marginTop: 6 }}>{request.message}</p>}
        {request.proofs.length > 0 && (
          <div className="proof-list proof-list-compact" style={{ marginTop: 8 }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>Proofs</span>
            {request.proofs.map((proof) => (
              <div className="proof-item-compact" key={proof.id}>
                <span className="tag" style={{ fontSize: 10 }}>{PROOF_TYPE_LABELS[proof.proofType] ?? proof.proofType}</span>
                <strong>{proof.title}</strong>
                {proof.url && <a href={proof.url} target="_blank" rel="noopener noreferrer" className="section-action" style={{ fontSize: 12 }}>View ↗</a>}
              </div>
            ))}
          </div>
        )}
      </div>
      <form action={onAction} className="project-request-actions">
        <input type="hidden" name="request_id" value={request.id} />
        <button className="button" name="approve" value="true" disabled={pending}>Accept</button>
        <button className="button button-secondary" name="approve" value="false" disabled={pending}>Decline</button>
      </form>
    </div>
  );
}

export function ProjectWorkspace({ project, viewerId }: { project: Workspace & { requestsV2?: WorkspaceJoinRequest[] }; viewerId: string }) {
  const mine = project.members.find((member) => member.profile_id === viewerId);
  const owner = mine?.role === "owner" && mine.status === "active";
  const myPendingRequest = project.requests.find((r) => r.profileId === viewerId && r.status === "requested");

  const [editState, edit] = useActionState(updateMemberProject, initial);
  const [submitState, submit] = useActionState(submitProjectForReview, initial);
  const [requestState, requestAction, requestPending] = useActionState(resolveProjectJoinRequest, initial);
  const [transferState, transfer] = useActionState(transferProjectOwnership, initial);
  const [withdrawState, withdraw] = useActionState(withdrawProjectJoinRequest, initial);

  const requestsV2 = project.requestsV2 ?? project.requests.map((r) => ({ ...r, proofs: [] }));
  const pendingRequests = requestsV2.filter((r) => r.status === "requested");

  return (
    <section className="admin-events">
      <div className="admin-directory-head">
        <div>
          <div className="eyebrow">{project.category} / {project.publication_state}</div>
          <h2>{project.title}</h2>
          <p>Build stage: {project.build_stage} · Recruitment: {project.recruitment_mode.replace("_", " ")}{project.team_capacity ? ` · Capacity ${project.team_capacity}` : ""}</p>
        </div>
      </div>

      {project.reviews.filter((review) => review.decision === "changes_requested" && review.feedback).map((review) => (
        <div className="admin-member-error" key={review.createdAt}><strong>Changes requested</strong><p>{review.feedback}</p></div>
      ))}

      <details className="admin-event-attendees" open>
        <summary>Team ({project.members.length})</summary>
        {project.members.map((member) => (
          <div className="admin-event-attendee" key={member.profile_id}>
            <div>
              <strong>{member.fullName}</strong>
              <span>{member.handle} · {member.role} · {member.status}</span>
            </div>
            {owner && member.profile_id !== viewerId && member.status === "active" ? (
              <form action={transfer}>
                <input type="hidden" name="project_id" value={project.id} />
                <button className="button button-secondary" name="new_owner_id" value={member.profile_id}
                  onClick={(event) => { if (!confirm(`Transfer ownership to ${member.fullName}? You will become a contributor.`)) event.preventDefault(); }}>
                  Transfer ownership
                </button>
              </form>
            ) : null}
          </div>
        ))}
        <Message state={transferState} />
      </details>

      {owner && (
        <>
          <details className="admin-event-attendees" open>
            <summary>Join requests ({pendingRequests.length})</summary>
            {pendingRequests.length === 0 && <p className="muted" style={{ padding: "12px 0" }}>No pending requests.</p>}
            {pendingRequests.map((request) => (
              <RequestCard key={request.id} request={request} onAction={requestAction} pending={requestPending} />
            ))}
            <Message state={requestState} />
          </details>

          <details className="admin-event-edit" open>
            <summary>Edit project</summary>
            <form action={edit} className="admin-event-fields">
              <input type="hidden" name="project_id" value={project.id} />
              <label>Title<input name="title" required defaultValue={project.title} /></label>
              <label>Category<input name="category" required defaultValue={project.category} /></label>
              <label>Build stage
                <select name="build_stage" defaultValue={project.build_stage}>
                  <option value="idea">Idea</option>
                  <option value="building">Building</option>
                  <option value="prototype">Prototype</option>
                  <option value="shipped">Shipped</option>
                </select>
              </label>
              <label>Recruitment
                <select name="recruitment_mode" defaultValue={project.recruitment_mode}>
                  <option value="open">Open</option>
                  <option value="invite_only">Invite only</option>
                  <option value="not_recruiting">Not recruiting</option>
                </select>
              </label>
              <label>Capacity<input name="team_capacity" type="number" min="1" max="100" defaultValue={project.team_capacity ?? ""} /></label>
              <label>Repository URL<input name="repository_url" type="url" defaultValue={project.repository_url ?? ""} /></label>
              <label>Demo URL<input name="demo_url" type="url" defaultValue={project.demo_url ?? ""} /></label>
              <label className="admin-event-field-wide">Technologies<input name="technologies" defaultValue={project.technologies.join(", ")} /></label>
              <label className="admin-event-field-wide">Description<textarea name="description" defaultValue={project.description} /></label>
              <button className="button">Save project</button>
              <Message state={editState} />
            </form>
          </details>

          {(project.publication_state === "draft" || project.publication_state === "changes_requested") && (
            <form action={submit} className="admin-event-actions">
              <input type="hidden" name="project_id" value={project.id} />
              <button className="button">Submit for review</button>
              <Message state={submitState} />
            </form>
          )}
        </>
      )}

      {myPendingRequest && (
        <div className="project-pending-panel">
          <div className="eyebrow">Your request is pending review</div>
          {myPendingRequest.contribution && <p className="muted"><strong>Contribution:</strong> {myPendingRequest.contribution}</p>}
          {myPendingRequest.message && <p className="muted">{myPendingRequest.message}</p>}
          <JoinRequestProofForm
            requestId={myPendingRequest.id}
            proofs={(project.requestsV2?.find((r) => r.id === myPendingRequest.id)?.proofs) ?? []}
          />
          <form action={withdraw} className="admin-event-actions" style={{ marginTop: 12 }}>
            <input type="hidden" name="request_id" value={myPendingRequest.id} />
            <button className="button button-secondary">Withdraw request</button>
            <Message state={withdrawState} />
          </form>
        </div>
      )}
    </section>
  );
}
