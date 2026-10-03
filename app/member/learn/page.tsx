import Link from "next/link";
import { ArrowRight, BookOpenText, CalendarDays, FlaskConical, Palette } from "lucide-react";
import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { getMemberBuildProveDomains } from "@/lib/services/build-prove";

const domainDescriptions = {
  innovation_research: "Research, experimentation, ideas and technical exploration.",
  event_management: "Plan, coordinate and execute community events.",
  media_design: "Visuals, creative assets, branding and communication.",
  documentation: "Reports, records, guides and structured knowledge.",
} as const;

const domainIcons = {
  innovation_research: FlaskConical,
  event_management: CalendarDays,
  media_design: Palette,
  documentation: BookOpenText,
} as const;

function domainPath(key: string) {
  return key.replaceAll("_", "-");
}

export default async function BuildAndProveHome() {
  const domains = await getMemberBuildProveDomains();

  return (
    <>
      <Topline section="AWS ISLEC / Build & Prove" />
      <PageIntro
        kicker="Your work"
        title="Build & Prove"
        description="Open your domain, work through assigned tasks, submit your proof, and use reviewer feedback to move each task forward."
      />
      <section className="build-domain-grid" aria-label="Build & Prove domains">
        {domains.map((domain) => {
          const Icon = domainIcons[domain.key];
          return (
            <article className="build-domain-card" key={domain.key}>
              <div className="build-domain-card-top">
                <span className={`build-domain-icon ${domain.key}`}>
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="build-domain-count">
                  {domain.taskCount} {domain.taskCount === 1 ? "task" : "tasks"}
                </span>
              </div>
              <div>
                <h2>{domain.name}</h2>
                <p>{domainDescriptions[domain.key]}</p>
              </div>
              <div className="build-domain-card-footer">
                <span>{domain.activeTaskCount} active</span>
                <span>{domain.awaitingReviewCount} awaiting review</span>
              </div>
              <Link
                className="build-domain-link"
                href={`/member/learn/${domainPath(domain.key)}`}
                aria-label={`Open ${domain.name} tasks`}
              >
                View assigned work <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </section>
      <p className="build-legacy-link">
        Looking for learning missions? <Link href="/member/challenges">Browse legacy challenges</Link>
      </p>
    </>
  );
}
