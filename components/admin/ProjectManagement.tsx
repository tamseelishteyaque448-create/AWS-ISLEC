"use client";
import { useActionState } from "react";
import { FolderKanban, Pencil, UsersRound } from "lucide-react";
import {
  createProject,
  recoverProjectOwnership,
  reviewProjectMember,
  reviewProjectPublication,
  updateProject,
} from "@/app/admin/projects/actions";
import type { ProjectFormState } from "@/app/admin/projects/actions";
import type { AdminProject } from "@/lib/services/projects";

const initialProjectFormState: ProjectFormState = { status: "idle" };

// ---------------------------------------------------------------------------
// Fields — V1-aligned form fields.
// publication_state is deliberately absent: it is managed exclusively by the
// publication review workflow (reviewProjectPublication), not via direct edit.
// ---------------------------------------------------------------------------
function Fields({ project }: { project?: AdminProject }) {
  return (
    <div className="admin-event-fields">
      <label>
        Title
        <input name="title" required maxLength={160} defaultValue={project?.title} />
      </label>
      <label>
        Category
        <input name="category" required maxLength={80} defaultValue={project?.category} />
      </label>
      <label>
        Build stage
        <select name="build_stage" defaultValue={project?.build_stage ?? "idea"}>
          <option value="idea">Idea</option>
          <option value="building">Building</option>
          <option value="prototype">Prototype</option>
          <option value="shipped">Shipped</option>
        </select>
      </label>
      <label>
        Recruitment
        <select name="recruitment_mode" defaultValue={project?.recruitment_mode ?? "open"}>
          <option value="open">Open</option>
          <option value="invite_only">Invite only</option>
          <option value="not_recruiting">Not recruiting</option>
        </select>
      </label>
      <label>
        Team capacity (optional)
        <input
          name="team_capacity"
          type="number"
          min="1"
          max="100"
          defaultValue={project?.team_capacity ?? ""}
        />
      </label>
      <label>
        Repository URL
        <input name="repository_url" type="url" defaultValue={project?.repository_url ?? ""} />
      </label>
      <label>
        Demo URL
        <input name="demo_url" type="url" defaultValue={project?.demo_url ?? ""} />
      </label>
      <label className="admin-event-field-wide">
        Technologies
        <input
          name="technologies"
          defaultValue={project?.technologies.join(", ") ?? ""}
          placeholder="Lambda, DynamoDB"
        />
      </label>
      <label className="admin-event-field-wide">
        Description
        <textarea name="description" maxLength={2000} defaultValue={project?.description ?? ""} />
      </label>
    </div>
  );
}

function Form({ project }: { project?: AdminProject }) {
  const [state, action, pending] = useActionState(
    project ? updateProject : createProject,
    initialProjectFormState,
  );
  return (
    <details className={project ? "admin-event-edit" : "admin-event-create"}>
      <summary>
        {project ? (
          <><Pencil size={15} />Edit project details</>
        ) : (
          <><FolderKanban size={17} />Create project</>
        )}
      </summary>
      <form action={action}>
        {project ? <input type="hidden" name="project_id" value={project.id} /> : null}
        <Fields project={project} />
        <div className="admin-event-actions">
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : project ? "Save changes" : "Create project"}
          </button>
          <p className={`admin-event-message ${state.status}`}>{state.message}</p>
        </div>
      </form>
    </details>
  );
}

// Team — shows all project_members rows; actions target status transitions.
// approve_request / decline_request act on status='requested'
// complete_submission / return_submission act on status='submitted'
function Team({ project }: { project: AdminProject }) {
  const [state, action, pending] = useActionState(reviewProjectMember, initialProjectFormState);
  return (
    <details className="admin-event-attendees">
      <summary>
        {project.members.length} team member{project.members.length === 1 ? "" : "s"}
      </summary>
      {project.members.map((member) => (
        <div className="admin-event-attendee" key={member.profile_id}>
          <div>
            <strong>{member.fullName}</strong>
            <span>{member.handle} · {member.role} · {member.status}</span>
          </div>
          {member.status === "requested" ? (
            <form action={action}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="profile_id" value={member.profile_id} />
              <button className="button button-secondary" name="action" value="approve_request" disabled={pending}>
                Approve
              </button>
              <button className="button button-secondary" name="action" value="decline_request" disabled={pending}>
                Decline
              </button>
            </form>
          ) : member.status === "submitted" ? (
            <form action={action}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="profile_id" value={member.profile_id} />
              <button className="button button-secondary" name="action" value="complete_submission" disabled={pending}>
                Complete
              </button>
              <button className="button button-secondary" name="action" value="return_submission" disabled={pending}>
                Return
              </button>
            </form>
          ) : (
            <span className="tag">{member.status}</span>
          )}
        </div>
      ))}
      {state.message ? (
        <p className={`admin-event-message ${state.status}`}>{state.message}</p>
      ) : null}
    </details>
  );
}

