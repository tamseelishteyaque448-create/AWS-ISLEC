"use client";

import Link from "next/link";
import { ArrowUpRight, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminProject } from "@/lib/services/projects";

export function AdminProjectExplore({ projects }: { projects: AdminProject[] }) {
  const [query, setQuery] = useState("");
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
          <p>{publishedProjects.length === 0 ? "Approve a pending project from Project management to make it visible here and to members." : "Try a different search term."}</p>
          {publishedProjects.length === 0 ? <Link className="button" href="/admin/projects">Open project management</Link> : null}
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
