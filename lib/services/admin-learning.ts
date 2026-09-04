import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

export type AdminLearningPath = Pick<Tables<"learning_paths">, "id" | "title" | "description" | "level" | "estimated_minutes" | "points" | "sort_order" | "is_published" | "created_at" | "updated_at"> & { challengeCount: number };

export async function getAdminLearningPaths(): Promise<AdminLearningPath[]> {
  await requireAdmin();
  const supabase = await createClient();
  const [pathsResult, challengesResult] = await Promise.all([
    supabase.from("learning_paths").select("id, title, description, level, estimated_minutes, points, sort_order, is_published, created_at, updated_at").order("sort_order", { ascending: true }).order("title", { ascending: true }),
    supabase.from("challenges").select("learning_path_id"),
  ]);

  if (pathsResult.error || challengesResult.error) throw new Error("Unable to load learning paths.");

  const challengeCounts = new Map<string, number>();
  for (const challenge of challengesResult.data ?? []) {
    challengeCounts.set(challenge.learning_path_id, (challengeCounts.get(challenge.learning_path_id) ?? 0) + 1);
  }

  return (pathsResult.data ?? []).map((path) => ({ ...path, challengeCount: challengeCounts.get(path.id) ?? 0 }));
}