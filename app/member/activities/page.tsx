import { ActivityList } from "@/components/cards/ActivityList";
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

	return <><Topline section="Everything you have done" /><PageIntro kicker="Activity log" title="Keep the trail visible." description="A simple record of your learning, building, and showing up." />{activities.length === 0 ? <div className="panel"><h2>No activity yet.</h2><p className="muted">Your learning, building, and community moments will appear here.</p></div> : <ActivityList activities={activities} />}</>;
}
