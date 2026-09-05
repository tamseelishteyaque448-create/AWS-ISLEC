"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { challengeUpdate, getChallengeId, makeChallengeSlug, validateChallengeInput } from "@/lib/validation/admin-challenges";

export type ChallengeFormState = { status: "idle" | "error" | "success"; message?: string };

async function adminClient() {
  await requireAdmin();
  return createClient();
}

async function learningPathExists(supabase: Awaited<ReturnType<typeof createClient>>, learningPathId: string) {
  const { data, error } = await supabase.from("learning_paths").select("id").eq("id", learningPathId).maybeSingle();
  return !error && Boolean(data);
}

export async function createChallenge(_previousState: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const supabase = await adminClient();
  const input = validateChallengeInput(formData);
  if ("error" in input) return { status: "error", message: input.error };
  if (!(await learningPathExists(supabase, input.data.learning_path_id))) return { status: "error", message: "Select an existing learning path." };

  const { error } = await supabase.from("challenges").insert({ ...input.data, slug: makeChallengeSlug(input.data.title) });
  if (error) return { status: "error", message: "The challenge could not be created. Check for a duplicate title or ordering value." };

  revalidatePath("/admin/challenges");
  revalidatePath("/admin/learning");
  revalidatePath("/member/learn");
  revalidatePath("/member/challenges");
  return { status: "success", message: "Challenge created." };
}

export async function updateChallenge(_previousState: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const supabase = await adminClient();
  const id = getChallengeId(formData.get("challenge_id"));
  const input = validateChallengeInput(formData);
  if (!id || "error" in input) return { status: "error", message: "error" in input ? input.error : "The selected challenge is invalid." };
  if (!(await learningPathExists(supabase, input.data.learning_path_id))) return { status: "error", message: "Select an existing learning path." };

  const { data, error } = await supabase.from("challenges").update(challengeUpdate(input.data)).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "The challenge could not be updated. Please refresh and try again." };

  revalidatePath("/admin/challenges");
  revalidatePath("/admin/learning");
  revalidatePath("/member/learn");
  revalidatePath("/member/challenges");
  return { status: "success", message: "Challenge updated." };
}
