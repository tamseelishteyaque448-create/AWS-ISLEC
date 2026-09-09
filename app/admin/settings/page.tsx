import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminSettingsPage() {
  await requireAdmin();
  return <AdminPlaceholder title="Settings, with care." description="Administrative preferences and workspace configuration will live here." />;
}
