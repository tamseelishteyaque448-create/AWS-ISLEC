import "server-only";

import { requireAdmin } from "@/lib/auth/admin";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/types/database";

export type BuildDomain =
  | "innovation_research"
  | "event_management"
  | "media_design"
  | "documentation";
export type BuildProveDomainKey = BuildDomain;
export type BuildWorkStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "resubmitted"
  | "approved"
  | "cancelled";
export type BuildReviewDecision = "approved" | "changes_requested";

export type SaveBuildAssignmentInput = {
  assignmentId?: string;
  slug: string;
  title: string;
  summary?: string;
  objective?: string;
  difficulty: "easy" | "medium" | "hard";
  domain: BuildDomain;
  assignmentScope: "domain" | "individual";
  publicationState: "draft" | "published" | "archived";
  deadlineAt?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  requirements?: Json;
  deliverables?: Json;
  submissionRequirements?: Json;
  evaluationCriteria?: Json;
  rewardPoints: number;
  sortOrder?: number;
  memberIds?: string[];
};

export type SubmitBuildWorkInput = {
  workItemId: string;
  projectTitle: string;
  explanation: string;
  approach: string;
  technologies?: string[];
  challenges?: string;
  learnings?: string;
  futureImprovements?: string;
  repositoryUrl?: string | null;
  deploymentUrl?: string | null;
  demoUrl?: string | null;
};

type BuildAssignmentRow = Pick<
  Tables<"build_assignments">,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "objective"
  | "difficulty"
  | "domain"
  | "assignment_scope"
  | "publication_state"
  | "deadline_at"
  | "priority"
  | "requirements"
  | "deliverables"
  | "submission_requirements"
  | "evaluation_criteria"
  | "reward_points"
  | "created_at"
  | "updated_at"
>;
type BuildWorkItemRow = Pick<
  Tables<"build_assignment_members">,
  | "id"
  | "assignment_id"
  | "member_id"
  | "assigned_by"
  | "assigned_at"
  | "status"
  | "reward_points_snapshot"
  | "updated_at"
>;
type BuildSubmissionRow = Tables<"build_submissions">;
type BuildReviewRow = Tables<"build_submission_reviews">;
type BuildEvidenceRow = Pick<
  Tables<"build_submission_evidence">,
  "id" | "submission_id" | "owner_id" | "content_type" | "file_size" | "caption" | "created_at"
>;
type BuildReferenceRow = Pick<
  Tables<"build_assignment_attachments">,
  "id" | "assignment_id" | "label" | "content_type" | "file_size" | "created_at"
>;
type BuildProfileRow = Pick<Tables<"profiles">, "id" | "full_name" | "handle">;

export type BuildProveReview = {
  id: string;
  submissionId: string;
  reviewerId: string;
  decision: BuildReviewDecision;
  feedback: string;
  createdAt: string;
};

export type BuildProveEvidenceMetadata = {
  id: string;
  contentType: string;
  fileSize: number;
  caption: string;
  createdAt: string;
};

export type BuildProveReferenceMetadata = {
  id: string;
  label: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
};

export type BuildProveSubmissionRevision = {
  id: string;
  workItemId: string;
  revisionNumber: number;
  projectTitle: string;
  explanation: string;
  approach: string;
  technologies: string[];
  challenges: string;
  learnings: string;
  futureImprovements: string;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  demoUrl: string | null;
  submittedAt: string;
  createdAt: string;
  reviews: BuildProveReview[];
  evidence: BuildProveEvidenceMetadata[];
};

export type BuildProveTaskDefinition = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  objective: string;
  difficulty: string;
  domain: BuildDomain;
  assignmentScope: "domain" | "individual";
  publicationState: "draft" | "published" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  deadlineAt: string | null;
  requirements: Json;
  deliverables: Json;
  submissionRequirements: Json;
  evaluationCriteria: Json;
  rewardPoints: number;
  createdAt: string;
  updatedAt: string;
};

export type BuildProveDomain = {
  key: BuildProveDomainKey;
  name: string;
  taskCount: number;
  activeTaskCount: number;
  awaitingReviewCount: number;
};

export type BuildProveMemberWorkItem = {
  workItemId: string;
  assignmentId: string;
  title: string;
  summary: string;
  domain: BuildDomain;
  status: BuildWorkStatus;
  priority: "low" | "normal" | "high" | "urgent";
  deadlineAt: string | null;
  isOverdue: boolean;
  rewardPoints: number;
  rewardPointsSnapshot: number;
  assignedAt: string;
  updatedAt: string;
  latestRevisionNumber: number | null;
  latestSubmittedAt: string | null;
};

