import { EventManagement } from "@/components/admin/EventManagement";
import { PageIntro } from "@/components/cards/PageIntro";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminEvents } from "@/lib/services/admin-events";

export default async function AdminEventsPage() {
  await requireAdmin();
  const events = await getAdminEvents().catch(() => null);
  return <>
    <PageIntro kicker="Admin workspace / events" title="Events, thoughtfully run." description="Create, schedule, and keep the community calendar current." />
    {events ? <EventManagement events={events} /> : <section className="admin-member-error"><h2>The event calendar is unavailable.</h2><p>Please refresh the page and try again.</p></section>}
  </>;
}
