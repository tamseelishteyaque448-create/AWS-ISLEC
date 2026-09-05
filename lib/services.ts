import { activities, type Activity } from "@/data/activities";
import { badges } from "@/data/badges";
import { challenges } from "@/data/challenges";
import { events } from "@/data/events";
import { projects } from "@/data/projects";
import { currentUser, leaders } from "@/data/users";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import type { Tables } from "@/lib/types/database";

type LearningPathRow = Pick<
  Tables<"learning_paths">,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "level"
  | "estimated_minutes"
  | "points"
  | "sort_order"
>;
type ChallengeRow = Pick<
  Tables<"challenges">,
  | "id"
  | "learning_path_id"
  | "slug"
  | "title"
  | "detail"
  | "level"
  | "points"
  | "sort_order"
>;
type ProgressRow = Pick<
  Tables<"user_challenge_progress">,
  "challenge_id" | "progress" | "status"
>;
type ActivityRow = Pick<
  Tables<"activities">,
  "id" | "activity_type" | "title" | "detail" | "points" | "occurred_at"
>;

export type LearningChallenge = {
  id: string;
  slug: string;
  title: string;
  detail: string;
  level: string;
  points: number;
};

export type LearningPath = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  estimatedMinutes: number | null;
  points: number;
  challenges: LearningChallenge[];
};

export type DashboardChallenge = LearningChallenge & {
  progress: number;
  status: string;
};

export type MemberChallenge = LearningChallenge & {
  progress: number;
  status: "not_started" | "in_progress" | "completed";
};

export type MemberBadge = {
  id: string;
  slug: string;
  icon: string;
  title: string;
  detail: string;
  points: number;
  earnedAt: string;
};

export type MemberLeaderboardEntry = {
  id: string;
  name: string;
  handle: string;
  points: number;
  streak: number;
  rank: number;
  isCurrentMember: boolean;
};

export type DashboardData = {
  profile: MemberProfile;
  nextChallenge: DashboardChallenge | null;
  activities: Activity[];
};

export type MemberProfile = typeof currentUser;

class MemberProfileError extends Error {
  constructor() {
    super("Unable to load the member profile.");
    this.name = "MemberProfileError";
  }
}

class ActivityLogError extends Error {
  constructor() {
    super("Unable to load the activity log.");
    this.name = "ActivityLogError";
  }
}

class LearningCatalogueError extends Error {
  constructor() {
    super("Unable to load the learning catalogue.");
    this.name = "LearningCatalogueError";
  }
}

class ChallengeListError extends Error {
  constructor() {
    super("Unable to load challenges.");
    this.name = "ChallengeListError";
  }
}

function mapChallenge(challenge: ChallengeRow): LearningChallenge {
  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    detail: challenge.detail,
    level: challenge.level,
    points: challenge.points,
  };
}

function mapLearningPath(
  path: LearningPathRow,
  challenges: ChallengeRow[],
): LearningPath {
  return {
    id: path.id,
    slug: path.slug,
    title: path.title,
    description: path.description,
    level: path.level,
    estimatedMinutes: path.estimated_minutes,
    points: path.points,
    challenges: challenges
      .filter((challenge) => challenge.learning_path_id === path.id)
      .map(mapChallenge),
  };
}

