import { getAuthenticatedClaims } from "@/lib/auth/session";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { redirect } from "next/navigation";

export default async function MemberLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const claims = await getAuthenticatedClaims();

  if (!claims) {
    redirect("/join?mode=login&next=/member");
  }

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
