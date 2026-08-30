import Link from "next/link";
import { ArrowRight, Bot, Cloud, Handshake, Hammer, HeartHandshake, Lightbulb, UsersRound } from "lucide-react";

export default function PublicHome() {
  return <>
    <section className="public-hero">
    <div className="public-hero-copy">
      <div className="eyebrow">A student technology community</div>
      <h1>Learn. Build.<br /><span>Lead.</span> Together.</h1>
      <p>AWS ISLEC is where students learn AWS, AI, and emerging technologies; build real projects; collaborate with curious people; and grow together.</p>
      <div className="hero-actions">
        <Link className="button" href="/explore">Explore Community <ArrowRight size={16} aria-hidden="true" /></Link>
        <Link className="button button-secondary" href="/join">Join Community</Link>
      </div>
    </div>
    <aside className="public-proof" aria-label="What AWS ISLEC members do">
      <div className="eyebrow" style={{ color: "#a8c9ee" }}>Built for builders in motion</div>
      <div className="public-proof-list">
        <div><span className="public-proof-icon"><Cloud size={19} aria-hidden="true" /></span><div><strong>Learn the tools</strong><p>AWS, AI, and the technologies shaping what comes next.</p></div></div>
        <div><span className="public-proof-icon"><Bot size={19} aria-hidden="true" /></span><div><strong>Make real things</strong><p>Turn questions into practical projects you can share.</p></div></div>
        <div><span className="public-proof-icon"><UsersRound size={19} aria-hidden="true" /></span><div><strong>Grow together</strong><p>Find collaborators, feedback, and momentum along the way.</p></div></div>
      </div>
    </aside>
    </section>
    <section className="growth-section" aria-labelledby="growth-title">
      <div className="growth-heading">
        <div className="eyebrow">The AWS ISLEC journey</div>
        <h2 id="growth-title">How we grow together.</h2>
        <p>There is no single path into technology. Start where you are, make progress visible, and help someone else move forward.</p>
      </div>
      <ol className="growth-path">
        <li><span className="growth-icon"><Lightbulb size={19} aria-hidden="true" /></span><div><span className="growth-step">01 / Learn</span><h3>Find your starting point.</h3><p>Explore AWS, AI, and emerging technology with room to ask better questions.</p></div></li>
        <li><span className="growth-icon"><Hammer size={19} aria-hidden="true" /></span><div><span className="growth-step">02 / Build</span><h3>Turn learning into work.</h3><p>Ship a project, test an idea, and discover what you can do by doing it.</p></div></li>
        <li><span className="growth-icon"><Handshake size={19} aria-hidden="true" /></span><div><span className="growth-step">03 / Connect</span><h3>Find your people.</h3><p>Meet collaborators who bring perspective, feedback, and shared momentum.</p></div></li>
        <li><span className="growth-icon"><HeartHandshake size={19} aria-hidden="true" /></span><div><span className="growth-step">04 / Contribute</span><h3>Make the circle wider.</h3><p>Share what you learned, support another builder, and leave a useful trail.</p></div></li>
        <li><span className="growth-icon growth-icon-lead"><UsersRound size={19} aria-hidden="true" /></span><div><span className="growth-step">05 / Lead</span><h3>Help shape what is next.</h3><p>Lead with curiosity, create opportunities, and bring others along with you.</p></div></li>
      </ol>
    </section>
  </>;
}
