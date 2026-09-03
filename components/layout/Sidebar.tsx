import { NavLinks } from "@/components/navigation/NavLinks";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function Sidebar() {
  return <aside className="sidebar"><div className="logo"><span className="logo-mark">i.</span>islec<span>.</span></div><NavLinks /><div className="sidebar-footer">AWS ISLEC<br />Learn boldly. Ship together.<LogoutButton /></div></aside>;
}
