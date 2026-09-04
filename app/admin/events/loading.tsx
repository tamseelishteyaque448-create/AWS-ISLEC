import { PageIntro } from "@/components/cards/PageIntro";

export default function AdminEventsLoading() {
  return <><PageIntro kicker="Admin workspace / events" title="Events, thoughtfully run." description="Loading the community calendar." /><section className="admin-directory admin-directory-loading" aria-busy="true" aria-label="Loading events"><div className="admin-loading-line wide" /><div className="admin-loading-line" /><div className="admin-loading-line" /></section></>;
}
