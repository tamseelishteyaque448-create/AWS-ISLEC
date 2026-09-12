import "server-only";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

type ProjectRow = Pick<Tables<"projects">, "id" | "slug" | "title" | "category" | "description" | "technologies" | "created_at" | "updated_at"> & {
  publication_state: "draft" | "pending_review" | "published" | "changes_requested" | "archived";
  build_stage: "idea" | "building" | "prototype" | "shipped";
  recruitment_mode: "open" | "invite_only" | "not_recruiting";
  team_capacity: number | null;
  repository_url: string | null;
  demo_url: string | null;
};
type MembershipRow = Pick<Tables<"project_members">, "project_id" | "profile_id" | "role" | "status" | "joined_at" | "submitted_at" | "reviewed_at">;

export type CommunityProject = ProjectRow & { membership: MembershipRow | null; joinRequestStatus: string | null };
export type AdminProjectMember = MembershipRow & { fullName: string; handle: string };
export type AdminProject = ProjectRow & { members: AdminProjectMember[] };
export type ProjectWorkspace = ProjectRow & { members: AdminProjectMember[]; requests: Array<{ id: string; profileId: string; fullName: string; handle: string; contribution: string; message: string; status: string }>; reviews: Array<{ decision: string; feedback: string; createdAt: string }> };
const PROJECT_FIELDS = "id, slug, title, category, description, technologies, created_at, updated_at, publication_state, build_stage, recruitment_mode, team_capacity, repository_url, demo_url";

export async function getPublicProjects(): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select(PROJECT_FIELDS).eq("publication_state", "published").order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load projects.");
  return (data ?? []) as ProjectRow[];
}

export async function getPublicProjectBySlug(slug: string): Promise<ProjectRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select(PROJECT_FIELDS).eq("slug", slug).eq("publication_state", "published").maybeSingle();
  if (error) throw new Error("Unable to load project.");
  return data as ProjectRow | null;
}

export async function getMemberProjects(): Promise<CommunityProject[]> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return [];
  const supabase = await createClient();
  const [projects, memberships, joinRequests] = await Promise.all([
    supabase.from("projects").select(PROJECT_FIELDS).order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at").eq("profile_id", claims.sub),
    supabase.from("project_join_requests").select("project_id, status").eq("profile_id", claims.sub).eq("status", "requested"),
  ]);
  if (projects.error || memberships.error || joinRequests.error) throw new Error("Unable to load projects.");
  const byProject = new Map((memberships.data ?? []).map((membership) => [membership.project_id, membership as MembershipRow]));
  const requestsByProject = new Map((joinRequests.data ?? []).map((request) => [request.project_id, request.status]));
  return ((projects.data ?? []) as ProjectRow[]).map((project) => ({ ...project, membership: byProject.get(project.id) ?? null, joinRequestStatus: requestsByProject.get(project.id) ?? null }));
}

export async function getMemberProjectWorkspace(projectId: string): Promise<ProjectWorkspace | null> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return null;
  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase.from("projects").select(PROJECT_FIELDS).eq("id", projectId).maybeSingle();
  if (projectError || !project) return null;
  const [membersResult, requestsResult, reviewsResult, profilesResult] = await Promise.all([
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at").eq("project_id", projectId),
    supabase.from("project_join_requests").select("id, profile_id, requested_contribution, message, status").eq("project_id", projectId),
    supabase.from("project_reviews").select("decision, feedback, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, handle"),
  ]);
  if (membersResult.error || requestsResult.error || reviewsResult.error || profilesResult.error) throw new Error("Unable to load project workspace.");
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const members = (membersResult.data ?? []).flatMap((member) => { const profile = profiles.get(member.profile_id); return profile ? [{ ...member, fullName: profile.full_name, handle: profile.handle }] : []; });
  const requests = (requestsResult.data ?? []).flatMap((request) => { const profile = profiles.get(request.profile_id); return profile ? [{ id: request.id, profileId: request.profile_id, fullName: profile.full_name, handle: profile.handle, contribution: request.requested_contribution, message: request.message, status: request.status }] : []; });
  return { ...(project as ProjectRow), members, requests, reviews: (reviewsResult.data ?? []).map((review) => ({ decision: review.decision, feedback: review.feedback, createdAt: review.created_at })) };
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

