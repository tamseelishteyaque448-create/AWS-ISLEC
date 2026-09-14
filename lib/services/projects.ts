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
export type MemberExploreProject = Pick<ProjectRow, "id" | "title" | "category" | "description" | "technologies" | "build_stage" | "recruitment_mode" | "team_capacity"> & {
  membership: MembershipRow | null;
  joinRequestStatus: string | null;
};
export type MemberProjectsDashboard = { myProjects: CommunityProject[] };
export type AdminProjectMember = MembershipRow & { fullName: string; handle: string };
export type AdminProject = ProjectRow & { members: AdminProjectMember[] };
export type ProjectWorkspace = ProjectRow & { members: AdminProjectMember[]; requests: Array<{ id: string; profileId: string; fullName: string; handle: string; contribution: string; message: string; status: string }>; reviews: Array<{ decision: string; feedback: string; createdAt: string }> };
const PROJECT_FIELDS = "id, slug, title, category, description, technologies, created_at, updated_at, publication_state, build_stage, recruitment_mode, team_capacity, repository_url, demo_url";
const WORKSPACE_PROJECT_FIELDS = `${PROJECT_FIELDS}, created_by`;

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
  requestedAt?: string;
  resolvedAt?: string | null;
  proofs: JoinRequestProof[];
};

type WorkspaceProfile = Pick<Tables<"profiles">, "id" | "full_name" | "handle" | "avatar_url">;
type WorkspaceMilestoneRow = Tables<"project_milestones">;
type WorkspaceTaskRow = Tables<"project_tasks">;

export type WorkspaceMember = MembershipRow & {
  fullName: string;
  handle: string;
  avatarUrl: string | null;
};

export type WorkspaceMilestoneState = "empty" | "in_progress" | "complete";

export type WorkspaceMilestone = WorkspaceMilestoneRow & {
  state: WorkspaceMilestoneState | null;
  activeTaskCount: number;
  completedActiveTaskCount: number;
};

export type WorkspaceTask = WorkspaceTaskRow & {
  assignee: { id: string; fullName: string; handle: string; avatarUrl: string | null; isActiveMember: boolean } | null;
};

export type ProjectWorkspaceV2 = Omit<ProjectWorkspace, "members" | "requests"> & {
  creator: { id: string; fullName: string; handle: string; avatarUrl: string | null } | null;
  members: WorkspaceMember[];
  activeMembers: WorkspaceMember[];
  owner: WorkspaceMember | null;
  requests: ProjectWorkspace["requests"];
  requestsV2: WorkspaceJoinRequest[];
  milestones: WorkspaceMilestone[];
  tasks: WorkspaceTask[];
  progress: { totalActiveTasks: number; completedActiveTasks: number; progressPercentage: number };
  contributorCurrentMilestone: WorkspaceMilestone | null;
  displayCurrentMilestone: WorkspaceMilestone | null;
  latestCompletedMilestone: WorkspaceMilestone | null;
};

const ACTIVE_WORKSPACE_MEMBER_STATUSES = new Set(["active", "submitted", "completed"]);

function sortByWorkspaceOrder<T extends { sort_order: number; id: string }>(left: T, right: T) {
  return left.sort_order - right.sort_order || left.id.localeCompare(right.id);
}

/** Published, member-visible projects only; discovery must not inherit workspace query semantics. */
export async function getMemberExploreProjects(): Promise<MemberExploreProject[]> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return [];
  const supabase = await createClient();
  const [projects, memberships, joinRequests] = await Promise.all([
    supabase.from("projects").select("id, title, category, description, technologies, build_stage, recruitment_mode, team_capacity").eq("publication_state", "published").order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at").eq("profile_id", claims.sub),
    supabase.from("project_join_requests").select("project_id, status").eq("profile_id", claims.sub).eq("status", "requested"),
  ]);
  if (projects.error || memberships.error || joinRequests.error) throw new Error("Unable to load discoverable projects.");
  const membershipByProject = new Map((memberships.data ?? []).map((membership) => [membership.project_id, membership as MembershipRow]));
  const requestByProject = new Map((joinRequests.data ?? []).map((request) => [request.project_id, request.status]));
  return (projects.data ?? []).map((project) => ({
    ...project,
    membership: membershipByProject.get(project.id) ?? null,
    joinRequestStatus: requestByProject.get(project.id) ?? null,
  })) as MemberExploreProject[];
}

