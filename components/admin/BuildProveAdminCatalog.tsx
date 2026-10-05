import Link from "next/link";
import type { ReactNode } from "react";
import type {
  BuildDomain,
  BuildProveAdminOverview,
  BuildProveAdminTaskListItem,
  BuildProvePublicationState,
  BuildProvePage,
  BuildWorkStatus,
} from "@/lib/services/build-prove";

const domainLabels: Record<BuildDomain, string> = {
  innovation_research: "Innovation & Research",
  event_management: "Event Management",
  media_design: "Media & Design",
  documentation: "Documentation",
};
const workStatuses: BuildWorkStatus[] = [
  "assigned",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "approved",
  "cancelled",
];
const statusLabels: Record<BuildWorkStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  cancelled: "Cancelled",
};

export type BuildProveCatalogFilters = {
  domain?: BuildDomain;
  publicationState?: BuildProvePublicationState;
  status?: BuildWorkStatus;
  search?: string;
  overdue?: boolean;
};

function hrefFor(filters: BuildProveCatalogFilters) {
  const params = new URLSearchParams();
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.publicationState) params.set("publicationState", filters.publicationState);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.overdue !== undefined) params.set("overdue", String(filters.overdue));
  const query = params.toString();
  return query ? `/admin/build-prove?${query}` : "/admin/build-prove";
}

function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))
    : "No deadline";
}

function Metric({
  label,
  value,
  href,
  detail,
}: {
  label: string;
  value: number;
  href?: string;
  detail?: ReactNode;
}) {
  const content = <>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail ? <small>{detail}</small> : null}
  </>;
  return href
    ? <Link className="admin-build-metric" href={href}>{content}<span className="admin-build-metric-link">View catalogue</span></Link>
    : <article className="admin-build-metric">{content}</article>;
}

