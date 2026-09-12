import {
  Activity,
  Award,
  BarChart3,
  CalendarDays,
  FolderKanban,
  GraduationCap,
  TrendingUp,
  UsersRound,
  Zap,
} from "lucide-react";
import { Topline } from "@/components/ui/Topline";
import type { AdminAnalytics } from "@/lib/services/admin-analytics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number): string {
  return value.toLocaleString();
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

const STAGE_LABEL: Record<string, string> = {
  idea:      "Idea",
  building:  "Building",
  prototype: "Prototype",
  shipped:   "Shipped",
};

const ACTIVITY_LABEL: Record<string, string> = {
  challenge: "Challenges",
  event:     "Events",
  badge:     "Badges",
  project:   "Projects",
  lesson:    "Lessons",
  other:     "Other",
};

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function SectionHead({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="admin-directory-head">
      <div>
        <div className="eyebrow">Community intelligence</div>
        <h2 id={`analytics-${title.toLowerCase().replace(/\s+/g, "-")}`}>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <span className="admin-directory-icon" aria-hidden="true">{icon}</span>
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-analytics-metric-row">
      <span className="admin-analytics-metric-label">{label}</span>
      <div>
        <strong>{value}</strong>
        {sub ? <span className="admin-analytics-metric-sub">{sub}</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminAnalytics({ analytics }: { analytics: AdminAnalytics }) {
  const {
    memberCount,
    activeMemberCount,
    avgPointsPerMember,
    maxStreak,
    completionCount,
    distinctCompleters,
    challengePointsAwarded,
    badgeAwardCount,
    badgePointsRecorded,
    totalEventCount,
    upcomingEventCount,
    totalRegistrations,
    recentRegistrations,
    publishedProjectCount,
    projectsByStage,
    openRecruitmentCount,
    pendingReviewCount,
    recentActivityCount,
    activityBreakdown,
    topMembers,
  } = analytics;

  const activePct = pct(activeMemberCount, memberCount);
  const learnerPct = pct(distinctCompleters, memberCount);

  return (
    <>
      <Topline section="AWS ISLEC / Admin analytics" />

      {/* ------------------------------------------------------------------ */}
      {/* Hero summary                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="admin-hero" aria-labelledby="analytics-hero-title">
        <div>
          <div className="eyebrow">Community pulse</div>
          <h1 id="analytics-hero-title">Intelligence you can act on.</h1>
          <p className="hero-copy">
            Live snapshot of member engagement, learning outcomes, event participation,
            and project momentum — all from authoritative, real-time sources.
          </p>
        </div>
        <aside className="admin-pulse-card" aria-label="Current operations summary">
          <div className="admin-pulse-head">
            <span className="eyebrow">Last 30 days</span>
            <span className="admin-live-dot">Live snapshot</span>
          </div>
          <strong>{fmt(recentActivityCount)}</strong>
          <p>activities recorded across the community</p>
          <div className="admin-pulse-breakdown">
            <span><UsersRound size={15} aria-hidden="true" />{activePct} active members</span>
            <span><GraduationCap size={15} aria-hidden="true" />{fmt(activityBreakdown.challenge)} completions</span>
          </div>
        </aside>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Top-line metrics grid                                               */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="grid admin-metrics"
        aria-label="Top-line community metrics"
      >
        <div className="panel">
          <h2>Members</h2>
          <div className="metric">{fmt(memberCount)}</div>
          <div className="muted">{activePct} active in the last 30 days</div>
        </div>
        <div className="panel">
          <h2>Challenge completions</h2>
          <div className="metric">{fmt(completionCount)}</div>
          <div className="muted">{learnerPct} of members have completed at least one</div>
        </div>
        <div className="panel">
          <h2>Event registrations</h2>
          <div className="metric">{fmt(totalRegistrations)}</div>
          <div className="muted">{fmt(recentRegistrations)} in the last 30 days</div>
        </div>
        <div className="panel">
          <h2>Published projects</h2>
          <div className="metric">{fmt(publishedProjectCount)}</div>
          <div className="muted">{fmt(openRecruitmentCount)} open for recruitment</div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Member community health                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-labelledby="analytics-community-health"
      >
        <div className="admin-directory panel">
          <SectionHead
            icon={<UsersRound size={18} />}
            title="Community health"
            subtitle="Engagement depth and point momentum across the full member base."
          />

          <div className="admin-analytics-grid" aria-label="Community health metrics">
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><UsersRound size={16} /></span>
              <strong>{fmt(memberCount)}</strong>
              <span>total members</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><Activity size={16} /></span>
              <strong>{fmt(activeMemberCount)}</strong>
              <span>active last 30 days</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><TrendingUp size={16} /></span>
              <strong>{fmt(avgPointsPerMember)}</strong>
              <span>avg points per member</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><Zap size={16} /></span>
              <strong>{fmt(maxStreak)}</strong>
              <span>longest active streak</span>
            </div>
          </div>

          {topMembers.length > 0 ? (
            <div className="admin-analytics-top-members" aria-label="Top members by points">
              <div className="admin-analytics-sub-head">
                <span className="eyebrow">Top members by points</span>
              </div>
              <div className="admin-event-list" role="list">
                {topMembers.map((member, index) => (
                  <article
                    className="admin-analytics-member-row"
                    key={member.id}
                    role="listitem"
                    aria-label={`${member.fullName} — ${fmt(member.points)} points`}
                  >
                    <span className="admin-analytics-rank" aria-hidden="true">
                      #{index + 1}
                    </span>
                    <div>
                      <strong>{member.fullName}</strong>
                      <span>@{member.handle}</span>
                    </div>
                    <div className="admin-analytics-member-stats">
                      <span><strong>{fmt(member.points)}</strong> pts</span>
                      <span><strong>{fmt(member.streak)}</strong> streak</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Learning outcomes                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-labelledby="analytics-learning-outcomes"
      >
        <div className="admin-directory panel">
          <SectionHead
            icon={<GraduationCap size={18} />}
            title="Learning outcomes"
            subtitle="Challenge completion and badge award history from the member workspace."
          />

          <div className="admin-outcome-metrics" aria-label="Learning outcome totals">
            <div>
              <GraduationCap size={16} aria-hidden="true" />
              <strong>{fmt(completionCount)}</strong>
              <span>total completions</span>
            </div>
            <div>
              <UsersRound size={16} aria-hidden="true" />
              <strong>{fmt(distinctCompleters)}</strong>
              <span>members completed</span>
            </div>
            <div>
              <TrendingUp size={16} aria-hidden="true" />
              <strong>{fmt(challengePointsAwarded)}</strong>
              <span>challenge points awarded</span>
            </div>
          </div>

          {badgeAwardCount > 0 ? (
            <div className="admin-analytics-detail-row">
              <MetricRow
                label="Badge awards"
                value={fmt(badgeAwardCount)}
                sub={`${fmt(badgePointsRecorded)} badge pts recorded`}
              />
              <MetricRow
                label="Completion rate"
                value={learnerPct}
                sub={`${fmt(distinctCompleters)} of ${fmt(memberCount)} members`}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Event engagement                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-labelledby="analytics-event-engagement"
      >
        <div className="admin-directory panel">
          <SectionHead
            icon={<CalendarDays size={18} />}
            title="Event engagement"
            subtitle="Registration and participation signals across all published events."
          />

          <div className="admin-analytics-grid" aria-label="Event engagement metrics">
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><CalendarDays size={16} /></span>
              <strong>{fmt(totalEventCount)}</strong>
              <span>published events</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><CalendarDays size={16} /></span>
              <strong>{fmt(upcomingEventCount)}</strong>
              <span>upcoming events</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><UsersRound size={16} /></span>
              <strong>{fmt(totalRegistrations)}</strong>
              <span>total registrations</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><Activity size={16} /></span>
              <strong>{fmt(recentRegistrations)}</strong>
              <span>registrations last 30 days</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Project pipeline                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-labelledby="analytics-project-pipeline"
      >
        <div className="admin-directory panel">
          <SectionHead
            icon={<FolderKanban size={18} />}
            title="Project pipeline"
            subtitle="Published project distribution by build stage and recruitment status."
          />

          <div className="admin-analytics-grid" aria-label="Project pipeline metrics">
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><FolderKanban size={16} /></span>
              <strong>{fmt(publishedProjectCount)}</strong>
              <span>published projects</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><UsersRound size={16} /></span>
              <strong>{fmt(openRecruitmentCount)}</strong>
              <span>open for recruitment</span>
            </div>
            <div className="admin-analytics-card">
              <span className="admin-analytics-icon" aria-hidden="true"><BarChart3 size={16} /></span>
              <strong>{fmt(pendingReviewCount)}</strong>
              <span>pending publication review</span>
            </div>
          </div>

          {publishedProjectCount > 0 ? (
            <div
              className="admin-analytics-stage-list"
              aria-label="Projects by build stage"
            >
              <div className="admin-analytics-sub-head">
                <span className="eyebrow">By build stage</span>
              </div>
              {(["idea", "building", "prototype", "shipped"] as const).map((stage) => {
                const count = projectsByStage[stage];
                return (
                  <div className="admin-analytics-stage-row" key={stage}>
                    <span>{STAGE_LABEL[stage]}</span>
                    <div
                      className="admin-analytics-stage-bar-wrap"
                      role="meter"
                      aria-label={`${STAGE_LABEL[stage]}: ${fmt(count)} of ${fmt(publishedProjectCount)}`}
                      aria-valuenow={count}
                      aria-valuemin={0}
                      aria-valuemax={publishedProjectCount}
                    >
                      <div
                        className="admin-analytics-stage-bar"
                        style={{ width: pct(count, publishedProjectCount) }}
                      />
                    </div>
                    <strong>{fmt(count)}</strong>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Activity breakdown                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="admin-analytics-section"
        aria-labelledby="analytics-activity-breakdown"
      >
        <div className="admin-directory panel">
          <SectionHead
            icon={<BarChart3 size={18} />}
            title="Activity breakdown"
            subtitle={`${fmt(recentActivityCount)} activities recorded across the community in the last 30 days.`}
          />

          {recentActivityCount === 0 ? (
            <div className="admin-member-empty" role="status">
              <Activity size={24} aria-hidden="true" />
              <h3>No activity in the last 30 days.</h3>
              <p>Member activity will appear here once challenges are completed, events are attended, or projects are updated.</p>
            </div>
          ) : (
            <div
              className="admin-analytics-breakdown-list"
              aria-label="Activity type breakdown"
              role="list"
            >
              {Object.entries(activityBreakdown)
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    className="admin-analytics-breakdown-row"
                    key={type}
                    role="listitem"
                    aria-label={`${ACTIVITY_LABEL[type] ?? type}: ${fmt(count)}`}
                  >
                    <span className="admin-analytics-breakdown-label">
                      {ACTIVITY_LABEL[type] ?? type}
                    </span>
                    <div
                      className="admin-analytics-stage-bar-wrap"
                      role="meter"
                      aria-label={`${ACTIVITY_LABEL[type] ?? type}: ${pct(count, recentActivityCount)}`}
                      aria-valuenow={count}
                      aria-valuemin={0}
                      aria-valuemax={recentActivityCount}
                    >
                      <div
                        className="admin-analytics-stage-bar"
                        style={{ width: pct(count, recentActivityCount) }}
                      />
                    </div>
                    <strong>{fmt(count)}</strong>
                    <span className="admin-analytics-breakdown-pct">
                      {pct(count, recentActivityCount)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {badgeAwardCount > 0 ? (
            <p className="admin-outcome-note" role="note">
              <Award size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {fmt(badgeAwardCount)} badge awards recorded in total — {fmt(badgePointsRecorded)} badge points in the community.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
