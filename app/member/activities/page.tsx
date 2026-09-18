import { ActivityTimeline } from "@/components/cards/ActivityTimeline";
import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

export default async function Activities() {
	let activities;

	try {
		activities = await supabaseRepository.getActivities();
	} catch {
		return <><Topline section="Everything you have done" /><PageIntro kicker="Activity log" title="Keep the trail visible." description="A simple record of your learning, building, and showing up." /><div className="panel"><h2>Your activity could not load.</h2><p className="muted">Please refresh the page and try again.</p></div></>;
	}

	const totalPoints = activities.reduce((total, activity) => total + activity.points, 0);
	const categoryCount = new Set(activities.map((activity) => activity.type)).size;

	return <>
		<Topline section="Everything you have done" />
		<PageIntro kicker="Activity log" title="Keep the trail visible." description="A simple record of your learning, building, and showing up." />
		{activities.length === 0 ? <div className="activity-empty-state"><div className="activity-empty-icon" aria-hidden="true">+</div><div><h2>No activity yet.</h2><p className="muted">Your learning, building, and community moments will appear here.</p></div></div> : <>
			<section className="activity-summary" aria-label="Activity summary">
				<div><span className="eyebrow">Total activities</span><strong>{activities.length}</strong><span>Moments in your record</span></div>
				<div><span className="eyebrow">Points earned</span><strong>{totalPoints.toLocaleString()}</strong><span>Across your activity</span></div>
				<div><span className="eyebrow">Categories</span><strong>{categoryCount}</strong><span>Ways you are moving</span></div>
			</section>
			<ActivityTimeline activities={activities} />
		</>}
	</>;
}