function mapDashboardActivity(activity: ActivityRow): Activity {
  return {
    id: activity.id,
    type: activity.activity_type as Activity["type"],
    title: activity.title,
    detail: activity.detail,
    date: new Date(activity.occurred_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    points: activity.points,
  };
}

export type IslecRepository = {
  getProfile: () => typeof currentUser;
  getActivities: () => Activity[];
  getBadges: () => typeof badges;
  getChallenges: () => typeof challenges;
  getEvents: () => typeof events;
  getProjects: () => typeof projects;
  getLeaders: () => typeof leaders;
  getLearningCatalogue: () => Promise<LearningPath[]>;
};

export const mockRepository: IslecRepository = {
  getProfile: () => currentUser,
  getActivities: () => activities,
  getBadges: () => badges,
  getChallenges: () => challenges,
  getEvents: () => events,
  getProjects: () => projects,
  getLeaders: () => leaders,
  getLearningCatalogue: async () => [],
};

/**
 * Request-scoped, RLS-enforced data access for authenticated member pages.
 */
export const supabaseRepository = {
  async getPublicLearningCatalogue() {
    const supabase = await createClient();
    const [pathsResult, challengesResult] = await Promise.all([
      supabase
        .from("learning_paths")
        .select("id, slug, title, description, level, estimated_minutes, points, sort_order")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("challenges")
        .select("id, learning_path_id, slug, title, detail, level, points, sort_order")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (pathsResult.error || challengesResult.error) {
      throw new LearningCatalogueError();
    }

    return pathsResult.data.map((path) => mapLearningPath(path, challengesResult.data));
  },

  async getProfile(): Promise<MemberProfile | null> {
    const claims = await getAuthenticatedClaims();

    if (!claims?.sub) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, handle, role, points, streak")
      .eq("id", claims.sub)
      .maybeSingle();

    if (error) {
      throw new MemberProfileError();
    }

    return data
      ? {
          name: data.full_name,
          handle: data.handle,
          role: data.role,
          points: data.points,
          streak: data.streak,
        }
      : null;
  },

  async getDashboardData(): Promise<DashboardData | null> {
    const claims = await getAuthenticatedClaims();

    if (!claims?.sub) {
      return null;
    }

    const supabase = await createClient();
    const [profileResult, challengesResult, progressResult, activitiesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, handle, role, points, streak")
        .eq("id", claims.sub)
        .maybeSingle(),
      supabase
        .from("challenges")
        .select("id, learning_path_id, slug, title, detail, level, points, sort_order, learning_paths!inner(is_published)")
        .eq("is_published", true)
        .eq("learning_paths.is_published", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_challenge_progress")
        .select("challenge_id, progress, status")
        .eq("profile_id", claims.sub),
      supabase
        .from("activities")
        .select("id, activity_type, title, detail, points, occurred_at")
        .eq("profile_id", claims.sub)
        .order("occurred_at", { ascending: false })
        .limit(3),
    ]);

    if (profileResult.error || challengesResult.error || progressResult.error || activitiesResult.error) {
      throw new MemberProfileError();
    }

    if (!profileResult.data) {
      return null;
    }

    const profile: MemberProfile = {
      name: profileResult.data.full_name,
      handle: profileResult.data.handle,
      role: profileResult.data.role,
      points: profileResult.data.points,
      streak: profileResult.data.streak,
    };
    const progressByChallenge = new Map(
      (progressResult.data as ProgressRow[]).map((progress) => [progress.challenge_id, progress]),
    );
    const nextChallengeRow = challengesResult.data.find((challenge) => {
      return progressByChallenge.get(challenge.id)?.status !== "completed";
    });

    return {
      profile,
      nextChallenge: nextChallengeRow
        ? {
            ...mapChallenge(nextChallengeRow),
            progress: progressByChallenge.get(nextChallengeRow.id)?.progress ?? 0,
            status: progressByChallenge.get(nextChallengeRow.id)?.status ?? "not_started",
          }
        : null,
      activities: (activitiesResult.data as ActivityRow[]).map(mapDashboardActivity),
    };
  },

  async getActivities(): Promise<Activity[]> {
    const claims = await getAuthenticatedClaims();

    if (!claims?.sub) {
      return [];
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("activities")
      .select("id, activity_type, title, detail, points, occurred_at")
      .eq("profile_id", claims.sub)
      .order("occurred_at", { ascending: false });

    if (error) {
      throw new ActivityLogError();
    }

    return (data as ActivityRow[]).map(mapDashboardActivity);
  },

  async getEarnedBadges(): Promise<MemberBadge[]> {
    const claims = await getAuthenticatedClaims();

    if (!claims?.sub) {
      return [];
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_badges")
      .select("earned_at, badges!inner(id, slug, icon, title, detail, points)")
      .eq("profile_id", claims.sub)
      .order("earned_at", { ascending: false });

    if (error) {
      throw new Error("Unable to load earned badges.");
    }

    return (data ?? []).map((assignment) => {
      const badge = Array.isArray(assignment.badges) ? assignment.badges[0] : assignment.badges;
      return {
        id: badge.id,
        slug: badge.slug,
        icon: badge.icon,
        title: badge.title,
        detail: badge.detail,
        points: badge.points,
        earnedAt: assignment.earned_at,
      };
    });
  },

  async getLeaderboard(): Promise<MemberLeaderboardEntry[]> {
    const claims = await getAuthenticatedClaims();

    if (!claims?.sub) {
      return [];
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, handle, points, streak, created_at")
      .order("points", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      throw new Error("Unable to load the leaderboard.");
    }

    return (data ?? []).map((profile, index) => ({
      id: profile.id,
      name: profile.full_name,
      handle: profile.handle,
      points: profile.points,
      streak: profile.streak,
      rank: index + 1,
      isCurrentMember: profile.id === claims.sub,
    }));
  },

  async getChallenges(): Promise<MemberChallenge[]> {
    const claims = await getAuthenticatedClaims();

    if (!claims?.sub) {
      return [];
    }

    const supabase = await createClient();
    const [challengesResult, progressResult] = await Promise.all([
      supabase
        .from("challenges")
        .select("id, learning_path_id, slug, title, detail, level, points, sort_order, learning_paths!inner(is_published)")
        .eq("is_published", true)
        .eq("learning_paths.is_published", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_challenge_progress")
        .select("challenge_id, progress, status")
        .eq("profile_id", claims.sub),
    ]);

    if (challengesResult.error || progressResult.error) {
      throw new ChallengeListError();
    }

    const progressByChallenge = new Map(
      (progressResult.data as ProgressRow[]).map((progress) => [progress.challenge_id, progress]),
    );

    return challengesResult.data.map((challenge) => ({
      ...mapChallenge(challenge),
      progress: progressByChallenge.get(challenge.id)?.progress ?? 0,
      status: (progressByChallenge.get(challenge.id)?.status ?? "not_started") as MemberChallenge["status"],
    }));
  },

  async getLearningCatalogue() {
    return this.getPublicLearningCatalogue();
  },
};
