import "server-only";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

type ProjectRow = Pick<Tables<"projects">, "id" | "title" | "category" | "status" | "description" | "progress" | "technologies" | "is_published" | "created_at" | "updated_at">;
type MembershipRow = Pick<Tables<"project_members">, "project_id" | "profile_id" | "role" | "status" | "joined_at" | "submitted_at" | "reviewed_at">;

export type CommunityProject = ProjectRow & { membership: MembershipRow | null };
export type AdminProjectMember = MembershipRow & { fullName: string; handle: string };
export type AdminProject = ProjectRow & { members: AdminProjectMember[] };
const PROJECT_FIELDS = "id, title, category, status, description, progress, technologies, is_published, created_at, updated_at";

export async function getPublicProjects(): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select(PROJECT_FIELDS).eq("is_published", true).neq("status", "archived").order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load projects.");
  return (data ?? []) as ProjectRow[];
}

export async function getMemberProjects(): Promise<CommunityProject[]> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return [];
  const supabase = await createClient();
  const [projects, memberships] = await Promise.all([
    supabase.from("projects").select(PROJECT_FIELDS).order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at").eq("profile_id", claims.sub),
  ]);
  if (projects.error || memberships.error) throw new Error("Unable to load projects.");
  const byProject = new Map((memberships.data ?? []).map((membership) => [membership.project_id, membership as MembershipRow]));
  return ((projects.data ?? []) as ProjectRow[]).map((project) => ({ ...project, membership: byProject.get(project.id) ?? null }));
}

export async function getAdminProjects(): Promise<AdminProject[]> {
  await requireAdmin();
  const supabase = await createClient();
  const [projects, memberships, profiles] = await Promise.all([
    supabase.from("projects").select(PROJECT_FIELDS).order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at"),
    supabase.from("profiles").select("id, full_name, handle"),
  ]);
  if (projects.error || memberships.error || profiles.error) throw new Error("Unable to load projects.");
  const profilesById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  const membersByProject = new Map<string, AdminProjectMember[]>();
  for (const membership of memberships.data ?? []) {
    const profile = profilesById.get(membership.profile_id);
    if (!profile) continue;
    const members = membersByProject.get(membership.project_id) ?? [];
    members.push({ ...membership, fullName: profile.full_name, handle: profile.handle });
    membersByProject.set(membership.project_id, members);
  }
  return ((projects.data ?? []) as ProjectRow[]).map((project) => ({ ...project, members: membersByProject.get(project.id) ?? [] }));
}
