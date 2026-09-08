"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MemberChallenge } from "@/lib/services";

const filters = ["all", "easy", "medium", "hard", "solved", "remaining"] as const;

export function ChallengeCatalogue({ challenges }: { challenges: MemberChallenge[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const visibleChallenges = useMemo(() => challenges.filter((challenge) => {
    if (filter === "all") return true;
    if (filter === "solved") return challenge.status === "completed";
    if (filter === "remaining") return challenge.status !== "completed";
    return challenge.level === filter;
  }), [challenges, filter]);

  return <>
    <div className="challenge-filters" aria-label="Filter challenges">
      {filters.map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)} type="button">{item[0].toUpperCase() + item.slice(1)}</button>)}
    </div>
    {visibleChallenges.length === 0 ? <div className="panel"><h2>No {filter === "all" ? "" : `${filter} `}challenges found.</h2><p className="muted">Try another filter to see available missions.</p></div> : <div className="grid">
      {visibleChallenges.map((challenge) => <article className="panel challenge-card" key={challenge.id}>
        <div className="challenge-card-top"><span className={`tag difficulty-${challenge.level}`}>{challenge.level}</span><span className="eyebrow">{challenge.status === "completed" ? "Solved" : "Ready"}</span></div>
        <h2>{challenge.title}</h2><p className="muted">{challenge.detail}</p>
        <div className="challenge-card-meta"><span>{challenge.category}</span><span>{challenge.estimatedMinutes} min</span><strong>+{challenge.points} pts</strong></div>
        <Link className="section-action" href={`/member/challenges/${challenge.slug}`}>{challenge.status === "completed" ? "Review mission" : "Open mission"} →</Link>
      </article>)}
    </div>}
  </>;
}
