"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BuildProveAdminMutationError,
  BuildProveQueryError,
  BuildProveValidationError,
  assignBuildMember,
  assignBuildMembersBulk,
  cancelBuildWorkItem,
  reviewBuildSubmission,
  saveBuildAssignment,
  uploadBuildAssignmentReference,
  type BuildDomain,
  type BuildProvePublicationState,
  type BuildReviewDecision,
} from "@/lib/services/build-prove";
import type { Json } from "@/lib/types/database";

export type BuildProveAdminActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const domains: BuildDomain[] = [
  "innovation_research",
  "event_management",
  "media_design",
  "documentation",
];
const publicationStates: BuildProvePublicationState[] = ["draft", "published", "archived"];
const priorities = ["low", "normal", "high", "urgent"] as const;
const difficulties = ["easy", "medium", "hard"] as const;
const assignmentScopes = ["domain", "individual"] as const;
const reviewDecisions = ["approved", "changes_requested"] as const;
// Mirrors the review_build_submission RPC's own feedback limit.
const MAX_FEEDBACK_LENGTH = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InvalidBuildProveFormError extends Error {}

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string") throw new InvalidBuildProveFormError();
  return value;
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value === "object") {
    return Object.values(value).every(isJson);
  }
  return false;
}

function parseJsonArray(formData: FormData, key: string): Json {
  const raw = formText(formData, key).trim();
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new InvalidBuildProveFormError();
  }
  if (!Array.isArray(value) || !value.every(isJson)) {
    throw new InvalidBuildProveFormError();
  }
  return value;
}

function parseBuildTask(formData: FormData) {
  const title = formText(formData, "title").trim();
  const summary = formText(formData, "summary");
  const objective = formText(formData, "objective");
  const domain = formText(formData, "domain");
  const difficulty = formText(formData, "difficulty");
  const assignmentScope = formText(formData, "assignmentScope");
  const publicationState = formText(formData, "publicationState");
  const priority = formText(formData, "priority");
  const rewardPoints = Number(formText(formData, "rewardPoints"));
  const deadlineDate = formText(formData, "deadlineDate");
  const sortOrder = Number(formText(formData, "sortOrder") || "0");
  const assignmentId = formText(formData, "assignmentId").trim();

  if (
    !title
    || title.length > 160
    || !domains.includes(domain as BuildDomain)
    || !difficulties.includes(difficulty as (typeof difficulties)[number])
    || !assignmentScopes.includes(assignmentScope as (typeof assignmentScopes)[number])
    || !publicationStates.includes(publicationState as BuildProvePublicationState)
    || !priorities.includes(priority as (typeof priorities)[number])
    || !Number.isInteger(rewardPoints)
    || rewardPoints < 0
    || rewardPoints > 10000
    || !Number.isInteger(sortOrder)
    || sortOrder < 0
    || (deadlineDate && !/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate))
  ) {
    throw new InvalidBuildProveFormError();
  }

  const slugBase = title.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  const slug = assignmentId
    ? formText(formData, "slug")
    : `${slugBase || "build-task"}-${randomUUID().slice(0, 8)}`;

  return {
    assignmentId: assignmentId || undefined,
    slug,
    title,
    summary,
    objective,
    difficulty: difficulty as "easy" | "medium" | "hard",
    domain: domain as BuildDomain,
    assignmentScope: assignmentScope as "domain" | "individual",
    publicationState: publicationState as BuildProvePublicationState,
    deadlineAt: deadlineDate ? `${deadlineDate}T23:59:59.999Z` : null,
    priority: priority as "low" | "normal" | "high" | "urgent",
    requirements: parseJsonArray(formData, "requirements"),
    deliverables: parseJsonArray(formData, "deliverables"),
    submissionRequirements: parseJsonArray(formData, "submissionRequirements"),
    evaluationCriteria: parseJsonArray(formData, "evaluationCriteria"),
    rewardPoints,
    sortOrder,
  };
}

function mutationMessage(error: BuildProveAdminMutationError): string {
  switch (error.code) {
    case "forbidden":
      return "Administrator authorization is required for this action.";
    case "not_found":
      return "The task or member could not be found. Refresh the page and try again.";
    case "invalid_input":
      return "The task or assignment is invalid. Check the fields, publication state, and member eligibility.";
    case "conflict":
      return "This task cannot be changed in its current state. Refresh the page and review its assignments.";
    default:
      return "The Build & Prove operation could not be completed. Please try again.";
  }
}

