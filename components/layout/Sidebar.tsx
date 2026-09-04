import { NavLinks } from "@/components/navigation/NavLinks";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function Sidebar({ workspace = "member" }: { workspace?: "admin" | "member" }) {
  return <aside className="sidebar"><div className="logo"><img className="logo-aws-image" src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg" alt="AWS" /></div>{workspace === "admin" ? <div className="workspace-badge">Admin workspace</div> : null}<NavLinks workspace={workspace} /><div className="sidebar-footer">AWS ISLEC<br />Learn boldly. Ship together.<LogoutButton /></div></aside>;
}
