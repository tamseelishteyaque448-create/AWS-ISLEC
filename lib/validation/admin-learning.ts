import type { TablesInsert, TablesUpdate } from "@/lib/types/database";

const LEARNING_LEVELS = ["starter", "builder", "architect"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type LearningPathInput = Pick<TablesInsert<"learning_paths">, "title" | "description" | "level" | "estimated_minutes" | "points" | "sort_order" | "is_published">;

function text(value: FormDataEntryValue | null, maxLength: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  return (required && !normalized) || normalized.length > maxLength ? null : normalized;
}

function integer(value: FormDataEntryValue | null, max: number, optional = false) {
  if (typeof value !== "string" || value === "") return optional ? null : undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : undefined;
}

export function getLearningPathId(value: FormDataEntryValue | null) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function validateLearningPathInput(formData: FormData): { data: LearningPathInput } | { error: string } {
  const title = text(formData.get("title"), 160, true);
  const description = text(formData.get("description"), 2_000);
  const level = text(formData.get("level"), 20, true);
  const estimatedMinutes = integer(formData.get("estimated_minutes"), 100_000, true);
  const points = integer(formData.get("points"), 1_000_000);
  const sortOrder = integer(formData.get("sort_order"), 1_000_000);
  const isPublished = formData.get("is_published") === "on";

  if (!title || description === null || !level || !LEARNING_LEVELS.includes(level as typeof LEARNING_LEVELS[number]) || estimatedMinutes === undefined || points == null || sortOrder == null) {
    return { error: "Check the required fields and use valid learning path values." };
  }
  if (estimatedMinutes === 0) return { error: "Estimated minutes must be greater than 0." };

  return { data: { title, description, level, estimated_minutes: estimatedMinutes, points, sort_order: sortOrder, is_published: isPublished } };
}

export function learningPathUpdate(input: LearningPathInput): TablesUpdate<"learning_paths"> {
  return input;
}

export function makeLearningPathSlug(title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 110) || "learning-path";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}