export type BuildProveTaskDetail = {
  task: BuildProveTaskDefinition;
  workItem: {
    id: string;
    assignedBy: string;
    assignedAt: string;
    status: BuildWorkStatus;
    rewardPointsSnapshot: number;
    updatedAt: string;
  };
  referenceAttachments: BuildProveReferenceMetadata[];
  latestSubmission: BuildProveSubmissionRevision | null;
  revisionHistory: BuildProveSubmissionRevision[];
};

export type BuildProveAdminOverview = {
  totalTasks: number;
  activeTasks: number;
  awaitingReview: number;
  changesRequested: number;
  approved: number;
  overdue: number;
};

export type BuildProveAdminTaskListItem = {
  task: BuildProveTaskDefinition;
  assignedMemberCount: number;
  statusCounts: Record<BuildWorkStatus, number>;
  overdueMemberCount: number;
  members: Array<{
    workItemId: string;
    memberId: string;
    fullName: string;
    handle: string;
    status: BuildWorkStatus;
  }>;
};

export type BuildProveAdminTaskDetail = {
  task: BuildProveTaskDefinition;
  referenceAttachments: BuildProveReferenceMetadata[];
  members: Array<{
    workItem: BuildProveTaskDetail["workItem"] & { memberId: string; fullName: string; handle: string };
    latestSubmission: BuildProveSubmissionRevision | null;
    revisionHistory: BuildProveSubmissionRevision[];
  }>;
};

export type BuildProveReviewQueueItem = {
  task: BuildProveTaskDefinition;
  workItemId: string;
  memberId: string;
  fullName: string;
  handle: string;
  status: "submitted" | "resubmitted";
  latestRevisionNumber: number;
  latestSubmissionId: string;
  submittedAt: string;
};

export type BuildProveListFilters = {
  domain?: BuildDomain;
  status?: BuildWorkStatus;
  priority?: "low" | "normal" | "high" | "urgent";
  overdue?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type BuildProveAdminListFilters = BuildProveListFilters & {
  memberId?: string;
};

export type BuildProvePage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type PageQueryResult<T> = { data: T[] | null; error: unknown };
const READ_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 80;

const BUILD_DOMAINS: Array<Pick<BuildProveDomain, "key" | "name">> = [
  { key: "innovation_research", name: "Innovation & Research" },
  { key: "event_management", name: "Event Management" },
  { key: "media_design", name: "Media & Design" },
  { key: "documentation", name: "Documentation" },
];

const BUILD_STATUSES: BuildWorkStatus[] = [
  "assigned",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "approved",
  "cancelled",
];
const ACTIVE_STATUSES: BuildWorkStatus[] = [
  "assigned",
  "in_progress",
  "changes_requested",
  "resubmitted",
];

export class BuildProveUnauthenticatedError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "BuildProveUnauthenticatedError";
  }
}

export class BuildProveQueryError extends Error {
  constructor() {
    super("Unable to load Build & Prove data.");
    this.name = "BuildProveQueryError";
  }
}

export class BuildProveValidationError extends Error {
  constructor() {
    super("Invalid Build & Prove query filters.");
    this.name = "BuildProveValidationError";
  }
}

async function requireMemberContext() {
  const claims = await getAuthenticatedClaims();
  if (typeof claims?.sub !== "string" || !claims.sub) {
    throw new BuildProveUnauthenticatedError();
  }
  return { memberId: claims.sub, supabase: await createClient() };
}

async function requireMember() {
  return (await requireMemberContext()).supabase;
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageQueryResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new BuildProveQueryError();
    const page = data ?? [];
    rows.push(...page);
    if (page.length < READ_PAGE_SIZE) return rows;
  }
}

