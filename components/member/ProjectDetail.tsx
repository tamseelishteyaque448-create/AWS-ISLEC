"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, UsersRound } from "lucide-react";
import { ProjectMembershipControl } from "@/components/member/ProjectMembershipControl";
import { withdrawProjectJoinRequest, type ProjectMemberState } from "@/app/member/projects/actions";
import type { MemberProjectExperience } from "@/lib/services/projects";

const initial: ProjectMemberState = { status: "idle" };

const stageLabels = {
  idea: "Idea",
  building: "Building",
  prototype: "Prototype",
  shipped: "Shipped",
} as const;

const recruitmentLabels = {
  open: "Accepting contributors",
  invite_only: "Invitation required",
  not_recruiting: "Recruitment closed",
} as const;

const ACTIVE_MEMBER_STATUSES = new Set(["active", "submitted", "completed"]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function ProjectDetail({ project }: { project: MemberProjectExperience }) {
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawProjectJoinRequest, initial);
  const membership = project.membership;
  const isActiveMember = membership !== null && ACTIVE_MEMBER_STATUSES.has(membership.status);
  const isOwner = membership?.role === "owner" && membership.status === "active";
  const isArchived = project.publication_state === "archived";
  const canRequest = project.publication_state === "published" && project.build_stage !== "shipped" && project.recruitment_mode === "open" && !project.request;

  return (
    <section className="project-detail">
      <header className="project-detail-hero">
        <div>
          <div className="project-detail-badges">
            <span className="eyebrow">{project.category}</span>
            <span className={`project-discovery-status ${project.build_stage}`}>{stageLabels[project.build_stage]}</span>
            {isArchived ? <span className="project-detail-archived">Archived · read-only</span> : null}
          </div>
          <h1>{project.title}</h1>
          <p>{project.description || "A community project built by AWS ISLEC members."}</p>
        </div>
        <div className="project-detail-hero-status">
          <span className="eyebrow">Recruitment</span>
          <strong>{recruitmentLabels[project.recruitment_mode]}</strong>
          {project.team_capacity ? <span><UsersRound size={14} aria-hidden="true" />Capacity: {project.team_capacity}</span> : <span>Team capacity is flexible</span>}
        </div>
      </header>

      <div className="project-detail-grid">
        <article className="project-detail-card project-detail-overview">
          <span className="eyebrow">Project overview</span>
          <h2>What is being built</h2>
          <p>{project.description || "This project does not have a longer description yet."}</p>
          {project.technologies.length > 0 ? <div className="project-tech-list" aria-label="Technologies">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div> : null}
        </article>

        <aside className="project-detail-card project-detail-action-card">
          <span className="eyebrow">Your relationship</span>
          {isOwner ? <><h2>Project owner</h2><p>You manage this project and its team workspace.</p><Link className="button" href={`/member/projects/${project.id}`}>Manage project <ArrowRight size={15} aria-hidden="true" /></Link></> :
            isActiveMember ? <><h2>{isArchived ? "Archived project" : membership?.status === "completed" ? "Completed contributor" : "Project contributor"}</h2><p>{isArchived ? "Your read-only project workspace remains available." : "Your project workspace is available."}</p><Link className="button" href={`/member/projects/${project.id}`}>{isArchived ? "View read-only workspace" : "Open workspace"} <ArrowRight size={15} aria-hidden="true" /></Link></> :
            project.request ? <><h2>Request pending</h2><p>Your request was sent {formatDate(project.request.requestedAt)}.</p>{project.request.contribution ? <p><strong>Contribution:</strong> {project.request.contribution}</p> : null}{project.request.message ? <p>{project.request.message}</p> : null}<form action={withdrawAction}><input type="hidden" name="request_id" value={project.request.id} /><button className="button button-secondary" type="submit" disabled={withdrawPending}>{withdrawPending ? "Withdrawing…" : "Withdraw request"}</button><p className={`project-detail-message ${withdrawState.status}`} role={withdrawState.status === "error" ? "alert" : "status"}>{withdrawState.message}</p></form></> :
            <><h2>{isArchived ? "Archived project" : project.recruitment_mode === "open" ? "Want to contribute?" : recruitmentLabels[project.recruitment_mode]}</h2><p>{isArchived ? "This project is archived and is not accepting new participation." : project.recruitment_mode === "open" ? "Tell the project team how you could help." : "This project is not accepting open join requests."}</p>{canRequest ? <ProjectMembershipControl projectId={project.id} membershipStatus={null} joinRequestStatus={null} canRequest /> : <span className="tag">{isArchived ? "View only" : recruitmentLabels[project.recruitment_mode]}</span>}</>}
        </aside>
      </div>

      {project.repository_url || project.demo_url ? <div className="project-detail-links">{project.repository_url ? <a href={project.repository_url} target="_blank" rel="noopener noreferrer">Repository</a> : null}{project.demo_url ? <a href={project.demo_url} target="_blank" rel="noopener noreferrer">Live demo</a> : null}</div> : null}
    </section>
  );
}
