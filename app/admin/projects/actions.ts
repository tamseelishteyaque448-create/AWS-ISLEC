"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { getProjectId, makeProjectSlug, validateProjectInput } from "@/lib/validation/admin-projects";

export type ProjectFormState = { status: "idle" | "error" | "success"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function adminClient() {
  const claims = await requireAdmin();
  return { claims, supabase: await createClient() };
}

function projectMutationError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "23505") return "A project with this title is already being created. Please try again.";
  if (error.code === "42501") return "You are not authorized to perform this project action.";
  if (error.code === "22023") return "Check the project fields and try again.";
  if (error.code === "P0002") return "The project no longer exists. Refresh and try again.";

  console.error("Project mutation failed", {
    code: error.code,
    message: error.message,
  });
  return fallback;
}

function revalidateProjects() {
  revalidatePath("/admin/projects");
  revalidatePath("/member/projects");
  revalidatePath("/projects");
  revalidatePath("/explore");
}

// ---------------------------------------------------------------------------
// createProject
// Creates a draft project via the authoritative create_project_v1 RPC.
// The admin becomes the initial owner; publication is a separate review step.
// ---------------------------------------------------------------------------
export async function createProject(
  _: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const admin = await adminClient();
  const input = validateProjectInput(formData);
  if ("error" in input) return { status: "error", message: input.error };

  const { error } = await admin.supabase.rpc("create_project_v1", {
    p_title:            input.data.title,
    p_slug:             makeProjectSlug(input.data.title),
    p_category:         input.data.category,
    p_description:      input.data.description,
    p_technologies:     input.data.technologies,
    p_recruitment_mode: input.data.recruitment_mode,
    p_team_capacity:    input.data.team_capacity,
  });

  if (error) return { status: "error", message: projectMutationError(error, "The project could not be created. Please try again.") };
  revalidateProjects();
  return { status: "success", message: "Draft project created with you as owner." };
}

// ---------------------------------------------------------------------------
// updateProject
// Routes through the admin_update_project_v1 RPC (SECURITY DEFINER, admin-
// only).  This path validates inputs, guards capacity, preserves ownership
// invariants, and writes to the audit log — the previous direct table UPDATE
// did none of those things.
// ---------------------------------------------------------------------------
export async function updateProject(
  _: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const admin = await adminClient();
  const id    = getProjectId(formData.get("project_id"));
  const input = validateProjectInput(formData);

  if (!id)             return { status: "error", message: "Invalid project." };
  if ("error" in input) return { status: "error", message: input.error };

  const { error } = await admin.supabase.rpc("admin_update_project_v1", {
    p_project_id:      id,
    p_title:           input.data.title,
    p_category:        input.data.category,
    p_description:     input.data.description,
    p_technologies:    input.data.technologies,
    p_build_stage:     input.data.build_stage,
    p_recruitment_mode: input.data.recruitment_mode,
    p_team_capacity:   input.data.team_capacity,
    p_repository_url:  input.data.repository_url,
    p_demo_url:        input.data.demo_url,
  });

  if (error) return { status: "error", message: projectMutationError(error, "The project could not be updated. Please try again.") };
  revalidateProjects();
  return { status: "success", message: "Project updated." };
}

// ---------------------------------------------------------------------------
// reviewProjectMember
// Calls the existing review_project_member RPC (admin-only, SECURITY DEFINER).
// Actions: approve_request | decline_request | complete_submission | return_submission
// ---------------------------------------------------------------------------
export async function reviewProjectMember(
  _: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const admin     = await adminClient();
  const projectId = formData.get("project_id");
  const profileId = formData.get("profile_id");
  const action    = formData.get("action");

  if (
    typeof projectId !== "string" || !UUID.test(projectId) ||
    typeof profileId !== "string" || !UUID.test(profileId) ||
    typeof action    !== "string"
  ) {
    return { status: "error", message: "Invalid team review." };
  }

  const { error } = await admin.supabase.rpc("review_project_member", {
    p_project_id: projectId,
    p_profile_id: profileId,
    p_action:     action,
  });

  if (error) return { status: "error", message: "The team review could not be applied." };
  revalidateProjects();
  return { status: "success", message: "Team status updated." };
}

// ---------------------------------------------------------------------------
// reviewProjectPublication
// Calls review_project_publication (admin-only, SECURITY DEFINER).
// Decisions: approved | changes_requested | archived
// ---------------------------------------------------------------------------
export async function reviewProjectPublication(
  _: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const admin    = await adminClient();
  const projectId = formData.get("project_id");
  const decision  = formData.get("decision");
  const feedback  = formData.get("feedback");

  if (
    typeof projectId !== "string" || !UUID.test(projectId) ||
    typeof decision  !== "string" || !["approved", "changes_requested", "archived"].includes(decision) ||
    (typeof feedback === "string" && feedback.length > 2000)
  ) {
    return { status: "error", message: "Invalid project review." };
  }

  const { error } = await admin.supabase.rpc("review_project_publication", {
    p_project_id: projectId,
    p_decision:   decision,
    p_feedback:   typeof feedback === "string" ? feedback.trim() : "",
  });

  if (error) return { status: "error", message: "The review could not be applied; the project may have changed." };
  revalidateProjects();
  return { status: "success", message: "Project review recorded." };
}

// ---------------------------------------------------------------------------
// recoverProjectOwnership
// Calls recover_project_ownership (admin-only, SECURITY DEFINER).
// Used when a project has no active owner; creates an audit + review record.
// ---------------------------------------------------------------------------
export async function recoverProjectOwnership(
  _: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const admin    = await adminClient();
  const projectId = formData.get("project_id");
  const ownerId   = formData.get("new_owner_id");
  const reason    = formData.get("reason");

  if (
    typeof projectId !== "string" || !UUID.test(projectId) ||
    typeof ownerId   !== "string" || !UUID.test(ownerId) ||
    (typeof reason === "string" && reason.length > 1000)
  ) {
    return { status: "error", message: "Invalid ownership recovery." };
  }

  const { error } = await admin.supabase.rpc("recover_project_ownership", {
    p_project_id:   projectId,
    p_new_owner_id: ownerId,
    p_reason:       typeof reason === "string" ? reason.trim() : "",
  });

  if (error) return { status: "error", message: "Recovery could not be applied." };
  revalidateProjects();
  return { status: "success", message: "Ownership recovered and audited." };
}
