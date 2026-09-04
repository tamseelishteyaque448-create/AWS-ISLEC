import { requireAdmin } from "@/lib/auth/admin";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
