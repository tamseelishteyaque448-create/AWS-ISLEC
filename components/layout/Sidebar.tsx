import { NavLinks } from "@/components/navigation/NavLinks";

export function Sidebar() {
  return <aside className="sidebar"><div className="logo"><span className="logo-mark">i.</span>islec<span>.</span></div><NavLinks /><div className="sidebar-footer">AWS ISLEC<br />Learn boldly. Ship together.</div></aside>;
}
