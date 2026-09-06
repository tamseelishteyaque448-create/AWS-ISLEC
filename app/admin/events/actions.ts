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
const MAX_POSTER_DIMENSION = 10_000;

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
  const dimensions = isJpeg ? jpegDimensions(bytes) : isPng ? pngDimensions(bytes) : isWebp ? webpDimensions(bytes) : null;
  if ((isJpeg || isPng || isWebp) && (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > MAX_POSTER_DIMENSION || dimensions.height > MAX_POSTER_DIMENSION)) return { error: "Use a valid image no larger than 10,000 pixels on either side." };
  if (isJpeg) return { file: value, extension: "jpg", contentType: "image/jpeg" };
  if (isPng) return { file: value, extension: "png", contentType: "image/png" };
  if (isWebp) return { file: value, extension: "webp", contentType: "image/webp" };
  if (isAvif) return { file: value, extension: "avif", contentType: "image/avif" };
  return { error: "Use a valid JPEG, PNG, WebP, or AVIF image." };
}

function pngDimensions(bytes: Uint8Array) { return bytes.length >= 24 ? { width: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20) } : null; }
function jpegDimensions(bytes: Uint8Array) {
  for (let offset = 2; offset + 9 < bytes.length;) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (marker >= 0xc0 && marker <= 0xc3) return { width: (bytes[offset + 7] << 8) | bytes[offset + 8], height: (bytes[offset + 5] << 8) | bytes[offset + 6] };
    offset += 2 + length;
  }
  return null;
}
function webpDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fourCC = new TextDecoder().decode(bytes.slice(12, 16));
  if (fourCC === "VP8X" && bytes.length >= 30) return { width: 1 + view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16), height: 1 + view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16) };
  if (fourCC === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  if (fourCC === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  return null;
}

async function uploadPoster(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, poster: Exclude<Awaited<ReturnType<typeof inspectPoster>>, null | { error: string }>): Promise<{ path: string } | { error: string }> {
  const path = `events/${eventId}/${crypto.randomUUID()}.${poster.extension}`;
  const { error } = await supabase.storage.from(POSTER_BUCKET).upload(path, poster.file, { cacheControl: "31536000", contentType: poster.contentType, upsert: false });
  return error ? { error: "The poster could not be uploaded." } : { path };
}

async function removePoster(supabase: Awaited<ReturnType<typeof createClient>>, path: string): Promise<string | null> {
  const { error } = await supabase.storage.from(POSTER_BUCKET).remove([path]);
  return error ? "Poster cleanup could not be completed. The current event record is safe, but remove the old file from Storage before closing this task." : null;
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
    if (updateError) {
      const cleanupError = await removePoster(admin.supabase, upload.path);
      return { status: "error", message: cleanupError ? `Event created without the new poster. ${cleanupError}` : "Event created, but the poster could not be attached." };
    }
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
  const removePosterRequested = formData.get("remove_poster") === "on";
  let replacementPath: string | null | undefined;
  if (poster) {
    const upload = await uploadPoster(admin.supabase, id, poster);
    if ("error" in upload) return { status: "error", message: upload.error };
    replacementPath = upload.path;
  } else if (removePosterRequested) replacementPath = null;
  const update = replacementPath === undefined ? eventUpdate(input.data) : { ...eventUpdate(input.data), poster_path: replacementPath };
  const { data, error } = await admin.supabase.from("events").update(update).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    const cleanupError = replacementPath ? await removePoster(admin.supabase, replacementPath) : null;
    return { status: "error", message: cleanupError ? `The event was not updated. ${cleanupError}` : "The event could not be updated. Please refresh and try again." };
  }
  const cleanupError = replacementPath !== undefined && existing.poster_path ? await removePoster(admin.supabase, existing.poster_path) : null;
  revalidateEvents();
  if (cleanupError) return { status: "success", message: `${replacementPath === null ? "Event updated and poster removed." : "Event updated."} ${cleanupError}` };
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
