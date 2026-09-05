"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { initialEventAttendanceState, recordEventAttendance } from "@/app/admin/events/actions";

export function EventAttendanceControl({ eventId, profileId, status }: { eventId: string; profileId: string; status: string }) {
  const [state, formAction, pending] = useActionState(recordEventAttendance, initialEventAttendanceState);
  if (status === "attended") return <span className="tag">Attended</span>;

  return <form action={formAction}>
    <input type="hidden" name="event_id" value={eventId} />
    <input type="hidden" name="profile_id" value={profileId} />
    <button className="button button-secondary" type="submit" disabled={pending}>{pending ? <LoaderCircle size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}Mark attended</button>
    {state.message ? <p className={`event-registration-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
  </form>;
}
