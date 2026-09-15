"use client";

import Link from "next/link";
import { ArrowUpRight, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { reviewProjectPublication, type ProjectFormState } from "@/app/admin/projects/actions";
import type { AdminProject } from "@/lib/services/projects";

const initialReviewState: ProjectFormState = { status: "idle" };

function ReviewCard({ project }: { project: AdminProject }) {
  const [state, action, pending] = useActionState(reviewProjectPublication, initialReviewState);
  const isPending = project.publication_state === "pending_review";

  return (
    <article className="admin-explore-card admin-explore-review-card">
      <div className="admin-explore-card-topline">
        <span className="tag">{project.category}</span>
        <span className="admin-event-status">{project.publication_state.replace("_", " ")}</span>
        <span className="admin-event-status">{project.build_stage}</span>
      </div>
      <h2>{project.title}</h2>
      <p>{project.description || "This project has no description yet."}</p>
      <div className="admin-event-meta">
        <span><UsersRound size={14} />{project.members.length} team record{project.members.length === 1 ? "" : "s"}</span>
        {project.team_capacity ? <span>Capacity {project.team_capacity}</span> : null}
        <span>{project.recruitment_mode.replace("_", " ")}</span>
      </div>
      {project.technologies.length > 0 ? <div className="project-tech-list">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div> : null}
      {project.repository_url || project.demo_url ? (
        <div className="admin-explore-card-links">
          {project.repository_url ? <a href={project.repository_url} target="_blank" rel="noopener noreferrer">Repository</a> : null}
          {project.demo_url ? <a href={project.demo_url} target="_blank" rel="noopener noreferrer">Live demo</a> : null}
        </div>
      ) : null}
      {isPending ? (
        <form action={action} className="admin-event-actions">
          <input type="hidden" name="project_id" value={project.id} />
          <input name="feedback" maxLength={2000} placeholder="Feedback (optional)" />
          <button className="button" name="decision" value="approved" disabled={pending}>Publish for members</button>
          <button className="button button-secondary" name="decision" value="archived" disabled={pending}>Archive</button>
        </form>
      ) : null}
      {state.message ? <p className={`admin-event-message ${state.status}`}>{state.message}</p> : null}
      <div className="admin-explore-card-actions">
        {project.publication_state === "published" ? <Link className="button button-secondary" href={`/projects/${project.slug}`}>Preview public page <ArrowUpRight size={15} /></Link> : null}
        <Link className="section-action" href={`/admin/projects#project-${project.id}`}>Open full review</Link>
      </div>
    </article>
  );
}

export function AdminProjectExplore({ projects }: { projects: AdminProject[] }) {
  const [query, setQuery] = useState("");
  const reviewProjects = projects.filter((project) => project.publication_state === "pending_review");
  const publishedProjects = projects.filter((project) => project.publication_state === "published");
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return publishedProjects;
    return publishedProjects.filter((project) =>
      [project.title, project.category, project.description, ...project.technologies]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [publishedProjects, query]);

  return (
    <section className="admin-explore">
      <section className="admin-explore-review-queue">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Needs review</span>
            <h2>Member project submissions</h2>
          </div>
          <span className="muted">{reviewProjects.length} awaiting review</span>
        </div>
        {reviewProjects.length === 0 ? <p className="admin-member-empty panel">No member projects are waiting for review.</p> : (
          <div className="admin-explore-grid">{reviewProjects.map((project) => <ReviewCard key={project.id} project={project} />)}</div>
        )}
      </section>
      <div className="admin-explore-toolbar panel">
        <label className="admin-explore-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search published projects</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search published projects, technologies, or categories"
          />
        </label>
        <span className="muted">{filteredProjects.length} of {publishedProjects.length} published</span>
      </div>

      {filteredProjects.length === 0 ? (
        <section className="admin-member-empty panel">
          <h2>{publishedProjects.length === 0 ? "No projects are published yet." : "No published projects match your search."}</h2>
          <p>{publishedProjects.length === 0 ? "Publish a reviewed project to make it visible to members." : "Try a different search term."}</p>
        </section>
      ) : (
        <div className="admin-explore-grid">
          {filteredProjects.map((project) => (
            <article className="admin-explore-card" key={project.id}>
              <div className="admin-explore-card-topline">
                <span className="tag">{project.category}</span>
                <span className="admin-event-status">{project.build_stage}</span>
              </div>
              <h2>{project.title}</h2>
              <p>{project.description || "A published community project."}</p>
              <div className="admin-event-meta">
                <span><UsersRound size={14} />{project.members.length} team record{project.members.length === 1 ? "" : "s"}</span>
                {project.recruitment_mode === "open" ? <span>Accepting contributors</span> : <span>{project.recruitment_mode.replace("_", " ")}</span>}
              </div>
              {project.technologies.length > 0 ? <div className="project-tech-list">{project.technologies.slice(0, 6).map((technology) => <span key={technology}>{technology}</span>)}</div> : null}
              <div className="admin-explore-card-actions">
                <Link className="button button-secondary" href={`/projects/${project.slug}`}>Preview public page <ArrowUpRight size={15} /></Link>
                <Link className="section-action" href="/admin/projects">Manage project</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
