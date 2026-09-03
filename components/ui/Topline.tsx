import Link from "next/link";
import { Bell } from "lucide-react";
import { supabaseRepository } from "@/lib/services";

function getInitials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export async function Topline({ section = "AWS ISLEC / Builder workspace" }: { section?: string }) {
	let profile;

	try {
		profile = await supabaseRepository.getProfile();
	} catch {
		profile = null;
	}

	const initials = profile ? getInitials(profile.name) : "?";

	return <div className="topline"><div className="eyebrow">{section}</div><div className="topline-actions"><button type="button" aria-label="Notifications" style={{ border: 0, background: "transparent", color: "var(--slate)", display: "grid", placeItems: "center", padding: 6 }}><Bell size={18} /></button><Link href="/member/profile" className="avatar" aria-label={profile ? `Open profile for ${profile.name}` : "Open profile"}>{initials}</Link></div></div>;
}
