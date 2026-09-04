import { PageIntro } from "@/components/cards/PageIntro";

export default function AdminLearningLoading() {
  return <><PageIntro kicker="Admin workspace / learning" title="Learning, made visible." description="Loading the curriculum catalogue." /><section className="admin-directory admin-directory-loading" aria-busy="true" aria-label="Loading learning paths"><div className="admin-loading-line wide" /><div className="admin-loading-line" /><div className="admin-loading-line" /></section></>;
}