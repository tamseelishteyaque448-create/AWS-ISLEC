"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { getLearningPathId, learningPathUpdate, makeLearningPathSlug, validateLearningPathInput } from "@/lib/validation/admin-learning";

export type LearningPathFormState = { status: "idle" | "error" | "success"; message?: string };

async function adminClient() {
  const claims = await requireAdmin();
  return { claims, supabase: await createClient() };
}

export async function createLearningPath(_previousState: LearningPathFormState, formData: FormData): Promise<LearningPathFormState> {
  const admin = await adminClient();
  const input = validateLearningPathInput(formData);
  if ("error" in input) return { status: "error", message: input.error };

  const { error } = await admin.supabase.from("learning_paths").insert({ ...input.data, slug: makeLearningPathSlug(input.data.title) });
  if (error) return { status: "error", message: "The learning path could not be created. Check for a duplicate title or ordering value." };

  revalidatePath("/admin/learning");
  revalidatePath("/member/learn");
  return { status: "success", message: "Learning path created." };
}

export async function updateLearningPath(_previousState: LearningPathFormState, formData: FormData): Promise<LearningPathFormState> {
  const admin = await adminClient();
  const id = getLearningPathId(formData.get("learning_path_id"));
  const input = validateLearningPathInput(formData);
  if (!id || "error" in input) return { status: "error", message: "error" in input ? input.error : "The selected learning path is invalid." };

  const { data, error } = await admin.supabase.from("learning_paths").update(learningPathUpdate(input.data)).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "The learning path could not be updated. Please refresh and try again." };

  revalidatePath("/admin/learning");
  revalidatePath("/member/learn");
  return { status: "success", message: "Learning path updated." };
}
