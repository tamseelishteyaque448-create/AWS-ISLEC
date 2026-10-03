import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildProveTaskDetail } from "@/components/member/build-prove/BuildProveTaskDetail";
import { PageIntro } from "@/components/cards/PageIntro";
import { Topline } from "@/components/ui/Topline";
import { getMemberBuildProveTaskDetail } from "@/lib/services/build-prove";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BuildProveTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  if (!UUID_PATTERN.test(taskId)) notFound();
  const detail = await getMemberBuildProveTaskDetail(taskId);
  if (!detail) notFound();

  return (
    <>
      <Topline section={`Build & Prove / ${detail.task.domain.replaceAll("_", " ")}`} />
      <Link
        className="build-back-link"
        href={`/member/learn/${detail.task.domain.replaceAll("_", "-")}`}
      >
        ← {detail.task.domain.replaceAll("_", " ")}
      </Link>
      <PageIntro
        kicker={detail.task.domain.replaceAll("_", " ")}
        title={detail.task.title}
        description={detail.task.summary}
      />
      <BuildProveTaskDetail detail={detail} />
    </>
  );
}
