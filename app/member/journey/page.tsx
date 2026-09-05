import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

export default async function Journey() {
  let activities;

  try {
    activities = await supabaseRepository.getActivities();
  } catch {
    return <>
      <Topline section="The long way around" />
      <PageIntro kicker="Journey unavailable" title="Your timeline could not load." description="Please refresh the page and try again." />
    </>;
  }

  return <>
    <Topline section="The long way around" />
    <PageIntro kicker="Your journey" title="Small steps count." description="A living timeline of lessons, builds, and the people who helped you keep moving." />
    {activities.length === 0 ? (
      <section className="panel">
        <h2>Your journey starts here.</h2>
        <p className="muted">Your learning, project, badge, and community moments will appear as you make them.</p>
      </section>
    ) : (
      <div className="list">
        {activities.map((activity, index) => (
          <article className="list-item" key={activity.id}>
            <div>
              <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
              <strong style={{ marginLeft: 16 }}>{activity.title}</strong>
              <p className="muted" style={{ margin: "7px 0 0 44px" }}>{activity.detail}</p>
            </div>
            <span className="tag">{activity.date}</span>
          </article>
        ))}
      </div>
    )}
  </>;
}
