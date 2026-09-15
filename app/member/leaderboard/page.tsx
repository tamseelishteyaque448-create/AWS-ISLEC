import { Crown, Flame, Medal, Trophy } from "lucide-react";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

const podiumMeta = {
	1: { label: "1st", title: "Community leader", icon: Crown, className: "gold" },
	2: { label: "2nd", title: "Setting the pace", icon: Medal, className: "silver" },
	3: { label: "3rd", title: "On the podium", icon: Medal, className: "bronze" },
} as const;

export default async function Leaderboard() {
	let leaders;

	try {
		leaders = await supabaseRepository.getLeaderboard();
	} catch {
		return <><Topline section="A little friendly pressure" /><header className="leaderboard-hero"><div><span className="eyebrow">Community leaderboard</span><h1>The builders setting the pace.</h1><p>See who&apos;s learning, building, contributing, and moving the community forward.</p></div></header><div className="panel"><h2>The leaderboard could not load.</h2><p className="muted">Please refresh the page and try again.</p></div></>;
	}

	const currentMember = leaders.find((leader) => leader.isCurrentMember);
	const podium = leaders.filter((leader) => leader.rank <= 3);
	const remaining = leaders.filter((leader) => leader.rank > 3);

	return <><Topline section="A little friendly pressure" /><header className="leaderboard-hero"><div><span className="eyebrow">Community leaderboard</span><h1>The builders setting the pace.</h1><p>See who&apos;s learning, building, contributing, and moving the community forward.</p></div><div className="leaderboard-hero-note"><Trophy size={22} aria-hidden="true" /><span className="eyebrow">Keep going</span><strong>Every contribution moves the community forward.</strong></div></header>{leaders.length === 0 ? <div className="panel"><h2>No leaderboard entries yet.</h2><p className="muted">Member progress will appear here as the community gets moving.</p></div> : <><section className="leaderboard-summary" aria-label="Leaderboard summary"><div><span className="eyebrow">Community members</span><strong>{leaders.length}</strong><span>Ranking this season</span></div><div><span className="eyebrow">Your position</span><strong>{currentMember ? `#${currentMember.rank}` : "—"}</strong><span>{currentMember ? `${currentMember.points.toLocaleString()} points earned` : "Keep building to appear"}</span></div><div><span className="eyebrow">Your momentum</span><strong>{currentMember ? currentMember.streak : "—"}</strong><span>{currentMember ? "Day streak" : "Start your journey"}</span></div></section><section className="leaderboard-podium" aria-labelledby="leaderboard-podium-title"><div className="leaderboard-section-heading"><div><span className="eyebrow">Top of the community</span><h2 id="leaderboard-podium-title">The podium</h2></div><span>Recognition for the people leading by example</span></div><div className="leaderboard-podium-grid">{podium.map((leader) => { const meta = podiumMeta[leader.rank as 1 | 2 | 3]; const Icon = meta.icon; return <article className={`leaderboard-podium-card ${meta.className}`} key={leader.id}><div className="leaderboard-medal"><Icon size={22} aria-hidden="true" /><strong>{meta.label}</strong></div><span className="eyebrow">{meta.title}</span><h3>{leader.name}</h3><p>{leader.handle}</p>{leader.isCurrentMember ? <span className="tag">You</span> : null}<div className="leaderboard-points"><strong>{leader.points.toLocaleString()}</strong><span>points</span></div><div className="leaderboard-streak"><Flame size={14} aria-hidden="true" />{leader.streak} day streak</div></article>; })}</div></section>{remaining.length > 0 && <section className="leaderboard-rankings" aria-labelledby="leaderboard-rankings-title"><div className="leaderboard-section-heading"><div><span className="eyebrow">Keep moving</span><h2 id="leaderboard-rankings-title">Community rankings</h2></div><span>{remaining.length} more {remaining.length === 1 ? "member" : "members"}</span></div><div className="leaderboard-ranking-list">{remaining.map((leader) => <div className={`leaderboard-ranking-row ${leader.isCurrentMember ? "current" : ""}`} key={leader.id}><span className="leaderboard-ranking-number">{String(leader.rank).padStart(2, "0")}</span><div><strong>{leader.name}</strong><span>{leader.handle}</span></div>{leader.isCurrentMember ? <span className="tag">You</span> : null}<strong className="leaderboard-ranking-points">{leader.points.toLocaleString()} <small>pts</small></strong></div>)}</div></section>}</>}</>;
}
