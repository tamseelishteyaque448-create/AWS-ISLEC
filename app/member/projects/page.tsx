import { PageIntro } from "@/components/cards/PageIntro";
import { ProjectCreateForm } from "@/components/member/ProjectCreateForm";
import Link from "next/link";
import { Topline } from "@/components/ui/Topline";
import { getMemberProjectsDashboard } from "@/lib/services/projects";

const buildStageLabels = {
  idea: "Idea",
  building: "Building",
  prototype: "Prototype",
  shipped: "Shipped",
} as const;

const publicationLabels = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  changes_requested: "Changes requested",
  archived: "Archived",
} as const;

const recruitmentLabels = {
  open: "Recruiting",
  invite_only: "Invite only",
  not_recruiting: "Closed",
} as const;

function projectMonogram(title: string) {
  return title
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function Projects() {
  const dashboard = await getMemberProjectsDashboard().catch(() => null);

  if (dashboard === null) {
    return (
      <>
        <Topline section="Build / document / share" />
        <PageIntro kicker="Project studio" title="See projects in motion." description="Create a project and build with a team." />
        <section className="admin-member-error"><h2>The project studio is unavailable.</h2><p>Please refresh and try again.</p></section>
      </>
    );
  }

  const myProjects = dashboard.myProjects;
  const metrics = [
    { label: "My projects", value: myProjects.length, detail: "Projects you are building" },
    { label: "Active builds", value: myProjects.filter((project) => ["building", "prototype"].includes(project.build_stage)).length, detail: "Currently in motion" },
    { label: "Recruiting", value: myProjects.filter((project) => project.recruitment_mode === "open").length, detail: "Open to contributors" },
    { label: "Completed", value: myProjects.filter((project) => project.build_stage === "shipped").length, detail: "Shipped builds" },
  ];

  return (
    <>
      <Topline section="Build / document / share" />
      <header className="project-studio-hero">
        <div>
          <div className="eyebrow">Project studio</div>
          <h1>Build something real.</h1>
          <p>Create, collaborate, and move ideas from concept to something people can actually use.</p>
        </div>
        <div className="project-studio-note">
          <span className="eyebrow">Your workspace</span>
          <strong>Ideas become easier to ship together.</strong>
          <span>Keep the next step visible and the team moving.</span>
        </div>
      </header>
      <section className="project-studio-metrics" aria-label="Project studio metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span className="eyebrow">{metric.label}</span>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </div>
        ))}
      </section>

      <ProjectCreateForm />

      {myProjects.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <div><span className="eyebrow">In your orbit</span><h2>My projects</h2></div>
            <span className="project-count">{myProjects.length} {myProjects.length === 1 ? "project" : "projects"}</span>
          </div>
          <div className="project-studio-grid">
            {myProjects.map((project) => (
              <article className="project-studio-card" key={project.id}>
                <div className="project-card-accent" />
                <div className="project-card-topline">
                  <span className="badge-mark">{projectMonogram(project.title)}</span>
                  <div className="project-card-state">
                    <span className={`tag project-state-${project.publication_state}`}>{publicationLabels[project.publication_state]}</span>
                    <span className={`tag project-stage-${project.build_stage}`}>{buildStageLabels[project.build_stage]}</span>
                  </div>
                </div>
                <span className="eyebrow">{project.category}</span>
                <h3>{project.title}</h3>
                <p className="muted">{project.description || "A community project built by AWS ISLEC members."}</p>
                {project.technologies.length > 0 && <div className="project-tech-list" aria-label="Technologies">{project.technologies.slice(0, 4).map((technology) => <span key={technology}>{technology}</span>)}</div>}
                <div className="project-card-footer">
                  <span className="project-card-recruitment">{project.membership ? `Team ${project.membership.status === "completed" ? "completed" : "active"}` : "Team"} · {recruitmentLabels[project.recruitment_mode]}</span>
                  <Link href={`/member/projects/${project.id}`} className="section-action">Open workspace <span aria-hidden="true">→</span></Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {myProjects.length === 0 && (
        <div className="project-studio-empty">
          <span className="badge-mark">+</span>
          <div>
            <span className="eyebrow">Your next build starts here</span>
            <h2>Find a problem worth solving.</h2>
            <p className="muted">Explore community projects to find a build that fits your interests, or start one of your own.</p>
            <Link href="/member/explore" className="button">Explore community projects</Link>
          </div>
        </div>
      )}
    </>
  );
}
