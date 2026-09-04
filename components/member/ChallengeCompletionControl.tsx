"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { completeChallenge, initialChallengeCompletionState } from "@/app/member/challenges/actions";

export function ChallengeCompletionControl({ challengeId, isCompleted }: { challengeId: string; isCompleted: boolean }) {
  const [state, action, pending] = useActionState(completeChallenge, initialChallengeCompletionState);
  const completed = isCompleted || state.status === "completed" || state.status === "already_completed";

  if (completed) return <div className="challenge-completion-state" role="status"><Check size={15} aria-hidden="true" />{state.result ? <span>{state.message} {state.result.pointsAwarded > 0 ? `+${state.result.pointsAwarded} points. ` : ""}Total: {state.result.totalPoints} points. Streak: {state.result.streak} days.</span> : <span>Completed</span>}</div>;

  return <div className="challenge-completion-control"><form action={action}><input type="hidden" name="challenge_id" value={challengeId} /><button className="button" type="submit" disabled={pending || completed}>{pending ? <><LoaderCircle size={15} aria-hidden="true" />Completing...</> : <><Check size={15} aria-hidden="true" />Complete challenge</>}</button></form>{state.result ? <p className="challenge-completion-feedback" role="status">{state.message} {state.result.pointsAwarded > 0 ? `+${state.result.pointsAwarded} points. ` : ""}Total: {state.result.totalPoints} points. Streak: {state.result.streak} days.</p> : state.status === "error" ? <p className="challenge-completion-feedback error" role="alert">{state.message}</p> : null}</div>;
}