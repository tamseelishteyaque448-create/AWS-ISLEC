import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminAnalyticsTopMember = {
  id: string;
  fullName: string;
  handle: string;
  points: number;
  streak: number;
};

export type AdminAnalyticsActivityBreakdown = {
  challenge: number;
  event: number;
  badge: number;
  project: number;
  lesson: number;
  other: number;
};

export type AdminAnalyticsProjectsByStage = {
  idea: number;
  building: number;
  prototype: number;
  shipped: number;
};

export type AdminAnalytics = {
  // Community health
  memberCount: number;
  activeMemberCount: number;
  totalPointsAwarded: number;
  avgPointsPerMember: number;
  maxStreak: number;

  // Learning outcomes
  completionCount: number;
  distinctCompleters: number;
  challengePointsAwarded: number;
  badgeAwardCount: number;
  badgePointsRecorded: number;

  // Event engagement
  totalEventCount: number;
  upcomingEventCount: number;
  totalRegistrations: number;
  recentRegistrations: number;

  // Project pipeline
  publishedProjectCount: number;
  projectsByStage: AdminAnalyticsProjectsByStage;
  openRecruitmentCount: number;
  pendingReviewCount: number;

  // Activity breakdown (last 30 days)
  recentActivityCount: number;
  activityBreakdown: AdminAnalyticsActivityBreakdown;

  // Top members
  topMembers: AdminAnalyticsTopMember[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function toBreakdown(raw: Record<string, unknown> | null | undefined): AdminAnalyticsActivityBreakdown {
  const map = raw ?? {};
  return {
    challenge: toNumber(map.challenge),
    event:     toNumber(map.event),
    badge:     toNumber(map.badge),
    project:   toNumber(map.project),
    lesson:    toNumber(map.lesson),
    other:     Object.entries(map)
      .filter(([k]) => !["challenge", "event", "badge", "project", "lesson"].includes(k))
      .reduce((acc, [, v]) => acc + toNumber(v), 0),
  };
}

function toProjectsByStage(raw: Record<string, unknown> | null | undefined): AdminAnalyticsProjectsByStage {
  const map = raw ?? {};
  return {
    idea:      toNumber(map.idea),
    building:  toNumber(map.building),
    prototype: toNumber(map.prototype),
    shipped:   toNumber(map.shipped),
  };
}

function toTopMembers(raw: unknown): AdminAnalyticsTopMember[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.full_name !== "string" || typeof r.handle !== "string") return [];
    return [{
      id:       r.id,
      fullName: r.full_name,
      handle:   r.handle,
      points:   toNumber(r.points),
      streak:   toNumber(r.streak),
    }];
  });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Fetches the V1 community intelligence snapshot.
 * Protected by both requireAdmin() at the app layer and private.is_admin()
 * inside the SECURITY DEFINER RPC. Read-only — no mutations.
 */
export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_admin_analytics_v1");

  if (error) {
    throw new Error("Unable to load analytics data.");
  }

  const raw = data as Record<string, unknown>;

  return {
    memberCount:             toNumber(raw.member_count),
    activeMemberCount:       toNumber(raw.active_member_count),
    totalPointsAwarded:      toNumber(raw.total_points_awarded),
    avgPointsPerMember:      toNumber(raw.avg_points_per_member),
    maxStreak:               toNumber(raw.max_streak),

    completionCount:         toNumber(raw.completion_count),
    distinctCompleters:      toNumber(raw.distinct_completers),
    challengePointsAwarded:  toNumber(raw.challenge_points_awarded),
    badgeAwardCount:         toNumber(raw.badge_award_count),
    badgePointsRecorded:     toNumber(raw.badge_points_recorded),

    totalEventCount:         toNumber(raw.total_event_count),
    upcomingEventCount:      toNumber(raw.upcoming_event_count),
    totalRegistrations:      toNumber(raw.total_registrations),
    recentRegistrations:     toNumber(raw.recent_registrations),

    publishedProjectCount:   toNumber(raw.published_project_count),
    projectsByStage:         toProjectsByStage(raw.projects_by_stage as Record<string, unknown>),
    openRecruitmentCount:    toNumber(raw.open_recruitment_count),
    pendingReviewCount:      toNumber(raw.pending_review_count),

    recentActivityCount:     toNumber(raw.recent_activity_count),
    activityBreakdown:       toBreakdown(raw.activity_breakdown as Record<string, unknown>),

    topMembers:              toTopMembers(raw.top_members),
  };
}
