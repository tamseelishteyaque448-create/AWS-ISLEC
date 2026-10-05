import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildProveTaskOperations } from "@/components/admin/BuildProveTaskOperations";
import { PageIntro } from "@/components/cards/PageIntro";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminBuildProveAssignableMembers,
  getAdminBuildProveTaskDetail,
} from "@/lib/services/build-prove";

export default async function AdminBuildProveTaskPage({
  params,
  searchParams,
}: PageProps<"/admin/build-prove/tasks/[taskId]">) {
  await requireAdmin();
  const [{ taskId }, query] = await Promise.all([params, searchParams]);
  const detail = await getAdminBuildProveTaskDetail(taskId);
  if (!detail) notFound();
  const assignableMembers = await getAdminBuildProveAssignableMembers(taskId);
  const notice = query.created === "1"
    ? "Task created and saved."
    : query.saved === "1"
      ? "Task changes saved."
      : null;

  return <>
    <PageIntro kicker="Admin workspace / Build & Prove" title="Task operations." description="Review the task definition, assignment status, and private reference materials." />
    <div className="admin-build-page-actions">
      <Link className="button button-secondary" href="/admin/build-prove">Back to catalogue</Link>
      <Link className="button button-secondary" href={`/admin/build-prove/tasks/${taskId}/edit`}>Edit task</Link>
      <Link className="button button-secondary" href="/admin/build-prove/review">Review queue</Link>
    </div>
    {notice ? <p className="admin-build-notice" role="status">{notice}</p> : null}
    <BuildProveTaskOperations
      task={detail.task}
      referenceAttachments={detail.referenceAttachments}
      members={detail.members}
      assignableMembers={assignableMembers}
    />
  </>;
}
