import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminAchievementsPage() {
  await requireAdmin();
  return <AdminPlaceholder title="Achievements, recognized." description="Badge and achievement administration will live here." />;
}
