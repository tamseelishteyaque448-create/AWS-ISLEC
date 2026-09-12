import {
  Activity,
  CalendarDays,
  GraduationCap,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Topline } from "@/components/ui/Topline";
import {
  ACTIVITY_TYPES,
  ADMIN_ACTIVITY_PAGE_SIZE,
  type AdminActivityResult,
  type ActivityType,
} from "@/lib/services/admin-activities";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString();
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABEL: Record<string, string> = {
  challenge: "Challenge",
  event: "Event",
  project: "Project",
  badge: "Badge",
  lesson: "Lesson",
};

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

function buildHref(page: number, typeFilter: ActivityType | ""): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (typeFilter) params.set("type", typeFilter);
  const qs = params.toString();
  return `/admin/activities${qs ? `?${qs}` : ""}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="admin-analytics-card">
      <span className="admin-analytics-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TypeFilterBar({
  current,
}: {
  current: ActivityType | "";
}) {
  const filters: Array<{ value: ActivityType | ""; label: string }> = [
    { value: "", label: "All types" },
    ...ACTIVITY_TYPES.map((t) => ({
      value: t as ActivityType,
      label: TYPE_LABEL[t] ?? t,
    })),
  ];
  return (
    <nav className="challenge-filters" aria-label="Filter activities by type">
      {filters.map((f) => (
        <Link
          key={f.value}
          href={buildHref(1, f.value)}
          className={`challenge-filters-link${current === f.value ? " active" : ""}`}
          aria-current={current === f.value ? "true" : undefined}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminActivityOverview({
  result,
  typeFilter,
}: {
  result: AdminActivityResult;
  typeFilter: ActivityType | "";
}) {
  const { activities, stats, total, page } = result;
  const lastPage = Math.max(Math.ceil(total / ADMIN_ACTIVITY_PAGE_SIZE), 1);
  const hasPrev = page > 1;
  const hasNext = page < lastPage;

  return (
    <>
      <Topline section="AWS ISLEC / Admin activities" />

      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="admin-hero" aria-labelledby="activity-page-title">
        <div>
          <div className="eyebrow">Community activity</div>
          <h1 id="activity-page-title">Activity, connected.</h1>
          <p className="hero-copy">
            A community-wide, read-only view of every member action —
            challenge completions, events, projects, badges, and lessons —
            ordered by recency.
          </p>
        </div>
        <aside className="admin-pulse-card" aria-label="Activity snapshot">
          <div className="admin-pulse-head">
            <span className="eyebrow">Community pulse</span>
            <span className="admin-live-dot">Live</span>
          </div>
          <strong>{fmt(stats.totalCount)}</strong>
          <p>total activities recorded</p>
          <div className="admin-pulse-breakdown">
            <span>
              <CalendarDays size={15} aria-hidden="true" />
              {fmt(stats.last30dCount)} last 30 days
            </span>
            <span>
              <UsersRound size={15} aria-hidden="true" />
              {fmt(stats.uniqueMemberCount)} members active
            </span>
          </div>
        </aside>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Summary stats grid                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-label="Activity summary statistics"
      >
        <div className="admin-analytics-grid">
          <StatCard
            icon={<Activity size={16} />}
            label="last 24 hours"
            value={fmt(stats.last24hCount)}
          />
          <StatCard
            icon={<Zap size={16} />}
            label="last 7 days"
            value={fmt(stats.last7dCount)}
          />
          <StatCard
            icon={<CalendarDays size={16} />}
            label="last 30 days"
            value={fmt(stats.last30dCount)}
          />
          <StatCard
            icon={<UsersRound size={16} />}
            label="members with activity"
            value={fmt(stats.uniqueMemberCount)}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Type breakdown                                                      */}
      {/* ------------------------------------------------------------------ */}
      {stats.totalCount > 0 ? (
        <section
          className="admin-analytics-section"
          aria-labelledby="activity-breakdown-title"
        >
          <div className="admin-directory panel">
            <div className="admin-directory-head">
              <div>
                <div className="eyebrow">Community intelligence</div>
                <h2 id="activity-breakdown-title">Activity by type</h2>
                <p>
                  All-time distribution across every recorded activity type.
                </p>
              </div>
              <span className="admin-directory-icon" aria-hidden="true">
                <GraduationCap size={18} />
              </span>
            </div>
            <div
              className="admin-analytics-breakdown-list"
              aria-label="Activity type breakdown"
              role="list"
            >
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    className="admin-analytics-breakdown-row"
                    key={type}
                    role="listitem"
                    aria-label={`${TYPE_LABEL[type] ?? type}: ${fmt(count)}`}
                  >
                    <span className="admin-analytics-breakdown-label">
                      {TYPE_LABEL[type] ?? type}
                    </span>
                    <div
                      className="admin-analytics-stage-bar-wrap"
                      role="meter"
                      aria-label={`${TYPE_LABEL[type] ?? type}: ${pct(count, stats.totalCount)}`}
                      aria-valuenow={count}
                      aria-valuemin={0}
                      aria-valuemax={stats.totalCount}
                    >
                      <div
                        className="admin-analytics-stage-bar"
                        style={{ width: pct(count, stats.totalCount) }}
                      />
                    </div>
                    <strong>{fmt(count)}</strong>
                    <span className="admin-analytics-breakdown-pct">
                      {pct(count, stats.totalCount)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Paged activity list                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-labelledby="activity-list-title"
      >
        <div className="admin-directory panel">
          <div className="admin-directory-head">
            <div>
              <div className="eyebrow">Community intelligence</div>
              <h2 id="activity-list-title">
                {typeFilter
                  ? `${TYPE_LABEL[typeFilter] ?? typeFilter} activity`
                  : "All activity"}
              </h2>
              <p>
                {fmt(total)}{" "}
                {typeFilter
                  ? `${TYPE_LABEL[typeFilter] ?? typeFilter} `
                  : ""}
                {total === 1 ? "record" : "records"} · page {page} of{" "}
                {lastPage}
              </p>
            </div>
          </div>

          <TypeFilterBar current={typeFilter} />

          {activities.length === 0 ? (
            <div className="admin-member-empty" role="status">
              <Activity size={24} aria-hidden="true" />
              <h3>No activity found.</h3>
              <p>
                {typeFilter
                  ? `No ${TYPE_LABEL[typeFilter] ?? typeFilter} activities have been recorded yet.`
                  : "No community activity has been recorded yet."}
              </p>
            </div>
          ) : (
            <div
              className="admin-event-list"
              role="list"
              aria-label="Community activity records"
            >
              {activities.map((row) => (
                <article
                  className="admin-activity-row"
                  key={row.id}
                  role="listitem"
                  aria-label={`${row.title} by ${row.memberName}`}
                >
                  <div className="admin-activity-type-tag">
                    <span
                      className={`tag admin-activity-type-${row.activityType}`}
                      aria-label={`Type: ${TYPE_LABEL[row.activityType] ?? row.activityType}`}
                    >
                      {TYPE_LABEL[row.activityType] ?? row.activityType}
                    </span>
                  </div>
                  <div className="admin-activity-content">
                    <strong>{row.title}</strong>
                    {row.detail ? (
                      <span className="muted">{row.detail}</span>
                    ) : null}
                    <span className="admin-activity-member">
                      <UsersRound size={12} aria-hidden="true" />
                      {row.memberName}
                      {row.memberHandle ? ` @${row.memberHandle}` : ""}
                    </span>
                  </div>
                  <div className="admin-activity-meta">
                    {row.points > 0 ? (
                      <span className="tag">+{fmt(row.points)} pts</span>
                    ) : null}
                    <time
                      dateTime={row.occurredAt}
                      className="admin-activity-time"
                    >
                      {fmtDate(row.occurredAt)}
                      <span>{fmtTime(row.occurredAt)}</span>
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}

          {lastPage > 1 ? (
            <nav
              className="admin-activity-pagination"
              aria-label="Activity pagination"
            >
              {hasPrev ? (
                <Link
                  href={buildHref(page - 1, typeFilter)}
                  className="button button-secondary"
                  aria-label="Previous page"
                >
                  ← Previous
                </Link>
              ) : (
                <span
                  className="button button-secondary admin-activity-disabled"
                  aria-disabled="true"
                >
                  ← Previous
                </span>
              )}
              <span
                className="admin-activity-page-info"
                aria-live="polite"
              >
                Page {page} of {lastPage}
              </span>
              {hasNext ? (
                <Link
                  href={buildHref(page + 1, typeFilter)}
                  className="button button-secondary"
                  aria-label="Next page"
                >
                  Next →
                </Link>
              ) : (
                <span
                  className="button button-secondary admin-activity-disabled"
                  aria-disabled="true"
                >
                  Next →
                </span>
              )}
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}
