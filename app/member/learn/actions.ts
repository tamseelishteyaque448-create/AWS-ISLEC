"use server";

import { revalidatePath } from "next/cache";
import {
  BuildProveEvidenceOperationError,
  getMemberBuildProveTaskDetail,
  saveBuildSubmissionDraft,
  startBuildAssignment,
  submitBuildSubmissionDraft,
  type SubmitBuildWorkInput,
} from "@/lib/services/build-prove";

export type BuildProveActionState = {
  error?: string;
  success?: string;
  draftId?: string;
  submissionId?: string;
  revisionNumber?: number;
  status?: "submitted" | "resubmitted";
};

function textField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function optionalTextField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value.trim();
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

function submissionInputFrom(
  formData: FormData,
  workItemId: string,
): { input: SubmitBuildWorkInput } | { error: string } {
  const projectTitle = textField(formData, "projectTitle", 160);
  const explanation = textField(formData, "explanation", 12_000);
  const approach = textField(formData, "approach", 12_000);
  const challenges = optionalTextField(formData, "challenges", 4_000);
  const learnings = optionalTextField(formData, "learnings", 4_000);
  const futureImprovements = optionalTextField(formData, "futureImprovements", 4_000);
  const technologiesText = optionalTextField(formData, "technologies", 3_000);
  const repositoryUrl = optionalUrl(formData, "repositoryUrl");
  const deploymentUrl = optionalUrl(formData, "deploymentUrl");
  const demoUrl = optionalUrl(formData, "demoUrl");
  if (
    !projectTitle
    || !explanation
    || !approach
    || challenges === null
    || learnings === null
    || futureImprovements === null
    || technologiesText === null
  ) {
    return { error: "Add a submission title, description, and approach before saving." };
  }
  if (repositoryUrl === undefined || deploymentUrl === undefined || demoUrl === undefined) {
    return { error: "Links must be valid HTTP or HTTPS URLs." };
  }
  const technologies = technologiesText
    .split(/\r?\n/)
    .map((technology) => technology.trim())
    .filter(Boolean);
  if (technologies.length > 25 || technologies.some((technology) => technology.length > 120)) {
    return { error: "List up to 25 technologies, with no more than 120 characters each." };
  }
  return {
    input: {
      workItemId,
      projectTitle,
      explanation,
      approach,
      technologies,
      challenges,
      learnings,
      futureImprovements,
      repositoryUrl,
      deploymentUrl,
      demoUrl,
    },
  };
}

function operationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof BuildProveEvidenceOperationError ? error.message : fallback;
}

export async function startBuildWorkAction(
  _previousState: BuildProveActionState,
  formData: FormData,
): Promise<BuildProveActionState> {
  const workItemId = workItemIdFrom(formData);
  if (!workItemId) return { error: "This task could not be started. Refresh and try again." };
  try {
    const detail = await getMemberBuildProveTaskDetail(workItemId);
    if (!detail || detail.workItem.status !== "assigned") {
      return { error: "This task is no longer available to start." };
    }
    await startBuildAssignment(workItemId);
    invalidateWorkPages(detail.task.domain, workItemId);
    return { success: "Work started. Your workspace is ready." };
  } catch {
    return { error: "This task could not be started. Refresh and try again." };
  }
}

export async function saveBuildWorkDraftAction(
  _previousState: BuildProveActionState,
  formData: FormData,
): Promise<BuildProveActionState> {
  const workItemId = workItemIdFrom(formData);
  if (!workItemId) return { error: "This task could not be saved. Refresh and try again." };
  const parsed = submissionInputFrom(formData, workItemId);
  if ("error" in parsed) return parsed;

  try {
    const detail = await getMemberBuildProveTaskDetail(workItemId);
    if (!detail || !["in_progress", "changes_requested"].includes(detail.workItem.status)) {
      return { error: "This task is not accepting draft changes right now." };
    }
    const draft = await saveBuildSubmissionDraft(parsed.input);
    invalidateWorkPages(detail.task.domain, workItemId);
    return { success: "Your draft was saved.", draftId: draft.draftId };
  } catch (error) {
    return {
      error: operationErrorMessage(error, "Your draft could not be saved. Refresh and try again."),
    };
  }
}

export async function submitBuildWorkAction(
  _previousState: BuildProveActionState,
  formData: FormData,
): Promise<BuildProveActionState> {
  const workItemId = workItemIdFrom(formData);
  if (!workItemId) {
    return { error: "Add a submission title, description, and approach before submitting." };
  }
  const parsed = submissionInputFrom(formData, workItemId);
  if (!("input" in parsed)) return { error: parsed.error.replace("before saving", "before submitting") };

  try {
    const detail = await getMemberBuildProveTaskDetail(workItemId);
    if (!detail || !["in_progress", "changes_requested"].includes(detail.workItem.status)) {
      return { error: "This task is not accepting a submission right now." };
    }
    const draft = await saveBuildSubmissionDraft(parsed.input);
    const submission = await submitBuildSubmissionDraft(draft.draftId);
    invalidateWorkPages(detail.task.domain, workItemId);
    return {
      success: "Your work was submitted for review.",
      submissionId: submission.submissionId,
      revisionNumber: submission.revisionNumber,
      status: submission.status,
    };
  } catch (error) {
    return {
      error: operationErrorMessage(error, "Your work could not be submitted. Refresh and try again."),
    };
  }
}
