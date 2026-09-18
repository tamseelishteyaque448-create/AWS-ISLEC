import { Award, BookOpen, CalendarDays, FolderKanban, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Activity } from "@/data/activities";
import Link from "next/link";

const activityMeta: Record<Activity["type"], { label: string; icon: LucideIcon }> = {
  project: { label: "Project", icon: FolderKanban },
  lesson: { label: "Lesson", icon: BookOpen },
  challenge: { label: "Challenge", icon: Target },
  event: { label: "Event", icon: CalendarDays },
  badge: { label: "Badge", icon: Award },
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
        return <article className="activity-timeline-item" key={activity.id}>
          <div className={`activity-timeline-node activity-type-${activity.type}`} aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></div>
          <div className="activity-timeline-content">
            <div className="activity-timeline-topline">
              <span className="activity-timeline-type">{meta.label}</span>
              <span className="activity-timeline-points">+{activity.points}</span>
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
