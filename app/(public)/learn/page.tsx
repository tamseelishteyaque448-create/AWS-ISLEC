import Link from "next/link";
import { ArrowRight, BookOpen, Check, CircleDot, Code2, Layers3, Rocket, Sparkles } from "lucide-react";
import { mockRepository } from "@/lib/services";

const pathProgress = [100, 62, 28];
const practiceLoop = [
  { icon: BookOpen, step: "01 / Learn", title: "Start with the useful bits.", detail: "Get a clear foundation and a question worth testing." },
  { icon: CircleDot, step: "02 / Practice", title: "Put it under your hands.", detail: "Turn concepts into small, repeatable experiments." },
  { icon: Rocket, step: "03 / Build", title: "Make a thing that travels.", detail: "Shape your progress into a project you can share." },
];

export default function LearnPage() {
  const challenges = mockRepository.getChallenges();
  const projects = mockRepository.getProjects();
  const activities = mockRepository.getActivities();

  return <>
    <section className="learn-hero">
      <div>
        <div className="eyebrow">AWS ISLEC learning hub</div>
        <h1>Learn enough<br />to <span>build</span> with it.</h1>
        <p>Practical paths for moving from “I think I get it” to “I made this.” Follow the thread, try the challenge, and take your next project somewhere real.</p>
        <div className="hero-actions"><Link className="button" href="/member/learn">Start a learning path <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-secondary" href="/member/projects">See project ideas</Link></div>
      </div>
      <aside className="learn-map" aria-label="Learning path overview">
        <div className="learn-map-top"><div><div className="eyebrow">A path with momentum</div><strong>From first build<br />to resilient systems.</strong></div><Layers3 size={25} aria-hidden="true" /></div>
        <ol>{challenges.map((challenge, index) => <li key={challenge.title}><span className={index === 0 ? "learn-map-check complete" : "learn-map-check"}>{index === 0 ? <Check size={13} aria-hidden="true" /> : `0${index + 1}`}</span><div><span>{challenge.level}</span><strong>{challenge.title}</strong></div><em>{pathProgress[index]}%</em></li>)}</ol>
      </aside>
    </section>

    <section className="learn-section" aria-labelledby="paths-title">
      <div className="learn-section-heading"><div><div className="eyebrow">Learning paths</div><h2 id="paths-title">Pick a challenge. Make progress visible.</h2></div><p>Each path combines a focused cloud concept with a concrete thing to make—not another course to leave unfinished.</p></div>
      <div className="learn-path-grid">{challenges.map((challenge, index) => <article className="learn-path-card" key={challenge.title}><div className="learn-path-card-top"><span className="learn-number">0{index + 1}</span><span className="tag">{challenge.level}</span></div><h3>{challenge.title}</h3><p>{challenge.detail}</p><div className="learn-progress-label"><span>Path progress</span><strong>{pathProgress[index]}%</strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${pathProgress[index]}%` }} /></div><Link href="/member/learn" className="learn-card-action" aria-label={`Start ${challenge.title}`}>Start this challenge <ArrowRight size={15} aria-hidden="true" /></Link><span className="learn-points">+{challenge.points} builder points</span></article>)}</div>
    </section>

    <section className="learn-section learn-practice" aria-labelledby="practice-title">
      <div className="learn-section-heading"><div><div className="eyebrow">A better learning loop</div><h2 id="practice-title">Keep going until it becomes yours.</h2></div><p>The most useful learning does not end at understanding. It leaves you with a working example, a sharper question, and a trail for the next person.</p></div>
      <div className="learn-practice-grid">{practiceLoop.map(({ icon: Icon, step, title, detail }) => <article key={step}><span className="learn-practice-icon"><Icon size={20} aria-hidden="true" /></span><span className="growth-step">{step}</span><h3>{title}</h3><p>{detail}</p></article>)}</div>
    </section>

    <section className="learn-project-bridge" aria-labelledby="bridge-title">
      <div className="learn-bridge-copy"><div className="eyebrow">What learning looks like in the wild</div><h2 id="bridge-title">Every path has a project on the other side.</h2><p>Use a challenge as your launchpad, then give it your own question, audience, or point of view.</p><Link href="/member/projects" className="button">Explore the project studio <ArrowRight size={16} aria-hidden="true" /></Link></div>
      <div className="learn-project-list">{projects.map((project) => <div key={project.title}><span><Code2 size={18} aria-hidden="true" /></span><div><strong>{project.title}</strong><p>{project.category} / {project.status}</p></div><em>{project.progress}%</em></div>)}</div>
    </section>

    <section className="learn-momentum" aria-labelledby="momentum-title">
      <div><div className="eyebrow">Learning in motion</div><h2 id="momentum-title">Small wins count.</h2></div>
      <div className="learn-activity-list">{activities.filter((activity) => activity.type === "lesson" || activity.type === "badge").map((activity) => <div key={activity.id}><Sparkles size={16} aria-hidden="true" /><span>{activity.title}<small>{activity.detail}</small></span><strong>+{activity.points}</strong></div>)}</div>
    </section>
  </>;
}
