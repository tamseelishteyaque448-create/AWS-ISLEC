import { ChallengeManagement } from "@/components/admin/ChallengeManagement";
import { PageIntro } from "@/components/cards/PageIntro";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminChallenges } from "@/lib/services/admin-challenges";

export default async function AdminChallengesPage() {
  await requireAdmin();
  const data = await getAdminChallenges().catch(() => null);
  return <>
    <PageIntro kicker="Admin workspace / challenges" title="Challenges, in motion." description="Curate practical missions members can take from learning to evidence." />
    {data ? <ChallengeManagement data={data} /> : <section className="admin-member-error"><h2>The challenge catalogue is unavailable.</h2><p>Please refresh the page and try again.</p></section>}
  </>;
}
