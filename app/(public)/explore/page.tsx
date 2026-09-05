import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Code2, MessageCircleHeart, Rocket, Sparkles, UsersRound } from "lucide-react";
import { mockRepository } from "@/lib/services";
import { getPublicProjects } from "@/lib/services/projects";

const contributionWays = [
  { icon: BookOpen, title: "Share a useful note", detail: "Turn a fresh lesson into a trail someone else can follow." },
  { icon: MessageCircleHeart, title: "Give thoughtful feedback", detail: "Help a project move forward with a question, test, or perspective." },
  { icon: UsersRound, title: "Bring a collaborator", detail: "Invite someone curious and make the next build a little less lonely." },
];

export default async function ExplorePage() {
  const challenges = mockRepository.getChallenges();
  const projects = await getPublicProjects().catch(() => []);
  const events = mockRepository.getEvents();
  const activities = mockRepository.getActivities();

  return <>
    <section className="explore-hero">
      <div>
        <div className="eyebrow">The AWS ISLEC ecosystem</div>
        <h1>Find the thread<br />you want to <span>pull.</span></h1>
        <p>Explore a community where learning becomes practice, practice becomes projects, and every project gives the next person somewhere to begin.</p>
        <div className="hero-actions"><Link className="button" href="/join">Join the community <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-secondary" href="/member">Open member workspace</Link></div>
      </div>
      <aside className="explore-pulse" aria-label="Community snapshot">
        <div className="explore-pulse-header"><span className="eyebrow">In motion this week</span><span className="pulse-dot" aria-hidden="true" /></div>
        <div className="explore-pulse-stat"><strong>{projects.length}</strong><span>projects moving<br />from idea to shipped</span></div>
        <div className="explore-pulse-list">{activities.slice(0, 3).map((activity) => <div key={activity.id}><Sparkles size={15} aria-hidden="true" /><span>{activity.title}</span><time>{activity.date}</time></div>)}</div>
      </aside>
    </section>

    <section className="explore-section explore-paths" aria-labelledby="paths-title">
      <div className="explore-section-heading"><div><div className="eyebrow">Choose a direction</div><h2 id="paths-title">Learn it. Then make it useful.</h2></div><p>Small, practical challenges for building confidence with the tools behind the cloud.</p></div>
      <div className="explore-path-grid">{challenges.map((challenge, index) => <article className="explore-path-card" key={challenge.title}><div className="explore-card-top"><span className="explore-path-icon"><Rocket size={19} aria-hidden="true" /></span><span className="tag">0{index + 1} / {challenge.level}</span></div><h3>{challenge.title}</h3><p>{challenge.detail}</p><div className="explore-card-foot"><span>+{challenge.points} builder points</span><Link href="/member/learn" aria-label={`Explore ${challenge.title}`}>Explore <ArrowRight size={15} aria-hidden="true" /></Link></div></article>)}</div>
    </section>

    <section className="explore-section explore-work" aria-labelledby="work-title">
      <div className="explore-section-heading"><div><div className="eyebrow">Built in the open</div><h2 id="work-title">See what people are making.</h2></div><Link className="section-action" href="/member/projects">Visit project studio <ArrowRight size={14} aria-hidden="true" /></Link></div>
      <div className="explore-projects">{projects.map((project) => <article className="explore-project" key={project.title}><div className="explore-project-mark"><Code2 size={22} aria-hidden="true" /></div><div className="explore-project-copy"><span className="eyebrow">{project.category} / {project.status}</span><h3>{project.title}</h3><p>Built by members who are turning a question into something they can show, test, and improve.</p></div><div className="explore-project-progress"><strong>{project.progress}%</strong><div className="progress-track"><div className="progress-value" style={{ width: `${project.progress}%` }} /></div></div></article>)}</div>
    </section>

    <section className="explore-section explore-events" aria-labelledby="events-title">
      <div className="explore-section-heading"><div><div className="eyebrow">Make room to meet</div><h2 id="events-title">A reason to show up.</h2></div><p>Study together, share the thing you just figured out, or find a fresh perspective.</p></div>
      <div className="explore-event-grid">{events.map((event) => <article className="explore-event" key={event.title}><span className="explore-event-date">{event.date}</span><div><span className="tag">{event.type}</span><h3>{event.title}</h3><p>{event.time}</p></div><Link href="/member/events" className="explore-event-link" aria-label={`View ${event.title}`}><CalendarDays size={18} aria-hidden="true" /></Link></article>)}</div>
    </section>

    <section className="explore-contribute" aria-labelledby="contribute-title">
      <div className="explore-contribute-intro"><div className="eyebrow">There is room for your point of view</div><h2 id="contribute-title">A community gets stronger when people leave something useful behind.</h2><Link className="button" href="/join">Find your place <ArrowRight size={16} aria-hidden="true" /></Link></div>
      <div className="explore-contribution-list">{contributionWays.map(({ icon: Icon, title, detail }) => <div key={title}><span><Icon size={20} aria-hidden="true" /></span><div><h3>{title}</h3><p>{detail}</p></div></div>)}</div>
    </section>
  </>;
}
