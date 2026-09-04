"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, CalendarDays, Compass, FolderKanban, Home, Map, Medal, Rocket, Settings, Target, Trophy, UserRound, UsersRound } from "lucide-react";

const links = [
  { label: "Workspace", items: [["/member", "Overview", Home], ["/member/explore", "Explore", Compass], ["/member/learn", "Learn", Rocket], ["/member/challenges", "Challenges", Target], ["/member/projects", "Projects", FolderKanban], ["/member/activities", "Activity", Activity]] },
  { label: "Community", items: [["/member/events", "Events", CalendarDays], ["/member/leaderboard", "Leaderboard", Trophy], ["/member/achievements", "Proof", Medal], ["/member/journey", "Journey", Map], ["/member/profile", "Profile", UserRound]] },
] as const;

const adminLinks = [
  { label: "Admin workspace", items: [["/admin", "Overview", Home]] },
  { label: "Manage", items: [["/admin/members", "Members", UsersRound], ["/admin/events", "Events", CalendarDays], ["/admin/learning", "Learning", Rocket], ["/admin/challenges", "Challenges", Target], ["/admin/projects", "Projects", FolderKanban]] },
  { label: "Community", items: [["/admin/achievements", "Achievements", Medal], ["/admin/leaderboard", "Leaderboard", Trophy], ["/admin/activities", "Activities", Activity]] },
  { label: "Insights", items: [["/admin/analytics", "Analytics", BarChart3], ["/admin/settings", "Settings", Settings]] },
] as const;

export function NavLinks({ workspace = "member" }: { workspace?: "admin" | "member" }) {
  const pathname = usePathname();
  const navigation = workspace === "admin" ? adminLinks : links;
  return <>{navigation.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div><nav className="nav" aria-label={group.label}>{group.items.map(([href, text, Icon]) => <Link className={pathname === href ? "active" : undefined} href={href} key={href}><Icon size={16} strokeWidth={1.8} /><span>{text}</span></Link>)}</nav></div>)}</>;
}
