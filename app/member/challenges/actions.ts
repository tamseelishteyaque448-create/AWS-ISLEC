"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompletionResult = {
  status: "completed" | "already_completed";
  challengeId: string;
  pointsAwarded: number;
  totalPoints: number;
  streak: number;
  newBadges: Array<{ title: string; points: number }>;
};

function parseNewBadges(value: Json | undefined): Array<{ title: string; points: number }> | null {
  if (!Array.isArray(value)) return null;
  const badges: Array<{ title: string; points: number }> = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const badge = candidate as Record<string, Json | undefined>;
    if (typeof badge.title !== "string" || typeof badge.points !== "number") return null;
    badges.push({ title: badge.title, points: badge.points });
  }
  return badges;
}

export type ChallengeCompletionState = {
  status: "idle" | "error" | "completed" | "already_completed";
  message?: string;
  result?: CompletionResult;
};

export const initialChallengeCompletionState: ChallengeCompletionState = { status: "idle" };

function parseCompletionResult(value: Json | null): CompletionResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, Json | undefined>;
  const status = result.status;
  const challengeId = result.challenge_id;
  const pointsAwarded = result.points_awarded;
  const totalPoints = result.total_points;
  const streak = result.streak;
  const newBadges = parseNewBadges(result.new_badges);
  if ((status !== "completed" && status !== "already_completed") || typeof challengeId !== "string" || typeof pointsAwarded !== "number" || typeof totalPoints !== "number" || typeof streak !== "number") return null;
  if (!newBadges) return null;
  return { status, challengeId, pointsAwarded, totalPoints, streak, newBadges };
}

export async function completeChallenge(_previousState: ChallengeCompletionState, formData: FormData): Promise<ChallengeCompletionState> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return { status: "error", message: "Please sign in to complete a challenge." };

  const challengeId = formData.get("challenge_id");
  if (typeof challengeId !== "string" || !UUID_PATTERN.test(challengeId)) return { status: "error", message: "That challenge is invalid." };
  const normalizedChallengeId = challengeId.toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_challenge", { p_challenge_id: normalizedChallengeId });
  if (error) return { status: "error", message: "The challenge could not be completed. Please try again." };

  const result = parseCompletionResult(data);
  if (!result || result.challengeId !== normalizedChallengeId) return { status: "error", message: "The challenge returned an invalid completion result." };

  revalidatePath("/member/challenges");
  revalidatePath("/member/learn");
  revalidatePath("/member");
  revalidatePath("/member/activities");
  revalidatePath("/member/achievements");
  revalidatePath("/member/leaderboard");
  revalidatePath("/admin/challenges");

  return { status: result.status, result, message: result.status === "completed" ? "Challenge completed." : "This challenge was already completed." };
}