function chunked<T>(values: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function normalizePage(page: number | undefined, pageSize: number | undefined) {
  if ((page !== undefined && (!Number.isInteger(page) || page < 1))
      || (pageSize !== undefined && (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE))) {
    throw new BuildProveValidationError();
  }
  return { page: page ?? 1, pageSize: pageSize ?? DEFAULT_PAGE_SIZE };
}

function normalizeSearch(search: string | undefined) {
  return search?.trim().slice(0, MAX_SEARCH_LENGTH).toLocaleLowerCase() ?? "";
}

function readStatus(value: string): BuildWorkStatus {
  if (!BUILD_STATUSES.includes(value as BuildWorkStatus)) {
    throw new BuildProveQueryError();
  }
  return value as BuildWorkStatus;
}

function readDomain(value: string): BuildDomain {
  if (!BUILD_DOMAINS.some((domain) => domain.key === value)) {
    throw new BuildProveQueryError();
  }
  return value as BuildDomain;
}

function readReviewDecision(value: string): BuildReviewDecision {
  if (value !== "approved" && value !== "changes_requested") {
    throw new BuildProveQueryError();
  }
  return value;
}

function mapTask(row: BuildAssignmentRow): BuildProveTaskDefinition {
  if (!["domain", "individual"].includes(row.assignment_scope)
    || !["draft", "published", "archived"].includes(row.publication_state)
    || !["low", "normal", "high", "urgent"].includes(row.priority)) {
    throw new BuildProveQueryError();
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    objective: row.objective,
    difficulty: row.difficulty,
    domain: readDomain(row.domain),
    assignmentScope: row.assignment_scope as "domain" | "individual",
    publicationState: row.publication_state as "draft" | "published" | "archived",
    priority: row.priority as BuildProveTaskDefinition["priority"],
    deadlineAt: row.deadline_at,
    requirements: row.requirements,
    deliverables: row.deliverables,
    submissionRequirements: row.submission_requirements,
    evaluationCriteria: row.evaluation_criteria,
    rewardPoints: row.reward_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReview(row: BuildReviewRow): BuildProveReview {
  return {
    id: row.id,
    submissionId: row.submission_id,
    reviewerId: row.reviewer_id,
    decision: readReviewDecision(row.decision),
    feedback: row.feedback,
    createdAt: row.created_at,
  };
}

function mapEvidence(row: BuildEvidenceRow): BuildProveEvidenceMetadata {
  return {
    id: row.id,
    contentType: row.content_type,
    fileSize: row.file_size,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function mapReference(row: BuildReferenceRow): BuildProveReferenceMetadata {
  return {
    id: row.id,
    label: row.label,
    contentType: row.content_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

function mapRevision(
  row: BuildSubmissionRow,
  reviews: BuildReviewRow[],
  evidence: BuildEvidenceRow[],
): BuildProveSubmissionRevision {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    revisionNumber: row.revision_number,
    projectTitle: row.project_title,
    explanation: row.explanation,
    approach: row.approach,
    technologies: row.technologies,
    challenges: row.challenges,
    learnings: row.learnings,
    futureImprovements: row.future_improvements,
    repositoryUrl: row.repository_url,
    deploymentUrl: row.deployment_url,
    demoUrl: row.demo_url,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    reviews: reviews.filter((review) => review.submission_id === row.id).map(mapReview),
    evidence: evidence.filter((item) => item.submission_id === row.id).map(mapEvidence),
  };
}

function getLatestRevisions(submissions: BuildSubmissionRow[]) {
  const latest = new Map<string, BuildSubmissionRow>();
  for (const row of submissions) {
    const current = latest.get(row.work_item_id);
    if (!current || row.revision_number > current.revision_number) {
      latest.set(row.work_item_id, row);
    }
  }
  return latest;
}

function isOverdue(deadlineAt: string | null, status: BuildWorkStatus, now = Date.now()) {
  return deadlineAt !== null
    && new Date(deadlineAt).getTime() < now
    && ACTIVE_STATUSES.includes(status);
}

async function loadAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<BuildAssignmentRow[]> {
  const rows: BuildAssignmentRow[] = [];
  for (const idsChunk of chunked([...new Set(ids)])) {
    const chunkRows = await fetchAllPages((from, to) =>
      supabase.from("build_assignments")
        .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, created_at, updated_at")
        .in("id", idsChunk)
        .order("created_at", { ascending: false })
        .range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadSubmissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workItemIds: string[],
): Promise<BuildSubmissionRow[]> {
  const rows: BuildSubmissionRow[] = [];
  for (const idsChunk of chunked([...new Set(workItemIds)])) {
    const chunkRows = await fetchAllPages((from, to) =>
      supabase.from("build_submissions")
        .select("id, work_item_id, member_id, revision_number, project_title, explanation, approach, technologies, challenges, learnings, future_improvements, repository_url, deployment_url, demo_url, submitted_at, created_at")
        .in("work_item_id", idsChunk)
        .order("revision_number", { ascending: false })
        .range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadReviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionIds: string[],
): Promise<BuildReviewRow[]> {
  const rows: BuildReviewRow[] = [];
  for (const idsChunk of chunked([...new Set(submissionIds)])) {
    const chunkRows = await fetchAllPages((from, to) =>
      supabase.from("build_submission_reviews")
        .select("id, work_item_id, submission_id, reviewer_id, decision, feedback, created_at")
        .in("submission_id", idsChunk)
        .order("created_at", { ascending: true })
        .range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadEvidence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionIds: string[],
): Promise<BuildEvidenceRow[]> {
  const rows: BuildEvidenceRow[] = [];
  for (const idsChunk of chunked([...new Set(submissionIds)])) {
    const chunkRows = await fetchAllPages((from, to) =>
      supabase.from("build_submission_evidence")
        .select("id, submission_id, owner_id, content_type, file_size, caption, created_at")
        .in("submission_id", idsChunk)
        .order("created_at", { ascending: true })
        .range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentIds: string[],
): Promise<BuildReferenceRow[]> {
  const rows: BuildReferenceRow[] = [];
  for (const idsChunk of chunked([...new Set(assignmentIds)])) {
    const chunkRows = await fetchAllPages((from, to) =>
      supabase.from("build_assignment_attachments")
        .select("id, assignment_id, label, content_type, file_size, created_at")
        .in("assignment_id", idsChunk)
        .order("created_at", { ascending: true })
        .range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadMemberWorkItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
) {
  const workItems = await fetchAllPages((from, to) =>
    supabase.from("build_assignment_members")
      .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
      .eq("member_id", memberId)
      .neq("status", "cancelled")
      .order("assigned_at", { ascending: false })
      .range(from, to));
  const assignments = await loadAssignments(supabase, workItems.map((item) => item.assignment_id));
  if (assignments.length !== new Set(workItems.map((item) => item.assignment_id)).size) {
    throw new BuildProveQueryError();
  }
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, mapTask(assignment)]));
  return workItems.flatMap((workItem) => {
    const task = assignmentById.get(workItem.assignment_id);
    if (!task) throw new BuildProveQueryError();
    return [{ workItem, task }];
  });
}

function pageOf<T>(items: T[], page: number | undefined, pageSize: number | undefined): BuildProvePage<T> {
  const pagination = normalizePage(page, pageSize);
  const start = (pagination.page - 1) * pagination.pageSize;
  return {
    items: items.slice(start, start + pagination.pageSize),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: items.length,
  };
}

function matchesTaskFilters(
  task: BuildProveTaskDefinition,
  status: BuildWorkStatus,
  filters: BuildProveListFilters,
  search: string,
) {
  if (filters.domain && task.domain !== filters.domain) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.status && status !== filters.status) return false;
  if (filters.overdue !== undefined && isOverdue(task.deadlineAt, status) !== filters.overdue) return false;
  if (search && !`${task.title} ${task.summary}`.toLocaleLowerCase().includes(search)) return false;
  return true;
}

function validateFilters(filters: BuildProveListFilters) {
  if ((filters.search !== undefined && typeof filters.search !== "string")
    || (filters.overdue !== undefined && typeof filters.overdue !== "boolean")) {
    throw new BuildProveValidationError();
  }
  if ((filters.domain && !BUILD_DOMAINS.some((domain) => domain.key === filters.domain))
    || (filters.status && !BUILD_STATUSES.includes(filters.status))
    || (filters.priority && !["low", "normal", "high", "urgent"].includes(filters.priority))) {
    throw new BuildProveValidationError();
  }
  normalizePage(filters.page, filters.pageSize);
}

export async function saveBuildAssignment(input: SaveBuildAssignmentInput) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_build_assignment", {
    p_assignment_id: input.assignmentId ?? null,
    p_slug: input.slug,
    p_title: input.title,
    p_summary: input.summary ?? "",
    p_objective: input.objective ?? "",
    p_difficulty: input.difficulty,
    p_domain: input.domain,
    p_assignment_scope: input.assignmentScope,
    p_publication_state: input.publicationState,
    p_deadline_at: input.deadlineAt ?? null,
    p_priority: input.priority,
    p_requirements: input.requirements ?? [],
    p_deliverables: input.deliverables ?? [],
    p_submission_requirements: input.submissionRequirements ?? [],
    p_evaluation_criteria: input.evaluationCriteria ?? [],
    p_reward_points: input.rewardPoints,
    p_sort_order: input.sortOrder ?? 0,
    p_member_ids: input.memberIds ?? [],
  });
  if (error) throw new Error("Unable to save build assignment.");
  return data;
}

export async function setBuildMemberDomain(profileId: string, domain: BuildDomain, assigned: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_build_member_domain", {
    p_profile_id: profileId,
    p_domain: domain,
    p_assigned: assigned,
  });
  if (error) throw new Error("Unable to update build member domain.");
  return data;
}

export async function registerBuildAssignmentAttachment(
  assignmentId: string,
  storagePath: string,
  contentType: string,
  fileSize: number,
  label = "",
) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_build_assignment_attachment", {
    p_assignment_id: assignmentId,
    p_storage_path: storagePath,
    p_content_type: contentType,
    p_file_size: fileSize,
    p_label: label,
  });
  if (error) throw new Error("Unable to register build assignment attachment.");
  return data;
}

export async function assignBuildMember(assignmentId: string, memberId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_build_member", {
    p_assignment_id: assignmentId,
    p_member_id: memberId,
  });
  if (error) throw new Error("Unable to assign build work.");
  return data;
}

export async function startBuildAssignment(workItemId: string) {
  const supabase = await requireMember();
  const { data, error } = await supabase.rpc("start_build_assignment", {
    p_work_item_id: workItemId,
  });
  if (error) throw new Error("Unable to start build work.");
  return data;
}

export async function submitBuildWork(input: SubmitBuildWorkInput) {
  const supabase = await requireMember();
  const { data, error } = await supabase.rpc("submit_build_work", {
    p_work_item_id: input.workItemId,
    p_project_title: input.projectTitle,
    p_explanation: input.explanation,
    p_approach: input.approach,
    p_technologies: input.technologies ?? [],
    p_challenges: input.challenges ?? "",
    p_learnings: input.learnings ?? "",
    p_future_improvements: input.futureImprovements ?? "",
    p_repository_url: input.repositoryUrl ?? undefined,
    p_deployment_url: input.deploymentUrl ?? undefined,
    p_demo_url: input.demoUrl ?? undefined,
  });
  if (error) throw new Error("Unable to submit build work.");
  return data;
}

export async function resubmitBuildWork(input: SubmitBuildWorkInput) {
  const supabase = await requireMember();
  const { data, error } = await supabase.rpc("resubmit_build_work", {
    p_work_item_id: input.workItemId,
    p_project_title: input.projectTitle,
    p_explanation: input.explanation,
    p_approach: input.approach,
    p_technologies: input.technologies ?? [],
    p_challenges: input.challenges ?? "",
    p_learnings: input.learnings ?? "",
    p_future_improvements: input.futureImprovements ?? "",
    p_repository_url: input.repositoryUrl ?? undefined,
    p_deployment_url: input.deploymentUrl ?? undefined,
    p_demo_url: input.demoUrl ?? undefined,
  });
  if (error) throw new Error("Unable to resubmit build work.");
  return data;
}

export async function reviewBuildSubmission(
  submissionId: string,
  decision: BuildReviewDecision,
  feedback = "",
) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_build_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_feedback: feedback,
  });
  if (error) throw new Error("Unable to review build submission.");
  return data;
}

