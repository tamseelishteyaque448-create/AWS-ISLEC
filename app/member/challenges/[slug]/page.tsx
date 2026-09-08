import Link from "next/link";
import { notFound } from "next/navigation";
import { ChallengeCompletionControl } from "@/components/member/ChallengeCompletionControl";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

export default async function ChallengeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const challenge = await supabaseRepository.getChallengeBySlug(slug);
  if (!challenge) notFound();

  return <><Topline section="Challenges / practical mission" /><nav className="challenge-breadcrumb" aria-label="Breadcrumb"><Link href="/member/challenges">Challenges</Link><span>/</span><span>{challenge.title}</span></nav>
    <article className="challenge-detail panel"><div className="challenge-card-top"><span className={`tag difficulty-${challenge.level}`}>{challenge.level}</span><span className="eyebrow">+{challenge.points} pts · {challenge.estimatedMinutes} min · {challenge.category}</span></div>
      <h1>{challenge.title}</h1><p className="challenge-scenario"><strong>Scenario</strong>{challenge.scenario}</p><section><div className="eyebrow">Your task</div><h2>{challenge.question}</h2></section>
      {challenge.status === "completed" ? <div className="challenge-completion-state" role="status">This mission is solved. Your points and progress are saved.</div> : <ChallengeCompletionControl challengeId={challenge.id} isCompleted={false} options={challenge.options} />}
      {challenge.hint ? <details className="challenge-hint"><summary>Need a hint?</summary><p>{challenge.hint}</p></details> : null}
      {challenge.status === "completed" && challenge.successExplanation ? <p className="challenge-explanation"><strong>Why this works:</strong> {challenge.successExplanation}</p> : null}
    </article></>;
}
