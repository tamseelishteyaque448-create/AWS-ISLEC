import { AdminOverview } from "@/components/admin/AdminOverview";
import { getAdminCommunityOverview } from "@/lib/services/community";

export default async function AdminPage() {
  const overview = await getAdminCommunityOverview();
  return <AdminOverview overview={overview} />;
}
