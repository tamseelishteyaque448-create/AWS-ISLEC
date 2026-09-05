import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { getMemberProjects } from "@/lib/services/projects";

export default async function Explore() {
  const projects = await getMemberProjects().catch(() => null);
  return <><Topline section="Explore the community" /><PageIntro kicker="People / projects / ideas" title="See what is being built." description="Follow the threads, projects, and curious experiments moving through the community right now." />{projects === null ? <section className="admin-member-error"><h2>Community projects are unavailable.</h2><p>Please refresh the page and try again.</p></section> : projects.length === 0 ? <section className="admin-member-empty"><h2>No projects are available yet.</h2><p>Check back soon for the next community build.</p></section> : <div className="list">{projects.map((project) => <article className="list-item" key={project.id}><div><strong>{project.title}</strong><div className="muted">{project.category} / {project.status}</div></div><span className="tag">{project.progress}% complete</span></article>)}</div>}</>;
}
