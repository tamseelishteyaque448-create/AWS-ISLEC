import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

export default async function Achievements() {
  let badges;

  try {
    badges = await supabaseRepository.getEarnedBadges();
  } catch {
    return <><Topline section="Proof of practice" /><PageIntro kicker="Milestones" title="Collect the useful wins." description="Badges mark the moments where a new capability became part of your toolkit." /><div className="panel"><h2>Your achievements could not load.</h2><p className="muted">Please refresh the page and try again.</p></div></>;
  }

  return <><Topline section="Proof of practice" /><PageIntro kicker="Milestones" title="Collect the useful wins." description="Badges mark the moments where a new capability became part of your toolkit." />{badges.length === 0 ? <div className="panel"><h2>No badges earned yet.</h2><p className="muted">Complete challenges and keep building your record of progress.</p></div> : <div className="grid">{badges.map((badge) => <article className="panel" key={badge.id}><div className="badge-mark">{badge.icon}</div><h2 style={{ marginTop: 18 }}>{badge.title}</h2><p className="muted">{badge.detail}</p><div className="eyebrow" style={{ marginTop: 20 }}>+{badge.points} pts</div><span className="tag" style={{ marginTop: 14 }}>Earned {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(badge.earnedAt))}</span></article>)}</div>}</>;
}
