import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

const RECENT_COMPLETIONS_LIMIT = 25;

export type AdminLearningOutcomeSummary = {
  completionCount: number;
  memberCount: number;
  challengePointsAwarded: number;
  badgeAwardCount: number;
  badgePointsRecorded: number;
};

export type AdminRecentCompletion = {
  id: string;
  memberName: string;
  memberHandle: string;
  challengeTitle: string;
  completedAt: string;
  challengePoints: number;
  badges: Array<{ title: string; points: number }>;
};

export type AdminLearningOutcomes = {
  summary: AdminLearningOutcomeSummary;
  recentCompletions: AdminRecentCompletion[];
};

/** Real operational learning outcomes. Every read is protected by both the route guard and RLS. */
export async function getAdminLearningOutcomes(): Promise<AdminLearningOutcomes> {
  await requireAdmin();
  const supabase = await createClient();
  const [summaryResult, completionsResult] = await Promise.all([
    supabase.rpc("get_admin_learning_outcome_summary"),
    supabase
      .from("challenge_completions")
      .select("id, profile_id, challenge_id, points_awarded, completed_at")
      .order("completed_at", { ascending: false })
      .limit(RECENT_COMPLETIONS_LIMIT),
  ]);

  if (summaryResult.error || completionsResult.error) {
    throw new Error("Unable to load learning outcomes.");
  }

  const summaryRow = summaryResult.data?.[0];
  if (!summaryRow) {
    throw new Error("Learning outcome summary is unavailable.");
  }

  const completions = completionsResult.data ?? [];
  if (completions.length === 0) {
    return {
      summary: {
        completionCount: summaryRow.completion_count,
        memberCount: summaryRow.member_count,
        challengePointsAwarded: summaryRow.challenge_points_awarded,
        badgeAwardCount: summaryRow.badge_award_count,
        badgePointsRecorded: summaryRow.badge_points_recorded,
      },
      recentCompletions: [],
    };
  }

  const completionIds = completions.map((completion) => completion.id);
  const profileIds = [...new Set(completions.map((completion) => completion.profile_id))];
  const challengeIds = [...new Set(completions.map((completion) => completion.challenge_id))];
  const [profilesResult, challengesResult, awardsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, handle").in("id", profileIds),
    supabase.from("challenges").select("id, title").in("id", challengeIds),
    supabase.from("challenge_completion_badges").select("completion_id, badge_id, points_awarded").in("completion_id", completionIds),
  ]);

  if (profilesResult.error || challengesResult.error || awardsResult.error) {
    throw new Error("Unable to load recent learning outcomes.");
  }

  const awards = awardsResult.data ?? [];
  const badgeIds = [...new Set(awards.map((award) => award.badge_id))];
  const badgesResult = badgeIds.length > 0
    ? await supabase.from("badges").select("id, title").in("id", badgeIds)
    : { data: [], error: null };

  if (badgesResult.error) {
    throw new Error("Unable to load earned badge details.");
  }

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const challenges = new Map((challengesResult.data ?? []).map((challenge) => [challenge.id, challenge]));
  const badges = new Map((badgesResult.data ?? []).map((badge) => [badge.id, badge]));
  const awardsByCompletion = new Map<string, Array<{ title: string; points: number }>>();

  for (const award of awards) {
    const badge = badges.get(award.badge_id);
    if (!badge) continue;
    const existing = awardsByCompletion.get(award.completion_id) ?? [];
    existing.push({ title: badge.title, points: award.points_awarded });
    awardsByCompletion.set(award.completion_id, existing);
  }

  return {
    summary: {
      completionCount: summaryRow.completion_count,
      memberCount: summaryRow.member_count,
      challengePointsAwarded: summaryRow.challenge_points_awarded,
      badgeAwardCount: summaryRow.badge_award_count,
      badgePointsRecorded: summaryRow.badge_points_recorded,
    },
    recentCompletions: completions.map((completion) => {
      const profile = profiles.get(completion.profile_id);
      const challenge = challenges.get(completion.challenge_id);
      return {
        id: completion.id,
        memberName: profile?.full_name ?? "Unknown member",
        memberHandle: profile?.handle ?? "",
        challengeTitle: challenge?.title ?? "Unavailable challenge",
        completedAt: completion.completed_at,
        challengePoints: completion.points_awarded,
        badges: awardsByCompletion.get(completion.id) ?? [],
      };
    }),
  };
}
