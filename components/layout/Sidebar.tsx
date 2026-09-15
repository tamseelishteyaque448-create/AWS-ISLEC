import { NavLinks } from "@/components/navigation/NavLinks";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function Sidebar({ workspace = "member" }: { workspace?: "admin" | "member" }) {
  return <aside className="sidebar"><div className="logo"><div className="sidebar-brand" aria-label="AWS ISLEC"><span className="sidebar-brand-mark">i.</span><span className="sidebar-brand-name">AWS ISLEC</span></div></div>{workspace === "admin" ? <div className="workspace-badge">Admin workspace</div> : null}<NavLinks workspace={workspace} /><div className="sidebar-footer">AWS ISLEC<br />Learn boldly. Ship together.<LogoutButton /></div></aside>;
}
