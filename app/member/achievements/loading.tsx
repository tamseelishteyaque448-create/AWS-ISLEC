import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";

export default function Loading() {
  return <><Topline section="Proof of practice" /><PageIntro kicker="Milestones" title="Collect the useful wins." description="Loading your earned badges." /><div className="panel" aria-busy="true"><p className="muted">Loading achievements...</p></div></>;
}