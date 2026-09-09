import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminActivitiesPage() {
  await requireAdmin();
  return <AdminPlaceholder title="Activity, connected." description="A community-wide activity view and moderation tools will live here." />;
}
