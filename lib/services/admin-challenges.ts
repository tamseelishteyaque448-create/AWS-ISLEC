import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

type AdminLearningPathOption = Pick<Tables<"learning_paths">, "id" | "title" | "is_published">;
export type AdminChallenge = Pick<Tables<"challenges">, "id" | "title" | "detail" | "level" | "points" | "sort_order" | "is_published" | "created_at" | "updated_at" | "learning_path_id"> & { learningPathTitle: string };
export type AdminChallengeData = { challenges: AdminChallenge[]; learningPaths: AdminLearningPathOption[] };

export async function getAdminChallenges(): Promise<AdminChallengeData> {
  await requireAdmin();
  const supabase = await createClient();
  const [challengesResult, pathsResult] = await Promise.all([
    supabase.from("challenges").select("id, title, detail, level, points, sort_order, is_published, created_at, updated_at, learning_path_id").order("sort_order", { ascending: true }).order("title", { ascending: true }),
    supabase.from("learning_paths").select("id, title, is_published").order("sort_order", { ascending: true }).order("title", { ascending: true }),
  ]);

  if (challengesResult.error || pathsResult.error) throw new Error("Unable to load challenges.");

  const learningPathTitles = new Map((pathsResult.data ?? []).map((path) => [path.id, path.title]));
  return {
    challenges: (challengesResult.data ?? []).map((challenge) => ({ ...challenge, learningPathTitle: learningPathTitles.get(challenge.learning_path_id) ?? "Unknown learning path" })),
    learningPaths: pathsResult.data ?? [],
  };
}