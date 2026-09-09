import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLeaderboardPage() {
  await requireAdmin();
  return <AdminPlaceholder title="Leaderboard, understood." description="Community momentum and recognition tools will live here." />;
}
