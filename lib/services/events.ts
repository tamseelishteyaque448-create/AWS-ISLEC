import "server-only";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type EventRow = {
  id: string; slug: string; title: string; event_type: string; status: "upcoming" | "past" | "cancelled";
  starts_at: string; ends_at: string | null; location: string | null; context: string; details: string;
  capacity: number | null; is_published: boolean; poster_path: string | null; poster_alt: string | null;
};
type Availability = { registeredCount: number; availableSlots: number | null };
export type EventDisplayStatus = "upcoming" | "past" | "cancelled";
export type EventWithPresentation = EventRow & Availability & { posterUrl: string | null; effectiveStatus: EventDisplayStatus };
export type CommunityEvent = EventWithPresentation & {
  registrationStatus: "registered" | "attended" | "cancelled" | null; registrationOpen: boolean; cancellationOpen: boolean;
};

const EVENT_FIELDS = "id, slug, title, event_type, status, starts_at, ends_at, location, context, details, capacity, is_published, poster_path, poster_alt";

function getEffectiveStatus(event: Pick<EventRow, "status" | "starts_at">, now = Date.now()): EventDisplayStatus {
  if (event.status === "cancelled") return "cancelled";
  return new Date(event.starts_at).getTime() <= now ? "past" : "upcoming";
}

async function getAvailability(eventId: string): Promise<Availability> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_availability", { p_event_id: eventId });
  if (error || !data?.[0]) throw new Error("Unable to load event availability.");
  return { registeredCount: data[0].registered_count, availableSlots: data[0].available_slots };
}

async function getAvailabilities(eventIds: string[]): Promise<Map<string, Availability>> {
  if (eventIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_availabilities", { p_event_ids: eventIds });
  if (error || (data?.length ?? 0) !== eventIds.length) throw new Error("Unable to load event availability.");
  return new Map(data.map((row) => [row.event_id, { registeredCount: row.registered_count, availableSlots: row.available_slots }]));
}

function presentEvent(event: EventRow, availability: Availability): EventWithPresentation {
  return { ...event, ...availability, posterUrl: event.poster_path ? `/api/events/${event.slug}/poster` : null, effectiveStatus: getEffectiveStatus(event) };
}

async function presentEvents(events: EventRow[]): Promise<EventWithPresentation[]> {
  const availability = await getAvailabilities(events.map((event) => event.id));
  return events.map((event) => {
    const value = availability.get(event.id);
    if (!value) throw new Error("Unable to load event availability.");
    return presentEvent(event, value);
  });
}

export async function getPublicEvents(): Promise<EventWithPresentation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_FIELDS).eq("is_published", true).neq("status", "cancelled").order("starts_at", { ascending: true });
  if (error) throw new Error("Unable to load events.");
  return presentEvents((data ?? []) as EventRow[]);
}

export async function getPublicEventBySlug(slug: string): Promise<EventWithPresentation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_FIELDS).eq("slug", slug).eq("is_published", true).neq("status", "cancelled").maybeSingle();
  if (error) throw new Error("Unable to load event.");
  if (!data) return null;
  return presentEvent(data as EventRow, await getAvailability(data.id));
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
  const events = await presentEvents((eventsResult.data ?? []) as EventRow[]);
  return events.map((event) => ({ ...event, registrationStatus: (attendance.get(event.id) ?? null) as CommunityEvent["registrationStatus"], registrationOpen: event.is_published && event.effectiveStatus === "upcoming" && event.availableSlots !== 0, cancellationOpen: event.effectiveStatus === "upcoming" }));
}

export async function getMemberEventBySlug(slug: string): Promise<CommunityEvent | null> {
  const events = await getMemberEvents();
  return events.find((event) => event.slug === slug) ?? null;
}
