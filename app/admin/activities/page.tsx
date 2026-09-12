import { AdminActivityOverview } from "@/components/admin/AdminActivityOverview";
import { PageIntro } from "@/components/cards/PageIntro";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminActivities,
  getActivityPage,
  getActivityTypeFilter,
} from "@/lib/services/admin-activities";

export default async function AdminActivitiesPage({
  searchParams,
}: PageProps<"/admin/activities">) {
  await requireAdmin();
  const params = await searchParams;
  const page = getActivityPage(params.page);
  const typeFilter = getActivityTypeFilter(params.type);

  const result = await getAdminActivities({ page, typeFilter }).catch(
    () => null,
  );

  if (!result) {
    return (
      <>
        <PageIntro
          kicker="Admin workspace / activities"
          title="Activity, connected."
          description="A community-wide activity view for administrators."
        />
        <section className="admin-member-error">
          <h2>The activity log is unavailable.</h2>
          <p>Please refresh the page and try again.</p>
        </section>
      </>
    );
  }

  return <AdminActivityOverview result={result} typeFilter={typeFilter} />;
}
