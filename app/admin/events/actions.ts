"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { eventUpdate, getEventId, makeEventSlug, validateEventInput } from "@/lib/validation/admin-events";
export type EventFormState = { status: "idle" | "error" | "success"; message?: string };
export const initialEventFormState: EventFormState = { status: "idle" };
/** Mutations repeat the page-level server guard; form submissions are separate requests. */
async function adminClient() { const claims = await requireAdmin(); return { claims, supabase: await createClient() }; }
export async function createEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await adminClient();
  const input = validateEventInput(formData);
  if ("error" in input) return { status: "error", message: input.error };
  const { error } = await admin.supabase.from("events").insert({ ...input.data, slug: makeEventSlug(input.data.title), created_by: admin.claims.sub });
  if (error) return { status: "error", message: "The event could not be created. A title may already be in use." };
  revalidatePath("/admin/events");
  return { status: "success", message: "Event created." };
}
export async function updateEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await adminClient();
  const id = getEventId(formData.get("event_id"));
  const input = validateEventInput(formData);
  if (!id || "error" in input) return { status: "error", message: "error" in input ? input.error : "The selected event is invalid." };
  const { data, error } = await admin.supabase.from("events").update(eventUpdate(input.data)).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "The event could not be updated. Please refresh and try again." };
  revalidatePath("/admin/events");
  return { status: "success", message: "Event updated." };
}
