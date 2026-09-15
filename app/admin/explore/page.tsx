import { PageIntro } from "@/components/cards/PageIntro";
import { AdminProjectExplore } from "@/components/admin/AdminProjectExplore";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminProjects } from "@/lib/services/projects";

export default async function AdminExplorePage() {
  await requireAdmin();
  const projects = await getAdminProjects().catch(() => null);

  return (
    <>
      <PageIntro
        kicker="Admin workspace / explore"
        title="See what members can discover."
        description="Preview the published project catalogue and confirm that approved work is visible to the community."
      />
      {projects ? <AdminProjectExplore projects={projects} /> : <section className="admin-member-error"><h2>Project discovery is unavailable.</h2><p>Please refresh and try again.</p></section>}
    </>
  );
}
