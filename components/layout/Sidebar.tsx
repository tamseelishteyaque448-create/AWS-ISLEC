import Image from "next/image";
import { NavLinks } from "@/components/navigation/NavLinks";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function Sidebar({ workspace = "member" }: { workspace?: "admin" | "member" }) {
  return <aside className="sidebar"><div className="logo"><Image className="logo-aws-image" src="/images/aws-logo.svg" alt="Amazon Web Services" width={304} height={182} unoptimized /></div>{workspace === "admin" ? <div className="workspace-badge">Admin workspace</div> : null}<NavLinks workspace={workspace} /><div className="sidebar-footer">AWS ISLEC<br />Learn boldly. Ship together.<LogoutButton /></div></aside>;
}