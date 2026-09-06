"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { eventUpdate, getEventId, makeEventSlug, validateEventInput } from "@/lib/validation/admin-events";

export type EventFormState = { status: "idle" | "error" | "success"; message?: string };
export type EventAttendanceState = EventFormState;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTER_BUCKET = "event-posters";
const MAX_POSTER_BYTES = 5 * 1024 * 1024;

async function adminClient() { const claims = await requireAdmin(); return { claims, supabase: await createClient() }; }
function revalidateEvents() {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/member/events");
  revalidatePath("/member/events/[slug]", "page");
}

async function inspectPoster(value: FormDataEntryValue | null): Promise<{ file: File; extension: string; contentType: string } | null | { error: string }> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_POSTER_BYTES) return { error: "Poster images must be 5 MB or smaller." };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  const isWebp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const brand = bytes.length >= 12 ? new TextDecoder().decode(bytes.slice(8, 12)) : "";
  const isAvif = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp" && (brand === "avif" || brand === "avis");
  if (isJpeg) return { file: value, extension: "jpg", contentType: "image/jpeg" };
  if (isPng) return { file: value, extension: "png", contentType: "image/png" };
  if (isWebp) return { file: value, extension: "webp", contentType: "image/webp" };
  if (isAvif) return { file: value, extension: "avif", contentType: "image/avif" };
  return { error: "Use a valid JPEG, PNG, WebP, or AVIF image." };
}

async function uploadPoster(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, poster: Exclude<Awaited<ReturnType<typeof inspectPoster>>, null | { error: string }>): Promise<{ path: string } | { error: string }> {
  const path = `events/${eventId}/${crypto.randomUUID()}.${poster.extension}`;
  const { error } = await supabase.storage.from(POSTER_BUCKET).upload(path, poster.file, { cacheControl: "31536000", contentType: poster.contentType, upsert: false });
  return error ? { error: "The poster could not be uploaded." } : { path };
}

export async function createEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await adminClient();
  const input = validateEventInput(formData);
  const poster = await inspectPoster(formData.get("poster"));
  if ("error" in input) return { status: "error", message: input.error };
  if (poster && "error" in poster) return { status: "error", message: poster.error };
  const { data: event, error } = await admin.supabase.from("events").insert({ ...input.data, slug: makeEventSlug(input.data.title), created_by: admin.claims.sub }).select("id").single();
  if (error || !event) return { status: "error", message: "The event could not be created. A title may already be in use." };
  if (poster) {
    const upload = await uploadPoster(admin.supabase, event.id, poster);
    if ("error" in upload) return { status: "error", message: `Event created, but ${upload.error.toLowerCase()}` };
    const { error: updateError } = await admin.supabase.from("events").update({ poster_path: upload.path }).eq("id", event.id);
    if (updateError) { await admin.supabase.storage.from(POSTER_BUCKET).remove([upload.path]); return { status: "error", message: "Event created, but the poster could not be attached." }; }
  }
  revalidateEvents();
  return { status: "success", message: "Event created." };
}

export async function updateEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await adminClient();
  const id = getEventId(formData.get("event_id"));
  const input = validateEventInput(formData);
  const poster = await inspectPoster(formData.get("poster"));
  if (!id || "error" in input) return { status: "error", message: "error" in input ? input.error : "The selected event is invalid." };
  if (poster && "error" in poster) return { status: "error", message: poster.error };
  const { data: existing, error: existingError } = await admin.supabase.from("events").select("poster_path").eq("id", id).maybeSingle();
  if (existingError || !existing) return { status: "error", message: "The selected event is no longer available." };
  const removePoster = formData.get("remove_poster") === "on";
  let replacementPath: string | null | undefined;
  if (poster) {
    const upload = await uploadPoster(admin.supabase, id, poster);
    if ("error" in upload) return { status: "error", message: upload.error };
    replacementPath = upload.path;
  } else if (removePoster) replacementPath = null;
  const update = replacementPath === undefined ? eventUpdate(input.data) : { ...eventUpdate(input.data), poster_path: replacementPath };
  const { data, error } = await admin.supabase.from("events").update(update).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    if (replacementPath) await admin.supabase.storage.from(POSTER_BUCKET).remove([replacementPath]);
    return { status: "error", message: "The event could not be updated. Please refresh and try again." };
  }
  if (replacementPath !== undefined && existing.poster_path) await admin.supabase.storage.from(POSTER_BUCKET).remove([existing.poster_path]);
  revalidateEvents();
  return { status: "success", message: replacementPath === null ? "Event updated and poster removed." : "Event updated." };
}

export async function recordEventAttendance(_previousState: EventAttendanceState, formData: FormData): Promise<EventAttendanceState> {
  const admin = await adminClient();
  const eventId = formData.get("event_id"); const profileId = formData.get("profile_id");
  if (typeof eventId !== "string" || typeof profileId !== "string" || !UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(profileId)) return { status: "error", message: "The attendee selection is invalid." };
  const { error } = await admin.supabase.rpc("record_event_attendance", { p_event_id: eventId.toLowerCase(), p_profile_id: profileId.toLowerCase() });
  if (error) return { status: "error", message: "Attendance cannot be recorded for this registration yet." };
  revalidatePath("/admin/events"); revalidatePath("/member/events"); revalidatePath("/member/events/[slug]", "page");
  return { status: "success", message: "Attendance recorded." };
}
