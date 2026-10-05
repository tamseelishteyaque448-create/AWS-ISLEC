import Link from "next/link";
import { PageIntro } from "@/components/cards/PageIntro";
import { BuildProveTaskForm } from "@/components/admin/BuildProveTaskForm";
import { requireAdmin } from "@/lib/auth/admin";

export default async function NewBuildProveTaskPage() {
  await requireAdmin();
  return <>
    <PageIntro kicker="Admin workspace / Build & Prove" title="Create a task." description="Define the work, expectations, and publication state before assigning members." />
    <div className="admin-build-page-actions">
      <Link className="button button-secondary" href="/admin/build-prove">Back to catalogue</Link>
    </div>
    <BuildProveTaskForm />
  </>;
}