export function BuildProveAdminCatalog({
  overview,
  page,
  filters,
}: {
  overview: BuildProveAdminOverview;
  page: BuildProvePage<BuildProveAdminTaskListItem>;
  filters: BuildProveCatalogFilters;
}) {
  const pageHref = (nextPage: number) => {
    const href = hrefFor(filters);
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    params.set("page", String(nextPage));
    return `/admin/build-prove?${params.toString()}`;
  };
  const submittedLink = hrefFor({ ...filters, status: "submitted" });
  const resubmittedLink = hrefFor({ ...filters, status: "resubmitted" });

  return <div className="admin-build-prove">
    <section className="admin-build-overview" aria-labelledby="build-prove-overview-title">
      <div className="admin-build-section-heading">
        <div className="eyebrow">Operational overview</div>
        <h2 id="build-prove-overview-title">Work, at a glance.</h2>
        <p>Live counts from Build &amp; Prove assignments and member work items.</p>
      </div>
      <div className="admin-build-metrics">
        <Metric label="Total tasks" value={overview.totalTasks} />
        <Metric label="Published tasks" value={overview.publishedTasks} href={hrefFor({ publicationState: "published" })} />
        <Metric label="Unpublished tasks" value={overview.unpublishedTasks} href={hrefFor({ publicationState: "draft" })} detail={`${overview.draftTasks} drafts · ${overview.archivedTasks} archived`} />
        <Metric label="Assigned work" value={overview.assignedWorkItems} href={hrefFor({ status: "assigned" })} />
        <Metric label="Submitted / resubmitted" value={overview.submittedWorkItems} detail={<>{overview.reviewQueueCount} awaiting review · <Link href={submittedLink}>submitted</Link> · <Link href={resubmittedLink}>resubmitted</Link></>} />
        <Metric label="Changes requested" value={overview.changesRequested} href={hrefFor({ status: "changes_requested" })} />
        <Metric label="Approved work" value={overview.approved} href={hrefFor({ status: "approved" })} />
        <Metric label="Cancelled work" value={overview.cancelledWorkItems} href={hrefFor({ status: "cancelled" })} />
        <Metric label="Overdue work" value={overview.overdue} href={hrefFor({ overdue: true })} />
      </div>
    </section>

    <section className="admin-build-catalog" aria-labelledby="build-prove-catalog-title">
      <div className="admin-build-catalog-header">
        <div className="admin-build-section-heading">
          <div className="eyebrow">Task catalogue</div>
          <h2 id="build-prove-catalog-title">Tasks to manage.</h2>
          <p>Browse, publish, and maintain work across the four AWS ISLEC domains.</p>
        </div>
        <div className="admin-build-page-actions">
          <Link className="button button-secondary" href="/admin/build-prove/review">Review queue</Link>
          <Link className="button" href="/admin/build-prove/tasks/new">Create task</Link>
        </div>
      </div>

      <form className="admin-build-filters" method="get">
        <label>Domain
          <select name="domain" defaultValue={filters.domain ?? ""}>
            <option value="">All domains</option>
            {Object.entries(domainLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>Publication
          <select name="publicationState" defaultValue={filters.publicationState ?? ""}>
            <option value="">All publication states</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>Work status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Any work status</option>
            {workStatuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        <label>Overdue
          <select name="overdue" defaultValue={filters.overdue === undefined ? "" : String(filters.overdue)}>
            <option value="">Any deadline state</option>
            <option value="true">Overdue only</option>
            <option value="false">Not overdue</option>
          </select>
        </label>
        <label className="admin-build-filter-search">Search
          <input name="search" type="search" maxLength={80} defaultValue={filters.search ?? ""} placeholder="Task title or description" />
        </label>
        <button className="button button-secondary" type="submit">Apply filters</button>
        <Link className="admin-build-clear-filter" href="/admin/build-prove">Clear</Link>
      </form>

      {page.items.length === 0
        ? <div className="admin-build-empty"><h3>No tasks match these filters.</h3><p>Change the filters or create a task for this workflow.</p></div>
        : <div className="admin-build-task-list">{page.items.map(({ task, assignedMemberCount, statusCounts, overdueMemberCount }) =>
          <article className="admin-build-task-row" key={task.id}>
            <div className="admin-build-task-main">
              <div className="admin-build-badges">
                <span className="admin-build-badge domain">{domainLabels[task.domain]}</span>
                <span className={`admin-build-badge publication ${task.publicationState}`}>{task.publicationState}</span>
                <span className={`admin-build-badge priority ${task.priority}`}>{task.priority}</span>
              </div>
              <h3><Link href={`/admin/build-prove/tasks/${task.id}`}>{task.title}</Link></h3>
              <p>{task.summary || "No description provided."}</p>
              <div className="admin-build-task-facts">
                <span>Due {dateLabel(task.deadlineAt)}</span>
                <span>{task.rewardPoints} reward points</span>
                <span>{assignedMemberCount} member{assignedMemberCount === 1 ? "" : "s"} assigned</span>
                {overdueMemberCount ? <span className="overdue">{overdueMemberCount} overdue</span> : null}
              </div>
              <div className="admin-build-status-counts" aria-label="Work item status totals">
                {workStatuses.filter((status) => statusCounts[status] > 0).map((status) =>
                  <span className={`admin-build-status ${status}`} key={status}>
                    {statusLabels[status]} <strong>{statusCounts[status]}</strong>
                  </span>)}
                {assignedMemberCount === 0 ? <span className="admin-build-status">No assigned work</span> : null}
              </div>
            </div>
            <Link className="button button-secondary" href={`/admin/build-prove/tasks/${task.id}`}>Manage task</Link>
          </article>)}</div>}

      <div className="admin-build-pagination" aria-label="Catalogue pagination">
        <span>{page.total} task{page.total === 1 ? "" : "s"} · page {page.page}</span>
        <div>
          {page.page > 1 ? <Link className="button button-secondary" href={pageHref(page.page - 1)}>Previous</Link> : null}
          {page.page * page.pageSize < page.total ? <Link className="button button-secondary" href={pageHref(page.page + 1)}>Next</Link> : null}
        </div>
      </div>
    </section>
  </div>;
}
