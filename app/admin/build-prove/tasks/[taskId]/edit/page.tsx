import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/cards/PageIntro";
import { BuildProveTaskForm } from "@/components/admin/BuildProveTaskForm";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminBuildProveTaskDetail } from "@/lib/services/build-prove";

export default async function EditBuildProveTaskPage({
  params,
}: PageProps<"/admin/build-prove/tasks/[taskId]/edit">) {
  await requireAdmin();
  const { taskId } = await params;
  const detail = await getAdminBuildProveTaskDetail(taskId);
  if (!detail) notFound();

  return <>
    <PageIntro kicker="Admin workspace / Build & Prove" title="Edit task." description="Update the existing task definition without replacing its identity or work history." />
    <div className="admin-build-page-actions">
      <Link className="button button-secondary" href={`/admin/build-prove/tasks/${detail.task.id}`}>Back to task</Link>
    </div>
    <BuildProveTaskForm task={detail.task} />
  </>;
}