// ---------------------------------------------------------------------------
// V2.1 — Skill proofs
// ---------------------------------------------------------------------------

export type JoinRequestProof = {
  id: string;
  proofType: string;
  title: string;
  description: string;
  url: string | null;
  createdAt: string;
};

export type WorkspaceJoinRequest = {
  id: string;
  profileId: string;
  fullName: string;
  handle: string;
  contribution: string;
  message: string;
  status: string;
  proofs: JoinRequestProof[];
};

/** Replaces the old requests shape in getMemberProjectWorkspace for V2.1 */
export async function getMemberProjectWorkspaceV2(projectId: string): Promise<(ProjectWorkspace & { requestsV2: WorkspaceJoinRequest[] }) | null> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return null;
  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase.from("projects").select(PROJECT_FIELDS).eq("id", projectId).maybeSingle();
  if (projectError || !project) return null;
  const [membersResult, requestsResult, reviewsResult, profilesResult, proofsResult] = await Promise.all([
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at").eq("project_id", projectId),
    supabase.from("project_join_requests").select("id, profile_id, requested_contribution, message, status").eq("project_id", projectId),
    supabase.from("project_reviews").select("decision, feedback, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, handle"),
    supabase.from("project_join_request_proofs").select("id, request_id, proof_type, title, description, url, created_at"),
  ]);
  if (membersResult.error || requestsResult.error || reviewsResult.error || profilesResult.error) throw new Error("Unable to load project workspace.");
  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const proofsByRequest = new Map<string, JoinRequestProof[]>();
  for (const proof of proofsResult.data ?? []) {
    const list = proofsByRequest.get(proof.request_id) ?? [];
    list.push({ id: proof.id, proofType: proof.proof_type, title: proof.title, description: proof.description, url: proof.url, createdAt: proof.created_at });
    proofsByRequest.set(proof.request_id, list);
  }
  const members = (membersResult.data ?? []).flatMap((m) => { const p = profiles.get(m.profile_id); return p ? [{ ...m, fullName: p.full_name, handle: p.handle }] : []; });
  const requests = (requestsResult.data ?? []).flatMap((r) => { const p = profiles.get(r.profile_id); return p ? [{ id: r.id, profileId: r.profile_id, fullName: p.full_name, handle: p.handle, contribution: r.requested_contribution, message: r.message, status: r.status }] : []; });
  const requestsV2: WorkspaceJoinRequest[] = requests.map((r) => ({ ...r, proofs: proofsByRequest.get(r.id) ?? [] }));
  return { ...(project as ProjectRow), members, requests, requestsV2, reviews: (reviewsResult.data ?? []).map((r) => ({ decision: r.decision, feedback: r.feedback, createdAt: r.created_at })) };
}

/** Gets the active join request for the current member on a project, including proofs */
export async function getMyJoinRequest(projectId: string): Promise<{ id: string; contribution: string; message: string; status: string; proofs: JoinRequestProof[] } | null> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return null;
  const supabase = await createClient();
  const { data: request } = await supabase.from("project_join_requests").select("id, requested_contribution, message, status").eq("project_id", projectId).eq("profile_id", claims.sub).order("requested_at", { ascending: false }).limit(1).maybeSingle();
  if (!request) return null;
  const { data: proofs } = await supabase.from("project_join_request_proofs").select("id, proof_type, title, description, url, created_at").eq("request_id", request.id).order("created_at", { ascending: true });
  return { id: request.id, contribution: request.requested_contribution, message: request.message, status: request.status, proofs: (proofs ?? []).map((p) => ({ id: p.id, proofType: p.proof_type, title: p.title, description: p.description, url: p.url, createdAt: p.created_at })) };
}
