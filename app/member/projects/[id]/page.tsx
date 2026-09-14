import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/member/ProjectDetail";
import { ProjectWorkspace } from "@/components/member/ProjectWorkspace";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { getMemberProjectExperience, getMemberProjectWorkspaceV2 } from "@/lib/services/projects";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MemberProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub || !UUID.test(id)) notFound();
  const experience = await getMemberProjectExperience(id);
  if (!experience) notFound();
  const isActiveMember = experience.membership !== null && ["active", "submitted", "completed"].includes(experience.membership.status);
  if (!isActiveMember) return <ProjectDetail project={experience} />;
  const workspace = await getMemberProjectWorkspaceV2(id);
  if (!workspace) notFound();
  return <ProjectWorkspace project={workspace} viewerId={claims.sub} />;
}
