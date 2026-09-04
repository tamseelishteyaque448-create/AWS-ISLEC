"use client";

import { useActionState, useEffect, useRef } from "react";
import { BookOpen, Pencil, Plus, Target } from "lucide-react";
import { createLearningPath, initialLearningPathFormState, updateLearningPath } from "@/app/admin/learning/actions";
import type { AdminLearningPath } from "@/lib/services/admin-learning";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function LearningPathFields({ path }: { path?: AdminLearningPath }) {
  return <div className="admin-event-fields">
    <label>Title<input name="title" required maxLength={160} defaultValue={path?.title} /></label>
    <label>Level<select name="level" required defaultValue={path?.level ?? "starter"}><option value="starter">Starter</option><option value="builder">Builder</option><option value="architect">Architect</option></select></label>
    <label>Estimated minutes<input name="estimated_minutes" type="number" min="1" max="100000" defaultValue={path?.estimated_minutes ?? ""} /></label>
    <label>Points<input name="points" type="number" min="0" max="1000000" required defaultValue={path?.points ?? 0} /></label>
    <label>Position<input name="sort_order" type="number" min="0" max="1000000" required defaultValue={path?.sort_order ?? 0} /></label>
    <label><input name="is_published" type="checkbox" defaultChecked={path?.is_published ?? true} />Published for members</label>
    <label className="admin-event-field-wide">Description<textarea name="description" maxLength={2000} defaultValue={path?.description} /></label>
  </div>;
}

function CreateLearningPathForm() {
  const [state, action, pending] = useActionState(createLearningPath, initialLearningPathFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);
  return <details className="admin-event-create"><summary><Plus size={17} aria-hidden="true" />Create learning path</summary><form action={action} ref={formRef}><LearningPathFields /><div className="admin-event-actions"><button className="button" type="submit" disabled={pending}>{pending ? "Creating..." : "Create learning path"}</button><p className={`admin-event-message ${state.status}`} aria-live="polite">{state.message}</p></div></form></details>;
}

function EditLearningPathForm({ path }: { path: AdminLearningPath }) {
  const [state, action, pending] = useActionState(updateLearningPath, initialLearningPathFormState);
  return <details className="admin-event-edit"><summary><Pencil size={15} aria-hidden="true" />Edit</summary><form action={action}><input type="hidden" name="learning_path_id" value={path.id} /><LearningPathFields path={path} /><div className="admin-event-actions"><button className="button" type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</button><p className={`admin-event-message ${state.status}`} aria-live="polite">{state.message}</p></div></form></details>;
}

export function LearningPathManagement({ paths }: { paths: AdminLearningPath[] }) {
  return <section className="admin-events" aria-labelledby="admin-learning-title"><div className="admin-directory-head"><div><div className="eyebrow">Curriculum catalogue</div><h2 id="admin-learning-title">Learning, made visible.</h2><p>Create focused paths and control what members can access.</p></div><span className="admin-directory-icon"><BookOpen size={21} aria-hidden="true" /></span></div><CreateLearningPathForm />
    {paths.length === 0 ? <div className="admin-member-empty"><BookOpen size={24} aria-hidden="true" /><h3>No learning paths yet.</h3><p>Create the first path to start the member curriculum.</p></div> : <div className="admin-event-list" role="list">{paths.map((path) => <article className="admin-event-row" key={path.id} role="listitem"><div className="admin-event-main"><div><span className="tag">{path.level}</span><span className={`admin-event-status ${path.is_published ? "" : "past"}`}>{path.is_published ? "Published" : "Unpublished"}</span></div><h3>{path.title}</h3><p>{path.description || "No description provided."}</p><div className="admin-event-meta"><span><Target size={14} aria-hidden="true" />{path.challengeCount} {path.challengeCount === 1 ? "challenge" : "challenges"}</span><span>Position {path.sort_order}</span><span>{path.points} pts{path.estimated_minutes ? ` / ${path.estimated_minutes} min` : ""}</span><span>Created {formatDate(path.created_at)} · Updated {formatDate(path.updated_at)}</span></div></div><EditLearningPathForm path={path} /></article>)}</div>}
  </section>;
}