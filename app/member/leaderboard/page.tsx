import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

export default async function Leaderboard() {
	let leaders;

	try {
		leaders = await supabaseRepository.getLeaderboard();
	} catch {
		return <><Topline section="A little friendly pressure" /><PageIntro kicker="Season one" title="People in motion." description="Progress is more fun when you can see the shape of everyone else's journey." /><div className="panel"><h2>The leaderboard could not load.</h2><p className="muted">Please refresh the page and try again.</p></div></>;
	}

	return <><Topline section="A little friendly pressure" /><PageIntro kicker="Season one" title="People in motion." description="Progress is more fun when you can see the shape of everyone else's journey." />{leaders.length === 0 ? <div className="panel"><h2>No leaderboard entries yet.</h2><p className="muted">Member progress will appear here as the community gets moving.</p></div> : <div className="list">{leaders.map((leader) => <div className="list-item" key={leader.id}><div style={{ display: "flex", gap: 22, alignItems: "center" }}><span className="eyebrow">{String(leader.rank).padStart(2, "0")}</span><div><strong>{leader.name}</strong><div className="muted">{leader.handle}</div></div>{leader.isCurrentMember ? <span className="tag">You</span> : null}</div><strong>{leader.points.toLocaleString()} pts</strong></div>)}</div>}</>;
}
