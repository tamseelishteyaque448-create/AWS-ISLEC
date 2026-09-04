import { PageIntro } from "@/components/cards/PageIntro";

export default function AdminMembersLoading() {
  return <>
    <PageIntro kicker="Admin workspace / members" title="Members, in focus." description="Loading the community directory." />
    <section className="admin-directory admin-directory-loading" aria-busy="true" aria-label="Loading member directory">
      <div className="admin-loading-line wide" />
      <div className="admin-loading-line" />
      <div className="admin-loading-line" />
      <div className="admin-loading-line" />
    </section>
  </>;
}
