import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProjectBySlug } from "@/lib/services/projects";

export default async function PublicProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getPublicProjectBySlug(slug).catch(() => null);
  if (!project) notFound();
  return <section className="projects-section"><div className="eyebrow">{project.category} / {project.build_stage}</div><h1>{project.title}</h1><p className="muted">{project.description}</p><div className="project-tech-list">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div><p className="muted">Recruitment: {project.recruitment_mode.replace("_", " ")}{project.team_capacity ? ` · team capacity ${project.team_capacity}` : ""}</p>{project.repository_url ? <p><a href={project.repository_url} rel="noreferrer">Repository</a></p> : null}{project.demo_url ? <p><a href={project.demo_url} rel="noreferrer">Live demo</a></p> : null}<Link className="button" href="/member/projects">View in project studio</Link></section>;
}
