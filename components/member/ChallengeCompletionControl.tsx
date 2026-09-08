"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { submitChallengeAnswer } from "@/app/member/challenges/actions";
import type { ChallengeCompletionState } from "@/app/member/challenges/actions";

const initialChallengeCompletionState: ChallengeCompletionState = { status: "idle" };

export function ChallengeCompletionControl({ challengeId, isCompleted, options }: { challengeId: string; isCompleted: boolean; options: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState(submitChallengeAnswer, initialChallengeCompletionState);
  const completed = isCompleted || state.status === "completed" || state.status === "already_completed";

  const rewardSummary = state.result ? <>{state.result.pointsAwarded > 0 ? `+${state.result.pointsAwarded} points. ` : ""}{state.result.newBadges.length > 0 ? `New badge${state.result.newBadges.length === 1 ? "" : "s"}: ${state.result.newBadges.map((badge) => `${badge.title} (+${badge.points})`).join(", ")}. ` : ""}Total: {state.result.totalPoints} points. Streak: {state.result.streak} days.</> : null;
  if (completed) return <div className="challenge-completion-state" role="status"><Check size={15} aria-hidden="true" />{state.result ? <span>{state.message} {rewardSummary}</span> : <span>Completed</span>}</div>;

  const multiple = options.length > 3;
  return <div className="challenge-completion-control"><form action={action}><input type="hidden" name="challenge_id" value={challengeId} /><fieldset className="challenge-answer-options" disabled={pending}><legend className="sr-only">Choose your answer</legend>{options.map((option) => <label key={option.id}><input type={multiple ? "checkbox" : "radio"} name="answer" value={option.id} required={!multiple} />{option.label}</label>)}</fieldset><button className="button" type="submit" disabled={pending || completed}>{pending ? <><LoaderCircle size={15} aria-hidden="true" />Checking...</> : <><Check size={15} aria-hidden="true" />Submit answer</>}</button></form>{state.result ? <p className="challenge-completion-feedback" role="status">{state.message} {rewardSummary}</p> : state.status === "incorrect" ? <p className="challenge-completion-feedback error" role="alert">{state.message}</p> : state.status === "error" ? <p className="challenge-completion-feedback error" role="alert">{state.message}</p> : null}</div>;
}
