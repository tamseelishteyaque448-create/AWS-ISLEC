import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { ProjectDiscovery } from "@/components/member/ProjectDiscovery";
import { getMemberExploreProjects } from "@/lib/services/projects";

export default async function Explore() {
  const projects = await getMemberExploreProjects().catch(() => null);
  return <><Topline section="Explore the community" /><PageIntro kicker="Project discovery" title="Find something worth building with." description="Explore published community projects, learn what is being built, and find a team or idea that fits your next step." />{projects === null ? <section className="admin-member-error"><h2>Project discovery is temporarily unavailable.</h2><p>Please try again.</p></section> : <ProjectDiscovery projects={projects} />}</>;
}
