"use server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export type ProjectMemberState = { status: "idle" | "error" | "success"; message?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function change(formData: FormData, rpc: "request_project_access" | "submit_project_work") { if (!(await getAuthenticatedClaims())?.sub) return { status: "error", message: "Please sign in first." } satisfies ProjectMemberState; const id = formData.get("project_id"); if (typeof id !== "string" || !UUID.test(id)) return { status: "error", message: "Invalid project." } satisfies ProjectMemberState; const supabase = await createClient(); const { error } = await supabase.rpc(rpc, { p_project_id: id }); if (error) return { status: "error", message: rpc === "request_project_access" ? "This project is not accepting requests." : "Your work cannot be submitted yet." } satisfies ProjectMemberState; revalidatePath("/member/projects"); revalidatePath("/admin/projects"); return { status: "success", message: rpc === "request_project_access" ? "Access requested." : "Work submitted for review." } satisfies ProjectMemberState; }
export async function requestProjectAccess(_: ProjectMemberState, formData: FormData) { return change(formData, "request_project_access"); }
export async function submitProjectWork(_: ProjectMemberState, formData: FormData) { return change(formData, "submit_project_work"); }
