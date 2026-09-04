import Link from "next/link";
import { ArrowRight, CalendarDays, FolderKanban, GraduationCap, UsersRound } from "lucide-react";
import { ActivityList } from "@/components/cards/ActivityList";
import { Metric } from "@/components/ui/Metric";
import { Topline } from "@/components/ui/Topline";
import { mockRepository } from "@/lib/services";

export function AdminOverview() {
  const events = mockRepository.getEvents().filter((event) => event.status === "Upcoming");
  const challenges = mockRepository.getChallenges();
  const projects = mockRepository.getProjects();
  const activities = mockRepository.getActivities();
  const leaders = mockRepository.getLeaders();
  const activeProjects = projects.filter((project) => project.status === "In progress");
  const communityPoints = leaders.reduce((total, leader) => total + leader.points, 0);

  return <>
    <Topline section="AWS ISLEC / Admin overview" />
    <section className="admin-hero" aria-labelledby="admin-overview-title">
      <div>
        <div className="eyebrow">Community pulse</div>
        <h1 id="admin-overview-title">A clear view of what the community is building.</h1>
        <p className="hero-copy">Keep an eye on learning, projects, gatherings, and the small signals that help members make progress together.</p>
      </div>
      <aside className="admin-pulse-card" aria-label="Community snapshot">
        <div className="admin-pulse-head"><span className="eyebrow">This week</span><span className="admin-live-dot">Live snapshot</span></div>
        <strong>{activeProjects.length + challenges.length}</strong>
        <p>active learning and building threads across the community</p>
        <div className="admin-pulse-breakdown"><span><GraduationCap size={15} aria-hidden="true" />{challenges.length} challenges</span><span><FolderKanban size={15} aria-hidden="true" />{activeProjects.length} projects</span></div>
      </aside>
    </section>

    <section className="grid admin-metrics" aria-label="Community metrics">
      <Metric label="Community members" value={leaders.length.toString()} detail="Visible in the current community snapshot" />
      <Metric label="Upcoming events" value={events.length.toString()} detail="Gatherings ready for the calendar" />
      <Metric label="Active challenges" value={challenges.length.toString()} detail="Practical paths members can take now" />
      <Metric label="Community points" value={communityPoints.toLocaleString()} detail="Across the current leaderboard" />
    </section>

    <section className="admin-snapshot-grid" aria-label="Community operations summary">
      <article className="panel admin-snapshot-card">
        <div className="admin-card-heading"><div><span className="admin-icon"><UsersRound size={18} aria-hidden="true" /></span><h2>Member community</h2></div><Link className="section-action" href="/admin/members">Members <ArrowRight size={14} aria-hidden="true" /></Link></div>
        <p className="muted">The current leaderboard reflects {leaders.length} active builders making visible progress.</p>
        <div className="admin-member-stack">{leaders.map((leader) => <div key={leader.handle}><span>{leader.name.split(" ").map((part) => part[0]).join("")}</span><strong>{leader.name}</strong><small>{leader.points.toLocaleString()} pts</small></div>)}</div>
      </article>
      <article className="panel admin-snapshot-card">
        <div className="admin-card-heading"><div><span className="admin-icon"><CalendarDays size={18} aria-hidden="true" /></span><h2>Next up</h2></div><Link className="section-action" href="/admin/events">Events <ArrowRight size={14} aria-hidden="true" /></Link></div>
        <div className="admin-signal-list">{events.slice(0, 3).map((event) => <div key={event.title}><span className="tag">{event.date}</span><div><strong>{event.title}</strong><p>{event.type} / {event.time}</p></div></div>)}</div>
      </article>
    </section>

    <section className="admin-snapshot-grid" aria-label="Learning and project activity">
      <article className="panel admin-snapshot-card">
        <div className="admin-card-heading"><div><span className="admin-icon"><GraduationCap size={18} aria-hidden="true" /></span><h2>Learning activity</h2></div><Link className="section-action" href="/admin/learning">Learning <ArrowRight size={14} aria-hidden="true" /></Link></div>
        <div className="admin-signal-list">{challenges.map((challenge) => <div key={challenge.title}><span className="tag">{challenge.level}</span><div><strong>{challenge.title}</strong><p>{challenge.detail} / +{challenge.points} pts</p></div></div>)}</div>
      </article>
      <article className="panel admin-snapshot-card">
        <div className="admin-card-heading"><div><span className="admin-icon"><FolderKanban size={18} aria-hidden="true" /></span><h2>Community building</h2></div><Link className="section-action" href="/admin/projects">Projects <ArrowRight size={14} aria-hidden="true" /></Link></div>
        <div className="admin-project-list">{projects.map((project) => <div key={project.title}><div><strong>{project.title}</strong><p>{project.category} / {project.status}</p></div><div><span>{project.progress}%</span><div className="progress-track"><div className="progress-value" style={{ width: `${project.progress}%` }} /></div></div></div>)}</div>
      </article>
    </section>

    <ActivityList activities={activities} />
  </>;
}
