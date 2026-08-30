import Link from "next/link";
import { Bell } from "lucide-react";

export function Topline({ section = "AWS ISLEC / Builder workspace" }: { section?: string }) { return <div className="topline"><div className="eyebrow">{section}</div><div className="topline-actions"><button type="button" aria-label="Notifications" style={{ border: 0, background: "transparent", color: "var(--slate)", display: "grid", placeItems: "center", padding: 6 }}><Bell size={18} /></button><Link href="/member/profile" className="avatar" aria-label="Open profile">AM</Link></div></div>; }
