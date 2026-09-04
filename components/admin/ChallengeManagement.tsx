"use client";

import { useActionState, useEffect, useRef } from "react";
import { Pencil, Plus, Target } from "lucide-react";
import { createChallenge, initialChallengeFormState, updateChallenge } from "@/app/admin/challenges/actions";
import type { AdminChallenge, AdminChallengeData } from "@/lib/services/admin-challenges";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function LearningPathOptions({ paths }: { paths: AdminChallengeData["learningPaths"] }) {
  return <>
    <option value="">Select a learning path</option>
    {paths.map((path) => <option key={path.id} value={path.id}>{path.title}{path.is_published ? "" : " (unpublished)"}</option>)}
  </>;
}

function ChallengeFields({ challenge, learningPaths }: { challenge?: AdminChallenge; learningPaths: AdminChallengeData["learningPaths"] }) {
  return <div className="admin-event-fields">
    <label>Title<input name="title" required maxLength={160} defaultValue={challenge?.title} /></label>
    <label>Learning path<select name="learning_path_id" required defaultValue={challenge?.learning_path_id ?? ""}><LearningPathOptions paths={learningPaths} /></select></label>
    <label>Difficulty<select name="level" required defaultValue={challenge?.level ?? "starter"}><option value="starter">Starter</option><option value="builder">Builder</option><option value="architect">Architect</option></select></label>
    <label>Points<input name="points" type="number" min="0" max="1000000" required defaultValue={challenge?.points ?? 0} /></label>
    <label>Position<input name="sort_order" type="number" min="0" max="1000000" required defaultValue={challenge?.sort_order ?? 0} /></label>
    <label><input name="is_published" type="checkbox" defaultChecked={challenge?.is_published ?? true} />Published for members</label>
    <label className="admin-event-field-wide">Summary<textarea name="detail" maxLength={2000} defaultValue={challenge?.detail} /></label>
  </div>;
}

function CreateChallengeForm({ learningPaths }: { learningPaths: AdminChallengeData["learningPaths"] }) {
  const [state, action, pending] = useActionState(createChallenge, initialChallengeFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);
  return <details className="admin-event-create"><summary><Plus size={17} aria-hidden="true" />Create challenge</summary><form action={action} ref={formRef}><ChallengeFields learningPaths={learningPaths} /><div className="admin-event-actions"><button className="button" type="submit" disabled={pending}>{pending ? "Creating..." : "Create challenge"}</button><p className={`admin-event-message ${state.status}`} aria-live="polite">{state.message}</p></div></form></details>;
}

function EditChallengeForm({ challenge, learningPaths }: { challenge: AdminChallenge; learningPaths: AdminChallengeData["learningPaths"] }) {
  const [state, action, pending] = useActionState(updateChallenge, initialChallengeFormState);
  return <details className="admin-event-edit"><summary><Pencil size={15} aria-hidden="true" />Edit</summary><form action={action}><input type="hidden" name="challenge_id" value={challenge.id} /><ChallengeFields challenge={challenge} learningPaths={learningPaths} /><div className="admin-event-actions"><button className="button" type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</button><p className={`admin-event-message ${state.status}`} aria-live="polite">{state.message}</p></div></form></details>;
}

export function ChallengeManagement({ data }: { data: AdminChallengeData }) {
  return <section className="admin-events" aria-labelledby="admin-challenges-title"><div className="admin-directory-head"><div><div className="eyebrow">Challenge catalogue</div><h2 id="admin-challenges-title">Challenges, in motion.</h2><p>Curate practical missions members can take from learning to evidence.</p></div><span className="admin-directory-icon"><Target size={21} aria-hidden="true" /></span></div><CreateChallengeForm learningPaths={data.learningPaths} />
    {data.challenges.length === 0 ? <div className="admin-member-empty"><Target size={24} aria-hidden="true" /><h3>No challenges yet.</h3><p>Create the first challenge for an existing learning path.</p></div> : <div className="admin-event-list" role="list">{data.challenges.map((challenge) => <article className="admin-event-row" key={challenge.id} role="listitem"><div className="admin-event-main"><div><span className="tag">{challenge.level}</span><span className={`admin-event-status ${challenge.is_published ? "" : "past"}`}>{challenge.is_published ? "Published" : "Unpublished"}</span></div><h3>{challenge.title}</h3><p>{challenge.detail || "No summary provided."}</p><div className="admin-event-meta"><span><Target size={14} aria-hidden="true" />{challenge.learningPathTitle}</span><span>{challenge.points} pts</span><span>Position {challenge.sort_order}</span><span>Created {formatDate(challenge.created_at)} · Updated {formatDate(challenge.updated_at)}</span></div></div><EditChallengeForm challenge={challenge} learningPaths={data.learningPaths} /></article>)}</div>}
  </section>;
}