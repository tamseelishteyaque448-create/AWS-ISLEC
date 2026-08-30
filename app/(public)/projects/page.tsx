import Link from "next/link";
import { ArrowRight, Code2, FolderPlus, GitPullRequest, UsersRound } from "lucide-react";
import { mockRepository } from "@/lib/services";

const projectSteps = [
  { number: "01", title: "Start with a useful question", detail: "Choose a problem, a curiosity, or a corner of the cloud you want to understand better." },
  { number: "02", title: "Build the smallest honest version", detail: "Make something you can run, test, and explain—then let the next iteration teach you." },
  { number: "03", title: "Share the trail", detail: "Document the decisions, ask for feedback, and make your work a starting point for someone else." },
];

export default function ProjectsPage() {
  const projects = mockRepository.getProjects();
  const activeProjects = projects.filter((project) => project.status === "In progress");
  const shippedProjects = projects.filter((project) => project.status === "Shipped");

  return <>
    <section className="projects-hero">
      <div>
        <div className="eyebrow">The AWS ISLEC project studio</div>
        <h1>Make a thing.<br />Leave a <span>trail.</span></h1>
        <p>Projects are where a fresh concept becomes a real capability. See what the community is building, find a thread to join, and turn your next learning path into work you can share.</p>
        <div className="hero-actions"><Link className="button" href="/member/projects">Explore project studio <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-secondary" href="/member/learn">Find a starting path</Link></div>
      </div>
      <aside className="projects-snapshot" aria-label="Project community snapshot">
        <div className="projects-snapshot-top"><div><div className="eyebrow">Built in the open</div><strong>{projects.length} projects<br />in the studio</strong></div><Code2 size={25} aria-hidden="true" /></div>
        <div className="projects-snapshot-stats"><div><strong>{activeProjects.length}</strong><span>in active<br />build mode</span></div><div><strong>{shippedProjects.length}</strong><span>ready to<br />learn from</span></div></div>
        <p>Every project begins with a first imperfect version. That is exactly the point.</p>
      </aside>
    </section>

    <section className="projects-section" aria-labelledby="active-title">
      <div className="projects-section-heading"><div><div className="eyebrow">In the works</div><h2 id="active-title">Ideas with some momentum.</h2></div><p>Follow the build as it takes shape. The useful parts are often the choices, revisions, and questions along the way.</p></div>
      <div className="project-showcase-grid">{activeProjects.map((project) => <article className="project-showcase-card" key={project.title}><div className="project-card-head"><span className="project-category"><Code2 size={16} aria-hidden="true" />{project.category}</span><span className="tag">{project.status}</span></div><h3>{project.title}</h3><p>{project.description}</p><div className="project-tech-list">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div><div className="project-progress-row"><span>Build progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${project.progress}%` }} /></div><div className="project-card-foot"><div className="project-contributors" aria-label={`${project.contributors.length} contributors`}>{project.contributors.map((contributor) => <span key={contributor}>{contributor}</span>)}<small>{project.contributors.length} contributors</small></div><Link href="/member/projects" aria-label={`Follow ${project.title}`}>Follow the build <ArrowRight size={15} aria-hidden="true" /></Link></div></article>)}</div>
    </section>

    <section className="projects-section projects-shipped" aria-labelledby="shipped-title">
      <div className="projects-section-heading"><div><div className="eyebrow">Made to be useful</div><h2 id="shipped-title">Finished is a beginning, too.</h2></div><Link className="section-action" href="/member/projects">See all project work <ArrowRight size={14} aria-hidden="true" /></Link></div>
      <div className="shipped-project-list">{shippedProjects.map((project) => <article key={project.title}><div className="shipped-project-icon"><GitPullRequest size={20} aria-hidden="true" /></div><div className="shipped-project-copy"><span className="eyebrow">{project.category} / {project.status}</span><h3>{project.title}</h3><p>{project.description}</p><div className="project-tech-list">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div></div><div className="project-contributors" aria-label={`${project.contributors.length} contributors`}>{project.contributors.map((contributor) => <span key={contributor}>{contributor}</span>)}</div></article>)}</div>
    </section>

    <section className="projects-section projects-process" aria-labelledby="process-title">
      <div className="projects-section-heading"><div><div className="eyebrow">Your next project</div><h2 id="process-title">Start before you feel ready.</h2></div><p>A project does not need to be grand to be meaningful. It needs a question, an honest first version, and a little momentum.</p></div>
      <div className="project-steps">{projectSteps.map((step) => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.detail}</p></article>)}</div>
    </section>

    <section className="projects-cta" aria-labelledby="cta-title"><div><div className="eyebrow">There is room on the board</div><h2 id="cta-title">Bring a question. Find your people. Build in public.</h2></div><div><Link className="button" href="/join">Join the community <UsersRound size={16} aria-hidden="true" /></Link><Link className="projects-cta-link" href="/member/projects">Start a project <FolderPlus size={16} aria-hidden="true" /></Link></div></section>
  </>;
}
