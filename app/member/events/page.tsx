import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin, UsersRound } from "lucide-react";
import { EventRegistrationControl } from "@/components/member/EventRegistrationControl";
import { Topline } from "@/components/ui/Topline";
import { getMemberEvents } from "@/lib/services/events";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function getDateParts(value: string) {
  const parts = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).formatToParts(new Date(value));
  return {
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
  };
}

export default async function Events() {
  const events = await getMemberEvents().catch(() => null);
  const now = new Date();
  const upcomingEvents = events?.filter((event) => event.effectiveStatus === "upcoming") ?? [];
  const registeredEvents = events?.filter((event) => event.registrationStatus === "registered") ?? [];
  const thisMonthEvents = events?.filter((event) => {
    const date = new Date(event.starts_at);
    return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
  }) ?? [];

  return <>
    <Topline section="Make room for serendipity" />
    <header className="member-events-hero">
      <div>
        <span className="eyebrow">Community calendar</span>
        <h1>Build together.<br />Learn together.</h1>
        <p>Workshops, sessions, study halls, orientations, and community moments happening at AWS ISLEC.</p>
      </div>
      {events !== null && <div className="member-events-metrics" aria-label="Calendar metrics">
        <div><strong>{upcomingEvents.length}</strong><span>Upcoming</span></div>
        <div><strong>{registeredEvents.length}</strong><span>Registered</span></div>
        <div><strong>{thisMonthEvents.length}</strong><span>This month</span></div>
      </div>}
    </header>
    {events === null ? <section className="admin-member-error"><h2>The event calendar is unavailable.</h2><p>Please refresh the page and try again.</p></section> : events.length === 0 ? <section className="member-events-empty"><CalendarDays size={24} aria-hidden="true" /><div><span className="eyebrow">Nothing scheduled yet</span><h2>Make room for the next gathering.</h2><p>Check back soon for the next opportunity to learn and build with the community.</p></div></section> : <section className="member-events-feed" aria-label="Community events"><div className="member-events-feed-heading"><div><span className="eyebrow">On the calendar</span><h2>Reasons to show up.</h2></div><span>{events.length} {events.length === 1 ? "event" : "events"}</span></div><div className="member-events-list">{events.map((event) => {
      const date = getDateParts(event.starts_at);
      return <article className="list-item" key={event.id}>
        <div className="member-event-date" aria-label={`Event date: ${date.weekday} ${date.month} ${date.day}`}>
          <span>{date.weekday}</span><strong>{date.day}</strong><span>{date.month}</span>
        </div>
        <div className="member-event-copy">
          <div className="member-event-labels"><span className="tag">{event.event_type}</span><span className={`member-event-status ${event.effectiveStatus}`}>{event.effectiveStatus === "upcoming" ? "Upcoming" : event.effectiveStatus}</span>{event.registrationStatus === "registered" ? <span className="member-event-registered">Registered</span> : null}</div>
          <h3><Link href={`/member/events/${event.slug}`}>{event.title}</Link></h3>
          {event.context ? <p className="muted">{event.context}</p> : null}
          <div className="member-event-meta"><span><Clock3 size={14} aria-hidden="true" />{formatTime(event.starts_at)} UTC{event.ends_at ? ` – ${formatTime(event.ends_at)} UTC` : ""}</span><span><MapPin size={14} aria-hidden="true" />{event.location || "Location to be confirmed"}</span>{event.capacity ? <span><UsersRound size={14} aria-hidden="true" />{event.availableSlots === 0 ? "Full" : `${event.availableSlots ?? event.capacity} spots left`}</span> : null}</div>
        </div>
        <div className="member-event-actions"><Link className="member-event-details" href={`/member/events/${event.slug}`}>View details <ArrowRight size={16} aria-hidden="true" /></Link><EventRegistrationControl eventId={event.id} registrationStatus={event.registrationStatus} registrationOpen={event.registrationOpen} cancellationOpen={event.cancellationOpen} /></div>
      </article>;
    })}</div></section>}
  </>;
}
