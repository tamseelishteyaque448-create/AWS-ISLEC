"use client";

import { useActionState } from "react";
import { createMemberProject, type ProjectMemberState } from "@/app/member/projects/actions";

const initial: ProjectMemberState = { status: "idle" };

export function ProjectCreateForm() {
  const [state, action, pending] = useActionState(createMemberProject, initial);
  return <details className="project-create-panel"><summary><span><span className="eyebrow">Build something new</span><strong>Have an idea worth building?</strong></span><span className="button">+ Create project</span></summary><form action={action} className="admin-event-fields">
    <label>Title<input name="title" required maxLength={160} /></label>
    <label>Category<input name="category" required maxLength={80} placeholder="Serverless" /></label>
    <label>Recruitment<select name="recruitment_mode" defaultValue="open"><option value="open">Open</option><option value="invite_only">Invite only</option><option value="not_recruiting">Not recruiting</option></select></label>
    <label>Team capacity (optional)<input name="team_capacity" type="number" min="1" max="100" /></label>
    <label className="admin-event-field-wide">Technologies<input name="technologies" maxLength={720} placeholder="Lambda, DynamoDB, Next.js" /></label>
    <label className="admin-event-field-wide">Description<textarea name="description" maxLength={2000} /></label>
    <div className="admin-event-actions"><button className="button" disabled={pending}>{pending ? "Submitting…" : "Create and submit for review"}</button>{state.message ? <p className={`admin-event-message ${state.status}`}>{state.message}</p> : null}</div>
  </form></details>;
}
