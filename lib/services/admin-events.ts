import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

export type AdminEventAttendee = Pick<Tables<"event_attendees">, "profile_id" | "status"> & { fullName: string; handle: string };
export type AdminEvent = Pick<Tables<"events">, "id" | "title" | "event_type" | "status" | "starts_at" | "ends_at" | "location" | "capacity" | "context" | "is_published"> & { registrationCount: number; attendees: AdminEventAttendee[] };

/** Loads event records and RLS-authorized registration rows for the admin workspace. */
export async function getAdminEvents(): Promise<AdminEvent[]> {
  await requireAdmin();
  const supabase = await createClient();
  const [eventsResult, attendeesResult, profilesResult] = await Promise.all([
    supabase.from("events").select("id, title, event_type, status, starts_at, ends_at, location, capacity, context, is_published").order("starts_at", { ascending: true }),
    supabase.from("event_attendees").select("event_id, profile_id, status"),
    supabase.from("profiles").select("id, full_name, handle"),
  ]);
  if (eventsResult.error || attendeesResult.error || profilesResult.error) throw new Error("Unable to load events.");

  const registrations = new Map<string, number>();
  const attendees = new Map<string, AdminEventAttendee[]>();
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  for (const attendee of attendeesResult.data ?? []) {
    if (attendee.status === "cancelled") continue;
    registrations.set(attendee.event_id, (registrations.get(attendee.event_id) ?? 0) + 1);
    const profile = profiles.get(attendee.profile_id);
    if (!profile) continue;
    const eventAttendees = attendees.get(attendee.event_id) ?? [];
    eventAttendees.push({ profile_id: attendee.profile_id, status: attendee.status, fullName: profile.full_name, handle: profile.handle });
    attendees.set(attendee.event_id, eventAttendees);
  }
  return (eventsResult.data ?? []).map((event) => ({ ...event, registrationCount: registrations.get(event.id) ?? 0, attendees: attendees.get(event.id) ?? [] }));
}
