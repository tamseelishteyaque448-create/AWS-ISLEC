import type { TablesInsert, TablesUpdate } from "@/lib/types/database";

const STATUSES = ["in_progress", "shipped", "archived"] as const;
export type ProjectInput = Pick<TablesInsert<"projects">, "title" | "category" | "status" | "description" | "progress" | "technologies" | "is_published">;

function text(value: FormDataEntryValue | null, maxLength: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  return (required && !normalized) || normalized.length > maxLength ? null : normalized;
}
export function getProjectId(value: FormDataEntryValue | null) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }
export function validateProjectInput(formData: FormData): { data: ProjectInput } | { error: string } {
  const title = text(formData.get("title"), 160, true); const category = text(formData.get("category"), 80, true); const description = text(formData.get("description"), 2000); const status = text(formData.get("status"), 20, true);
  const progressValue = formData.get("progress"); const progress = typeof progressValue === "string" && /^\d{1,3}$/.test(progressValue) ? Number(progressValue) : NaN;
  const technologies = typeof formData.get("technologies") === "string" ? [...new Set((formData.get("technologies") as string).split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 12) : [];
  if (!title || !category || description === null || !STATUSES.includes(status as typeof STATUSES[number]) || !Number.isInteger(progress) || progress < 0 || progress > 100 || technologies.some((value) => value.length > 60)) return { error: "Check the project title, category, status, progress, and technologies." };
  return { data: { title, category, description: description ?? "", status: status as string, progress, technologies, is_published: formData.get("is_published") === "on" } };
}
export function projectUpdate(input: ProjectInput): TablesUpdate<"projects"> { return input; }
export function makeProjectSlug(title: string) { const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 110) || "project"; return `${base}-${crypto.randomUUID().slice(0, 8)}`; }
