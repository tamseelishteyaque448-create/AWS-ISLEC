"use client";

import { useActionState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { cancelEventRegistration, initialEventRegistrationState, registerForEvent } from "@/app/member/events/actions";

export function EventRegistrationControl({ eventId, registrationStatus, registrationOpen }: { eventId: string; registrationStatus: "registered" | "attended" | "cancelled" | null; registrationOpen: boolean }) {
  const action = registrationStatus === "registered" ? cancelEventRegistration : registerForEvent;
  const [state, formAction, pending] = useActionState(action, initialEventRegistrationState);
  if (registrationStatus === "attended") return <span className="tag">Attended</span>;
  if (registrationStatus === "registered") return <form action={formAction}><input type="hidden" name="event_id" value={eventId} /><button className="button button-secondary" type="submit" disabled={pending || !registrationOpen}>{pending ? <LoaderCircle size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}{registrationOpen ? "Cancel registration" : "Registered"}</button>{state.message ? <p className={`event-registration-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</form>;
  if (!registrationOpen) return <span className="tag">Registration closed</span>;
  return <form action={formAction}><input type="hidden" name="event_id" value={eventId} /><button className="button" type="submit" disabled={pending}>{pending ? <LoaderCircle size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}Register</button>{state.message ? <p className={`event-registration-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</form>;
}