export async function cancelBuildWorkItem(workItemId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_build_work_item", {
    p_work_item_id: workItemId,
  });
  if (error) throw new Error("Unable to cancel build work.");
  return data;
}

export async function getMemberBuildProveDomains(): Promise<BuildProveDomain[]> {
  const { memberId, supabase } = await requireMemberContext();
  const assignedWork = await loadMemberWorkItems(supabase, memberId);
  return BUILD_DOMAINS.map(({ key, name }) => {
    const domainWork = assignedWork.filter(({ task }) => task.domain === key);
    return {
      key,
      name,
      taskCount: domainWork.length,
      activeTaskCount: domainWork.filter(({ workItem }) =>
        ACTIVE_STATUSES.includes(readStatus(workItem.status))).length,
      awaitingReviewCount: domainWork.filter(({ workItem }) =>
        workItem.status === "submitted" || workItem.status === "resubmitted").length,
    };
  });
}

export async function getMemberBuildProveWorkItems(
  filters: BuildProveListFilters = {},
): Promise<BuildProvePage<BuildProveMemberWorkItem>> {
  const { memberId, supabase } = await requireMemberContext();
  validateFilters(filters);
  const assignedWork = await loadMemberWorkItems(supabase, memberId);
  const search = normalizeSearch(filters.search);
  const filtered = assignedWork.filter(({ task, workItem }) =>
    matchesTaskFilters(task, readStatus(workItem.status), filters, search));
  const latestByWorkItem = getLatestRevisions(
    await loadSubmissions(supabase, filtered.map(({ workItem }) => workItem.id)),
  );
  const items = filtered.map(({ task, workItem }) => {
    const latest = latestByWorkItem.get(workItem.id);
    const status = readStatus(workItem.status);
    return {
      workItemId: workItem.id,
      assignmentId: task.id,
      title: task.title,
      summary: task.summary,
      domain: task.domain,
      status,
      priority: task.priority,
      deadlineAt: task.deadlineAt,
      isOverdue: isOverdue(task.deadlineAt, status),
      rewardPoints: task.rewardPoints,
      rewardPointsSnapshot: workItem.reward_points_snapshot,
      assignedAt: workItem.assigned_at,
      updatedAt: workItem.updated_at,
      latestRevisionNumber: latest?.revision_number ?? null,
      latestSubmittedAt: latest?.submitted_at ?? null,
    } satisfies BuildProveMemberWorkItem;
  });
  return pageOf(items, filters.page, filters.pageSize);
}

