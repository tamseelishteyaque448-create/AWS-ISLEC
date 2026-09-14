"use client";

import { useActionState, useId, useState } from "react";
import { Archive, CheckCircle2, ChevronRight, Circle, ClipboardList, FolderKanban, Plus, UsersRound } from "lucide-react";
import {
  archiveProjectMilestone,
  archiveProjectTask,
  assignProjectTask,
  createProjectMilestone,
  createProjectTask,
  deleteMemberProject,
  resolveProjectJoinRequest,
  submitProjectForReview,
  transferProjectOwnership,
  updateMemberProject,
  updateProjectTaskStatus,
  withdrawProjectJoinRequest,
  type ProjectMemberState,
} from "@/app/member/projects/actions";
import { JoinRequestProofForm } from "@/components/member/JoinRequestProofForm";
import type { ProjectWorkspaceV2 as Workspace, WorkspaceJoinRequest, WorkspaceMilestone, WorkspaceTask } from "@/lib/services/projects";

const initial: ProjectMemberState = { status: "idle" };
const STATUS_LABELS: Record<string, string> = { todo: "To do", in_progress: "In progress", blocked: "Blocked", completed: "Completed" };

function Message({ state }: { state: ProjectMemberState }) {
  return state.message ? <p className={`workspace-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null;
}

function StatePill({ state }: { state: WorkspaceMilestone["state"] }) {
  if (!state) return <span className="workspace-state archived">Archived</span>;
  return <span className={`workspace-state ${state}`}>{state === "empty" ? "Empty" : state === "in_progress" ? "In progress" : "Complete"}</span>;
}

function RequestCard({ request, action, pending }: { request: WorkspaceJoinRequest; action: (formData: FormData) => void; pending: boolean }) {
  return (
    <article className="workspace-request">
      <div>
        <strong>{request.fullName}</strong>
        <p>{request.handle}{request.contribution ? ` / ${request.contribution}` : ""}</p>
        {request.message && <p className="workspace-request-note">{request.message}</p>}
        {request.proofs.length > 0 && <div className="workspace-request-proofs">{request.proofs.map((proof) => <a key={proof.id} href={proof.url ?? undefined} target={proof.url ? "_blank" : undefined} rel={proof.url ? "noopener noreferrer" : undefined}>{proof.title}</a>)}</div>}
      </div>
      <form action={action} className="workspace-inline-actions">
        <input type="hidden" name="request_id" value={request.id} />
        <button className="button" name="approve" value="true" disabled={pending}>Accept</button>
        <button className="button button-secondary" name="approve" value="false" disabled={pending}>Decline</button>
      </form>
    </article>
  );
}

function WorkItem({ task, projectId, viewerId, isOwner, writable, members }: { task: WorkspaceTask; projectId: string; viewerId: string; isOwner: boolean; writable: boolean; members: Workspace["activeMembers"] }) {
  const [statusState, statusAction, statusPending] = useActionState(updateProjectTaskStatus, initial);
  const [assignState, assignAction, assignPending] = useActionState(assignProjectTask, initial);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveProjectTask, initial);
  const canUpdateStatus = writable && (isOwner || task.assignee_id === viewerId);
  const canSelfAssign = writable && !isOwner && !task.assignee_id;

  return (
    <article className={`workspace-task ${task.status} ${task.is_archived ? "archived" : ""}`}>
      <div className="workspace-task-main">
        <span className="workspace-task-icon" aria-hidden="true">{task.status === "completed" ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
        <div>
          <div className="workspace-task-title"><strong>{task.title}</strong>{task.is_archived && <span className="workspace-state archived">Archived</span>}</div>
          {task.description && <p>{task.description}</p>}
          <span className="workspace-task-assignee">{task.assignee ? `Assigned to ${task.assignee.fullName}` : "Unassigned"}</span>
        </div>
      </div>
      {!task.is_archived && writable && <div className="workspace-task-actions">
        {canUpdateStatus && <form action={statusAction}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="task_id" value={task.id} />
          <label className="sr-only" htmlFor={`task-status-${task.id}`}>Status for {task.title}</label>
          <select id={`task-status-${task.id}`} name="status" defaultValue={task.status} disabled={statusPending}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="button button-secondary" disabled={statusPending}>Save</button>
        </form>}
        {canSelfAssign && <form action={assignAction}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="assignee_id" value={viewerId} />
          <button className="button button-secondary" disabled={assignPending}>Assign to me</button>
        </form>}
        {isOwner && <form action={assignAction}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="task_id" value={task.id} />
          <label className="sr-only" htmlFor={`task-assignee-${task.id}`}>Assignee for {task.title}</label>
          <select id={`task-assignee-${task.id}`} name="assignee_id" defaultValue={task.assignee_id ?? ""} disabled={assignPending}>
            <option value="">Unassigned</option>
            {members.map((member) => <option key={member.profile_id} value={member.profile_id}>{member.fullName}</option>)}
          </select>
          <button className="button button-secondary" disabled={assignPending}>Assign</button>
        </form>}
        {isOwner && <form action={archiveAction}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="task_id" value={task.id} />
          <button className="workspace-icon-button" type="submit" disabled={archivePending} aria-label={`Archive task: ${task.title}`}><Archive size={15} /></button>
        </form>}
      </div>}
      <Message state={statusState} /><Message state={assignState} /><Message state={archiveState} />
    </article>
  );
}

function MilestoneCard({ milestone, tasks, project, viewerId, isOwner, writable }: { milestone: WorkspaceMilestone; tasks: WorkspaceTask[]; project: Workspace; viewerId: string; isOwner: boolean; writable: boolean }) {
  const [taskState, taskAction, taskPending] = useActionState(createProjectTask, initial);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveProjectMilestone, initial);
  const isCurrent = project.contributorCurrentMilestone?.id === milestone.id;
  const canAddTask = writable && !milestone.is_archived && (isOwner || isCurrent);
  const availableAssignees = project.activeMembers;

  return (
    <article className={`workspace-milestone ${milestone.is_archived ? "archived" : ""}`}>
      <header>
        <div>
          <div className="workspace-milestone-meta"><span>Milestone {milestone.sort_order + 1}</span><StatePill state={milestone.state} /></div>
          <h3>{milestone.title}</h3>
          {milestone.description && <p>{milestone.description}</p>}
        </div>
        {!milestone.is_archived && isOwner && writable && <form action={archiveAction}>
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="milestone_id" value={milestone.id} />
          <button className="workspace-icon-button" type="submit" disabled={archivePending} aria-label={`Archive milestone: ${milestone.title}`}><Archive size={16} /></button>
        </form>}
      </header>
      <div className="workspace-milestone-progress"><span>{milestone.completedActiveTaskCount} of {milestone.activeTaskCount} tasks complete</span><div><span style={{ width: `${milestone.activeTaskCount ? (milestone.completedActiveTaskCount / milestone.activeTaskCount) * 100 : 0}%` }} /></div></div>
      <div className="workspace-task-list">{tasks.length ? tasks.map((task) => <WorkItem key={task.id} task={task} projectId={project.id} viewerId={viewerId} isOwner={isOwner} writable={writable} members={availableAssignees} />) : <p className="workspace-empty">No tasks have been added.</p>}</div>
      {canAddTask && <details className="workspace-add-task">
        <summary><Plus size={15} aria-hidden="true" /> Add task</summary>
        <form action={taskAction} className="workspace-form">
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="milestone_id" value={milestone.id} />
          <input type="hidden" name="sort_order" value={tasks.length} />
          <label>Task title<input name="title" maxLength={200} required /></label>
          <label>Description (optional)<textarea name="description" maxLength={2000} rows={3} /></label>
          {isOwner && <label>Assignee<select name="assignee_id" defaultValue=""><option value="">Unassigned</option>{availableAssignees.map((member) => <option key={member.profile_id} value={member.profile_id}>{member.fullName}</option>)}</select></label>}
          {!isOwner && <input type="hidden" name="assignee_id" value="" />}
          <button className="button" type="submit" disabled={taskPending}>{taskPending ? "Creating..." : "Create task"}</button>
          <Message state={taskState} />
        </form>
      </details>}
      <Message state={archiveState} />
    </article>
  );
}

export function ProjectWorkspace({ project, viewerId }: { project: Workspace; viewerId: string }) {
  const tabPrefix = useId();
  const [activeTab, setActiveTab] = useState<"overview" | "team" | "work">("overview");
  const mine = project.members.find((member) => member.profile_id === viewerId);
  const isOwner = mine?.role === "owner" && mine.status === "active";
  const writable = ["draft", "published", "changes_requested"].includes(project.publication_state);
  const pendingRequest = project.requestsV2.find((request) => request.profileId === viewerId && request.status === "requested");
  const pendingRequests = isOwner ? project.requestsV2.filter((request) => request.status === "requested") : [];
  const visibleMilestones = project.milestones.filter((milestone) => !milestone.is_archived);
  const tasksFor = (milestoneId: string) => project.tasks.filter((task) => task.milestone_id === milestoneId);
  const [milestoneState, milestoneAction, milestonePending] = useActionState(createProjectMilestone, initial);
  const [requestState, requestAction, requestPending] = useActionState(resolveProjectJoinRequest, initial);
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawProjectJoinRequest, initial);
  const [transferState, transferAction, transferPending] = useActionState(transferProjectOwnership, initial);
  const [editState, editAction, editPending] = useActionState(updateMemberProject, initial);
  const [submitState, submitAction, submitPending] = useActionState(submitProjectForReview, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteMemberProject, initial);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: FolderKanban },
    { id: "team" as const, label: "Team", icon: UsersRound },
    { id: "work" as const, label: "Work", icon: ClipboardList },
  ];

  return (
    <section className="project-workspace">
      <header className="workspace-hero">
        <div>
          <p className="eyebrow">{project.category} / {project.publication_state.replace("_", " ")}</p>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
          {isOwner && (project.publication_state === "draft" || project.publication_state === "changes_requested") && (
            <div className="workspace-publish-prompt">
              <p>{project.publication_state === "draft" ? "Your project is private until it is reviewed and published." : "Make the requested changes, then submit this project for review again."}</p>
              <form action={submitAction}>
                <input type="hidden" name="project_id" value={project.id} />
                <button className="button" type="submit" disabled={submitPending}>
                  {submitPending ? "Submitting..." : "Submit for review"}
                </button>
                <Message state={submitState} />
              </form>
            </div>
          )}
        </div>
        <div className="workspace-hero-status">
          <span>Project progress</span>
          <strong>{project.progress.progressPercentage}%</strong>
          <div><span style={{ width: `${project.progress.progressPercentage}%` }} /></div>
          <small>{project.progress.completedActiveTasks} of {project.progress.totalActiveTasks} active tasks complete</small>
        </div>
      </header>

      <div className="workspace-tabs" role="tablist" aria-label="Project workspace sections">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} id={`${tabPrefix}-${id}-tab`} role="tab" type="button" aria-selected={activeTab === id} aria-controls={`${tabPrefix}-${id}-panel`} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}><Icon size={16} aria-hidden="true" />{label}</button>)}
      </div>

      <div id={`${tabPrefix}-overview-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-overview-tab`} hidden={activeTab !== "overview"} className="workspace-panel">
        <div className="workspace-overview-summary">
          <article><span className="eyebrow">Stage</span><strong>{project.build_stage}</strong><small>Current build phase</small></article>
          <article><span className="eyebrow">Team</span><strong>{project.members.length}</strong><small>{project.members.length === 1 ? "Active member" : "Active members"}</small></article>
          <article><span className="eyebrow">Milestones</span><strong>{visibleMilestones.length}</strong><small>{visibleMilestones.length === 1 ? "Current milestone" : "Current milestones"}</small></article>
          <article><span className="eyebrow">Tasks</span><strong>{project.progress.totalActiveTasks}</strong><small>{project.progress.completedActiveTasks} completed</small></article>
        </div>
        <div className="workspace-overview-grid">
          <article className="workspace-card">
            <div className="workspace-card-heading"><span className="eyebrow">What we are building</span><span className={`workspace-state ${project.publication_state}`}>{project.publication_state.replace("_", " ")}</span></div>
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            {project.technologies.length > 0 && <div className="project-tech-list">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>}
          </article>
          <article className="workspace-card workspace-next-step">
            <span className="eyebrow">What needs to happen next</span>
            <h2>{project.displayCurrentMilestone?.title ?? "All current milestones are complete"}</h2>
            <p>{project.displayCurrentMilestone ? `${project.displayCurrentMilestone.completedActiveTaskCount} of ${project.displayCurrentMilestone.activeTaskCount} tasks complete.` : "Create a new milestone when the team is ready for the next piece of work."}</p>
            <button className="workspace-text-button" type="button" onClick={() => setActiveTab("work")}>Open work board <ChevronRight size={15} /></button>
          </article>
        </div>
        {project.reviews.filter((review) => review.decision === "changes_requested" && review.feedback).map((review) => <div className="workspace-review" key={review.createdAt}><strong>Changes requested</strong><p>{review.feedback}</p></div>)}
        {isOwner && <details className="workspace-settings">
          <summary>Project settings</summary>
          {writable ? <form action={editAction} className="workspace-form workspace-settings-form">
            <input type="hidden" name="project_id" value={project.id} />
            <label>Title<input name="title" required maxLength={160} defaultValue={project.title} /></label>
            <label>Category<input name="category" required maxLength={80} defaultValue={project.category} /></label>
            <label>Build stage<select name="build_stage" defaultValue={project.build_stage}><option value="idea">Idea</option><option value="building">Building</option><option value="prototype">Prototype</option><option value="shipped">Shipped</option></select></label>
            <label>Recruitment<select name="recruitment_mode" defaultValue={project.recruitment_mode}><option value="open">Open</option><option value="invite_only">Invite only</option><option value="not_recruiting">Not recruiting</option></select></label>
            <label>Capacity<input name="team_capacity" type="number" min="1" max="100" defaultValue={project.team_capacity ?? ""} /></label>
            <label>Repository URL<input name="repository_url" type="url" defaultValue={project.repository_url ?? ""} /></label>
            <label>Demo URL<input name="demo_url" type="url" defaultValue={project.demo_url ?? ""} /></label>
            <label className="workspace-form-wide">Technologies<input name="technologies" defaultValue={project.technologies.join(", ")} /></label>
            <label className="workspace-form-wide">Description<textarea name="description" maxLength={2000} defaultValue={project.description} rows={4} /></label>
            <button className="button" type="submit" disabled={editPending}>{editPending ? "Saving..." : "Save project"}</button>
            <Message state={editState} />
          </form> : <p className="workspace-message" role="status">
            Project settings are read-only while this project is {project.publication_state.replace("_", " ")}.
          </p>}
          {isOwner && <div className="workspace-danger-action"><p className="muted">Deleting removes this project, requests, proofs, milestones, tasks, and project history permanently.</p><form action={deleteAction}><input type="hidden" name="project_id" value={project.id} /><button className="button button-secondary" type="submit" disabled={deletePending} onClick={(event) => { if (!confirm("Permanently delete this project and all requests, proofs, milestones, tasks, and history? This cannot be undone.")) event.preventDefault(); }}>{deletePending ? "Deleting..." : "Delete project permanently"}</button><Message state={deleteState} /></form></div>}
        </details>}
      </div>

      <div id={`${tabPrefix}-team-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-team-tab`} hidden={activeTab !== "team"} className="workspace-panel">
        <div className="workspace-section-heading"><div><span className="eyebrow">Who is building it</span><h2>Team</h2></div><span>{project.members.length} active members</span></div>
        <div className="workspace-team-list">{project.members.map((member) => <article key={member.profile_id}><div className="workspace-avatar" aria-hidden="true">{member.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><strong>{member.fullName}</strong><p>{member.handle} / {member.role}</p></div>{isOwner && member.profile_id !== viewerId && member.status === "active" && <form action={transferAction}><input type="hidden" name="project_id" value={project.id} /><button className="button button-secondary" name="new_owner_id" value={member.profile_id} disabled={transferPending} onClick={(event) => { if (!confirm(`Transfer ownership to ${member.fullName}? You will become a contributor.`)) event.preventDefault(); }}>Transfer ownership</button></form>}</article>)}</div>
        <Message state={transferState} />
        {isOwner && <section className="workspace-requests"><div className="workspace-section-heading"><div><span className="eyebrow">Requests</span><h2>People who want to contribute</h2></div><span>{pendingRequests.length} pending</span></div>{pendingRequests.length ? pendingRequests.map((request) => <RequestCard key={request.id} request={request} action={requestAction} pending={requestPending} />) : <p className="workspace-empty">No pending requests.</p>}<Message state={requestState} /></section>}
        {pendingRequest && <section className="workspace-my-request"><span className="eyebrow">Your request is pending</span>{pendingRequest.contribution && <p><strong>Contribution:</strong> {pendingRequest.contribution}</p>}{pendingRequest.message && <p>{pendingRequest.message}</p>}<JoinRequestProofForm requestId={pendingRequest.id} proofs={pendingRequest.proofs} /><form action={withdrawAction}><input type="hidden" name="request_id" value={pendingRequest.id} /><button className="button button-secondary" disabled={withdrawPending}>Withdraw request</button><Message state={withdrawState} /></form></section>}
      </div>

      <div id={`${tabPrefix}-work-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-work-tab`} hidden={activeTab !== "work"} className="workspace-panel">
        <div className="workspace-section-heading"><div><span className="eyebrow">Work</span><h2>Milestones and tasks</h2></div>{project.displayCurrentMilestone && <span>Current: {project.displayCurrentMilestone.title}</span>}</div>
        {visibleMilestones.length ? <div className="workspace-milestones">{visibleMilestones.map((milestone) => <MilestoneCard key={milestone.id} milestone={milestone} tasks={tasksFor(milestone.id)} project={project} viewerId={viewerId} isOwner={isOwner} writable={writable} />)}</div> : <p className="workspace-empty">No milestones yet. The project owner can add the first milestone.</p>}
        {isOwner && writable && <details className="workspace-create-milestone"><summary><Plus size={16} aria-hidden="true" /> Create milestone</summary><form action={milestoneAction} className="workspace-form"><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="sort_order" value={project.milestones.length} /><label>Milestone title<input name="title" maxLength={120} required /></label><label>Description (optional)<textarea name="description" maxLength={500} rows={3} /></label><button className="button" type="submit" disabled={milestonePending}>{milestonePending ? "Creating..." : "Create milestone"}</button><Message state={milestoneState} /></form></details>}
        {!writable && <p className="workspace-read-only">This workspace is read-only while the project is {project.publication_state.replace("_", " ")}.</p>}
      </div>
    </section>
  );
}
