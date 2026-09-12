import { PageIntro } from "@/components/cards/PageIntro";
import { ProjectCreateForm } from "@/components/member/ProjectCreateForm";
import { ProjectMembershipControl } from "@/components/member/ProjectMembershipControl";
import Link from "next/link";
import { Topline } from "@/components/ui/Topline";
import { getMemberProjects } from "@/lib/services/projects";

export default async function Projects() {
  const projects = await getMemberProjects().catch(() => null);

  if (projects === null) {
    return (
      <>
        <Topline section="Build / document / share" />
        <PageIntro kicker="Project studio" title="See projects in motion." description="Create a private draft, find published projects, and build with a team." />
        <section className="admin-member-error"><h2>The project studio is unavailable.</h2><p>Please refresh and try again.</p></section>
      </>
    );
  }

  // Split: projects where you are a member vs community projects you can discover
  const myProjects = projects.filter((p) => p.membership !== null);
  const communityProjects = projects.filter(
    (p) =>
      p.membership === null &&
      p.publication_state === "published" &&
      p.build_stage !== "shipped"
  );

  return (
    <>
      <Topline section="Build / document / share" />
      <PageIntro kicker="Project studio" title="See projects in motion." description="Create a private draft, find published projects, and build with a team." />

      <ProjectCreateForm />

      {myProjects.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <h2>Your projects</h2>
          </div>
          <div className="list">
            {myProjects.map((project) => (
              <article className="list-item" key={project.id}>
                <div>
                  <span className="eyebrow">{project.category} / {project.build_stage} / {project.publication_state}</span>
                  <strong>{project.title}</strong>
                  <p className="muted">{project.description}</p>
                  <Link href={`/member/projects/${project.id}`} className="section-action">Open workspace →</Link>
                </div>
                <ProjectMembershipControl
                  projectId={project.id}
                  membershipStatus={project.membership?.status ?? null}
                  joinRequestStatus={project.joinRequestStatus}
                  canRequest={false}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {communityProjects.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <h2>Community projects</h2>
            <span className="muted" style={{ fontSize: 13 }}>Published projects you can request to join</span>
          </div>
          <div className="list">
            {communityProjects.map((project) => (
              <article className="list-item" key={project.id}>
                <div>
                  <span className="eyebrow">{project.category} / {project.build_stage}</span>
                  <strong>{project.title}</strong>
                  <p className="muted">{project.description}</p>
                  <div className="project-tech-list" style={{ marginTop: 8 }}>
                    {project.technologies.map((tech) => <span key={tech}>{tech}</span>)}
                  </div>
                  <Link href={`/member/projects/${project.id}`} className="section-action" style={{ marginTop: 8, display: "inline-block" }}>View project →</Link>
                </div>
                <ProjectMembershipControl
                  projectId={project.id}
                  membershipStatus={project.membership?.status ?? null}
                  joinRequestStatus={project.joinRequestStatus}
                  canRequest={project.publication_state === "published" && project.recruitment_mode === "open"}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {myProjects.length === 0 && communityProjects.length === 0 && (
        <div className="panel">
          <h2>Nothing here yet.</h2>
          <p className="muted">Create your first project above, or published community projects will appear here once they exist.</p>
        </div>
      )}
    </>
  );
}
