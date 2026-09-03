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
        .select("id, learning_path_id, slug, title, detail, level, points, sort_order")
        .eq("is_published", true)
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

  async getLearningCatalogue() {
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

    return pathsResult.data.map((path) =>
      mapLearningPath(path, challengesResult.data),
    );
  },
};