export async function saveBuildTaskAction(
  _previousState: BuildProveAdminActionState,
  formData: FormData,
): Promise<BuildProveAdminActionState> {
  let input;
  try {
    input = parseBuildTask(formData);
  } catch (error) {
    if (error instanceof InvalidBuildProveFormError) {
      return { status: "error", message: "Check the task fields and enter valid JSON arrays where requested." };
    }
    throw error;
  }

  try {
    const result = await saveBuildAssignment(input);
    revalidatePath("/admin/build-prove");
    revalidatePath(`/admin/build-prove/tasks/${result.assignmentId}`);
    revalidatePath(`/admin/build-prove/tasks/${result.assignmentId}/edit`);
    const mode = input.assignmentId ? "saved" : "created";
    const query = mode === "created" ? "created=1" : "saved=1";
    redirect(`/admin/build-prove/tasks/${result.assignmentId}?${query}`);
  } catch (error) {
    if (error instanceof BuildProveAdminMutationError) {
      return { status: "error", message: mutationMessage(error) };
    }
    if (error instanceof BuildProveQueryError || error instanceof BuildProveValidationError) {
      return { status: "error", message: "The task could not be saved. Refresh and check the current task data." };
    }
    throw error;
  }
}

export async function assignBuildMemberAction(
  _previousState: BuildProveAdminActionState,
  formData: FormData,
): Promise<BuildProveAdminActionState> {
  const assignmentId = formData.get("assignmentId");
  const memberId = formData.get("memberId");
  if (typeof assignmentId !== "string" || typeof memberId !== "string") {
    return { status: "error", message: "Select a member to assign." };
  }
  try {
    const result = await assignBuildMember(assignmentId, memberId);
    revalidatePath("/admin/build-prove");
    revalidatePath(`/admin/build-prove/tasks/${assignmentId}`);
    return {
      status: "success",
      message: result.created ? "Member assigned." : "This member already has a work item; no duplicate was created.",
    };
  } catch (error) {
    if (error instanceof BuildProveAdminMutationError) {
      return { status: "error", message: mutationMessage(error) };
    }
    if (error instanceof BuildProveQueryError || error instanceof BuildProveValidationError) {
      return { status: "error", message: "The member could not be assigned. Check task publication and member eligibility." };
    }
    throw error;
  }
}

export async function assignBuildMembersBulkAction(
  _previousState: BuildProveAdminActionState,
  formData: FormData,
): Promise<BuildProveAdminActionState> {
  const assignmentId = formData.get("assignmentId");
  const memberIds = formData.getAll("memberIds");
  const selectedMemberIds = memberIds.filter((id): id is string => typeof id === "string");
  if (typeof assignmentId !== "string" || selectedMemberIds.length === 0
    || selectedMemberIds.length !== memberIds.length) {
    return { status: "error", message: "Select at least one eligible member." };
  }
  try {
    await assignBuildMembersBulk(assignmentId, selectedMemberIds);
    revalidatePath("/admin/build-prove");
    revalidatePath(`/admin/build-prove/tasks/${assignmentId}`);
    return {
      status: "success",
      message: "Bulk assignment saved. Existing member work items and reward snapshots were preserved.",
    };
  } catch (error) {
    if (error instanceof BuildProveAdminMutationError) {
      return { status: "error", message: mutationMessage(error) };
    }
    if (error instanceof BuildProveQueryError || error instanceof BuildProveValidationError) {
      return { status: "error", message: "Members could not be assigned. Check publication and domain eligibility." };
    }
    throw error;
  }
}

