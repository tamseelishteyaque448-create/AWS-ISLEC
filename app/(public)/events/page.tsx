import { ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { getPublicEvents } from "@/lib/services/events";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export default async function PublicEventsPage() {
  const events = await getPublicEvents().catch(() => null);
  const upcoming = events?.filter((event) => event.status === "upcoming") ?? [];
  const past = events?.filter((event) => event.status === "past") ?? [];

  return <>
    <section className="events-hero">
      <div><span className="eyebrow">The AWS ISLEC calendar</span><h1>Good rooms, <span>on purpose.</span></h1><p>Workshops, study halls, and practical conversations for people building their way into technology.</p><div className="hero-actions"><Link className="button" href="/member/events">Open the member calendar <ArrowRight size={16} aria-hidden="true" /></Link></div></div>
      <aside className="events-next"><div className="events-next-label"><span className="eyebrow">Next up</span><span className="events-live-dot" aria-hidden="true" /></div>{upcoming[0] ? <><div className="events-next-date">{formatDate(upcoming[0].starts_at)} UTC</div><h2>{upcoming[0].title}</h2><p>{upcoming[0].context || "Details coming soon."}</p><div className="events-next-meta"><span><Clock3 size={15} aria-hidden="true" />{upcoming[0].event_type}</span><span><MapPin size={15} aria-hidden="true" />{upcoming[0].location || "Location to be confirmed"}</span></div></> : <p>No upcoming events have been published yet. Check back soon.</p>}</aside>
    </section>
    <section className="events-section" aria-labelledby="upcoming-title"><div className="events-section-heading"><div><div className="eyebrow">On the calendar</div><h2 id="upcoming-title">Reasons to show up.</h2></div><p>Bring a project, a curiosity, or simply the willingness to meet someone building beside you.</p></div>{events === null ? <p className="muted">The calendar is unavailable right now.</p> : upcoming.length === 0 ? <p className="muted">No upcoming events have been published yet.</p> : <div className="upcoming-event-list">{upcoming.map((event) => <article key={event.id}><div className="upcoming-event-copy"><div><span className="tag">{event.event_type}</span><span className="event-status">Upcoming</span></div><h3>{event.title}</h3><p>{event.context || "Details coming soon."}</p><div className="upcoming-event-meta"><span><Clock3 size={14} aria-hidden="true" />{formatDate(event.starts_at)} UTC</span><span><MapPin size={14} aria-hidden="true" />{event.location || "Location to be confirmed"}</span></div></div><Link className="upcoming-event-action" href="/member/events">Participate <ArrowRight size={16} aria-hidden="true" /></Link></article>)}</div>}</section>
    {past.length ? <section className="events-section" aria-labelledby="past-title"><div className="events-section-heading"><div><div className="eyebrow">A trail of good rooms</div><h2 id="past-title">What we have been learning together.</h2></div></div><div className="past-event-grid">{past.map((event) => <article key={event.id}><div className="past-event-head"><span>{formatDate(event.starts_at)} UTC</span><CalendarDays size={19} aria-hidden="true" /></div><span className="tag">{event.event_type}</span><h3>{event.title}</h3><p>{event.context || "A community gathering."}</p></article>)}</div></section> : null}
  </>;
}
