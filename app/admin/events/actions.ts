"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { eventUpdate, getEventId, makeEventSlug, validateEventInput } from "@/lib/validation/admin-events";
export type EventFormState = { status: "idle" | "error" | "success"; message?: string };
export type EventAttendanceState = EventFormState;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
/** Mutations repeat the page-level server guard; form submissions are separate requests. */
async function adminClient() { const claims = await requireAdmin(); return { claims, supabase: await createClient() }; }
export async function createEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await adminClient();
  const input = validateEventInput(formData);
  if ("error" in input) return { status: "error", message: input.error };
  const { error } = await admin.supabase.from("events").insert({ ...input.data, slug: makeEventSlug(input.data.title), created_by: admin.claims.sub });
  if (error) return { status: "error", message: "The event could not be created. A title may already be in use." };
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/member/events");
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
  revalidatePath("/events");
  revalidatePath("/member/events");
  return { status: "success", message: "Event updated." };
}
export async function recordEventAttendance(_previousState: EventAttendanceState, formData: FormData): Promise<EventAttendanceState> {
  const admin = await adminClient();
  const eventId = formData.get("event_id");
  const profileId = formData.get("profile_id");
  if (typeof eventId !== "string" || typeof profileId !== "string" || !UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(profileId)) return { status: "error", message: "The attendee selection is invalid." };
  const { error } = await admin.supabase.rpc("record_event_attendance", { p_event_id: eventId.toLowerCase(), p_profile_id: profileId.toLowerCase() });
  if (error) return { status: "error", message: "Attendance cannot be recorded for this registration yet." };
  revalidatePath("/admin/events");
  revalidatePath("/member/events");
  return { status: "success", message: "Attendance recorded." };
}