function PublicationReview({ project }: { project: AdminProject }) {
  const [state, action, pending] = useActionState(reviewProjectPublication, initialProjectFormState);
  const reviewStatus = {
    draft: ["Draft", "The owner must submit this project for review before it can be published."],
    pending_review: ["Awaiting review", "Review the project details, then approve it or request changes."],
    changes_requested: ["Changes requested", "The owner must update the project and submit it again."],
    published: ["Published", "This project is visible to members in Explore."],
    archived: ["Archived", "This project is hidden from member discovery. Republish when ready."],
  }[project.publication_state];

  return (
    <div className={`admin-project-review admin-project-review-${project.publication_state}`}>
      <div className="admin-project-review-copy">
        <span className="admin-project-review-label">{reviewStatus[0]}</span>
        <p>{reviewStatus[1]}</p>
      </div>
      <form action={action} className="admin-event-actions">
      <input type="hidden" name="project_id" value={project.id} />
      {project.publication_state === "pending_review" ? (
        <>
          <input name="feedback" maxLength={2000} placeholder="Feedback for the owner (optional)" />
          <button className="button button-secondary" name="decision" value="approved" disabled={pending}>
            Approve
          </button>
          <button className="button button-secondary" name="decision" value="changes_requested" disabled={pending}>
            Request changes
          </button>
        </>
      ) : null}
      {project.publication_state !== "archived" ? (
        <button
          className="button button-secondary"
          name="decision"
          value="archived"
          disabled={pending}
          onClick={(event) => {
            if (!confirm("Archive this project?")) event.preventDefault();
          }}
        >
          Archive
        </button>
      ) : null}
      {project.publication_state === "archived" ? (
        <button
          className="button button-secondary"
          name="decision"
          value="approved"
          disabled={pending}
          onClick={(event) => {
            if (!confirm("Republish this archived project for members?")) event.preventDefault();
          }}
        >
          Republish
        </button>
      ) : null}
      {state.message ? (
        <p className={`admin-event-message ${state.status}`}>{state.message}</p>
      ) : null}
      </form>
    </div>
  );
}

function OwnershipRecovery({ project }: { project: AdminProject }) {
  const [state, action, pending] = useActionState(recoverProjectOwnership, initialProjectFormState);
  if (project.members.some((m) => m.role === "owner" && m.status === "active")) return null;
  return (
    <form action={action} className="admin-event-actions">
      <input type="hidden" name="project_id" value={project.id} />
      <select name="new_owner_id" required defaultValue="">
        <option value="" disabled>Select a replacement owner</option>
        {project.members.map((m) => (
          <option key={m.profile_id} value={m.profile_id}>{m.fullName}</option>
        ))}
      </select>
      <input name="reason" maxLength={1000} placeholder="Recovery reason" required />
      <button
        className="button button-secondary"
        disabled={pending}
        onClick={(event) => {
          if (!confirm("Recover ownership for this project?")) event.preventDefault();
        }}
      >
        Recover ownership
      </button>
      {state.message ? (
        <p className={`admin-event-message ${state.status}`}>{state.message}</p>
      ) : null}
    </form>
  );
}

export function ProjectManagement({ projects }: { projects: AdminProject[] }) {
  return (
    <section className="admin-events">
      <div className="admin-directory-head">
        <div>
          <div className="eyebrow">Project studio</div>
          <h2>Projects, in motion.</h2>
          <p>Review publication requests and retain an operational view of projects.</p>
          <div className="admin-project-flow">
            <span>1. Owner submits</span><span>2. Admin approves</span><span>3. Members discover</span>
          </div>
        </div>
        <span className="admin-directory-icon"><FolderKanban size={21} /></span>
      </div>
      <Form />
      {projects.map((project) => (
        <article className="admin-event-row" id={`project-${project.id}`} key={project.id}>
          <div className="admin-event-main">
            <div>
              <span className="tag">{project.category}</span>
              <span className="admin-event-status">{project.build_stage}</span>
              <span className="admin-event-status">{project.publication_state}</span>
              <span className="admin-event-status">{project.recruitment_mode.replace("_", " ")}</span>
            </div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="admin-event-meta">
              <span><UsersRound size={14} />{project.members.length} team record{project.members.length === 1 ? "" : "s"}</span>
              {project.team_capacity ? <span>Capacity {project.team_capacity}</span> : null}
            </div>
            <PublicationReview project={project} />
            <OwnershipRecovery project={project} />
            <Team project={project} />
          </div>
          <aside className="admin-project-editor">
            <div className="admin-project-editor-heading">
              <span className="eyebrow">Project editor</span>
              <span>Details & links</span>
            </div>
            <Form project={project} />
          </aside>
        </article>
      ))}
    </section>
  );
}
