"use client";
import { useActionState } from "react";
import { Check, LoaderCircle, Send } from "lucide-react";
import { initialProjectMemberState, requestProjectAccess, submitProjectWork } from "@/app/member/projects/actions";
export function ProjectMembershipControl({ projectId, membershipStatus, canRequest }: { projectId: string; membershipStatus: string | null; canRequest: boolean }) {
  const action = membershipStatus === "active" ? submitProjectWork : requestProjectAccess;
  const [state, formAction, pending] = useActionState(action, initialProjectMemberState);
  if (membershipStatus === "requested") return <span className="tag">Request pending</span>;
  if (membershipStatus === "submitted") return <span className="tag">Under review</span>;
  if (membershipStatus === "completed") return <span className="tag">Completed</span>;
  if (!canRequest) return <span className="tag">Not accepting requests</span>;
  return <form action={formAction}><input type="hidden" name="project_id" value={projectId} /><button className="button" type="submit" disabled={pending}>{pending ? <LoaderCircle size={15} aria-hidden="true" /> : membershipStatus === "active" ? <Send size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{membershipStatus === "active" ? "Submit work" : "Request access"}</button>{state.message ? <p className={`event-registration-message ${state.status}`}>{state.message}</p> : null}</form>;
}
