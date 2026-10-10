import { Award, BookOpen, CalendarDays, FolderKanban, Hammer, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Activity } from "@/data/activities";
import Link from "next/link";

const activityMeta: Record<Activity["type"], { label: string; icon: LucideIcon }> = {
  project: { label: "Project", icon: FolderKanban },
  lesson: { label: "Lesson", icon: BookOpen },
  challenge: { label: "Challenge", icon: Target },
  event: { label: "Event", icon: CalendarDays },
  badge: { label: "Badge", icon: Award },
  build_prove: { label: "Build & Prove", icon: Hammer },
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return <section className="activity-journal" aria-labelledby="activity-journal-title">
    <div className="activity-journal-heading">
      <div>
        <span className="eyebrow">Your progress journal</span>
        <h2 id="activity-journal-title">Recent activity</h2>
      </div>
      <Link className="activity-journal-view-all" href="/member/activities">View all <span aria-hidden="true">→</span></Link>
    </div>
    <div className="activity-timeline">
      {activities.map((activity) => {
        const meta = activityMeta[activity.type];
        const Icon = meta.icon;
        const pointsLabel = activity.type === "build_prove" && activity.points === 0
          ? "0 points"
          : `+${activity.points}`;
        return <article className="activity-timeline-item" key={activity.id}>
          <div className={`activity-timeline-node activity-type-${activity.type}`} aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></div>
          <div className="activity-timeline-content">
            <div className="activity-timeline-topline">
              <span className="activity-timeline-type">{meta.label}</span>
              <span className="activity-timeline-points">{pointsLabel}</span>
            </div>
            <h3>{activity.title}</h3>
            <p>{activity.detail}</p>
            <time>{activity.date}</time>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
