import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ActivityList } from "@/components/cards/ActivityList";
import { Metric } from "@/components/ui/Metric";
import { Topline } from "@/components/ui/Topline";
import { mockRepository, supabaseRepository } from "@/lib/services";

export async function MemberOverview() {
  let dashboard;

  try {
    dashboard = await supabaseRepository.getDashboardData();
  } catch {
    return <><Topline /><div className="panel"><h2>Dashboard data is unavailable right now.</h2><p className="muted">Please refresh the page and try again.</p></div></>;
  }

  if (!dashboard) {
    return <><Topline /><div className="panel"><h2>Your member profile is not ready yet.</h2><p className="muted">Please try again shortly.</p></div></>;
  }

  const currentProjects = mockRepository.getProjects();
  return <><Topline /><section className="hero"><div><div className="eyebrow">Your builder workspace</div><h1>Learn it.<br />Build it.<br /><span style={{ color: "var(--aws)" }}>Lead with it.</span></h1><p className="hero-copy">AWS ISLEC is your place to turn curiosity into cloud projects, find collaborators, and build a public body of work that travels with you.</p><div className="hero-actions"><Link className="button" href="/member/learn">Continue learning <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/member/projects">View projects</Link></div></div><div className="hero-art"><div><div className="eyebrow" style={{ color: "#a8c9ee" }}>Your current focus</div><div className="art-code">$ learn → practice<br />$ build → document<br />$ share → contribute</div></div><div className="focus-card"><div><div className="eyebrow" style={{ color: "#a8c9ee" }}>Momentum</div><strong>{dashboard.profile.streak} day streak</strong></div><Sparkles size={28} color="var(--aws)" /></div></div></section><section className="grid"><Metric label="Builder points" value={dashboard.profile.points.toLocaleString()} detail="Earned by learning, building and contributing" /><div className="panel"><h2>In the works</h2><div className="list">{currentProjects.slice(0, 2).map(project => <div className="list-item" key={project.title}><span>{project.title}</span><span className="tag">{project.progress}% complete</span></div>)}</div></div><div className="panel"><h2>Next challenge</h2>{dashboard.nextChallenge ? <><div style={{ color: "var(--navy)", fontSize: 19, fontWeight: 600, letterSpacing: "-.04em", marginBottom: 8 }}>{dashboard.nextChallenge.title}</div><div className="muted">{dashboard.nextChallenge.detail}</div><Link href="/member/learn" className="section-action" style={{ display: "inline-block", marginTop: 20 }}>{dashboard.nextChallenge.progress}% complete / Worth +{dashboard.nextChallenge.points} pts →</Link></> : <div className="muted">No learning challenges are available yet.</div>}</div></section><ActivityList activities={dashboard.activities} /></>;
}

export default MemberOverview;
