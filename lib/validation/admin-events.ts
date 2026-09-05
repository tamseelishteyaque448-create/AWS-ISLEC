import type { TablesInsert, TablesUpdate } from "@/lib/types/database";

const EVENT_STATUSES = ["upcoming", "past", "cancelled"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type EventInput = Pick<TablesInsert<"events">, "title" | "event_type" | "status" | "starts_at" | "ends_at" | "location" | "capacity" | "context" | "is_published">;

function text(value: FormDataEntryValue | null, maxLength: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  return (required && !normalized) || normalized.length > maxLength ? null : normalized;
}
function utcDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function capacity(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value === "") return null;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : undefined;
}
export function getEventId(value: FormDataEntryValue | null) { return typeof value === "string" && UUID_PATTERN.test(value) ? value : null; }
export function validateEventInput(formData: FormData): { data: EventInput } | { error: string } {
  const title = text(formData.get("title"), 160, true);
  const eventType = text(formData.get("event_type"), 80, true);
  const statusValue = text(formData.get("status"), 20, true);
  const startsAt = utcDate(formData.get("starts_at"));
  const endsAtValue = formData.get("ends_at");
  const endsAt = endsAtValue === "" ? null : utcDate(endsAtValue);
  const locationValue = text(formData.get("location"), 200);
  const context = text(formData.get("context"), 2_000);
  const parsedCapacity = capacity(formData.get("capacity"));
  if (!title || !eventType || !statusValue || !EVENT_STATUSES.includes(statusValue as typeof EVENT_STATUSES[number]) || !startsAt || endsAt === undefined || locationValue === null || context === null || parsedCapacity === undefined) return { error: "Check the required fields and use valid dates, status, and capacity." };
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) return { error: "The end date must be after the start date." };
  return { data: { title, event_type: eventType, status: statusValue, starts_at: startsAt, ends_at: endsAt, location: locationValue || null, context, capacity: parsedCapacity, is_published: formData.get("is_published") === "on" } };
}
export function eventUpdate(input: EventInput): TablesUpdate<"events"> { return input; }
export function makeEventSlug(title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 110) || "event";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
