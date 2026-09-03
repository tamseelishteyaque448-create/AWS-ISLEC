import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["/explore", "Explore"], ["/learn", "Learn"], ["/projects", "Projects"],
  ["/events", "Events"], ["/about", "About"],
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="public-shell">
    <header className="public-header">
      <Link href="/" className="public-logo" aria-label="AWS ISLEC home"><span className="logo-mark">i.</span><span className="public-logo-name">AWS ISLEC</span></Link>
      <nav className="public-nav" aria-label="Public navigation">{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
      <div className="public-actions"><Link className="public-workspace-link" href="/join?mode=login">Log in</Link><Link className="button public-join" href="/join">Join Community</Link></div>
    </header>
    <main className="public-main">{children}</main>
  </div>;
}
