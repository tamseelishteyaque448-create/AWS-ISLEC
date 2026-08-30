import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { mockRepository } from "@/lib/services";

export default function Achievements() {
  return <><Topline section="Proof of practice" /><PageIntro kicker="Milestones" title="Collect the useful wins." description="Badges mark the moments where a new capability became part of your toolkit." /><div className="grid">{mockRepository.getBadges().map(badge => <article className="panel" key={badge.title}><div className="badge-mark">{badge.icon}</div><h2 style={{ marginTop: 18 }}>{badge.title}</h2><p className="muted">{badge.detail}</p><span className="tag">{badge.earned ? "Earned" : "Locked"}</span></article>)}</div></>;
}
