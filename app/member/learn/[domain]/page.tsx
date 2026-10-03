import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { BuildProveWorkList } from "@/components/member/build-prove/BuildProveWorkList";
import {
  getMemberBuildProveWorkItems,
  type BuildDomain,
  type BuildWorkStatus,
} from "@/lib/services/build-prove";

const domains: Record<string, { key: BuildDomain; name: string; description: string }> = {
  "innovation-research": {
    key: "innovation_research",
    name: "Innovation & Research",
    description: "Research, experimentation, ideas and technical exploration.",
  },
  "event-management": {
    key: "event_management",
    name: "Event Management",
    description: "Plan, coordinate and execute community events.",
  },
  "media-design": {
    key: "media_design",
    name: "Media & Design",
    description: "Visuals, creative assets, branding and communication.",
  },
  documentation: {
    key: "documentation",
    name: "Documentation",
    description: "Reports, records, guides and structured knowledge.",
  },
};

const statuses: BuildWorkStatus[] = [
  "assigned",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "approved",
];

const priorities = ["low", "normal", "high", "urgent"] as const;

function oneOf<T extends string>(value: string | undefined, values: readonly T[]): T | undefined {
  return value && values.includes(value as T) ? value as T : undefined;
}

export default async function BuildProveDomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const [{ domain: domainParam }, query] = await Promise.all([params, searchParams]);
  const domain = domains[domainParam];
  if (!domain) notFound();

  const status = oneOf(query.status, statuses);
  const priority = oneOf(query.priority, priorities);
  const { items } = await getMemberBuildProveWorkItems({
    domain: domain.key,
    status,
    priority,
    pageSize: 100,
  });

  return (
    <>
      <Topline section={`Build & Prove / ${domain.name}`} />
      <Link className="build-back-link" href="/member/learn">← All domains</Link>
      <PageIntro kicker="Assigned work" title={domain.name} description={domain.description} />
      <form className="build-filter-bar" method="get" aria-label="Filter assigned work">
        <label>
          Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={priority ?? ""}>
            <option value="">All priorities</option>
            {priorities.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="button button-secondary" type="submit">Apply filters</button>
      </form>
      <BuildProveWorkList
        items={items}
        emptyTitle={status || priority ? "No tasks match your current filters." : "Nothing assigned here yet."}
        emptyDescription={
          status || priority
            ? "Change or clear a filter to see other assigned work."
            : "Your assigned work in this domain will appear here."
        }
      />
    </>
  );
}
