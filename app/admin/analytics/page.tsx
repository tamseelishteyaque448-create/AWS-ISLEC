import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  return <AdminPlaceholder title="Analytics, with context." description="Community health and programme insights will live here." />;
}
