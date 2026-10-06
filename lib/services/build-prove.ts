import "server-only";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/admin";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  BuildProveEvidenceValidationError,
  validateBuildProveEvidenceFile,
  type BuildProveEvidenceMimeType,
} from "@/lib/validation/build-prove-evidence";
import type { Json, Tables } from "@/lib/types/database";

export type BuildDomain =
  | "innovation_research"
  | "event_management"
  | "media_design"
  | "documentation";
export type BuildProveDifficulty = "easy" | "medium" | "hard";
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
export type BuildProvePublicationState = "draft" | "published" | "archived";

export type SaveBuildAssignmentInput = {
  assignmentId?: string;
  slug: string;
  title: string;
  summary?: string;
  objective?: string;
  difficulty: BuildProveDifficulty;
  domain: BuildDomain;
  assignmentScope: "domain" | "individual";
  publicationState: BuildProvePublicationState;
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

export type SaveBuildAssignmentResult = {
  assignmentId: string;
  publicationState: BuildProvePublicationState;
};

export type AssignBuildMemberResult = {
  assignmentId: string;
  memberId: string;
  created: boolean;
};

export type CancelBuildWorkItemResult = {
  status: "cancelled";
  idempotent: boolean;
};

export type AwardBuildSubmissionRewardResult = {
  status: "awarded" | "already_awarded";
  idempotent: boolean;
  pointsAwarded: number;
};

export type BuildProveAdminMutationErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "failed";

export class BuildProveAdminMutationError extends Error {
  constructor(readonly code: BuildProveAdminMutationErrorCode) {
    super({
      forbidden: "Build & Prove administrator access is required.",
      not_found: "The Build & Prove item was not found.",
      invalid_input: "The Build & Prove request is invalid.",
      conflict: "The Build & Prove item cannot be changed in its current state.",
      failed: "Unable to complete the Build & Prove administrator operation.",
    }[code]);
    this.name = "BuildProveAdminMutationError";
  }
}

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

export type BuildSubmissionDraftResult = {
  draftId: string;
  revisionNumber: number;
  state: "open";
  idempotent: boolean;
};

export type BuildSubmissionResult = {
  submissionId: string;
  revisionNumber: number;
  status: "submitted" | "resubmitted";
  idempotent: boolean;
};

export type BuildProveEvidenceOperationCode =
  | "unauthenticated"
  | "invalid_input"
  | "draft_unavailable"
  | "draft_conflict"
  | "draft_sealed"
  | "cancelled"
  | "invalid_file"
  | "file_too_large"
  | "unsupported_mime"
  | "signature_mismatch"
  | "storage_upload_failed"
  | "evidence_registration_failed"
  | "evidence_not_found"
  | "forbidden"
  | "storage_delete_failed"
  | "evidence_cleanup_required"
  | "storage_object_missing";

const BUILD_PROVE_EVIDENCE_MESSAGES: Record<BuildProveEvidenceOperationCode, string> = {
  unauthenticated: "Sign in to manage Build & Prove evidence.",
  invalid_input: "The Build & Prove evidence request is invalid.",
  draft_unavailable: "This draft is unavailable.",
  draft_conflict: "This draft changed or is no longer accepting changes.",
  draft_sealed: "Submitted evidence cannot be changed.",
  cancelled: "Cancelled work does not accept evidence changes.",
  invalid_file: "Choose a non-empty supported file.",
  file_too_large: "Evidence files must be 10 MiB or smaller.",
  unsupported_mime: "Only JPEG, PNG, WebP, and PDF files are supported.",
  signature_mismatch: "The file contents do not match the selected file type.",
  storage_upload_failed: "The upload could not be confirmed. A private file may require cleanup.",
  evidence_registration_failed: "The upload could not be registered. The private file may require cleanup.",
  evidence_not_found: "Evidence was not found.",
  forbidden: "You are not allowed to access this evidence.",
  storage_delete_failed: "The file could not be removed. Its evidence record is unchanged.",
  evidence_cleanup_required: "The file was removed, but its evidence record needs cleanup.",
  storage_object_missing: "The evidence file is no longer available.",
};

export class BuildProveEvidenceOperationError extends Error {
  constructor(
    readonly code: BuildProveEvidenceOperationCode,
    readonly diagnosticId?: string,
  ) {
    super(BUILD_PROVE_EVIDENCE_MESSAGES[code]);
    this.name = "BuildProveEvidenceOperationError";
  }
}

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
  | "sort_order"
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
  | "id"
  | "submission_id"
  | "draft_id"
  | "owner_id"
  | "content_type"
  | "file_size"
  | "caption"
  | "created_at"
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

export type BuildProveSubmissionDraft = Omit<
  BuildProveSubmissionRevision,
  "id" | "workItemId" | "submittedAt" | "createdAt" | "reviews"
> & {
  id: string;
  revisionNumber: number;
  evidence: BuildProveEvidenceMetadata[];
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
  difficulty: BuildProveDifficulty;
  domain: BuildDomain;
  assignmentScope: "domain" | "individual";
  publicationState: BuildProvePublicationState;
  priority: "low" | "normal" | "high" | "urgent";
  deadlineAt: string | null;
  requirements: Json;
  deliverables: Json;
  submissionRequirements: Json;
  evaluationCriteria: Json;
  rewardPoints: number;
  sortOrder: number;
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
    rewardPointsAwarded?: number | null;
    rewardAwardedAt?: string | null;
    updatedAt: string;
  };
  referenceAttachments: BuildProveReferenceMetadata[];
  openDraft: BuildProveSubmissionDraft | null;
  latestSubmission: BuildProveSubmissionRevision | null;
  revisionHistory: BuildProveSubmissionRevision[];
};

