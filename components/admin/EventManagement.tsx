"use client";

import { useActionState, useEffect, useRef } from "react";
import { CalendarPlus, MapPin, Pencil, UsersRound } from "lucide-react";
import { createEvent, initialEventFormState, updateEvent } from "@/app/admin/events/actions";
import { EventAttendanceControl } from "@/components/admin/EventAttendanceControl";
import type { AdminEvent } from "@/lib/services/admin-events";

function toDateTimeLocal(value: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function formatDate(value: string | null) { return value ? `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC` : "Not set"; }

function EventFields({ event }: { event?: AdminEvent }) {
  return <div className="admin-event-fields">
    <label>Title<input name="title" required maxLength={160} defaultValue={event?.title} /></label>
    <label>Event type<input name="event_type" required maxLength={80} defaultValue={event?.event_type} placeholder="Workshop" /></label>
    <label>Status<select name="status" defaultValue={event?.status ?? "upcoming"}><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="cancelled">Cancelled</option></select></label>
    <label>Starts at (UTC)<input name="starts_at" type="datetime-local" required defaultValue={toDateTimeLocal(event?.starts_at ?? null)} /></label>
    <label>Ends at (UTC)<input name="ends_at" type="datetime-local" defaultValue={toDateTimeLocal(event?.ends_at ?? null)} /></label>
    <label>Location<input name="location" maxLength={200} defaultValue={event?.location ?? ""} placeholder="Online or venue" /></label>
    <label>Capacity<input name="capacity" type="number" min="1" max="100000" defaultValue={event?.capacity ?? ""} /></label>
    <label className="admin-event-publish"><input name="is_published" type="checkbox" defaultChecked={event?.is_published ?? false} style={{ width: "auto", minHeight: "auto" }} />Publish on the public calendar</label>
    <label className="admin-event-field-wide">Description<textarea name="context" maxLength={2000} defaultValue={event?.context ?? ""} /></label>
  </div>;
}

function CreateEventForm() {
  const [state, action, pending] = useActionState(createEvent, initialEventFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);
  return <details className="admin-event-create"><summary><CalendarPlus size={17} aria-hidden="true" />Create event</summary><form action={action} ref={formRef}><EventFields /><div className="admin-event-actions"><button className="button" type="submit" disabled={pending}>{pending ? "Creating…" : "Create event"}</button><p className={`admin-event-message ${state.status}`} aria-live="polite">{state.message}</p></div></form></details>;
}

function EditEventForm({ event }: { event: AdminEvent }) {
  const [state, action, pending] = useActionState(updateEvent, initialEventFormState);
  return <details className="admin-event-edit"><summary><Pencil size={15} aria-hidden="true" />Edit</summary><form action={action}><input type="hidden" name="event_id" value={event.id} /><EventFields event={event} /><div className="admin-event-actions"><button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button><p className={`admin-event-message ${state.status}`} aria-live="polite">{state.message}</p></div></form></details>;
}

function AttendeeList({ event }: { event: AdminEvent }) {
  if (!event.attendees.length) return null;
  return <details className="admin-event-attendees"><summary>{event.attendees.length} active registration{event.attendees.length === 1 ? "" : "s"}</summary><div>{event.attendees.map((attendee) => <div className="admin-event-attendee" key={attendee.profile_id}><div><strong>{attendee.fullName}</strong><span>{attendee.handle}</span></div><EventAttendanceControl eventId={event.id} profileId={attendee.profile_id} status={attendee.status} /></div>)}</div></details>;
}

export function EventManagement({ events }: { events: AdminEvent[] }) {
  return <section className="admin-events" aria-labelledby="admin-events-title"><div className="admin-directory-head"><div><div className="eyebrow">Community calendar</div><h2 id="admin-events-title">Events, in motion.</h2><p>Create and update the gatherings members can see and join.</p></div><span className="admin-directory-icon"><CalendarPlus size={21} aria-hidden="true" /></span></div><CreateEventForm />
    {events.length === 0 ? <div className="admin-member-empty"><CalendarPlus size={24} aria-hidden="true" /><h3>No events yet.</h3><p>Create the first event to start the community calendar.</p></div> : <div className="admin-event-list" role="list">{events.map((event) => <article className="admin-event-row" key={event.id} role="listitem"><div className="admin-event-main"><div><span className="tag">{event.event_type}</span><span className={`admin-event-status ${event.status}`}>{event.status}</span><span className="admin-event-status">{event.is_published ? "published" : "draft"}</span></div><h3>{event.title}</h3><p>{event.context || "No description provided."}</p><div className="admin-event-meta"><span>{formatDate(event.starts_at)}{event.ends_at ? ` – ${formatDate(event.ends_at)}` : ""}</span><span><MapPin size={14} aria-hidden="true" />{event.location || "Location to be confirmed"}</span><span><UsersRound size={14} aria-hidden="true" />{event.registrationCount}{event.capacity ? ` / ${event.capacity}` : ""} registered</span></div><AttendeeList event={event} /></div><EditEventForm event={event} /></article>)}</div>}
  </section>;
}
