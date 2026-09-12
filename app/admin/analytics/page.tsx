import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { getAdminAnalytics } from "@/lib/services/admin-analytics";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const analytics = await getAdminAnalytics();
  return <AdminAnalytics analytics={analytics} />;
}
