import { PageIntro } from "@/components/cards/PageIntro";

export default function AdminBuildProveLoading() {
  return <>
    <PageIntro kicker="Admin workspace / Build & Prove" title="Build & Prove, in motion." description="Loading task operations." />
    <section className="admin-build-loading" aria-busy="true" aria-label="Loading Build & Prove tasks">
      <div className="admin-build-loading-metrics"><i /><i /><i /><i /></div>
      <div className="admin-build-loading-row" />
      <div className="admin-build-loading-row" />
      <div className="admin-build-loading-row" />
    </section>
  </>;
}