export async function getMemberBuildProveTaskDetail(
  workItemId: string,
): Promise<BuildProveTaskDetail | null> {
  const { memberId, supabase } = await requireMemberContext();
  const { data: workItem, error: workItemError } = await supabase
    .from("build_assignment_members")
    .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
    .eq("id", workItemId)
    .eq("member_id", memberId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (workItemError) throw new BuildProveQueryError();
  if (!workItem) return null;

  const { data: assignment, error: assignmentError } = await supabase
    .from("build_assignments")
    .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, created_at, updated_at")
    .eq("id", workItem.assignment_id)
    .maybeSingle();
  if (assignmentError) throw new BuildProveQueryError();
  if (!assignment) throw new BuildProveQueryError();

  const [references, submissions] = await Promise.all([
    loadReferences(supabase, [assignment.id]),
    loadSubmissions(supabase, [workItem.id]),
  ]);
  const submissionIds = submissions.map((submission) => submission.id);
  const [reviews, evidence] = await Promise.all([
    loadReviews(supabase, submissionIds),
    loadEvidence(supabase, submissionIds),
  ]);
  const revisions = submissions
    .sort((left, right) => left.revision_number - right.revision_number)
    .map((submission) => mapRevision(submission, reviews, evidence));
  return {
    task: mapTask(assignment),
    workItem: {
      id: workItem.id,
      assignedBy: workItem.assigned_by,
      assignedAt: workItem.assigned_at,
      status: readStatus(workItem.status),
      rewardPointsSnapshot: workItem.reward_points_snapshot,
      updatedAt: workItem.updated_at,
    },
    referenceAttachments: references.map(mapReference),
    latestSubmission: revisions.at(-1) ?? null,
    revisionHistory: revisions,
  };
}

export async function getAdminBuildProveOverview(): Promise<BuildProveAdminOverview> {
  await requireAdmin();
  const supabase = await createClient();
  const [totalResult, activeResult, reviewResult, changesResult, approvedResult, overdueItems] =
    await Promise.all([
      supabase.from("build_assignments").select("id", { count: "exact", head: true }),
      supabase.from("build_assignments").select("id", { count: "exact", head: true })
        .eq("publication_state", "published"),
      supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
        .in("status", ["submitted", "resubmitted"]),
      supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
        .eq("status", "changes_requested"),
      supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      fetchAllPages((from, to) =>
        supabase.from("build_assignment_members")
          .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
          .in("status", ACTIVE_STATUSES)
          .range(from, to)),
    ]);
  if (totalResult.error || activeResult.error || reviewResult.error || changesResult.error || approvedResult.error) {
    throw new BuildProveQueryError();
  }
  const activeWorkItems = overdueItems.filter((item) => ACTIVE_STATUSES.includes(readStatus(item.status)));
  const assignmentById = new Map(
    (await loadAssignments(supabase, activeWorkItems.map((item) => item.assignment_id)))
      .map((assignment) => [assignment.id, assignment]),
  );
  const overdue = activeWorkItems.filter((item) => {
    const assignment = assignmentById.get(item.assignment_id);
    return assignment?.deadline_at !== null
      && assignment?.deadline_at !== undefined
      && new Date(assignment.deadline_at).getTime() < Date.now();
  }).length;
  return {
    totalTasks: totalResult.count ?? 0,
    activeTasks: activeResult.count ?? 0,
    awaitingReview: reviewResult.count ?? 0,
    changesRequested: changesResult.count ?? 0,
    approved: approvedResult.count ?? 0,
    overdue,
  };
}

export async function getAdminBuildProveTasks(
  filters: BuildProveAdminListFilters = {},
): Promise<BuildProvePage<BuildProveAdminTaskListItem>> {
  await requireAdmin();
  validateFilters(filters);
  if (filters.memberId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.memberId)) {
    throw new BuildProveValidationError();
  }
  const supabase = await createClient();
  const assignments = await fetchAllPages((from, to) =>
    supabase.from("build_assignments")
      .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range(from, to));
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const workItems: BuildWorkItemRow[] = [];
  for (const idsChunk of chunked(assignmentIds)) {
    const chunkRows = await fetchAllPages((from, to) => {
      let query = supabase.from("build_assignment_members")
        .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
        .in("assignment_id", idsChunk);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.memberId) query = query.eq("member_id", filters.memberId);
      return query.order("assigned_at", { ascending: false }).range(from, to);
    });
    workItems.push(...chunkRows);
  }
  const taskById = new Map(assignments.map((assignment) => [assignment.id, mapTask(assignment)]));
  const search = normalizeSearch(filters.search);
  const workByAssignment = new Map<string, BuildWorkItemRow[]>();
  for (const workItem of workItems) {
    const group = workByAssignment.get(workItem.assignment_id) ?? [];
    group.push(workItem);
    workByAssignment.set(workItem.assignment_id, group);
  }
  const matchingAssignments = assignments.filter((assignment) => {
    const task = taskById.get(assignment.id);
    const matchingWork = workByAssignment.get(assignment.id) ?? [];
    if (!task || (filters.domain && task.domain !== filters.domain)
      || (filters.priority && task.priority !== filters.priority)
      || (search && !`${task.title} ${task.summary}`.toLocaleLowerCase().includes(search))) return false;
    if (filters.overdue === true
      && !matchingWork.some((item) => isOverdue(task.deadlineAt, readStatus(item.status)))) return false;
    if (filters.overdue === false
      && matchingWork.some((item) => isOverdue(task.deadlineAt, readStatus(item.status)))) return false;
    if ((filters.status || filters.memberId) && matchingWork.length === 0) return false;
    return true;
  });
  const filteredItems = matchingAssignments.map((assignment) => {
    const task = taskById.get(assignment.id);
    if (!task) throw new BuildProveQueryError();
    return { assignment, task };
  });
  const page = pageOf(filteredItems, filters.page, filters.pageSize);
  const displayWorkItems: BuildWorkItemRow[] = [];
  for (const idsChunk of chunked(page.items.map(({ assignment }) => assignment.id))) {
    displayWorkItems.push(...await fetchAllPages((from, to) =>
      supabase.from("build_assignment_members")
        .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
        .in("assignment_id", idsChunk)
        .order("assigned_at", { ascending: false })
        .range(from, to)));
  }
  const displayWorkByAssignment = new Map<string, BuildWorkItemRow[]>();
  for (const workItem of displayWorkItems) {
    const group = displayWorkByAssignment.get(workItem.assignment_id) ?? [];
    group.push(workItem);
    displayWorkByAssignment.set(workItem.assignment_id, group);
  }
  const selectedWorkItems = page.items.flatMap(({ assignment }) =>
    displayWorkByAssignment.get(assignment.id) ?? []);
  const profileIds = [...new Set(selectedWorkItems.map((item) => item.member_id))];
  const profiles: BuildProfileRow[] = [];
  for (const idsChunk of chunked(profileIds)) {
    const profileRows = await fetchAllPages((from, to) =>
      supabase.from("profiles")
        .select("id, full_name, handle")
        .in("id", idsChunk)
        .range(from, to));
    profiles.push(...profileRows);
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    ...page,
    items: page.items.map(({ assignment, task }) => {
      const members = displayWorkByAssignment.get(assignment.id) ?? [];
      const statusCounts = Object.fromEntries(BUILD_STATUSES.map((status) => [
        status,
        members.filter((member) => member.status === status).length,
      ])) as Record<BuildWorkStatus, number>;
      return {
        task,
        assignedMemberCount: members.length,
        statusCounts,
        overdueMemberCount: members.filter((member) =>
        isOverdue(task.deadlineAt, readStatus(member.status))).length,
        members: members.map((member) => {
          const profile = profileById.get(member.member_id);
          if (!profile) throw new BuildProveQueryError();
          return {
            workItemId: member.id,
            memberId: member.member_id,
            fullName: profile.full_name,
            handle: profile.handle,
            status: readStatus(member.status),
          };
        }),
      };
    }),
  };
}

