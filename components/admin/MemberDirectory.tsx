import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, UsersRound } from "lucide-react";
import type { AdminMember } from "@/lib/services/admin-members";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function membersHref(page: number, search: string) {
  const params = new URLSearchParams({ page: page.toString() });

  if (search) {
    params.set("q", search);
  }

  return `/admin/members?${params.toString()}`;
}

export function MemberDirectory({ members, page, search, total }: { members: AdminMember[]; page: number; search: string; total: number }) {
  const pageCount = Math.max(Math.ceil(total / 20), 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, total);

  return <section className="admin-directory" aria-labelledby="member-directory-title">
    <div className="admin-directory-head">
      <div>
        <div className="eyebrow">Community directory</div>
        <h2 id="member-directory-title">Members, at a glance.</h2>
        <p>{total.toLocaleString()} {total === 1 ? "member" : "members"} visible to administrators.</p>
      </div>
      <span className="admin-directory-icon"><UsersRound size={21} aria-hidden="true" /></span>
    </div>

    <form className="admin-member-search" action="/admin/members">
      <label htmlFor="member-search">Search members</label>
      <div>
        <Search size={18} aria-hidden="true" />
        <input id="member-search" name="q" type="search" defaultValue={search} maxLength={80} placeholder="Name or handle" />
        <button className="button" type="submit">Search</button>
      </div>
    </form>

    {members.length === 0 ? <div className="admin-member-empty"><UsersRound size={24} aria-hidden="true" /><h3>{search ? "No members found." : "No members yet."}</h3><p>{search ? "Try a different name or handle." : "Member profiles will appear here when accounts are created."}</p></div> : <>
      <div className="admin-member-list" role="list">
        {members.map((member) => <article className="admin-member-row" key={member.id} role="listitem">
          <span className="admin-member-avatar admin-member-initials">{initials(member.full_name)}</span>
          <div className="admin-member-identity"><strong>{member.full_name}</strong><span>{member.handle}</span></div>
          <dl className="admin-member-stats"><div><dt>Points</dt><dd>{member.points.toLocaleString()}</dd></div><div><dt>Streak</dt><dd>{member.streak} days</dd></div></dl>
          <div className="admin-member-dates"><span>Joined {formatDate(member.created_at)}</span><span>Updated {formatDate(member.updated_at)}</span></div>
        </article>)}
      </div>
      <nav className="admin-member-pagination" aria-label="Member directory pages">
        <span>Showing {rangeStart}–{rangeEnd} of {total.toLocaleString()}</span>
        <div><Link className={page === 1 ? "is-disabled" : undefined} href={membersHref(Math.max(page - 1, 1), search)} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}><ChevronLeft size={16} aria-hidden="true" />Previous</Link><span>Page {page} of {pageCount}</span><Link className={page >= pageCount ? "is-disabled" : undefined} href={membersHref(Math.min(page + 1, pageCount), search)} aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : undefined}>Next<ChevronRight size={16} aria-hidden="true" /></Link></div>
      </nav>
    </>}
  </section>;
}
