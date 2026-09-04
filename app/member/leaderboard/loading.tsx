import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";

export default function Loading() {
  return <><Topline section="A little friendly pressure" /><PageIntro kicker="Season one" title="People in motion." description="Loading the community leaderboard." /><div className="panel" aria-busy="true"><p className="muted">Loading leaderboard...</p></div></>;
}