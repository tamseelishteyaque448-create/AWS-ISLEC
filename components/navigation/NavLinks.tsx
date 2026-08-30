"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, Compass, FolderKanban, Home, Map, Medal, Rocket, Trophy, UserRound } from "lucide-react";

const links = [
  { label: "Workspace", items: [["/member", "Overview", Home], ["/member/explore", "Explore", Compass], ["/member/learn", "Learn", Rocket], ["/member/projects", "Projects", FolderKanban], ["/member/activities", "Activity", Activity]] },
  { label: "Community", items: [["/member/events", "Events", CalendarDays], ["/member/leaderboard", "Leaderboard", Trophy], ["/member/achievements", "Proof", Medal], ["/member/journey", "Journey", Map], ["/member/profile", "Profile", UserRound]] },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return <>{links.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div><nav className="nav" aria-label={group.label}>{group.items.map(([href, text, Icon]) => <Link className={pathname === href ? "active" : undefined} href={href} key={href}><Icon size={16} strokeWidth={1.8} /><span>{text}</span></Link>)}</nav></div>)}</>;
}
