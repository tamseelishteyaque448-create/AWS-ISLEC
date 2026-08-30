import Link from "next/link";
import { ArrowRight, BookOpen, Handshake, HeartHandshake, Lightbulb, Rocket, UsersRound } from "lucide-react";
import { mockRepository } from "@/lib/services";

const philosophy = [
  { icon: Lightbulb, step: "01 / Learn", title: "Find your starting point.", detail: "Explore AWS, AI, and emerging technology with room to ask better questions." },
  { icon: Rocket, step: "02 / Build", title: "Turn learning into work.", detail: "Ship a project, test an idea, and discover what you can do by doing it." },
  { icon: Handshake, step: "03 / Connect", title: "Find your people.", detail: "Meet collaborators who bring perspective, feedback, and shared momentum." },
  { icon: HeartHandshake, step: "04 / Contribute", title: "Make the circle wider.", detail: "Share what you learned, support another builder, and leave a useful trail." },
  { icon: UsersRound, step: "05 / Lead", title: "Help shape what is next.", detail: "Create opportunities, bring others along, and lead with curiosity." },
];

const values = [
  ["Progress over polish", "First versions, rough edges, and honest questions all belong here."],
  ["Useful work in public", "We share the decisions and lessons, not only the finished result."],
  ["Generosity compounds", "A thoughtful note, a kind critique, or an introduction can change someone’s path."],
] as const;

export default function AboutPage() {
  const projects = mockRepository.getProjects();
  const events = mockRepository.getEvents();
  const challenges = mockRepository.getChallenges();
  const activities = mockRepository.getActivities();

  return <>
    <section className="about-hero">
      <div><div className="eyebrow">About AWS ISLEC</div><h1>A place for<br />builders in <span>motion.</span></h1><p>AWS ISLEC is a student technology community for people who want to understand the cloud by using it, grow their confidence by making things, and find others who make the journey more interesting.</p><div className="hero-actions"><Link className="button" href="/explore">Explore the community <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-secondary" href="/join">Join AWS ISLEC</Link></div></div>
      <aside className="about-proof" aria-label="AWS ISLEC community activity"><div className="eyebrow">The community in practice</div><div className="about-proof-grid"><div><strong>{challenges.length}</strong><span>practical learning paths</span></div><div><strong>{projects.length}</strong><span>projects in the studio</span></div><div><strong>{events.filter((event) => event.status === "Upcoming").length}</strong><span>ways to gather next</span></div><div><strong>{activities.length}</strong><span>recent moments of momentum</span></div></div><p>The goal is not to look like you belong in technology. It is to make, learn, and contribute until you know you do.</p></aside>
    </section>

    <section className="about-intro" aria-labelledby="intro-title"><div className="eyebrow">Why we exist</div><h2 id="intro-title">Technology is easier to enter when nobody has to enter it alone.</h2><div><p>There is no single path into a technical life. Some people arrive with a course, others with a problem they want to solve, and many with only a hunch that they could build something useful.</p><p>AWS ISLEC makes space for all of those beginnings. We learn with our hands, share what is working, and make each other’s next step easier to see.</p></div></section>

    <section className="about-section" aria-labelledby="philosophy-title"><div className="about-section-heading"><div><div className="eyebrow">How we grow</div><h2 id="philosophy-title">A community is a practice, not a destination.</h2></div><p>Our philosophy is a loop: every time you move through it, your work gets stronger and the community becomes more useful for the person beside you.</p></div><ol className="about-philosophy">{philosophy.map(({ icon: Icon, step, title, detail }, index) => <li key={step}><span className={index === philosophy.length - 1 ? "about-philosophy-icon lead" : "about-philosophy-icon"}><Icon size={19} aria-hidden="true" /></span><div><span className="growth-step">{step}</span><h3>{title}</h3><p>{detail}</p></div></li>)}</ol></section>

    <section className="about-section about-values" aria-labelledby="values-title"><div className="about-section-heading"><div><div className="eyebrow">What we value</div><h2 id="values-title">The kind of room we are making.</h2></div><p>These are small commitments that shape how we show up for the work and for one another.</p></div><div className="about-value-grid">{values.map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></section>

    <section className="about-next" aria-labelledby="next-title"><div className="about-next-copy"><div className="eyebrow">Find your next thread</div><h2 id="next-title">Start where the energy is.</h2><p>Whether you want a structured challenge, a project to follow, or a room full of people making progress, there is a way in.</p></div><div className="about-next-links"><Link href="/learn"><BookOpen size={19} aria-hidden="true" /><span><strong>Learn by building</strong><small>Choose a practical learning path.</small></span><ArrowRight size={16} aria-hidden="true" /></Link><Link href="/projects"><Rocket size={19} aria-hidden="true" /><span><strong>See what is shipping</strong><small>Follow work moving through the studio.</small></span><ArrowRight size={16} aria-hidden="true" /></Link><Link href="/events"><UsersRound size={19} aria-hidden="true" /><span><strong>Find a good room</strong><small>Join a workshop, study hall, or demo night.</small></span><ArrowRight size={16} aria-hidden="true" /></Link></div></section>
  </>;
}