export async function reviewBuildSubmissionAction(
  _previousState: BuildProveAdminActionState,
  formData: FormData,
): Promise<BuildProveAdminActionState> {
  const submissionId = formData.get("submissionId");
  const assignmentId = formData.get("assignmentId");
  const decision = formData.get("decision");
  const feedbackValue = formData.get("feedback");
  const feedback = typeof feedbackValue === "string" ? feedbackValue.trim() : "";

  // Every rule here is re-checked by review_build_submission in the database.
  // Validating server-side keeps the message specific instead of surfacing a
  // raw Postgres error, and never trusts the browser for the decision.
  if (
    typeof submissionId !== "string"
    || !UUID_PATTERN.test(submissionId)
    || typeof decision !== "string"
    || !reviewDecisions.includes(decision as BuildReviewDecision)
  ) {
    return { status: "error", message: "Choose approve or request changes." };
  }
  if (feedback.length > MAX_FEEDBACK_LENGTH) {
    return {
      status: "error",
      message: `Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer.`,
    };
  }
  if (decision === "changes_requested" && feedback.length === 0) {
    return {
      status: "error",
      message: "Requesting changes requires feedback explaining what to improve.",
    };
  }

  try {
    const result = await reviewBuildSubmission(
      submissionId,
      decision as BuildReviewDecision,
      feedback,
    );
    if (typeof assignmentId === "string" && UUID_PATTERN.test(assignmentId)) {
      revalidatePath(`/admin/build-prove/tasks/${assignmentId}`);
    }
    revalidatePath("/admin/build-prove");
    revalidatePath("/admin/build-prove/review");
    return {
      status: "success",
      message: result.idempotent
        ? "This revision was already reviewed. No duplicate review was added."
        : decision === "approved"
          ? "Submission approved. The review is recorded permanently."
          : "Changes requested. The member can now revise and resubmit.",
    };
  } catch (error) {
    if (error instanceof BuildProveAdminMutationError) {
      return { status: "error", message: mutationMessage(error) };
    }
    if (error instanceof BuildProveQueryError || error instanceof BuildProveValidationError) {
      return {
        status: "error",
        message: "The review could not be recorded. Refresh and check the current submission state.",
      };
    }
    return {
      status: "error",
      message: "The review could not be recorded. The submission may have changed since it loaded.",
    };
  }
}

export async function cancelBuildWorkItemAction(
  _previousState: BuildProveAdminActionState,
  formData: FormData,
): Promise<BuildProveAdminActionState> {
  const workItemId = formData.get("workItemId");
  const assignmentId = formData.get("assignmentId");
  if (typeof workItemId !== "string" || !UUID_PATTERN.test(workItemId)) {
    return { status: "error", message: "The work item could not be identified." };
  }

  try {
    const result = await cancelBuildWorkItem(workItemId);
    if (typeof assignmentId === "string" && UUID_PATTERN.test(assignmentId)) {
      revalidatePath(`/admin/build-prove/tasks/${assignmentId}`);
    }
    revalidatePath("/admin/build-prove");
    revalidatePath("/admin/build-prove/review");
    return {
      status: "success",
      message: result.idempotent
        ? "This work item was already cancelled; no change was needed."
        : "Work item cancelled. Member drafts and evidence are no longer editable.",
    };
  } catch (error) {
    if (error instanceof BuildProveAdminMutationError) {
      return { status: "error", message: mutationMessage(error) };
    }
    if (error instanceof BuildProveQueryError || error instanceof BuildProveValidationError) {
      return {
        status: "error",
        message: "The work item could not be cancelled. Approved or cancelled items cannot change.",
      };
    }
    return { status: "error", message: "The work item could not be cancelled." };
  }
}

export async function uploadBuildReferenceAction(
  _previousState: BuildProveAdminActionState,
  formData: FormData,
): Promise<BuildProveAdminActionState> {
  const assignmentId = formData.get("assignmentId");
  const label = formData.get("label");
  const file = formData.get("referenceFile");
  if (
    typeof assignmentId !== "string"
    || typeof label !== "string"
    || !(file instanceof File)
  ) {
    return { status: "error", message: "Choose a reference file and provide a label." };
  }
  try {
    await uploadBuildAssignmentReference(assignmentId, file, label);
    revalidatePath(`/admin/build-prove/tasks/${assignmentId}`);
    return { status: "success", message: "Reference attachment added." };
  } catch (error) {
    if (error instanceof BuildProveAdminMutationError) {
      return { status: "error", message: mutationMessage(error) };
    }
    if (error instanceof BuildProveQueryError || error instanceof BuildProveValidationError) {
      return { status: "error", message: "The reference could not be added. Check the file and task state." };
    }
    throw error;
  }
}
