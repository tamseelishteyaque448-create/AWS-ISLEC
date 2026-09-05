import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Handshake, HeartHandshake, Lightbulb, Rocket, UsersRound } from "lucide-react";
import { AuthForm } from "@/components/auth/AuthForm";
import { getPublicCommunitySnapshot } from "@/lib/services/community";

const journey = [
  { icon: Lightbulb, step: "01 / Learn", title: "Choose a useful starting point." },
  { icon: Rocket, step: "02 / Build", title: "Turn curiosity into something real." },
  { icon: Handshake, step: "03 / Connect", title: "Find collaborators and feedback." },
  { icon: HeartHandshake, step: "04 / Contribute", title: "Leave a trail for someone else." },
  { icon: UsersRound, step: "05 / Lead", title: "Create opportunity and bring others along." },
];

const memberTypes = [
  ["Curious beginners", "You do not need a portfolio or a perfect plan—only enough curiosity to begin."],
  ["Builders with a question", "You have an idea, a half-finished project, or a problem worth getting your hands on."],
  ["Generous peers", "You want to share what you are learning and help make technology feel more accessible."],
] as const;

export default async function JoinPage() {
  const snapshot = await getPublicCommunitySnapshot().catch(() => null);
  const paths = snapshot?.learningPaths ?? [];
  const projects = snapshot?.projects ?? [];
  const events = snapshot?.events.filter((event) => event.status === "upcoming") ?? [];

  return <>
    <section className="join-hero"><div><div className="eyebrow">AWS ISLEC members</div><h1>Your next build<br />has <span>company.</span></h1><p>Join a student technology community where learning becomes practice, practice becomes projects, and nobody has to figure out the hard parts alone.</p><div className="hero-actions"><a className="button" href="#member-access">Open the member workspace <ArrowRight size={16} aria-hidden="true" /></a><Link className="button button-secondary" href="/explore">Explore the community</Link></div><small className="join-hero-note">Member access is available to pre-registered AWS ISLEC accounts.</small></div><Suspense fallback={<div className="join-welcome" aria-busy="true">Loading member access…</div>}><AuthForm /></Suspense></section>

    <section className="join-section" aria-labelledby="who-title"><div className="join-section-heading"><div><div className="eyebrow">Who this is for</div><h2 id="who-title">You do not have to arrive as an expert.</h2></div><p>AWS ISLEC is for students who want a more practical, more human way into technology.</p></div><div className="join-member-grid">{memberTypes.map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></section>

    <section className="join-section join-benefits" aria-labelledby="benefits-title"><div className="join-section-heading"><div><div className="eyebrow">What members get</div><h2 id="benefits-title">A little more direction. A lot more momentum.</h2></div><p>Make progress at your own pace, with practical places to focus and people who understand why the work matters.</p></div><div className="join-benefit-grid"><article><span className="join-benefit-icon"><BookOpen size={21} aria-hidden="true" /></span><strong>{paths.length} published paths</strong><p>Build confidence through focused challenges that lead somewhere concrete.</p><Link href="/learn">Explore learning <ArrowRight size={14} aria-hidden="true" /></Link></article><article><span className="join-benefit-icon"><Rocket size={21} aria-hidden="true" /></span><strong>{projects.length} projects in motion</strong><p>Find work to follow, questions to borrow, and a studio for your own experiments.</p><Link href="/projects">See projects <ArrowRight size={14} aria-hidden="true" /></Link></article><article><span className="join-benefit-icon"><UsersRound size={21} aria-hidden="true" /></span><strong>{events.length} ways to gather</strong><p>Join study halls, workshops, and demo nights built for showing up as you are.</p><Link href="/events">View events <ArrowRight size={14} aria-hidden="true" /></Link></article></div></section>

    <section className="join-section" aria-labelledby="journey-title"><div className="join-section-heading"><div><div className="eyebrow">Your first loop</div><h2 id="journey-title">A good start is all you need.</h2></div><p>The community journey is not a ladder you need to climb. It is a loop you can enter wherever you are.</p></div><ol className="join-journey">{journey.map(({ icon: Icon, step, title }, index) => <li key={step}><span className={index === journey.length - 1 ? "join-journey-icon lead" : "join-journey-icon"}><Icon size={19} aria-hidden="true" /></span><div><span className="growth-step">{step}</span><h3>{title}</h3></div></li>)}</ol></section>

    <section className="join-workspace" aria-labelledby="workspace-title"><div><div className="eyebrow">Ready when you are</div><h2 id="workspace-title">Take your first step inside.</h2><p>The member workspace is where paths, projects, events, and your own momentum come together. Log in with your pre-registered AWS ISLEC account to make it yours.</p></div><div className="join-workspace-actions"><a className="button" href="#member-access">Open member workspace <ArrowRight size={16} aria-hidden="true" /></a><Link href="/about">Read our story <ArrowRight size={15} aria-hidden="true" /></Link></div></section>
  </>;
}
