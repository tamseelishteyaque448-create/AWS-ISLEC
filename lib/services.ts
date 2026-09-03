import { activities, type Activity } from "@/data/activities";
import { badges } from "@/data/badges";
import { challenges } from "@/data/challenges";
import { events } from "@/data/events";
import { projects } from "@/data/projects";
import { currentUser, leaders } from "@/data/users";
import { createClient } from "@/lib/supabase/server";
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
export const supabaseRepository: Pick<IslecRepository, "getLearningCatalogue"> = {
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
