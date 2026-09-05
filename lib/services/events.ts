import "server-only";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  context: string;
  capacity: number | null;
  is_published: boolean;
};

export type CommunityEvent = EventRow & { registrationStatus: "registered" | "attended" | "cancelled" | null };

const EVENT_FIELDS = "id, title, event_type, status, starts_at, ends_at, location, context, capacity, is_published";

export async function getPublicEvents(): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_FIELDS).order("starts_at", { ascending: true });
  if (error) throw new Error("Unable to load events.");
  return (data ?? []) as EventRow[];
}

export async function getMemberEvents(): Promise<CommunityEvent[]> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return [];
  const supabase = await createClient();
  const [eventsResult, attendanceResult] = await Promise.all([
    supabase.from("events").select(EVENT_FIELDS).order("starts_at", { ascending: true }),
    supabase.from("event_attendees").select("event_id, status").eq("profile_id", claims.sub),
  ]);
  if (eventsResult.error || attendanceResult.error) throw new Error("Unable to load member events.");
  const attendance = new Map((attendanceResult.data ?? []).map((row) => [row.event_id, row.status]));
  return ((eventsResult.data ?? []) as EventRow[]).map((event) => ({
    ...event,
    registrationStatus: (attendance.get(event.id) ?? null) as CommunityEvent["registrationStatus"],
  }));
}
