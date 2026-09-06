import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/EventDetail";
import { getPublicEventBySlug } from "@/lib/services/events";

export default async function PublicEventDetailPage(props: PageProps<"/events/[slug]">) {
  const { slug } = await props.params;
  const event = await getPublicEventBySlug(slug).catch(() => null);
  if (!event) notFound();
  return <><Link className="event-back" href="/events"><ArrowLeft size={16} aria-hidden="true" />All events</Link><EventDetail event={event} action={<Link className="button" href={`/member/events/${event.slug}`}>Join from member calendar <ArrowRight size={16} aria-hidden="true" /></Link>} /></>;
}
