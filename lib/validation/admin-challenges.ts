import type { TablesInsert, TablesUpdate } from "@/lib/types/database";

const CHALLENGE_LEVELS = ["starter", "builder", "architect"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ChallengeInput = Pick<TablesInsert<"challenges">, "title" | "detail" | "level" | "points" | "sort_order" | "is_published" | "learning_path_id">;

function text(value: FormDataEntryValue | null, maxLength: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  return (required && !normalized) || normalized.length > maxLength ? null : normalized;
}

function integer(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : undefined;
}

export function getChallengeId(value: FormDataEntryValue | null) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function getLearningPathId(value: FormDataEntryValue | null) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function validateChallengeInput(formData: FormData): { data: ChallengeInput } | { error: string } {
  const title = text(formData.get("title"), 160, true);
  const detail = text(formData.get("detail"), 2_000);
  const level = text(formData.get("level"), 20, true);
  const learningPathId = getLearningPathId(formData.get("learning_path_id"));
  const points = integer(formData.get("points"), 1_000_000);
  const sortOrder = integer(formData.get("sort_order"), 1_000_000);
  const isPublished = formData.get("is_published") === "on";

  if (!title || detail === null || !level || !CHALLENGE_LEVELS.includes(level as typeof CHALLENGE_LEVELS[number]) || !learningPathId || points == null || sortOrder == null) {
    return { error: "Check the required fields and use valid challenge values." };
  }

  return { data: { title, detail, level, learning_path_id: learningPathId, points, sort_order: sortOrder, is_published: isPublished } };
}

export function challengeUpdate(input: ChallengeInput): TablesUpdate<"challenges"> {
  return input;
}

export function makeChallengeSlug(title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 110) || "challenge";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}