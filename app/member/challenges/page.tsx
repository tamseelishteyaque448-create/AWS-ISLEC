import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository, type MemberChallenge } from "@/lib/services";

function ChallengeListState({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}

function statusLabel(challenge: MemberChallenge) {
  if (challenge.status === "completed") return "Completed";
  if (challenge.status === "in_progress") return "In progress";
  return "Not started";
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
        <div className="panel" style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
          <div>
            <div className="eyebrow">Your challenge board</div>
            <h2 style={{ marginTop: 10 }}>Keep moving from theory to evidence.</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="metric">{completedCount}/{challenges.length}</div>
            <div className="muted">completed</div>
          </div>
        </div>
        <div className="grid">
          {challenges.map((challenge) => (
            <article className="panel" key={challenge.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <span className="tag">{challenge.level}</span>
                <span className="eyebrow">{statusLabel(challenge)}</span>
              </div>
              <h2 style={{ marginTop: 22 }}>{challenge.title}</h2>
              <p className="muted">{challenge.detail}</p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 27, marginBottom: 8 }}>
                <span className="eyebrow">Progress</span>
                <span className="eyebrow">{challenge.progress}%</span>
              </div>
              <div className="progress-track" aria-label={`${challenge.title} progress`}>
                <div className="progress-value" style={{ width: `${challenge.progress}%` }} />
              </div>
              <div className="eyebrow" style={{ marginTop: 20 }}>Worth +{challenge.points} pts</div>
            </article>
          ))}
        </div>
      </>
    )}
  </>;
}
