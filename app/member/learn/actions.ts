"use server";

import { revalidatePath } from "next/cache";
import {
  getMemberBuildProveTaskDetail,
  resubmitBuildWork,
  startBuildAssignment,
  submitBuildWork,
} from "@/lib/services/build-prove";

export type BuildProveActionState = { error?: string; success?: string };

function textField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function optionalUrl(formData: FormData, name: string): string | null | undefined {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.length > 2048) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function workItemIdFrom(formData: FormData): string | null {
  const value = formData.get("workItemId");
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function invalidateWorkPages(domain: string, workItemId: string) {
  revalidatePath("/member/learn");
  revalidatePath(`/member/learn/${domain.replaceAll("_", "-")}`);
  revalidatePath(`/member/learn/tasks/${workItemId}`);
}

export async function startBuildWorkAction(
  _previousState: BuildProveActionState,
  formData: FormData,
): Promise<BuildProveActionState> {
  const workItemId = workItemIdFrom(formData);
  if (!workItemId) return { error: "This task could not be started. Refresh and try again." };
  const detail = await getMemberBuildProveTaskDetail(workItemId);
  if (!detail || detail.workItem.status !== "assigned") {
    return { error: "This task is no longer available to start." };
  }
  await startBuildAssignment(workItemId);
  invalidateWorkPages(detail.task.domain, workItemId);
  return { success: "Work started. You can now submit your proof when it is ready." };
}

export async function submitBuildWorkAction(
  _previousState: BuildProveActionState,
  formData: FormData,
): Promise<BuildProveActionState> {
  const workItemId = workItemIdFrom(formData);
  const projectTitle = textField(formData, "projectTitle", 200);
  const explanation = textField(formData, "explanation", 10_000);
  const approach = textField(formData, "approach", 10_000);
  const repositoryUrl = optionalUrl(formData, "repositoryUrl");
  const deploymentUrl = optionalUrl(formData, "deploymentUrl");
  const demoUrl = optionalUrl(formData, "demoUrl");
  if (!workItemId || !projectTitle || !explanation || !approach) {
    return { error: "Add a submission title, description, and approach before submitting." };
  }
  if (repositoryUrl === undefined || deploymentUrl === undefined || demoUrl === undefined) {
    return { error: "Links must be valid HTTP or HTTPS URLs." };
  }

  const detail = await getMemberBuildProveTaskDetail(workItemId);
  if (!detail || !["in_progress", "changes_requested"].includes(detail.workItem.status)) {
    return { error: "This task is not accepting a submission right now." };
  }
  const input = {
    workItemId,
    projectTitle,
    explanation,
    approach,
    technologies: [],
    challenges: "",
    learnings: "",
    futureImprovements: "",
    repositoryUrl,
    deploymentUrl,
    demoUrl,
  };
  if (detail.workItem.status === "changes_requested") {
    await resubmitBuildWork(input);
  } else {
    await submitBuildWork(input);
  }
  invalidateWorkPages(detail.task.domain, workItemId);
  return { success: "Your work was submitted for review." };
}
