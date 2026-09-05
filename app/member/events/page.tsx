import { CalendarDays, Clock3, MapPin, UsersRound } from "lucide-react";
import { PageIntro } from "@/components/cards/PageIntro";
import { EventRegistrationControl } from "@/components/member/EventRegistrationControl";
import { Topline } from "@/components/ui/Topline";
import { getMemberEvents } from "@/lib/services/events";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export default async function Events() {
  const events = await getMemberEvents().catch(() => null);

  return <>
    <Topline section="Make room for serendipity" />
    <PageIntro kicker="Gatherings" title="Come as you are." description="A calendar of workshops, study halls, and moments to share the thing you just figured out." />
    {events === null ? <section className="admin-member-error"><h2>The event calendar is unavailable.</h2><p>Please refresh the page and try again.</p></section> : events.length === 0 ? <section className="admin-member-empty"><CalendarDays size={24} aria-hidden="true" /><h2>No events on the calendar yet.</h2><p>Check back soon for the next opportunity to gather.</p></section> : <div className="list">{events.map((event) => {
      return <article className="list-item" key={event.id}>
        <div className="member-event-copy">
          <span className="eyebrow">{event.event_type} · {event.status}</span>
          <strong>{event.title}</strong>
          {event.context ? <p className="muted">{event.context}</p> : null}
          <div className="member-event-meta"><span><Clock3 size={14} aria-hidden="true" />{formatDate(event.starts_at)} UTC</span><span><MapPin size={14} aria-hidden="true" />{event.location || "Location to be confirmed"}</span>{event.capacity ? <span><UsersRound size={14} aria-hidden="true" />Capacity {event.capacity}</span> : null}</div>
        </div>
        <EventRegistrationControl eventId={event.id} registrationStatus={event.registrationStatus} registrationOpen={event.registrationOpen} cancellationOpen={event.cancellationOpen} />
      </article>;
    })}</div>}
  </>;
}
