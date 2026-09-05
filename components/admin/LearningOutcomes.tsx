import { Award, Target, UsersRound } from "lucide-react";
import type { AdminLearningOutcomes } from "@/lib/services/admin-learning-outcomes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export function LearningOutcomes({ outcomes }: { outcomes: AdminLearningOutcomes }) {
  const { summary, recentCompletions } = outcomes;
  return <section className="admin-events" aria-labelledby="learning-outcomes-title">
    <div className="admin-directory-head"><div><div className="eyebrow">Member outcomes</div><h2 id="learning-outcomes-title">Learning, in practice.</h2><p>Authoritative completion and reward history from the member workspace.</p></div><span className="admin-directory-icon"><Target size={21} aria-hidden="true" /></span></div>
    <div className="admin-outcome-metrics" aria-label="Learning outcome totals">
      <div><Target size={16} aria-hidden="true" /><strong>{summary.completionCount.toLocaleString()}</strong><span>completions</span></div>
      <div><UsersRound size={16} aria-hidden="true" /><strong>{summary.memberCount.toLocaleString()}</strong><span>members completed</span></div>
      <div><Award size={16} aria-hidden="true" /><strong>{summary.challengePointsAwarded.toLocaleString()}</strong><span>challenge points awarded</span></div>
    </div>
    {recentCompletions.length === 0 ? <div className="admin-member-empty"><Target size={24} aria-hidden="true" /><h3>No challenge outcomes yet.</h3><p>Published challenges will appear here when members complete them.</p></div> : <div className="admin-event-list" role="list">{recentCompletions.map((completion) => <article className="admin-outcome-row" key={completion.id} role="listitem"><div><strong>{completion.memberName}</strong><span>{completion.memberHandle}</span></div><div><strong>{completion.challengeTitle}</strong><span>{formatDate(completion.completedAt)} UTC</span></div><div className="admin-outcome-reward"><strong>+{completion.challengePoints} pts</strong>{completion.badges.length > 0 ? <span>{completion.badges.map((badge) => `${badge.title} +${badge.points}`).join(", ")}</span> : <span>No new badge</span>}</div></article>)}</div>}
    {summary.badgeAwardCount > 0 ? <p className="admin-outcome-note">{summary.badgeAwardCount.toLocaleString()} badge awards / {summary.badgePointsRecorded.toLocaleString()} badge points recorded since outcome history was introduced.</p> : null}
  </section>;
}
