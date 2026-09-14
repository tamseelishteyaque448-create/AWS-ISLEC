"use client";

import Link from "next/link";
import { Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { MemberExploreProject } from "@/lib/services/projects";

type Filter = "all" | "recruiting" | "building" | "prototype" | "shipped";

const stageLabels: Record<MemberExploreProject["build_stage"], string> = {
  idea: "Idea",
  building: "Building",
  prototype: "Prototype",
  shipped: "Shipped",
};

const recruitmentLabels: Record<MemberExploreProject["recruitment_mode"], string> = {
  open: "Accepting contributors",
  invite_only: "By invitation",
  not_recruiting: "Recruitment closed",
};

function filterLabel(value: Filter) {
  if (value === "all") return "All";
  if (value === "recruiting") return "Recruiting";
  return stageLabels[value];
}

function relationshipLabel(project: MemberExploreProject) {
  if (project.membership?.role === "owner" && project.membership.status === "active") return "Manage / Open workspace";
  if (project.membership?.status === "active") return "Open workspace";
  if (project.membership?.status === "submitted") return "Under review";
  if (project.membership?.status === "completed") return "Completed";
  if (project.joinRequestStatus === "requested") return "Request pending";
  if (project.recruitment_mode !== "open") return "Recruitment closed";
  return "View project";
}

function ProjectCard({ project }: { project: MemberExploreProject }) {
  const isMember = project.membership?.status === "active" || project.membership?.status === "submitted" || project.membership?.status === "completed";
  const actionLabel = relationshipLabel(project);
  const href = isMember ? `/member/projects/${project.id}` : `/member/projects/${project.id}`;

  return (
    <article className="project-discovery-card">
      <div className="project-discovery-card-topline">
        <span className="tag">{project.category}</span>
        <span className={`project-discovery-status ${project.build_stage}`}>{stageLabels[project.build_stage]}</span>
      </div>
      <div className="project-discovery-card-body">
        <h3>{project.title}</h3>
        <p>{project.description || "A community project looking for thoughtful builders."}</p>
        <div className="project-discovery-meta">
          <span className={`project-recruitment ${project.recruitment_mode}`}>
            {recruitmentLabels[project.recruitment_mode]}
          </span>
          {project.team_capacity ? <span><UsersRound size={14} aria-hidden="true" />Capacity: {project.team_capacity}</span> : null}
        </div>
        {project.technologies.length > 0 && (
          <div className="project-tech-list" aria-label="Technologies">
            {project.technologies.slice(0, 6).map((technology) => <span key={technology}>{technology}</span>)}
          </div>
        )}
      </div>
      <div className="project-discovery-card-footer">
        {project.joinRequestStatus === "requested" ? <span className="tag">Request pending</span> : null}
        <Link className="button button-secondary" href={href}>{actionLabel}</Link>
      </div>
    </article>
  );
}

function EmptyDiscoveryState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <section className="project-discovery-empty panel">
        <h2>No projects match your filters.</h2>
        <p className="muted">Try a different search or clear the current filters.</p>
        <button className="button button-secondary" type="button" onClick={onClear}>Clear filters</button>
      </section>
    );
  }

  return (
    <section className="project-discovery-empty panel">
      <h2>No community projects yet.</h2>
      <p className="muted">Be one of the first builders to create something. New published projects will appear here.</p>
      <Link className="button" href="/member/projects">Create a project</Link>
    </section>
  );
}

export function ProjectDiscovery({ projects }: { projects: MemberExploreProject[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => [...new Set(projects.map((project) => project.category))].sort(), [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const searchable = [project.title, project.description, project.category, ...project.technologies].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesCategory = category === "all" || project.category === category;
      const matchesFilter =
        filter === "all" ||
        (filter === "recruiting" && project.recruitment_mode === "open") ||
        project.build_stage === filter;
      return matchesQuery && matchesCategory && matchesFilter;
    });
  }, [category, filter, projects, query]);

  const activeProjects = filteredProjects.filter((project) => project.build_stage !== "shipped");
  const shippedProjects = filteredProjects.filter((project) => project.build_stage === "shipped");
  const hasFilters = Boolean(query.trim()) || filter !== "all" || category !== "all";
  const clearFilters = () => { setQuery(""); setFilter("all"); setCategory("all"); };

  return (
    <section className="project-discovery">
      <div className="project-discovery-toolbar panel">
        <label className="project-discovery-search">
          <span className="sr-only">Search projects</span>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, technologies, or ideas" />
        </label>
        <div className="project-discovery-filters" aria-label="Project filters">
          {(["all", "recruiting", "building", "prototype", "shipped"] as Filter[]).map((value) => (
            <button key={value} className={filter === value ? "active" : ""} type="button" onClick={() => setFilter(value)}>
              {filterLabel(value)}
            </button>
          ))}
          {categories.length > 1 ? (
            <label className="project-category-filter">
              <span className="sr-only">Filter by category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {filteredProjects.length === 0 ? <EmptyDiscoveryState filtered={hasFilters} onClear={clearFilters} /> : (
        <div className="project-discovery-groups">
          {activeProjects.length > 0 ? <section><div className="project-discovery-heading"><div><span className="eyebrow">In progress</span><h2>Active builds</h2></div><span className="muted">{activeProjects.length} projects</span></div><div className="project-discovery-grid">{activeProjects.map((project) => <ProjectCard key={project.id} project={project} />)}</div></section> : null}
          {shippedProjects.length > 0 ? <section><div className="project-discovery-heading"><div><span className="eyebrow">Ready to learn from</span><h2>Completed builds</h2></div><span className="muted">{shippedProjects.length} projects</span></div><div className="project-discovery-grid">{shippedProjects.map((project) => <ProjectCard key={project.id} project={project} />)}</div></section> : null}
        </div>
      )}
    </section>
  );
}