export async function getAdminBuildProveTaskDetail(
  assignmentId: string,
): Promise<BuildProveAdminTaskDetail | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("build_assignments")
    .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, created_at, updated_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw new BuildProveQueryError();
  if (!assignment) return null;
  const [workItems, references] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase.from("build_assignment_members")
        .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
        .eq("assignment_id", assignmentId)
        .order("assigned_at", { ascending: true })
        .range(from, to)),
    loadReferences(supabase, [assignmentId]),
  ]);
  const workItemIds = workItems.map((item) => item.id);
  const submissions = await loadSubmissions(supabase, workItemIds);
  const submissionIds = submissions.map((item) => item.id);
  const [reviews, evidence] = await Promise.all([
    loadReviews(supabase, submissionIds),
    loadEvidence(supabase, submissionIds),
  ]);
  const revisionsByWorkItem = new Map<string, BuildProveSubmissionRevision[]>();
  for (const submission of submissions) {
    const revisions = revisionsByWorkItem.get(submission.work_item_id) ?? [];
    revisions.push(mapRevision(submission, reviews, evidence));
    revisionsByWorkItem.set(submission.work_item_id, revisions);
  }
  const profileIds = [...new Set(workItems.map((item) => item.member_id))];
  const profiles: BuildProfileRow[] = [];
  for (const idsChunk of chunked(profileIds)) {
    profiles.push(...await fetchAllPages((from, to) =>
      supabase.from("profiles")
        .select("id, full_name, handle")
        .in("id", idsChunk)
        .range(from, to)));
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const members = workItems.map((workItem) => {
    const profile = profileById.get(workItem.member_id);
    if (!profile) throw new BuildProveQueryError();
    const revisionHistory = (revisionsByWorkItem.get(workItem.id) ?? [])
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
    return {
      workItem: {
        id: workItem.id,
        assignedBy: workItem.assigned_by,
        assignedAt: workItem.assigned_at,
        status: readStatus(workItem.status),
        rewardPointsSnapshot: workItem.reward_points_snapshot,
        updatedAt: workItem.updated_at,
        memberId: workItem.member_id,
        fullName: profile.full_name,
        handle: profile.handle,
      },
      latestSubmission: revisionHistory.at(-1) ?? null,
      revisionHistory,
    };
  });
  return {
    task: mapTask(assignment),
    referenceAttachments: references.map(mapReference),
    members,
  };
}

