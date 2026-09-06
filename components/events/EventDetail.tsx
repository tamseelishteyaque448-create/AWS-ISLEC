import type { ReactNode } from "react";
import Image from "next/image";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import { EventDateTime } from "@/components/events/EventDateTime";
import type { EventWithPresentation } from "@/lib/services/events";

export function EventDetail({ event, action }: { event: EventWithPresentation; action?: ReactNode }) {
  const availability = event.capacity === null ? "No attendance limit" : event.availableSlots === 0 ? "Full" : `${event.availableSlots} of ${event.capacity} places available`;
  return <article className="event-detail">
    <div className="event-detail-poster">{event.posterUrl ? <Image src={event.posterUrl} alt={event.poster_alt || `${event.title} event poster`} width={800} height={1000} unoptimized /> : <div className="event-poster-placeholder"><CalendarDays size={42} aria-hidden="true" /><span>{event.event_type}</span></div>}</div>
    <div className="event-detail-main"><div className="event-detail-eyebrow"><span className="tag">{event.event_type}</span><span className={`event-state ${event.effectiveStatus}`}>{event.effectiveStatus === "upcoming" ? "Upcoming" : event.effectiveStatus}</span></div><h1>{event.title}</h1><p className="event-detail-summary">{event.context || "Details coming soon."}</p><div className="event-detail-facts"><div><CalendarDays size={18} aria-hidden="true" /><p><EventDateTime startsAt={event.starts_at} endsAt={event.ends_at} /></p></div><div><MapPin size={18} aria-hidden="true" /><p><strong>{event.location || "Location to be confirmed"}</strong><span>Location</span></p></div><div><UsersRound size={18} aria-hidden="true" /><p><strong>{availability}</strong><span>{event.registeredCount} registered</span></p></div></div>{action ? <div className="event-detail-action">{action}</div> : null}</div>
    {event.details ? <section className="event-detail-details"><div className="eyebrow">The details</div><h2>Come prepared.</h2>{event.details.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section> : null}
  </article>;
}
