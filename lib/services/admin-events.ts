import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

export type AdminEvent = Pick<Tables<"events">, "id" | "title" | "event_type" | "status" | "starts_at" | "ends_at" | "location" | "capacity" | "context"> & { registrationCount: number };

/** Loads event records and RLS-authorized registration rows for the admin workspace. */
export async function getAdminEvents(): Promise<AdminEvent[]> {
  await requireAdmin();
  const supabase = await createClient();
  const [eventsResult, attendeesResult] = await Promise.all([
    supabase.from("events").select("id, title, event_type, status, starts_at, ends_at, location, capacity, context").order("starts_at", { ascending: true }),
    supabase.from("event_attendees").select("event_id, status"),
  ]);
  if (eventsResult.error || attendeesResult.error) throw new Error("Unable to load events.");

  const registrations = new Map<string, number>();
  for (const attendee of attendeesResult.data ?? []) {
    if (attendee.status !== "cancelled") registrations.set(attendee.event_id, (registrations.get(attendee.event_id) ?? 0) + 1);
  }
  return (eventsResult.data ?? []).map((event) => ({ ...event, registrationCount: registrations.get(event.id) ?? 0 }));
}