/** The member project dashboard deliberately excludes community discovery, which belongs on Explore. */
export async function getMemberProjectsDashboard(): Promise<MemberProjectsDashboard> {
  const projects = await getMemberProjects();
  return { myProjects: projects.filter((project) => project.membership !== null) };
}

/** Reads the private V2.2 workspace. RLS remains the authorization authority. */
export async function getMemberProjectWorkspaceV2(projectId: string): Promise<ProjectWorkspaceV2 | null> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return null;
  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase.from("projects").select(WORKSPACE_PROJECT_FIELDS).eq("id", projectId).maybeSingle();
  if (projectError || !project) return null;

  const [membersResult, reviewsResult, milestonesResult, tasksResult] = await Promise.all([
    supabase.from("project_members").select("project_id, profile_id, role, status, joined_at, submitted_at, reviewed_at").eq("project_id", projectId),
    supabase.from("project_reviews").select("decision, feedback, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("project_milestones").select("id, project_id, title, description, sort_order, is_archived, created_by, created_at, updated_at").eq("project_id", projectId).order("sort_order", { ascending: true }).order("id", { ascending: true }),
    supabase.from("project_tasks").select("id, project_id, milestone_id, title, description, assignee_id, status, sort_order, is_archived, created_by, created_at, updated_at, completed_at").eq("project_id", projectId).order("sort_order", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (membersResult.error || reviewsResult.error || milestonesResult.error || tasksResult.error) throw new Error("Unable to load project workspace.");

  const memberships = (membersResult.data ?? []) as MembershipRow[];
  const viewerMembership = memberships.find((member) => member.profile_id === claims.sub);
  const isOwner = viewerMembership?.role === "owner" && viewerMembership.status === "active";
  const requestsResult = await (isOwner
    ? supabase.from("project_join_requests").select("id, profile_id, requested_contribution, message, status, requested_at, resolved_at").eq("project_id", projectId).eq("status", "requested").order("requested_at", { ascending: true })
    : supabase.from("project_join_requests").select("id, profile_id, requested_contribution, message, status, requested_at, resolved_at").eq("project_id", projectId).eq("profile_id", claims.sub).eq("status", "requested").order("requested_at", { ascending: true }));
  if (requestsResult.error) throw new Error("Unable to load project workspace.");

  const rawMilestones = (milestonesResult.data ?? []) as WorkspaceMilestoneRow[];
  const rawTasks = (tasksResult.data ?? []) as WorkspaceTaskRow[];
  const milestoneById = new Map(rawMilestones.map((milestone) => [milestone.id, milestone]));
  for (const task of rawTasks) {
    const milestone = milestoneById.get(task.milestone_id);
    if (!milestone || milestone.project_id !== task.project_id || task.project_id !== projectId) {
      throw new Error("Project workspace data is inconsistent.");
    }
  }

  const requestIds = (requestsResult.data ?? []).map((request) => request.id);
  const profileIds = new Set<string>([
    ...memberships.map((member) => member.profile_id),
    ...rawTasks.flatMap((task) => task.assignee_id ? [task.assignee_id] : []),
    ...(project.created_by ? [project.created_by] : []),
    ...(requestsResult.data ?? []).map((request) => request.profile_id),
  ]);
  const [profilesResult, proofsResult] = await Promise.all([
    profileIds.size > 0
      ? supabase.from("profiles").select("id, full_name, handle, avatar_url").in("id", [...profileIds])
      : Promise.resolve({ data: [], error: null }),
    requestIds.length > 0
      ? supabase.from("project_join_request_proofs").select("id, request_id, proof_type, title, description, url, created_at").in("request_id", requestIds).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || proofsResult.error) throw new Error("Unable to load project workspace.");

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile as WorkspaceProfile]));
  const proofsByRequest = new Map<string, JoinRequestProof[]>();
  for (const proof of proofsResult.data ?? []) {
    const list = proofsByRequest.get(proof.request_id) ?? [];
    list.push({ id: proof.id, proofType: proof.proof_type, title: proof.title, description: proof.description, url: proof.url, createdAt: proof.created_at });
    proofsByRequest.set(proof.request_id, list);
  }
  const allMembers = memberships.flatMap((member) => {
    const profile = profiles.get(member.profile_id);
    return profile ? [{ ...member, fullName: profile.full_name, handle: profile.handle, avatarUrl: profile.avatar_url }] : [];
  });
  const activeMembers = allMembers.filter((member) => ACTIVE_WORKSPACE_MEMBER_STATUSES.has(member.status));
  const requests = (requestsResult.data ?? []).flatMap((request) => {
    const profile = profiles.get(request.profile_id);
    return profile ? [{ id: request.id, profileId: request.profile_id, fullName: profile.full_name, handle: profile.handle, contribution: request.requested_contribution, message: request.message, status: request.status, requestedAt: request.requested_at, resolvedAt: request.resolved_at }] : [];
  });
  const requestsV2: WorkspaceJoinRequest[] = requests.map((request) => ({ ...request, proofs: proofsByRequest.get(request.id) ?? [] }));

  const tasksByMilestone = new Map<string, WorkspaceTaskRow[]>();
  for (const task of rawTasks) {
    const tasks = tasksByMilestone.get(task.milestone_id) ?? [];
    tasks.push(task);
    tasksByMilestone.set(task.milestone_id, tasks);
  }
  const milestones = rawMilestones.map((milestone) => {
    const activeTasks = milestone.is_archived ? [] : (tasksByMilestone.get(milestone.id) ?? []).filter((task) => !task.is_archived);
    const completedActiveTaskCount = activeTasks.filter((task) => task.status === "completed").length;
    const state = milestone.is_archived ? null : activeTasks.length === 0 ? "empty" : completedActiveTaskCount === activeTasks.length ? "complete" : "in_progress";
    return { ...milestone, state, activeTaskCount: activeTasks.length, completedActiveTaskCount } satisfies WorkspaceMilestone;
  }).sort(sortByWorkspaceOrder);
  const activeMemberIds = new Set(activeMembers.map((member) => member.profile_id));
  const tasks = rawTasks.map((task) => {
    const profile = task.assignee_id ? profiles.get(task.assignee_id) : undefined;
    return { ...task, assignee: profile ? { id: profile.id, fullName: profile.full_name, handle: profile.handle, avatarUrl: profile.avatar_url, isActiveMember: activeMemberIds.has(profile.id) } : null } satisfies WorkspaceTask;
  }).sort(sortByWorkspaceOrder);
  const activeWorkspaceTasks = rawTasks.filter((task) => !task.is_archived && !milestoneById.get(task.milestone_id)?.is_archived);
  const completedActiveTasks = activeWorkspaceTasks.filter((task) => task.status === "completed").length;
  const progressPercentage = activeWorkspaceTasks.length === 0 ? 0 : Math.min(100, Math.floor((completedActiveTasks * 100) / activeWorkspaceTasks.length));
  const nonArchivedMilestones = milestones.filter((milestone) => !milestone.is_archived);
  const contributorCurrentMilestone = nonArchivedMilestones.find((milestone) => milestone.state !== "complete") ?? null;
  const latestCompletedMilestone = [...nonArchivedMilestones].reverse().find((milestone) => milestone.state === "complete") ?? null;
  const creatorProfile = project.created_by ? profiles.get(project.created_by) : undefined;

  return {
    ...(project as ProjectRow),
    creator: creatorProfile ? { id: creatorProfile.id, fullName: creatorProfile.full_name, handle: creatorProfile.handle, avatarUrl: creatorProfile.avatar_url } : null,
    members: activeMembers,
    activeMembers,
    owner: activeMembers.find((member) => member.role === "owner") ?? null,
    requests,
    requestsV2,
    reviews: (reviewsResult.data ?? []).map((review) => ({ decision: review.decision, feedback: review.feedback, createdAt: review.created_at })),
    milestones,
    tasks,
    progress: { totalActiveTasks: activeWorkspaceTasks.length, completedActiveTasks, progressPercentage },
    contributorCurrentMilestone,
    displayCurrentMilestone: contributorCurrentMilestone,
    latestCompletedMilestone,
  };
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
