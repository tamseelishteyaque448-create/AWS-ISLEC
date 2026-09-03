import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { badges } from "@/data/badges";
import { supabaseRepository } from "@/lib/services";

export default async function Profile() {
	let profile;

	try {
		profile = await supabaseRepository.getProfile();
	} catch {
		return <><Topline section="A record of becoming" /><PageIntro kicker="Profile unavailable" title="Your profile could not load." description="Please refresh the page and try again." /></>;
	}

	if (!profile) {
		return <><Topline section="A record of becoming" /><PageIntro kicker="Profile unavailable" title="Your profile is not ready yet." description="We could not find a profile for this account. Please try again shortly." /></>;
	}

	return <><Topline section="A record of becoming" /><PageIntro kicker={profile.handle} title={profile.name} description={`${profile.role}. Learning out loud, one small deployment at a time.`} /><div className="grid"><div className="panel"><h2>Points</h2><div className="metric">{profile.points.toLocaleString()}</div></div><div className="panel"><h2>Streak</h2><div className="metric">{profile.streak}<span style={{ color: "var(--aws)" }}>d</span></div></div><div className="panel"><h2>Badges</h2><div className="list">{badges.map(badge => <div className="list-item" key={badge.title}><span>{badge.icon} {badge.title}</span><span className="tag">{badge.earned ? "Earned" : "Locked"}</span></div>)}</div></div></div></>;
}
