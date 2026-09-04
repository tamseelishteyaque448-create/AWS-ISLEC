import { LearningPathManagement } from "@/components/admin/LearningPathManagement";
import { PageIntro } from "@/components/cards/PageIntro";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminLearningPaths } from "@/lib/services/admin-learning";

export default async function AdminLearningPage() {
  await requireAdmin();
  const paths = await getAdminLearningPaths().catch(() => null);
  return <>
    <PageIntro kicker="Admin workspace / learning" title="Learning, made visible." description="Create focused paths and keep the member curriculum useful." />
    {paths ? <LearningPathManagement paths={paths} /> : <section className="admin-member-error"><h2>The learning catalogue is unavailable.</h2><p>Please refresh the page and try again.</p></section>}
  </>;
}
