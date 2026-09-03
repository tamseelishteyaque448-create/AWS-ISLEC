import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { supabaseRepository } from "@/lib/services";

function LearnCatalogueState({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}

export default async function Learn() {
  let paths;

  try {
    paths = await supabaseRepository.getLearningCatalogue();
  } catch {
    return <>
      <Topline section="Learn / practice / repeat" />
      <PageIntro kicker="Your curriculum" title="Get better by shipping." description="Short, practical paths for the moments when you want to understand a thing well enough to use it." />
      <LearnCatalogueState>
        <h2>Learning paths are unavailable right now.</h2>
        <p className="muted">Please refresh the page and try again.</p>
      </LearnCatalogueState>
    </>;
  }

  const challenges = paths.flatMap((path) => path.challenges);

  return <>
    <Topline section="Learn / practice / repeat" />
    <PageIntro kicker="Your curriculum" title="Get better by shipping." description="Short, practical paths for the moments when you want to understand a thing well enough to use it." />
    {challenges.length === 0 ? (
      <LearnCatalogueState>
        <h2>No learning paths are available yet.</h2>
        <p className="muted">Check back soon for the next practical path.</p>
      </LearnCatalogueState>
    ) : (
      <div className="grid">
        {challenges.map((challenge) => (
          <article className="panel" key={challenge.id}>
            <span className="tag">{challenge.level}</span>
            <h2 style={{ marginTop: 18 }}>{challenge.title}</h2>
            <p className="muted">{challenge.detail}</p>
            <div className="eyebrow" style={{ marginTop: 30 }}>+{challenge.points} pts</div>
          </article>
        ))}
      </div>
    )}
  </>;
}
