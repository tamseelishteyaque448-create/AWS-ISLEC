"use client";
import { useActionState } from "react";
import { Check, LoaderCircle, Send } from "lucide-react";
import { requestProjectJoin, submitProjectWork } from "@/app/member/projects/actions";
import type { ProjectMemberState } from "@/app/member/projects/actions";

const initialProjectMemberState: ProjectMemberState = { status: "idle" };

const CONTRIBUTION_AREAS = [
  "AWS / Cloud infrastructure",
  "Backend development",
  "Frontend development",
  "AI / ML",
  "UI / UX design",
  "Product",
  "Documentation",
  "Other",
] as const;

export function ProjectMembershipControl({
  projectId,
  membershipStatus,
  joinRequestStatus,
  canRequest,
}: {
  projectId: string;
  membershipStatus: string | null;
  joinRequestStatus?: string | null;
  canRequest: boolean;
}) {
  const action = membershipStatus === "active" ? submitProjectWork : requestProjectJoin;
  const [state, formAction, pending] = useActionState(action, initialProjectMemberState);

  if (membershipStatus === "requested" || joinRequestStatus === "requested") return <span className="tag">Request pending</span>;
  if (membershipStatus === "submitted") return <span className="tag">Under review</span>;
  if (membershipStatus === "completed") return <span className="tag">Completed</span>;
  if (!canRequest) return <span className="tag">Not accepting requests</span>;

  return (
    <form action={formAction}>
      <input type="hidden" name="project_id" value={projectId} />
      {membershipStatus !== "active" ? (
        <>
          <label className="sr-only" htmlFor={`contribution-${projectId}`}>Contribution area</label>
          <select
            id={`contribution-${projectId}`}
            name="contribution"
            required
            style={{ marginBottom: 8, display: "block", width: "100%" }}
          >
            <option value="">Select contribution area…</option>
            {CONTRIBUTION_AREAS.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
          <input name="message" maxLength={1000} placeholder="Optional message" style={{ display: "block", width: "100%", marginBottom: 8 }} />
        </>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? <LoaderCircle size={15} aria-hidden="true" /> : membershipStatus === "active" ? <Send size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
        {membershipStatus === "active" ? "Submit work" : "Request access"}
      </button>
      {state.message ? <p className={`event-registration-message ${state.status}`}>{state.message}</p> : null}
    </form>
  );
}
