import { MemberDirectory } from "@/components/admin/MemberDirectory";
import { PageIntro } from "@/components/cards/PageIntro";
import { getAdminMembers, getMemberDirectoryPage, getMemberDirectorySearch } from "@/lib/services/admin-members";
import { redirect } from "next/navigation";

export default async function AdminMembersPage({ searchParams }: PageProps<"/admin/members">) {
  const params = await searchParams;
  const search = getMemberDirectorySearch(params.q);
  const page = getMemberDirectoryPage(params.page);

  const result = await getAdminMembers({ page, search }).catch(() => null);

  if (result && result.page !== page) {
    const params = new URLSearchParams({ page: result.page.toString() });

    if (search) {
      params.set("q", search);
    }

    redirect(`/admin/members?${params.toString()}`);
  }

  return <>
    <PageIntro kicker="Admin workspace / members" title="Members, in focus." description="A clear, read-only view of the builders who make the community move." />
    {result ? <MemberDirectory members={result.members} page={result.page} search={search} total={result.total} /> : <section className="admin-member-error"><h2>The member directory is unavailable.</h2><p>Please refresh the page and try again.</p></section>}
  </>;
}
