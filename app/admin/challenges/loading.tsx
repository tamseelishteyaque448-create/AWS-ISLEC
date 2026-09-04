import { PageIntro } from "@/components/cards/PageIntro";

export default function AdminChallengesLoading() {
  return <><PageIntro kicker="Admin workspace / challenges" title="Challenges, in motion." description="Loading the challenge catalogue." /><section className="admin-directory admin-directory-loading" aria-busy="true" aria-label="Loading challenges"><div className="admin-loading-line wide" /><div className="admin-loading-line" /><div className="admin-loading-line" /></section></>;
}