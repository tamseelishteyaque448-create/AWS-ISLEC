import { PageIntro } from "@/components/cards/PageIntro";
import { ProjectCreateForm } from "@/components/member/ProjectCreateForm";
import { ProjectMembershipControl } from "@/components/member/ProjectMembershipControl";
import Link from "next/link";
import { Topline } from "@/components/ui/Topline";
import { getMemberProjectsDashboard } from "@/lib/services/projects";

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

  return (
    <>
      <Topline section="Build / document / share" />
      <PageIntro kicker="Project studio" title="See projects in motion." description="Create a project and build with a team." />

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

      {myProjects.length === 0 && (
        <div className="panel">
          <h2>You haven&apos;t joined a project yet.</h2>
          <p className="muted">Explore community projects to find a build that fits your interests.</p>
          <Link href="/member/explore" className="button">Explore community projects</Link>
        </div>
      )}
    </>
  );
}