export async function getAdminBuildProveReviewQueue(): Promise<BuildProveReviewQueueItem[]> {
  await requireAdmin();
  const supabase = await createClient();
  const workItems = await fetchAllPages((from, to) =>
    supabase.from("build_assignment_members")
      .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
      .in("status", ["submitted", "resubmitted"])
      .order("updated_at", { ascending: true })
      .range(from, to));
  if (workItems.length === 0) return [];
  const [assignments, submissions, profiles] = await Promise.all([
    loadAssignments(supabase, workItems.map((item) => item.assignment_id)),
    loadSubmissions(supabase, workItems.map((item) => item.id)),
    (async () => {
      const rows: BuildProfileRow[] = [];
      for (const idsChunk of chunked([...new Set(workItems.map((item) => item.member_id))])) {
        rows.push(...await fetchAllPages((from, to) =>
          supabase.from("profiles")
            .select("id, full_name, handle")
            .in("id", idsChunk)
            .range(from, to)));
      }
      return rows;
    })(),
  ]);
  const latestByWorkItem = getLatestRevisions(submissions);
  const reviews = await loadReviews(supabase, [...latestByWorkItem.values()].map((row) => row.id));
  const reviewedSubmissionIds = new Set(reviews.map((review) => review.submission_id));
  const taskById = new Map(assignments.map((assignment) => [assignment.id, mapTask(assignment)]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return workItems.flatMap((workItem) => {
    const latest = latestByWorkItem.get(workItem.id);
    const task = taskById.get(workItem.assignment_id);
    const profile = profileById.get(workItem.member_id);
    const status = readStatus(workItem.status);
    if (reviewedSubmissionIds.has(latest?.id ?? "")) return [];
    if (!latest || !task || !profile) throw new BuildProveQueryError();
    if (status !== "submitted" && status !== "resubmitted") throw new BuildProveQueryError();
    return [{
      task,
      workItemId: workItem.id,
      memberId: workItem.member_id,
      fullName: profile.full_name,
      handle: profile.handle,
      status,
      latestRevisionNumber: latest.revision_number,
      latestSubmissionId: latest.id,
      submittedAt: latest.submitted_at,
    }];
  });
}
