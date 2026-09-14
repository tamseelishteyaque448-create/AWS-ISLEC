"use server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export type ProjectMemberState = { status: "idle" | "error" | "success"; message?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// submitProjectWork: lets an active contributor mark their personal contribution
// as submitted for admin review via review_project_member(complete_submission).
// This is distinct from submitProjectForReview (owner submits the whole project).
export async function submitProjectWork(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const id = formData.get("project_id");
  if (typeof id !== "string" || !UUID.test(id)) return { status: "error", message: "Invalid project." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_project_work", { p_project_id: id });
  if (error) return { status: "error", message: "Your work cannot be submitted yet." };
  revalidatePath("/member/projects");
  revalidatePath("/admin/projects");
  return { status: "success", message: "Work submitted for review." };
}
function clean(value: FormDataEntryValue | null, max: number, required = false) { const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""; return (required && !text) || text.length > max ? null : text; }
function slug(title: string) { return `${title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100) || "project"}-${crypto.randomUUID().slice(0, 8)}`; }
export async function createMemberProject(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const title = clean(formData.get("title"), 160, true); const category = clean(formData.get("category"), 80, true); const description = clean(formData.get("description"), 2000);
  const recruitment = formData.get("recruitment_mode"); const capacityValue = formData.get("team_capacity"); const capacity = typeof capacityValue === "string" && capacityValue ? Number(capacityValue) : null;
  const technologies = typeof formData.get("technologies") === "string" ? [...new Set((formData.get("technologies") as string).split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 12) : [];
  if (!title || !category || description === null || !["open", "invite_only", "not_recruiting"].includes(String(recruitment)) || (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) || technologies.some((item) => item.length > 60)) return { status: "error", message: "Check the project details." };
  const supabase = await createClient(); const { error } = await supabase.rpc("create_project_v1", { p_title: title, p_slug: slug(title), p_category: category, p_description: description, p_technologies: technologies, p_recruitment_mode: String(recruitment), p_team_capacity: capacity });
  if (error) return { status: "error", message: "The project could not be created." }; revalidatePath("/member/projects"); return { status: "success", message: "Draft project created. You are its owner." };
}
export async function requestProjectJoin(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." }; const id = formData.get("project_id"); const contribution = clean(formData.get("contribution"), 120) ?? ""; const message = clean(formData.get("message"), 1000) ?? "";
  if (typeof id !== "string" || !UUID.test(id)) return { status: "error", message: "Invalid project." }; const supabase = await createClient(); const { error } = await supabase.rpc("request_project_join", { p_project_id: id, p_contribution: contribution, p_message: message });
  if (error) return { status: "error", message: "This project is not accepting your request." }; revalidatePath("/member/projects"); revalidatePath("/member/explore"); revalidatePath("/projects"); return { status: "success", message: "Join request sent." };
}
export async function submitProjectForReview(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> { if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." }; const id = formData.get("project_id"); if (typeof id !== "string" || !UUID.test(id)) return { status: "error", message: "Invalid project." }; const { error } = await (await createClient()).rpc("submit_project_for_review", { p_project_id: id }); if (error) return { status: "error", message: "This project cannot be submitted right now." }; revalidatePath("/member/projects"); revalidatePath("/admin/projects"); return { status: "success", message: "Project submitted for review." }; }
async function workspaceRpc(formData: FormData, rpc: "withdraw_project_join_request" | "resolve_project_join_request" | "transfer_project_ownership") { if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." } satisfies ProjectMemberState; const supabase = await createClient(); let error; if (rpc === "withdraw_project_join_request") { const requestId = formData.get("request_id"); if (typeof requestId !== "string" || !UUID.test(requestId)) return { status: "error", message: "Invalid request." }; ({ error } = await supabase.rpc(rpc, { p_request_id: requestId })); } else if (rpc === "resolve_project_join_request") { const requestId = formData.get("request_id"); const approve = formData.get("approve") === "true"; if (typeof requestId !== "string" || !UUID.test(requestId)) return { status: "error", message: "Invalid request." }; ({ error } = await supabase.rpc(rpc, { p_request_id: requestId, p_approve: approve })); } else { const projectId = formData.get("project_id"); const ownerId = formData.get("new_owner_id"); if (typeof projectId !== "string" || typeof ownerId !== "string" || !UUID.test(projectId) || !UUID.test(ownerId)) return { status: "error", message: "Invalid ownership transfer." }; ({ error } = await supabase.rpc(rpc, { p_project_id: projectId, p_new_owner_id: ownerId })); } if (error) return { status: "error", message: "This action could not be applied. The project may have changed." }; revalidatePath("/member/projects"); revalidatePath("/member/projects/[id]", "page"); revalidatePath("/admin/projects"); return { status: "success", message: rpc === "transfer_project_ownership" ? "Ownership transferred." : "Team request updated." }; }
export async function withdrawProjectJoinRequest(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> { return (await workspaceRpc(formData, "withdraw_project_join_request")) as ProjectMemberState; }
export async function resolveProjectJoinRequest(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> { return (await workspaceRpc(formData, "resolve_project_join_request")) as ProjectMemberState; }
export async function transferProjectOwnership(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> { return (await workspaceRpc(formData, "transfer_project_ownership")) as ProjectMemberState; }
export async function updateMemberProject(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> { if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." }; const id = formData.get("project_id"); const title = clean(formData.get("title"), 160, true); const category = clean(formData.get("category"), 80, true); const description = clean(formData.get("description"), 2000); const stage = formData.get("build_stage"); const recruitment = formData.get("recruitment_mode"); const capacityText = formData.get("team_capacity"); const capacity = typeof capacityText === "string" && capacityText ? Number(capacityText) : null; const repository = clean(formData.get("repository_url"), 500); const demo = clean(formData.get("demo_url"), 500); const technologies = typeof formData.get("technologies") === "string" ? [...new Set((formData.get("technologies") as string).split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 12) : []; if (typeof id !== "string" || !UUID.test(id) || !title || !category || description === null || repository === null || demo === null || !["idea","building","prototype","shipped"].includes(String(stage)) || !["open","invite_only","not_recruiting"].includes(String(recruitment)) || (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) || technologies.some((item) => item.length > 60)) return { status: "error", message: "Check the project details." }; const { error } = await (await createClient()).rpc("update_project_v1", { p_project_id: id, p_title: title, p_category: category, p_description: description, p_technologies: technologies, p_build_stage: String(stage), p_recruitment_mode: String(recruitment), p_team_capacity: capacity, p_repository_url: repository || null, p_demo_url: demo || null }); if (error) return { status: "error", message: "The project cannot be edited in its current state." }; revalidatePath("/member/projects"); return { status: "success", message: "Project updated." }; }

export async function addJoinRequestProof(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const requestId = formData.get("request_id");
  const proofType = formData.get("proof_type");
  const title = clean(formData.get("title"), 120, true);
  const description = clean(formData.get("description"), 500) ?? "";
  const url = clean(formData.get("url"), 500, true);
  if (!title || !url || typeof requestId !== "string" || !UUID.test(requestId)) return { status: "error", message: "Check the proof details." };
  const { error } = await (await createClient()).rpc("add_join_request_proof", { p_request_id: requestId, p_proof_type: String(proofType), p_title: title, p_description: description, p_url: url });
  if (error) return { status: "error", message: "The proof could not be added." };
  revalidatePath("/member/projects");
  revalidatePath("/member/projects/[id]", "page");
  return { status: "success", message: "Proof added." };
}

export async function removeJoinRequestProof(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const proofId = formData.get("proof_id");
  if (typeof proofId !== "string" || !UUID.test(proofId)) return { status: "error", message: "Invalid proof." };
  const { error } = await (await createClient()).rpc("remove_join_request_proof", { p_proof_id: proofId });
  if (error) return { status: "error", message: "The proof could not be removed." };
  revalidatePath("/member/projects");
  revalidatePath("/member/projects/[id]", "page");
  return { status: "success", message: "Proof removed." };
}

const TASK_STATUSES = ["todo", "in_progress", "blocked", "completed"] as const;

function nonNegativeInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function optionalUuid(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null || (typeof value === "string" && value.trim() === "")) return null;
  return typeof value === "string" && UUID.test(value) ? value : undefined;
}

function revalidateMemberProjectWorkspace(projectId: string) {
  revalidatePath(`/member/projects/${projectId}`);
}

function workspaceActionFailure(fallback: string): ProjectMemberState {
  return { status: "error", message: fallback };
}

export async function createProjectMilestone(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const projectId = formData.get("project_id");
  const title = clean(formData.get("title"), 120, true);
  const description = clean(formData.get("description"), 500);
  const sortOrder = nonNegativeInteger(formData.get("sort_order"));
  if (typeof projectId !== "string" || !UUID.test(projectId) || !title || description === null || sortOrder === null) {
    return { status: "error", message: "Check the milestone details." };
  }

  const { error } = await (await createClient()).rpc("create_project_milestone", {
    p_project_id: projectId,
    p_title: title,
    p_description: description,
    p_sort_order: sortOrder,
  });
  if (error) return workspaceActionFailure("The milestone could not be created.");
  revalidateMemberProjectWorkspace(projectId);
  return { status: "success", message: "Milestone created." };
}

export async function archiveProjectMilestone(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const projectId = formData.get("project_id");
  const milestoneId = formData.get("milestone_id");
  if (typeof projectId !== "string" || typeof milestoneId !== "string" || !UUID.test(projectId) || !UUID.test(milestoneId)) {
    return { status: "error", message: "Invalid milestone." };
  }

  const { error } = await (await createClient()).rpc("archive_project_milestone", { p_project_id: projectId, p_milestone_id: milestoneId });
  if (error) return workspaceActionFailure("The milestone cannot be archived right now.");
  revalidateMemberProjectWorkspace(projectId);
  return { status: "success", message: "Milestone archived." };
}

export async function createProjectTask(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const projectId = formData.get("project_id");
  const milestoneId = formData.get("milestone_id");
  const title = clean(formData.get("title"), 200, true);
  const description = clean(formData.get("description"), 2000);
  const assigneeId = optionalUuid(formData.get("assignee_id"));
  const sortOrder = nonNegativeInteger(formData.get("sort_order"));
  if (typeof projectId !== "string" || typeof milestoneId !== "string" || !UUID.test(projectId) || !UUID.test(milestoneId)
    || !title || description === null || assigneeId === undefined || sortOrder === null) {
    return { status: "error", message: "Check the task details." };
  }

  const { error } = await (await createClient()).rpc("create_project_task", {
    p_project_id: projectId,
    p_milestone_id: milestoneId,
    p_title: title,
    p_description: description,
    p_assignee_id: assigneeId,
    p_sort_order: sortOrder,
  });
  if (error) return workspaceActionFailure("The task could not be created.");
  revalidateMemberProjectWorkspace(projectId);
  return { status: "success", message: "Task created." };
}

export async function updateProjectTaskStatus(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const projectId = formData.get("project_id");
  const taskId = formData.get("task_id");
  const status = formData.get("status");
  if (typeof projectId !== "string" || typeof taskId !== "string" || typeof status !== "string"
    || !UUID.test(projectId) || !UUID.test(taskId) || !TASK_STATUSES.includes(status as typeof TASK_STATUSES[number])) {
    return { status: "error", message: "Invalid task status." };
  }

  const { error } = await (await createClient()).rpc("update_task_status", { p_project_id: projectId, p_task_id: taskId, p_status: status });
  if (error) return workspaceActionFailure("The task status could not be updated.");
  revalidateMemberProjectWorkspace(projectId);
  return { status: "success", message: "Task status updated." };
}

export async function assignProjectTask(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const projectId = formData.get("project_id");
  const taskId = formData.get("task_id");
  const assigneeId = optionalUuid(formData.get("assignee_id"));
  if (typeof projectId !== "string" || typeof taskId !== "string" || !UUID.test(projectId) || !UUID.test(taskId) || assigneeId === undefined) {
    return { status: "error", message: "Invalid task assignment." };
  }

  const { error } = await (await createClient()).rpc("assign_task", { p_project_id: projectId, p_task_id: taskId, p_assignee_id: assigneeId });
  if (error) return workspaceActionFailure("The task assignment could not be updated.");
  revalidateMemberProjectWorkspace(projectId);
  return { status: "success", message: assigneeId ? "Task assigned." : "Task unassigned." };
}

export async function archiveProjectTask(_: ProjectMemberState, formData: FormData): Promise<ProjectMemberState> {
  if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." };
  const projectId = formData.get("project_id");
  const taskId = formData.get("task_id");
  if (typeof projectId !== "string" || typeof taskId !== "string" || !UUID.test(projectId) || !UUID.test(taskId)) {
    return { status: "error", message: "Invalid task." };
  }

  const { error } = await (await createClient()).rpc("archive_task", { p_project_id: projectId, p_task_id: taskId });
  if (error) return workspaceActionFailure("The task cannot be archived right now.");
  revalidateMemberProjectWorkspace(projectId);
  return { status: "success", message: "Task archived." };
}
