import { PageIntro } from "@/components/cards/PageIntro";
import { ProjectManagement } from "@/components/admin/ProjectManagement";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminProjects } from "@/lib/services/projects";
export default async function AdminProjectsPage() { await requireAdmin(); const projects = await getAdminProjects().catch(() => null); return <><PageIntro kicker="Admin workspace / projects" title="Projects, thoughtfully run." description="Publish work, review team access, and keep project outcomes authoritative." />{projects ? <ProjectManagement projects={projects} /> : <section className="admin-member-error"><h2>The project studio is unavailable.</h2><p>Please refresh and try again.</p></section>}</>; }
