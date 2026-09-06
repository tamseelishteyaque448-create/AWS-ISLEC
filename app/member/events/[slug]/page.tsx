import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/EventDetail";
import { EventRegistrationControl } from "@/components/member/EventRegistrationControl";
import { getMemberEventBySlug } from "@/lib/services/events";

export default async function MemberEventDetailPage(props: PageProps<"/member/events/[slug]">) {
  const { slug } = await props.params;
  const event = await getMemberEventBySlug(slug);
  if (!event) notFound();
  return <><Link className="event-back" href="/member/events"><ArrowLeft size={16} aria-hidden="true" />Member calendar</Link><EventDetail event={event} action={<EventRegistrationControl eventId={event.id} registrationStatus={event.registrationStatus} registrationOpen={event.registrationOpen} cancellationOpen={event.cancellationOpen} />} /></>;
}
