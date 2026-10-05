import Link from "next/link";
import { PageIntro } from "@/components/cards/PageIntro";
import { BuildProveAdminCatalog, type BuildProveCatalogFilters } from "@/components/admin/BuildProveAdminCatalog";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminBuildProveOverview,
  getAdminBuildProveTasks,
  type BuildDomain,
  type BuildProvePublicationState,
  type BuildWorkStatus,
} from "@/lib/services/build-prove";

const domains: BuildDomain[] = [
  "innovation_research",
  "event_management",
  "media_design",
  "documentation",
];
const publicationStates: BuildProvePublicationState[] = ["draft", "published", "archived"];
const workStatuses: BuildWorkStatus[] = [
  "assigned",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "approved",
  "cancelled",
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function catalogueError() {
  return <section className="admin-build-error" role="alert">
    <h2>Build &amp; Prove data is unavailable.</h2>
    <p>Refresh the page and try again. Your administrator access and database connection are checked on the server.</p>
    <Link className="button button-secondary" href="/admin/build-prove">Retry</Link>
  </section>;
}

export default async function AdminBuildProvePage({
  searchParams,
}: PageProps<"/admin/build-prove">) {
  await requireAdmin();
  const params = await searchParams;
  const domainValue = first(params.domain);
  const publicationValue = first(params.publicationState);
  const statusValue = first(params.status);
  const search = first(params.search)?.slice(0, 80);
  const overdueValue = first(params.overdue);
  const filters: BuildProveCatalogFilters = {
    domain: domains.includes(domainValue as BuildDomain) ? domainValue as BuildDomain : undefined,
    publicationState: publicationStates.includes(publicationValue as BuildProvePublicationState)
      ? publicationValue as BuildProvePublicationState
      : undefined,
    status: workStatuses.includes(statusValue as BuildWorkStatus) ? statusValue as BuildWorkStatus : undefined,
    search,
    overdue: overdueValue === "true" ? true : overdueValue === "false" ? false : undefined,
  };

  let result: Awaited<ReturnType<typeof getAdminBuildProveOverview>> | null = null;
  let tasks: Awaited<ReturnType<typeof getAdminBuildProveTasks>> | null = null;
  try {
    [result, tasks] = await Promise.all([
      getAdminBuildProveOverview(),
      getAdminBuildProveTasks({
        ...filters,
        page: pageNumber(params.page),
        pageSize: 20,
      }),
    ]);
  } catch {
    return <>
      <PageIntro kicker="Admin workspace / Build & Prove" title="Build & Prove, in motion." description="Manage internal work across the four AWS ISLEC domains." />
      {catalogueError()}
    </>;
  }

  return <>
    <PageIntro kicker="Admin workspace / Build & Prove" title="Build & Prove, in motion." description="Manage internal work across the four AWS ISLEC domains." />
    {result && tasks ? <BuildProveAdminCatalog overview={result} page={tasks} filters={filters} /> : catalogueError()}
  </>;
}
