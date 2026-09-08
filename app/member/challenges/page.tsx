import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { ChallengeCatalogue } from "@/components/member/ChallengeCatalogue";
import { supabaseRepository, type MemberChallenge } from "@/lib/services";

function ChallengeListState({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}

export default async function Challenges() {
  let challenges: MemberChallenge[];

  try {
    challenges = await supabaseRepository.getChallenges();
  } catch {
    return <>
      <Topline section="Challenges / make it real" />
      <PageIntro kicker="Practical missions" title="Build proof, one challenge at a time." description="Turn cloud concepts into finished work with focused challenges from the AWS ISLEC learning paths." />
      <ChallengeListState>
        <h2>Challenges are unavailable right now.</h2>
        <p className="muted">Please refresh the page and try again.</p>
      </ChallengeListState>
    </>;
  }

  const completedCount = challenges.filter((challenge) => challenge.status === "completed").length;
  const earnedPoints = challenges.filter((challenge) => challenge.status === "completed").reduce((total, challenge) => total + challenge.points, 0);

  return <>
    <Topline section="Challenges / make it real" />
    <PageIntro kicker="Practical missions" title="Build proof, one challenge at a time." description="Turn cloud concepts into finished work with focused challenges from the AWS ISLEC learning paths." />
    {challenges.length === 0 ? (
      <ChallengeListState>
        <h2>No challenges are available yet.</h2>
        <p className="muted">Check back soon for the next practical mission.</p>
      </ChallengeListState>
    ) : (
      <>
        <div className="challenge-summary panel"><div><strong>{challenges.length}</strong><span>Total challenges</span></div><div><strong>{completedCount}</strong><span>Solved</span></div><div><strong>{challenges.length - completedCount}</strong><span>Remaining</span></div><div><strong>{earnedPoints}</strong><span>Challenge points earned</span></div></div>
        <ChallengeCatalogue challenges={challenges} />
      </>
    )}
  </>;
}
