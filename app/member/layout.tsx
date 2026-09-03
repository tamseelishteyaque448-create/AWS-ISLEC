import { Sidebar } from "@/components/layout/Sidebar";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function MemberLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const claims = await getAuthenticatedClaims();

  if (!claims) {
    redirect("/join?mode=login&next=/member");
  }

  return <div className="shell"><Sidebar /><main className="main">{children}</main></div>;
}
