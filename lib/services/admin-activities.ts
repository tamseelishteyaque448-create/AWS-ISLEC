import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ADMIN_ACTIVITY_PAGE_SIZE = 50;

/**
 * Authoritative activity_type values as defined by the activities table
 * constraint in migrations 20260830170000 and 20260904190000.
 */
export const ACTIVITY_TYPES = [
  "challenge",
  "event",
  "project",
  "badge",
  "lesson",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Maximum length of a URL search parameter used as a filter value. */
const MAX_FILTER_LENGTH = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminActivityRow = {
  id: string;
  profileId: string;
  memberName: string;
  memberHandle: string;
  activityType: string;
  title: string;
  detail: string;
  points: number;
  occurredAt: string;
};

export type AdminActivityStats = {
  /** All-time total activity count. */
  totalCount: number;
  /** Unique members who have generated at least one activity. */
  uniqueMemberCount: number;
  /** Activities in the last 24 hours. */
  last24hCount: number;
  /** Activities in the last 7 days. */
  last7dCount: number;
  /** Activities in the last 30 days. */
  last30dCount: number;
  /** Breakdown by activity_type, all time. */
  byType: Record<string, number>;
};

export type AdminActivityResult = {
  activities: AdminActivityRow[];
  stats: AdminActivityStats;
  total: number;
  page: number;
};

// ---------------------------------------------------------------------------
// Search-param helpers (safe, server-side)
// ---------------------------------------------------------------------------

export function getActivityPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  return Math.min(Math.max(Number(value), 1), 10_000);
}

export function getActivityTypeFilter(
  value: string | string[] | undefined,
): ActivityType | "" {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase().slice(0, MAX_FILTER_LENGTH);
  return (ACTIVITY_TYPES as readonly string[]).includes(trimmed)
    ? (trimmed as ActivityType)
    : "";
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Fetches community-wide activity data for the admin oversight surface.
 * Authorization is enforced at two layers:
 *   1. requireAdmin() at the app layer
 *   2. "Admins can read activities" RLS policy (private.is_admin() check)
 *
 * Read-only — no mutations anywhere in this service.
 */
export async function getAdminActivities({
  page,
  typeFilter,
}: {
  page: number;
  typeFilter: ActivityType | "";
}): Promise<AdminActivityResult> {
  await requireAdmin();
  const supabase = await createClient();

  // -------------------------------------------------------------------------
  // Paged activity list
  // -------------------------------------------------------------------------
  const from = (page - 1) * ADMIN_ACTIVITY_PAGE_SIZE;

  let listQuery = supabase
    .from("activities")
    .select(
      "id, profile_id, activity_type, title, detail, points, occurred_at, profiles!inner(full_name, handle)",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })
    .range(from, from + ADMIN_ACTIVITY_PAGE_SIZE - 1);

  if (typeFilter) {
    listQuery = listQuery.eq("activity_type", typeFilter);
  }

  const { data: listData, error: listError, count } = await listQuery;

  if (listError) {
    throw new Error("Unable to load activity data.");
  }

  const total = count ?? 0;

  const activities: AdminActivityRow[] = (listData ?? []).map((row) => {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    return {
      id: row.id,
      profileId: row.profile_id,
      memberName:
        profile && typeof profile === "object" && "full_name" in profile
          ? String((profile as Record<string, unknown>).full_name)
          : "Unknown",
      memberHandle:
        profile && typeof profile === "object" && "handle" in profile
          ? String((profile as Record<string, unknown>).handle)
          : "",
      activityType: row.activity_type,
      title: row.title,
      detail: row.detail,
      points: row.points,
      occurredAt: row.occurred_at,
    };
  });

  // -------------------------------------------------------------------------
  // Stats (community-wide, always unfiltered — show global totals)
  // -------------------------------------------------------------------------
  const now = new Date();
  const t24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const t7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const t30d = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [totalRes, h24Res, d7Res, d30Res, byTypeRes, profileRes] =
    await Promise.all([
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", t24h),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", t7d),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", t30d),
      supabase.from("activities").select("activity_type"),
      supabase.from("activities").select("profile_id"),
    ]);

  if (
    totalRes.error ||
    h24Res.error ||
    d7Res.error ||
    d30Res.error ||
    byTypeRes.error ||
    profileRes.error
  ) {
    throw new Error("Unable to load activity statistics.");
  }

  const byType: Record<string, number> = {};
  for (const row of byTypeRes.data ?? []) {
    byType[row.activity_type] = (byType[row.activity_type] ?? 0) + 1;
  }

  const distinctMembers = new Set(
    (profileRes.data ?? []).map((r) => r.profile_id),
  ).size;

  const stats: AdminActivityStats = {
    totalCount: totalRes.count ?? 0,
    uniqueMemberCount: distinctMembers,
    last24hCount: h24Res.count ?? 0,
    last7dCount: d7Res.count ?? 0,
    last30dCount: d30Res.count ?? 0,
    byType,
  };

  const lastPage = Math.max(Math.ceil(total / ADMIN_ACTIVITY_PAGE_SIZE), 1);
  const resolvedPage = Math.min(page, lastPage);

  return { activities, stats, total, page: resolvedPage };
}
