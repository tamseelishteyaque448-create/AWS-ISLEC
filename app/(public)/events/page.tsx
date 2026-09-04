import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin, Presentation, UsersRound } from "lucide-react";
import { mockRepository } from "@/lib/services";
import { getEventStatus } from "@/data/events";

const communityPromises = [
  "Come with a question, not a polished answer.",
  "Make room for every kind of first attempt.",
  "Leave with one useful next step.",
];

export default function EventsPage() {
  const events = mockRepository.getEvents().map((event) => ({ ...event, status: getEventStatus(event) }));
  const upcomingEvents = events.filter((event) => event.status === "Upcoming");
  const pastEvents = events.filter((event) => event.status === "Past");
  const nextEvent = upcomingEvents[0];

  return <>
    <section className="events-hero">
      <div>
        <div className="eyebrow">The AWS ISLEC event hub</div>
        <h1>Make room for<br /><span>serendipity.</span></h1>
        <p>Study halls, workshops, and demo nights for the moments when a good conversation, a fresh perspective, or a shared deadline can move your work forward.</p>
        <div className="hero-actions"><Link className="button" href="/member/events">See the member calendar <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-secondary" href="/join">Join the community</Link></div>
      </div>
      <aside className="events-next" aria-label="Next community event">
        <div className="events-next-label"><span className="eyebrow">Next up</span><span className="events-live-dot" aria-hidden="true" /></div>
        <div className="events-next-date">{nextEvent.date}</div><h2>{nextEvent.title}</h2><p>{nextEvent.context}</p>
        <div className="events-next-meta"><span><Clock3 size={15} aria-hidden="true" />{nextEvent.time}</span><span><MapPin size={15} aria-hidden="true" />{nextEvent.type}</span></div>
      </aside>
    </section>

    <section className="events-section" aria-labelledby="upcoming-title">
      <div className="events-section-heading"><div><div className="eyebrow">On the calendar</div><h2 id="upcoming-title">Reasons to show up.</h2></div><p>Join from wherever you are. Bring a project, a curiosity, or simply the willingness to meet someone building beside you.</p></div>
      <div className="upcoming-event-list">{upcomingEvents.map((event) => <article key={event.title}><div className="upcoming-event-date"><strong>{event.date.split(" ")[0]}</strong><span>{event.date.split(" ")[1]}</span></div><div className="upcoming-event-copy"><div><span className="tag">{event.type}</span><span className="event-status">{event.status}</span></div><h3>{event.title}</h3><p>{event.context}</p><div className="upcoming-event-meta"><span><Clock3 size={14} aria-hidden="true" />{event.time}</span><span><UsersRound size={14} aria-hidden="true" />{event.attendance}</span></div></div><Link className="upcoming-event-action" href="/member/events" aria-label={`Participate in ${event.title}`}>Participate <ArrowRight size={16} aria-hidden="true" /></Link></article>)}</div>
    </section>

    <section className="events-section events-community" aria-labelledby="community-title">
      <div className="events-community-card"><div className="events-community-icon"><UsersRound size={24} aria-hidden="true" /></div><div><div className="eyebrow">The room matters</div><h2 id="community-title">Come as you are. Leave with momentum.</h2><p>AWS ISLEC gatherings are deliberately low-pressure and high-context: spaces to try things out loud, share a rough edge, and recognize progress before it looks impressive.</p></div><ul>{communityPromises.map((promise) => <li key={promise}>{promise}</li>)}</ul></div>
    </section>

    <section className="events-section" aria-labelledby="past-title">
      <div className="events-section-heading"><div><div className="eyebrow">A trail of good rooms</div><h2 id="past-title">What we have been learning together.</h2></div><Link className="section-action" href="/member/events">Browse member events <ArrowRight size={14} aria-hidden="true" /></Link></div>
      <div className="past-event-grid">{pastEvents.map((event) => <article key={event.title}><div className="past-event-head"><span>{event.date}</span><Presentation size={19} aria-hidden="true" /></div><span className="tag">{event.type}</span><h3>{event.title}</h3><p>{event.context}</p><div><span>{event.attendance}</span><Link href="/member/events" aria-label={`View recap for ${event.title}`}>View recap <ArrowRight size={14} aria-hidden="true" /></Link></div></article>)}</div>
    </section>

    <section className="events-cta" aria-labelledby="cta-title"><div><div className="eyebrow">Your next good room</div><h2 id="cta-title">The right conversation can change the shape of a project.</h2></div><div><Link className="button" href="/join">Find your people <UsersRound size={16} aria-hidden="true" /></Link><Link className="events-cta-link" href="/member/events">Enter member workspace <CalendarDays size={16} aria-hidden="true" /></Link></div></section>
  </>;
}
