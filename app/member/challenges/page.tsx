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
    <div className="challenge-hero">
      <PageIntro kicker="Practical missions" title="Build proof, one challenge at a time." description="Turn cloud concepts into finished work with focused challenges from the AWS ISLEC learning paths." />
      <aside className="challenge-hero-panel">
        <span className="eyebrow">Your mission board</span>
        <strong>{completedCount === challenges.length ? "All missions solved" : `${challenges.length - completedCount} missions in reach`}</strong>
        <div className="challenge-hero-progress"><span style={{ width: `${challenges.length ? (completedCount / challenges.length) * 100 : 0}%` }} /></div>
        <small>{completedCount} of {challenges.length} challenges completed</small>
      </aside>
    </div>
    {challenges.length === 0 ? (
      <ChallengeListState>
        <h2>No challenges are available yet.</h2>
        <p className="muted">Check back soon for the next practical mission.</p>
      </ChallengeListState>
    ) : (
      <>
        <div className="challenge-summary"><div><span className="eyebrow">Missions</span><strong>{challenges.length}</strong><span>Total challenges</span></div><div><span className="eyebrow">Progress</span><strong>{completedCount}</strong><span>Solved</span></div><div><span className="eyebrow">Next up</span><strong>{challenges.length - completedCount}</strong><span>Remaining</span></div><div className="challenge-summary-points"><span className="eyebrow">Momentum</span><strong>{earnedPoints}</strong><span>Points earned</span></div></div>
        <ChallengeCatalogue challenges={challenges} />
      </>
    )}
  </>;
}
