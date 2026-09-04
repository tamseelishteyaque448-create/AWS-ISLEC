import { Construction } from "lucide-react";
import { PageIntro } from "@/components/cards/PageIntro";

export function AdminPlaceholder({ title, description }: { title: string; description: string }) {
  return <>
    <PageIntro kicker="Admin workspace" title={title} description={description} />
    <section className="admin-placeholder">
      <span className="admin-placeholder-icon"><Construction size={22} aria-hidden="true" /></span>
      <div>
        <h2>This workspace is being prepared.</h2>
        <p>Administrative tools will appear here once their workflows and safeguards are ready.</p>
      </div>
    </section>
  </>;
}
