"use client";

import { EventDetailError } from "@/components/events/EventDetailError";

export default function PublicEventDetailError({ reset }: { reset: () => void }) { return <EventDetailError reset={reset} />; }
