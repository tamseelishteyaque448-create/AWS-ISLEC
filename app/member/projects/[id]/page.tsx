import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/member/ProjectWorkspace";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { getMemberProjectWorkspaceV2 } from "@/lib/services/projects";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MemberProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub || !UUID.test(id)) notFound();
  const project = await getMemberProjectWorkspaceV2(id).catch(() => null);
  if (!project) notFound();
  return <ProjectWorkspace project={project} viewerId={claims.sub} />;
}