export type BuildProveAdminOverview = {
  totalTasks: number;
  publishedTasks: number;
  unpublishedTasks: number;
  draftTasks: number;
  archivedTasks: number;
  assignedWorkItems: number;
  submittedWorkItems: number;
  cancelledWorkItems: number;
  reviewQueueCount: number;
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

export type BuildProveAssignableMember = {
  id: string;
  fullName: string;
  handle: string;
  existingStatus: BuildWorkStatus | null;
};

export type BuildProveReferenceUploadResult = {
  attachmentId: string;
};

export type BuildProveAdminTaskDetail = {
  task: BuildProveTaskDefinition;
  referenceAttachments: BuildProveReferenceMetadata[];
  members: Array<{
    workItem: BuildProveTaskDetail["workItem"] & {
      memberId: string;
      fullName: string;
      handle: string;
    };
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
  submissionSummary: string;
  evidenceCount: number;
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
  publicationState?: BuildProvePublicationState;
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

const BUILD_PROVE_PRIVATE_BUCKET = "build-prove-private";
const BUILD_EVIDENCE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isJsonRecord(value: Json): value is { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRpcRecord(value: Json): { [key: string]: Json | undefined } {
  if (!isJsonRecord(value)) throw new BuildProveQueryError();
  return value;
}

function adminMutationError(error: { code?: string }): BuildProveAdminMutationError {
  if (error.code === "42501") return new BuildProveAdminMutationError("forbidden");
  if (error.code === "P0002") return new BuildProveAdminMutationError("not_found");
  if (error.code === "22023") return new BuildProveAdminMutationError("invalid_input");
  if (error.code === "40001" || error.code === "PT409") {
    return new BuildProveAdminMutationError("conflict");
  }
  return new BuildProveAdminMutationError("failed");
}

function readPublicationState(value: string | null): BuildProvePublicationState | null {
  return value === "draft" || value === "published" || value === "archived"
    ? value
    : null;
}

function rpcOperationError(
  error: { code?: string },
  defaultCode: BuildProveEvidenceOperationCode,
): BuildProveEvidenceOperationError {
  if (error.code === "42501") return new BuildProveEvidenceOperationError("forbidden");
  if (error.code === "P0002") return new BuildProveEvidenceOperationError("draft_unavailable");
  if (error.code === "40001") return new BuildProveEvidenceOperationError("draft_conflict");
  if (error.code === "22023") return new BuildProveEvidenceOperationError("invalid_input");
  return new BuildProveEvidenceOperationError(defaultCode);
}

function validateSubmissionDraftInput(input: SubmitBuildWorkInput): boolean {
  const validUrl = (value: string | null | undefined) => value == null || /^https?:\/\//i.test(value);
  return BUILD_EVIDENCE_UUID.test(input.workItemId)
    && input.projectTitle.trim().length > 0
    && input.projectTitle.trim().length <= 160
    && input.explanation.length <= 12000
    && input.approach.length <= 12000
    && (input.technologies?.length ?? 0) <= 25
    && (input.challenges?.length ?? 0) <= 4000
    && (input.learnings?.length ?? 0) <= 4000
    && (input.futureImprovements?.length ?? 0) <= 4000
    && validUrl(input.repositoryUrl)
    && validUrl(input.deploymentUrl)
    && validUrl(input.demoUrl);
}

function isBuildProveEvidenceMimeType(value: string): value is BuildProveEvidenceMimeType {
  return value === "image/jpeg"
    || value === "image/png"
    || value === "image/webp"
    || value === "application/pdf";
}

function rpcString(
  record: { [key: string]: Json | undefined },
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function rpcNumber(
  record: { [key: string]: Json | undefined },
  key: string,
): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function rpcBoolean(
  record: { [key: string]: Json | undefined },
  key: string,
): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

export async function saveBuildSubmissionDraft(
  input: SubmitBuildWorkInput,
): Promise<BuildSubmissionDraftResult> {
  if (!validateSubmissionDraftInput(input)) {
    throw new BuildProveEvidenceOperationError("invalid_input");
  }
  const supabase = await requireMember();
  const { data, error } = await supabase.rpc("save_build_submission_draft", {
    p_work_item_id: input.workItemId,
    p_project_title: input.projectTitle,
    p_explanation: input.explanation,
    p_approach: input.approach,
    p_technologies: input.technologies ?? [],
    p_challenges: input.challenges ?? "",
    p_learnings: input.learnings ?? "",
    p_future_improvements: input.futureImprovements ?? "",
    p_repository_url: input.repositoryUrl ?? null,
    p_deployment_url: input.deploymentUrl ?? null,
    p_demo_url: input.demoUrl ?? null,
  });
  if (error) throw rpcOperationError(error, "draft_unavailable");

  const result = requireRpcRecord(data);
  const draftId = rpcString(result, "draft_id");
  const revisionNumber = rpcNumber(result, "revision_number");
  const state = rpcString(result, "state");
  const idempotent = rpcBoolean(result, "idempotent");
  if (
    !draftId
    || !BUILD_EVIDENCE_UUID.test(draftId)
    || revisionNumber === null
    || state !== "open"
    || idempotent === null
  ) {
    throw new BuildProveQueryError();
  }
  return { draftId, revisionNumber, state, idempotent };
}

export async function submitBuildSubmissionDraft(draftId: string): Promise<BuildSubmissionResult> {
  if (!BUILD_EVIDENCE_UUID.test(draftId)) {
    throw new BuildProveEvidenceOperationError("invalid_input");
  }
  const supabase = await requireMember();
  const { data, error } = await supabase.rpc("submit_build_submission_draft", {
    p_draft_id: draftId,
  });
  if (error) throw rpcOperationError(error, "draft_conflict");

  const result = requireRpcRecord(data);
  const submissionId = rpcString(result, "submission_id");
  const revisionNumber = rpcNumber(result, "revision_number");
  const status = rpcString(result, "status");
  const idempotent = rpcBoolean(result, "idempotent");
  if (
    !submissionId
    || !BUILD_EVIDENCE_UUID.test(submissionId)
    || revisionNumber === null
    || (status !== "submitted" && status !== "resubmitted")
    || idempotent === null
  ) {
    throw new BuildProveQueryError();
  }
  return { submissionId, revisionNumber, status, idempotent };
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

function readDifficulty(value: string): BuildProveDifficulty {
  if (value !== "easy" && value !== "medium" && value !== "hard") {
    throw new BuildProveQueryError();
  }
  return value;
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
    difficulty: readDifficulty(row.difficulty),
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
    sortOrder: row.sort_order,
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
        .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, sort_order, created_at, updated_at")
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
        .select("id, submission_id, draft_id, owner_id, content_type, file_size, caption, created_at")
        .in("submission_id", idsChunk)
        .order("created_at", { ascending: true })
        .range(from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadDraftEvidence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  draftId: string,
): Promise<BuildEvidenceRow[]> {
  const rows = await fetchAllPages((from, to) =>
    supabase.from("build_submission_evidence")
      .select("id, submission_id, draft_id, owner_id, content_type, file_size, caption, created_at")
      .eq("draft_id", draftId)
      .order("created_at", { ascending: true })
      .range(from, to));
  return rows;
}

async function loadOpenSubmissionDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workItemId: string,
): Promise<BuildProveSubmissionDraft | null> {
  const { data: draft, error } = await supabase
    .from("build_submission_drafts")
    .select("id, work_item_id, revision_number, project_title, explanation, approach, technologies, challenges, learnings, future_improvements, repository_url, deployment_url, demo_url, state")
    .eq("work_item_id", workItemId)
    .eq("state", "open")
    .maybeSingle();
  if (error) throw new BuildProveQueryError();
  if (!draft) return null;
  if (draft.state !== "open") throw new BuildProveQueryError();

  const evidence = await loadDraftEvidence(supabase, draft.id);
  return {
    id: draft.id,
    revisionNumber: draft.revision_number,
    projectTitle: draft.project_title,
    explanation: draft.explanation,
    approach: draft.approach,
    technologies: draft.technologies,
    challenges: draft.challenges,
    learnings: draft.learnings,
    futureImprovements: draft.future_improvements,
    repositoryUrl: draft.repository_url,
    deploymentUrl: draft.deployment_url,
    demoUrl: draft.demo_url,
    evidence: evidence.filter((item) => item.draft_id === draft.id).map(mapEvidence),
  };
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

export async function saveBuildAssignment(
  input: SaveBuildAssignmentInput,
): Promise<SaveBuildAssignmentResult> {
  await requireAdmin();
  if (
    !input
    || typeof input !== "object"
    || (input.assignmentId !== undefined
      && (typeof input.assignmentId !== "string" || !BUILD_EVIDENCE_UUID.test(input.assignmentId)))
    || (input.memberIds !== undefined
      && (!Array.isArray(input.memberIds) || input.memberIds.some((id) =>
        typeof id !== "string" || !BUILD_EVIDENCE_UUID.test(id))))
  ) {
    throw new BuildProveAdminMutationError("invalid_input");
  }
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
  if (error) throw adminMutationError(error);
  const result = requireRpcRecord(data);
  const assignmentId = rpcString(result, "assignment_id");
  const publicationState = readPublicationState(rpcString(result, "publication_state"));
  if (
    !assignmentId
    || !BUILD_EVIDENCE_UUID.test(assignmentId)
    || !publicationState
    || publicationState !== input.publicationState
  ) {
    throw new BuildProveQueryError();
  }
  return { assignmentId, publicationState };
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

export async function uploadBuildAssignmentReference(
  assignmentId: string,
  file: File,
  label: string,
): Promise<BuildProveReferenceUploadResult> {
  await requireAdmin();
  if (
    typeof assignmentId !== "string"
    || !BUILD_EVIDENCE_UUID.test(assignmentId)
    || typeof label !== "string"
    || label.trim().length > 200
  ) {
    throw new BuildProveAdminMutationError("invalid_input");
  }
  let contentType: BuildProveEvidenceMimeType;
  try {
    contentType = await validateBuildProveEvidenceFile(file);
  } catch (error) {
    if (error instanceof BuildProveEvidenceValidationError) {
      throw new BuildProveAdminMutationError("invalid_input");
    }
    throw error;
  }

  const extensionByType: Record<BuildProveEvidenceMimeType, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  const storagePath = `assignments/${assignmentId}/${randomUUID()}.${extensionByType[contentType]}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUILD_PROVE_PRIVATE_BUCKET)
    .upload(storagePath, file, { contentType, upsert: false });
  if (uploadError) throw new BuildProveAdminMutationError("failed");

  const { data, error } = await supabase.rpc("add_build_assignment_attachment", {
    p_assignment_id: assignmentId,
    p_storage_path: storagePath,
    p_content_type: contentType,
    p_file_size: file.size,
    p_label: label.trim(),
  });
  const cleanupUploadedObject = async () => {
    const { error: cleanupError } = await supabase.storage
      .from(BUILD_PROVE_PRIVATE_BUCKET)
      .remove([storagePath]);
    if (cleanupError) {
      console.error("build_prove_reference_cleanup_failed", { diagnosticId: randomUUID() });
    }
  };
  if (error) {
    await cleanupUploadedObject();
    throw adminMutationError(error);
  }
  let result: { [key: string]: Json | undefined };
  try {
    result = requireRpcRecord(data);
  } catch (error) {
    await cleanupUploadedObject();
    throw error;
  }
  const attachmentId = rpcString(result, "attachment_id");
  if (!attachmentId || !BUILD_EVIDENCE_UUID.test(attachmentId)) {
    await cleanupUploadedObject();
    throw new BuildProveQueryError();
  }
  return { attachmentId };
}

export async function assignBuildMember(
  assignmentId: string,
  memberId: string,
): Promise<AssignBuildMemberResult> {
  await requireAdmin();
  if (
    typeof assignmentId !== "string"
    || !BUILD_EVIDENCE_UUID.test(assignmentId)
    || typeof memberId !== "string"
    || !BUILD_EVIDENCE_UUID.test(memberId)
  ) {
    throw new BuildProveAdminMutationError("invalid_input");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_build_member", {
    p_assignment_id: assignmentId,
    p_member_id: memberId,
  });
  if (error) throw adminMutationError(error);
  const result = requireRpcRecord(data);
  const resultAssignmentId = rpcString(result, "assignment_id");
  const resultMemberId = rpcString(result, "member_id");
  const created = rpcBoolean(result, "created");
  if (
    resultAssignmentId !== assignmentId
    || resultMemberId !== memberId
    || created === null
  ) {
    throw new BuildProveQueryError();
  }
  return { assignmentId: resultAssignmentId, memberId: resultMemberId, created };
}

export async function assignBuildMembersBulk(
  assignmentId: string,
  memberIds: string[],
): Promise<SaveBuildAssignmentResult> {
  await requireAdmin();
  if (
    typeof assignmentId !== "string"
    || !BUILD_EVIDENCE_UUID.test(assignmentId)
    || !Array.isArray(memberIds)
    || memberIds.length === 0
    || memberIds.some((id) => typeof id !== "string" || !BUILD_EVIDENCE_UUID.test(id))
    || new Set(memberIds).size !== memberIds.length
  ) {
    throw new BuildProveAdminMutationError("invalid_input");
  }
  const supabase = await createClient();
  const { data: assignment, error } = await supabase.from("build_assignments")
    .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, sort_order, created_at, updated_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new BuildProveQueryError();
  if (!assignment) throw new BuildProveAdminMutationError("not_found");
  const task = mapTask(assignment);
  if (task.publicationState !== "published") {
    throw new BuildProveAdminMutationError("invalid_input");
  }
  return saveBuildAssignment({
    assignmentId: task.id,
    slug: task.slug,
    title: task.title,
    summary: task.summary,
    objective: task.objective,
    difficulty: task.difficulty,
    domain: task.domain,
    assignmentScope: task.assignmentScope,
    publicationState: task.publicationState,
    deadlineAt: task.deadlineAt,
    priority: task.priority,
    requirements: task.requirements,
    deliverables: task.deliverables,
    submissionRequirements: task.submissionRequirements,
    evaluationCriteria: task.evaluationCriteria,
    rewardPoints: task.rewardPoints,
    sortOrder: assignment.sort_order,
    memberIds,
  });
}

export async function getAdminBuildProveAssignableMembers(
  assignmentId: string,
): Promise<BuildProveAssignableMember[]> {
  await requireAdmin();
  if (typeof assignmentId !== "string" || !BUILD_EVIDENCE_UUID.test(assignmentId)) {
    throw new BuildProveValidationError();
  }
  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase.from("build_assignments")
    .select("id, domain, assignment_scope")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw new BuildProveQueryError();
  if (!assignment) throw new BuildProveValidationError();

  let eligibleProfileIds: string[] | null = null;
  if (assignment.assignment_scope === "domain") {
    const domains = await fetchAllPages((from, to) =>
      supabase.from("build_member_domains")
        .select("profile_id")
        .eq("domain", assignment.domain)
        .range(from, to));
    eligibleProfileIds = [...new Set(domains.map(({ profile_id }) => profile_id))];
  } else if (assignment.assignment_scope !== "individual") {
    throw new BuildProveQueryError();
  }

  const [profiles, workItems] = await Promise.all([
    (async () => {
      const rows: BuildProfileRow[] = [];
      for (const idsChunk of chunked(eligibleProfileIds ?? [])) {
        rows.push(...await fetchAllPages((from, to) =>
          supabase.from("profiles")
            .select("id, full_name, handle")
            .in("id", idsChunk)
            .order("full_name", { ascending: true })
            .range(from, to)));
      }
      if (eligibleProfileIds !== null) return rows;
      return fetchAllPages((from, to) =>
        supabase.from("profiles")
          .select("id, full_name, handle")
          .order("full_name", { ascending: true })
          .range(from, to));
    })(),
    fetchAllPages((from, to) =>
      supabase.from("build_assignment_members")
        .select("member_id, status")
        .eq("assignment_id", assignmentId)
        .range(from, to)),
  ]);
  const statusByMember = new Map(workItems.map((item) => [item.member_id, readStatus(item.status)]));
  return profiles.map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    handle: profile.handle,
    existingStatus: statusByMember.get(profile.id) ?? null,
  }));
}

async function registerBuildDraftEvidenceWithContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  draftId: string,
  objectId: string,
  caption: string,
): Promise<BuildProveEvidenceMetadata> {
  const { data, error } = await supabase.rpc("register_build_draft_evidence", {
    p_draft_id: draftId,
    p_object_uuid: objectId,
    p_caption: caption,
  });
  if (error) throw rpcOperationError(error, "evidence_registration_failed");
  const result = requireRpcRecord(data);
  const evidenceId = rpcString(result, "evidence_id");
  const contentType = rpcString(result, "content_type");
  const fileSize = rpcNumber(result, "file_size");
  const registeredCaption = rpcString(result, "caption");
  const createdAt = rpcString(result, "created_at");
  if (
    !evidenceId
    || !BUILD_EVIDENCE_UUID.test(evidenceId)
    || !contentType
    || !isBuildProveEvidenceMimeType(contentType)
    || fileSize === null
    || registeredCaption === null
    || createdAt === null
  ) {
    throw new BuildProveQueryError();
  }
  return {
    id: evidenceId,
    contentType,
    fileSize,
    caption: registeredCaption,
    createdAt,
  };
}

export async function uploadBuildDraftEvidence(
  draftId: string,
  file: File,
  caption = "",
): Promise<BuildProveEvidenceMetadata> {
  const { memberId, supabase } = await requireMemberContext();
  if (!BUILD_EVIDENCE_UUID.test(draftId) || caption.trim().length > 500) {
    throw new BuildProveEvidenceOperationError("invalid_input");
  }

  const { data: draft, error: draftError } = await supabase
    .from("build_submission_drafts")
    .select("id, member_id, state")
    .eq("id", draftId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (draftError) throw new BuildProveQueryError();
  if (!draft) throw new BuildProveEvidenceOperationError("draft_unavailable");
  if (draft.state !== "open") throw new BuildProveEvidenceOperationError("draft_sealed");

  let contentType: BuildProveEvidenceMimeType;
  try {
    contentType = await validateBuildProveEvidenceFile(file);
  } catch (error) {
    if (error instanceof BuildProveEvidenceValidationError) {
      throw new BuildProveEvidenceOperationError(error.code);
    }
    throw new BuildProveEvidenceOperationError("invalid_file");
  }

  const objectId = randomUUID();
  const storagePath = `submissions/${memberId}/${draft.id}/${objectId}`;
  const uploadDiagnosticId = randomUUID();
  let uploadFailed = false;
  try {
    const { error: uploadError } = await supabase.storage
      .from(BUILD_PROVE_PRIVATE_BUCKET)
      .upload(storagePath, file, { contentType, upsert: false });
    uploadFailed = uploadError !== null;
  } catch {
    uploadFailed = true;
  }
  if (uploadFailed) {
    console.error("build_prove_evidence_storage_upload_failed", {
      diagnosticId: uploadDiagnosticId,
    });
    throw new BuildProveEvidenceOperationError("storage_upload_failed", uploadDiagnosticId);
  }

  try {
    return await registerBuildDraftEvidenceWithContext(
      supabase,
      draft.id,
      objectId,
      caption.trim(),
    );
  } catch {
    const diagnosticId = randomUUID();
    console.error("build_prove_evidence_registration_failed", { diagnosticId });
    throw new BuildProveEvidenceOperationError("evidence_registration_failed", diagnosticId);
  }
}

export async function removeBuildDraftEvidence(evidenceId: string): Promise<void> {
  const { memberId, supabase } = await requireMemberContext();
  if (!BUILD_EVIDENCE_UUID.test(evidenceId)) {
    throw new BuildProveEvidenceOperationError("invalid_input");
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("build_submission_evidence")
    .select("id, draft_id, submission_id, owner_id, storage_path")
    .eq("id", evidenceId)
    .maybeSingle();
  if (evidenceError) throw new BuildProveQueryError();
  if (!evidence) throw new BuildProveEvidenceOperationError("evidence_not_found");
  if (evidence.owner_id !== memberId) throw new BuildProveEvidenceOperationError("forbidden");
  if (!evidence.draft_id || evidence.submission_id) {
    throw new BuildProveEvidenceOperationError("draft_sealed");
  }

  const { data: draft, error: draftError } = await supabase
    .from("build_submission_drafts")
    .select("id, work_item_id, member_id, state")
    .eq("id", evidence.draft_id)
    .eq("member_id", memberId)
    .maybeSingle();
  if (draftError) throw new BuildProveQueryError();
  if (!draft) throw new BuildProveEvidenceOperationError("draft_unavailable");
  if (draft.state !== "open") throw new BuildProveEvidenceOperationError("draft_sealed");

  const { data: workItem, error: workItemError } = await supabase
    .from("build_assignment_members")
    .select("id, status")
    .eq("id", draft.work_item_id)
    .eq("member_id", memberId)
    .maybeSingle();
  if (workItemError) throw new BuildProveQueryError();
  if (!workItem) throw new BuildProveEvidenceOperationError("draft_unavailable");
  if (workItem.status === "cancelled") throw new BuildProveEvidenceOperationError("cancelled");
  if (!["in_progress", "changes_requested"].includes(workItem.status)) {
    throw new BuildProveEvidenceOperationError("draft_sealed");
  }

  const diagnosticId = randomUUID();
  // The Storage delete policy requires the registered evidence row to still exist.
  const { error: storageError } = await supabase.storage
    .from(BUILD_PROVE_PRIVATE_BUCKET)
    .remove([evidence.storage_path]);
  if (storageError) {
    console.error("build_prove_evidence_storage_delete_failed", { diagnosticId });
    throw new BuildProveEvidenceOperationError("storage_delete_failed", diagnosticId);
  }

  const { error: removalError } = await supabase.rpc("remove_build_draft_evidence", {
    p_evidence_id: evidence.id,
  });
  if (removalError) {
    console.error("build_prove_evidence_metadata_cleanup_failed", { diagnosticId });
    throw new BuildProveEvidenceOperationError("evidence_cleanup_required", diagnosticId);
  }
}

export type BuildProveEvidenceDownload = {
  body: Blob;
  contentType: BuildProveEvidenceMimeType;
  fileSize: number;
};

export async function downloadBuildEvidence(
  evidenceId: string,
): Promise<BuildProveEvidenceDownload> {
  const { memberId, supabase } = await requireMemberContext();
  if (!BUILD_EVIDENCE_UUID.test(evidenceId)) {
    throw new BuildProveEvidenceOperationError("invalid_input");
  }
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) throw new BuildProveQueryError();

  const { data: evidence, error: evidenceError } = await supabase
    .from("build_submission_evidence")
    .select("id, draft_id, submission_id, owner_id, storage_path, content_type, file_size")
    .eq("id", evidenceId)
    .maybeSingle();
  if (evidenceError) throw new BuildProveQueryError();
  if (!evidence) throw new BuildProveEvidenceOperationError("evidence_not_found");
  if (!admin && evidence.owner_id !== memberId) {
    throw new BuildProveEvidenceOperationError("forbidden");
  }
  if (!isBuildProveEvidenceMimeType(evidence.content_type)
    || evidence.file_size < 1
    || evidence.file_size > 10 * 1024 * 1024) {
    throw new BuildProveQueryError();
  }

  let workItemId: string;
  if (evidence.draft_id && !evidence.submission_id) {
    const { data: draft, error: draftError } = await supabase
      .from("build_submission_drafts")
      .select("id, work_item_id, member_id, state")
      .eq("id", evidence.draft_id)
      .maybeSingle();
    if (draftError) throw new BuildProveQueryError();
    if (!draft || draft.member_id !== evidence.owner_id || draft.state !== "open") {
      throw new BuildProveEvidenceOperationError("evidence_not_found");
    }
    workItemId = draft.work_item_id;
  } else if (evidence.submission_id && !evidence.draft_id) {
    const { data: submission, error: submissionError } = await supabase
      .from("build_submissions")
      .select("id, work_item_id, member_id")
      .eq("id", evidence.submission_id)
      .maybeSingle();
    if (submissionError) throw new BuildProveQueryError();
    if (!submission || submission.member_id !== evidence.owner_id) {
      throw new BuildProveEvidenceOperationError("evidence_not_found");
    }
    workItemId = submission.work_item_id;
  } else {
    throw new BuildProveQueryError();
  }

  const { data: workItem, error: workItemError } = await supabase
    .from("build_assignment_members")
    .select("id, member_id, status")
    .eq("id", workItemId)
    .maybeSingle();
  if (workItemError) throw new BuildProveQueryError();
  if (!workItem || workItem.member_id !== evidence.owner_id) {
    throw new BuildProveEvidenceOperationError("evidence_not_found");
  }
  if (!admin && (evidence.owner_id !== memberId || workItem.status === "cancelled")) {
    throw new BuildProveEvidenceOperationError("forbidden");
  }
  if (evidence.draft_id
    && !["in_progress", "changes_requested"].includes(workItem.status)) {
    throw new BuildProveEvidenceOperationError(
      workItem.status === "cancelled" ? "cancelled" : "draft_sealed",
    );
  }

  const { data: body, error: downloadError } = await supabase.storage
    .from(BUILD_PROVE_PRIVATE_BUCKET)
    .download(evidence.storage_path);
  if (downloadError && ("status" in downloadError && downloadError.status === 404)) {
    throw new BuildProveEvidenceOperationError("storage_object_missing");
  }
  if (downloadError || !body) throw new BuildProveQueryError();
  return {
    body,
    contentType: evidence.content_type,
    fileSize: evidence.file_size,
  };
}

export type BuildProveReferenceDownload = {
  body: Blob;
  contentType: string;
  fileSize: number;
};

export async function downloadBuildAssignmentReference(
  attachmentId: string,
): Promise<BuildProveReferenceDownload | null> {
  const { memberId, supabase } = await requireMemberContext();
  if (!BUILD_EVIDENCE_UUID.test(attachmentId)) return null;

  const { data: attachment, error: attachmentError } = await supabase
    .from("build_assignment_attachments")
    .select("id, assignment_id, storage_path, content_type, file_size")
    .eq("id", attachmentId)
    .maybeSingle();
  if (attachmentError) throw new BuildProveQueryError();
  if (!attachment) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("build_assignment_members")
    .select("id, status")
    .eq("assignment_id", attachment.assignment_id)
    .eq("member_id", memberId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (membershipError) throw new BuildProveQueryError();
  if (!membership) return null;

  const { data: body, error: downloadError } = await supabase.storage
    .from(BUILD_PROVE_PRIVATE_BUCKET)
    .download(attachment.storage_path);
  if (downloadError || !body) throw new BuildProveQueryError();
  return {
    body,
    contentType: attachment.content_type,
    fileSize: attachment.file_size,
  };
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
  const draft = await saveBuildSubmissionDraft(input);
  return submitBuildSubmissionDraft(draft.draftId);
}

export async function resubmitBuildWork(input: SubmitBuildWorkInput) {
  return submitBuildWork(input);
}

export async function reviewBuildSubmission(
  submissionId: string,
  decision: BuildReviewDecision,
  feedback = "",
): Promise<{
  status: BuildReviewDecision;
  idempotent: boolean;
  rewardStatus: "awarded" | "already_awarded" | "not_awarded" | "not_applicable";
  pointsAwarded: number;
}> {
  await requireAdmin();
  if (!BUILD_EVIDENCE_UUID.test(submissionId)) {
    throw new BuildProveValidationError();
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_build_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_feedback: feedback,
  });
  if (error) throw new Error("Unable to review build submission.");
  const result = requireRpcRecord(data);
  const resultSubmissionId = rpcString(result, "submission_id");
  const status = rpcString(result, "status");
  const idempotent = rpcBoolean(result, "idempotent");
  const rewardStatus = rpcString(result, "reward_status");
  const pointsAwarded = rpcNumber(result, "points_awarded");
  if (
    resultSubmissionId !== submissionId
    || (status !== "approved" && status !== "changes_requested")
    || status !== decision
    || idempotent === null
    || (
      rewardStatus !== "awarded"
      && rewardStatus !== "already_awarded"
      && rewardStatus !== "not_awarded"
      && rewardStatus !== "not_applicable"
    )
    || pointsAwarded === null
    || !Number.isInteger(pointsAwarded)
    || pointsAwarded < 0
  ) {
    throw new BuildProveQueryError();
  }
  return { status, idempotent, rewardStatus, pointsAwarded };
}

export async function awardBuildSubmissionReward(
  workItemId: string,
): Promise<AwardBuildSubmissionRewardResult> {
  await requireAdmin();
  if (typeof workItemId !== "string" || !BUILD_EVIDENCE_UUID.test(workItemId)) {
    throw new BuildProveAdminMutationError("invalid_input");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("award_build_submission_reward", {
    p_work_item_id: workItemId,
  });
  if (error) throw adminMutationError(error);
  const result = requireRpcRecord(data);
  const resultWorkItemId = rpcString(result, "work_item_id");
  const status = rpcString(result, "status");
  const idempotent = rpcBoolean(result, "idempotent");
  const pointsAwarded = rpcNumber(result, "points_awarded");
  if (
    resultWorkItemId !== workItemId
    || (status !== "awarded" && status !== "already_awarded")
    || idempotent === null
    || idempotent !== (status === "already_awarded")
    || pointsAwarded === null
    || !Number.isInteger(pointsAwarded)
    || pointsAwarded < 0
  ) {
    throw new BuildProveQueryError();
  }
  return { status, idempotent, pointsAwarded };
}

export async function cancelBuildWorkItem(
  workItemId: string,
): Promise<CancelBuildWorkItemResult> {
  await requireAdmin();
  if (typeof workItemId !== "string" || !BUILD_EVIDENCE_UUID.test(workItemId)) {
    throw new BuildProveAdminMutationError("invalid_input");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_build_work_item", {
    p_work_item_id: workItemId,
  });
  if (error) throw adminMutationError(error);
  const result = requireRpcRecord(data);
  const status = rpcString(result, "status");
  const idempotent = rpcBoolean(result, "idempotent");
  if (status !== "cancelled" || idempotent === null) {
    throw new BuildProveQueryError();
  }
  return { status, idempotent };
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
    .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, sort_order, created_at, updated_at")
    .eq("id", workItem.assignment_id)
    .maybeSingle();
  if (assignmentError) throw new BuildProveQueryError();
  if (!assignment) throw new BuildProveQueryError();

  const status = readStatus(workItem.status);
  const [references, submissions, rewardResult] = await Promise.all([
    loadReferences(supabase, [assignment.id]),
    loadSubmissions(supabase, [workItem.id]),
    status === "approved"
      ? supabase.from("build_submission_rewards")
        .select("points_awarded, awarded_at")
        .eq("work_item_id", workItem.id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (rewardResult.error) throw new BuildProveQueryError();
  const openDraft = ["in_progress", "changes_requested"].includes(status)
    ? await loadOpenSubmissionDraft(supabase, workItem.id)
    : null;
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
      status,
      rewardPointsSnapshot: workItem.reward_points_snapshot,
      rewardPointsAwarded: rewardResult.data?.points_awarded ?? null,
      rewardAwardedAt: rewardResult.data?.awarded_at ?? null,
      updatedAt: workItem.updated_at,
    },
    referenceAttachments: references.map(mapReference),
    openDraft,
    latestSubmission: revisions.at(-1) ?? null,
    revisionHistory: revisions,
  };
}

export async function getAdminBuildProveOverview(): Promise<BuildProveAdminOverview> {
  await requireAdmin();
  const supabase = await createClient();
  const [totalResult, publishedResult, draftResult, archivedResult, assignedResult,
    reviewResult, changesResult, approvedResult, cancelledResult, overdueItems] = await Promise.all([
    supabase.from("build_assignments").select("id", { count: "exact", head: true }),
    supabase.from("build_assignments").select("id", { count: "exact", head: true })
      .eq("publication_state", "published"),
    supabase.from("build_assignments").select("id", { count: "exact", head: true })
      .eq("publication_state", "draft"),
    supabase.from("build_assignments").select("id", { count: "exact", head: true })
      .eq("publication_state", "archived"),
    supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
      .eq("status", "assigned"),
    supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
      .in("status", ["submitted", "resubmitted"]),
    supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
      .eq("status", "changes_requested"),
    supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase.from("build_assignment_members").select("id", { count: "exact", head: true })
      .eq("status", "cancelled"),
    fetchAllPages((from, to) =>
      supabase.from("build_assignment_members")
        .select("id, assignment_id, member_id, assigned_by, assigned_at, status, reward_points_snapshot, updated_at")
        .in("status", ACTIVE_STATUSES)
        .range(from, to)),
  ]);
  if ([totalResult, publishedResult, draftResult, archivedResult, assignedResult, reviewResult,
    changesResult, approvedResult, cancelledResult].some((result) => result.error)) {
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
  const publishedTasks = publishedResult.count ?? 0;
  const reviewQueueCount = reviewResult.count ?? 0;
  return {
    totalTasks: totalResult.count ?? 0,
    publishedTasks,
    unpublishedTasks: (draftResult.count ?? 0) + (archivedResult.count ?? 0),
    draftTasks: draftResult.count ?? 0,
    archivedTasks: archivedResult.count ?? 0,
    assignedWorkItems: assignedResult.count ?? 0,
    submittedWorkItems: reviewQueueCount,
    cancelledWorkItems: cancelledResult.count ?? 0,
    reviewQueueCount,
    activeTasks: publishedTasks,
    awaitingReview: reviewQueueCount,
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
  if (filters.publicationState !== undefined
    && !readPublicationState(filters.publicationState)) {
    throw new BuildProveValidationError();
  }
  const supabase = await createClient();
  const assignments = await fetchAllPages((from, to) => {
    let query = supabase.from("build_assignments")
      .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, sort_order, created_at, updated_at");
    if (filters.domain) query = query.eq("domain", filters.domain);
    if (filters.publicationState) query = query.eq("publication_state", filters.publicationState);
    return query.order("created_at", { ascending: false }).range(from, to);
  });
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
      || (filters.publicationState && task.publicationState !== filters.publicationState)
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
  if (typeof assignmentId !== "string" || !BUILD_EVIDENCE_UUID.test(assignmentId)) {
    throw new BuildProveValidationError();
  }
  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("build_assignments")
    .select("id, slug, title, summary, objective, difficulty, domain, assignment_scope, publication_state, deadline_at, priority, requirements, deliverables, submission_requirements, evaluation_criteria, reward_points, sort_order, created_at, updated_at")
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
  const [reviews, evidence, rewards] = await Promise.all([
    loadReviews(supabase, submissionIds),
    loadEvidence(supabase, submissionIds),
    workItemIds.length
      ? fetchAllPages((from, to) =>
        supabase.from("build_submission_rewards")
          .select("work_item_id, points_awarded, awarded_at")
          .in("work_item_id", workItemIds)
          .range(from, to))
      : Promise.resolve([]),
  ]);
  const rewardByWorkItem = new Map(rewards.map((reward) => [reward.work_item_id, reward]));
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
        rewardPointsAwarded: rewardByWorkItem.get(workItem.id)?.points_awarded ?? null,
        rewardAwardedAt: rewardByWorkItem.get(workItem.id)?.awarded_at ?? null,
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
  const latestRevisions = [...latestByWorkItem.values()];
  const latestSubmissionIds = latestRevisions.map((row) => row.id);
  const [reviews, evidence] = await Promise.all([
    loadReviews(supabase, latestSubmissionIds),
    loadEvidence(supabase, latestSubmissionIds),
  ]);
  const reviewedSubmissionIds = new Set(reviews.map((review) => review.submission_id));
  const evidenceCountBySubmission = new Map<string, number>();
  for (const item of evidence) {
    if (item.submission_id) {
      evidenceCountBySubmission.set(
        item.submission_id,
        (evidenceCountBySubmission.get(item.submission_id) ?? 0) + 1,
      );
    }
  }
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
      submissionSummary: latest.explanation.length > 280
        ? `${latest.explanation.slice(0, 277).trimEnd()}...`
        : latest.explanation,
      evidenceCount: evidenceCountBySubmission.get(latest.id) ?? 0,
    }];
  });
}
