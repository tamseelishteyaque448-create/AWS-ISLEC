import type { Activity } from "@/data/activities";
import Link from "next/link";

export function ActivityList({ activities }: { activities: Activity[] }) { return <section className="content-section"><div className="section-heading"><h2>Recent activity</h2><Link className="section-action" href="/member/activities">View all →</Link></div><div className="list">{activities.map(activity => <div className="list-item" key={activity.id}><div><strong>{activity.title}</strong><div className="muted">{activity.detail} / {activity.date}</div></div><span className="tag">+{activity.points}</span></div>)}</div></section>; }
