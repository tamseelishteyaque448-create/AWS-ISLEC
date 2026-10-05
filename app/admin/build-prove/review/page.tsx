import Link from "next/link";
import { BuildProveReviewQueue } from "@/components/admin/BuildProveReviewQueue";
import { PageIntro } from "@/components/cards/PageIntro";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminBuildProveReviewQueue } from "@/lib/services/build-prove";

function queueError() {
  return (
    <section className="admin-build-error" role="alert">
      <h2>The review queue is unavailable.</h2>
      <p>
        Refresh the page and try again. Your administrator access and database connection are
        checked on the server.
      </p>
      <Link className="button button-secondary" href="/admin/build-prove/review">Retry</Link>
    </section>
  );
}

export default async function AdminBuildProveReviewPage() {
  await requireAdmin();

  let items: Awaited<ReturnType<typeof getAdminBuildProveReviewQueue>> | null = null;
  try {
    items = await getAdminBuildProveReviewQueue();
  } catch {
    return (
      <>
        <PageIntro
          kicker="Admin workspace / Build & Prove"
          title="Review queue."
          description="Decide on submitted practical work across every domain."
        />
        {queueError()}
      </>
    );
  }

  return (
    <>
      <PageIntro
        kicker="Admin workspace / Build & Prove"
        title="Review queue."
        description="Decide on submitted practical work across every domain."
      />
      <div className="admin-build-page-actions">
        <Link className="button button-secondary" href="/admin/build-prove">Back to catalogue</Link>
      </div>
      {items ? <BuildProveReviewQueue items={items} /> : queueError()}
    </>
  );
}