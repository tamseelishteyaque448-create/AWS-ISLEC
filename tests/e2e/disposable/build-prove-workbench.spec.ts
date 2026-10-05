import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "./fixtures/roles";

test.describe.configure({ timeout: 240_000 });

const BUCKET = "build-prove-private";
const EVIDENCE_URL = "/api/member/build-prove/evidence";
const REFERENCE_URL = "/api/member/build-prove/references";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_BYTES = Buffer.from("%PDF-1.7\nlocal Build & Prove workbench test\n");
const VIEWPORT_WIDTHS = [320, 360, 390, 412, 768, 1024, 1440];

type LocalRole = "CONTRIBUTOR" | "OWNER" | "ADMIN";

function localRoleClient(role: LocalRole) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!url || !key || !email || !password) {
    throw new Error(`Missing disposable local ${role} runtime credentials.`);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(role: LocalRole) {
  const client = localRoleClient(role);
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing local ${role} test credentials.`);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  expect(error, `Local ${role} test identity must authenticate`).toBeNull();
  if (!data.user) throw new Error(`Local ${role} test identity did not resolve.`);
  return { client, userId: data.user.id };
}

async function createTask(
  admin: ReturnType<typeof localRoleClient>,
  memberId: string,
  prefix: string,
) {
  const slug = `${prefix}-${randomUUID().replaceAll("-", "")}`;
  const { error } = await admin.rpc("save_build_assignment", {
    p_slug: slug,
    p_title: `Disposable workbench ${slug.slice(-8)}`,
    p_summary: "A local-only task used to verify the authenticated member workbench.",
    p_objective: "Complete and describe a small practical artifact.",
    p_difficulty: "easy",
    p_domain: "documentation",
    p_assignment_scope: "individual",
    p_publication_state: "published",
    p_priority: "normal",
    p_requirements: ["Explain the result", "Attach valid evidence"],
    p_deliverables: ["A concise implementation"],
    p_submission_requirements: ["Title", "Description", "Approach"],
    p_evaluation_criteria: ["Evidence is accessible to the assigned member"],
    p_reward_points: 0,
    p_member_ids: [memberId],
  });
  expect(error, "Task fixture must be created through the authorized admin RPC").toBeNull();

  const { data: assignment, error: assignmentError } = await admin
    .from("build_assignments")
    .select("id")
    .eq("slug", slug)
    .single();
  expect(assignmentError).toBeNull();
  if (!assignment) throw new Error("Local Build & Prove task fixture was not readable.");

  const { data: workItem, error: workItemError } = await admin
    .from("build_assignment_members")
    .select("id")
    .eq("assignment_id", assignment.id)
    .eq("member_id", memberId)
    .single();
  expect(workItemError).toBeNull();
  if (!workItem) throw new Error("Local Build & Prove work item was not assigned.");
  return {
    assignmentId: assignment.id,
    workItemId: workItem.id,
    slug,
    title: `Disposable workbench ${slug.slice(-8)}`,
  };
}

async function uploadReference(
  admin: ReturnType<typeof localRoleClient>,
  assignmentId: string,
) {
  const objectPath = `assignments/${assignmentId}/${randomUUID()}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, PNG_BYTES, { contentType: "image/png", upsert: false });
  expect(uploadError, "Admin reference must upload through authenticated private Storage").toBeNull();
  const { data, error } = await admin.rpc("add_build_assignment_attachment", {
    p_assignment_id: assignmentId,
    p_storage_path: objectPath,
    p_content_type: "image/png",
    p_file_size: PNG_BYTES.length,
    p_label: "Workbench reference",
  });
  expect(error, "Reference metadata must use its authorized RPC").toBeNull();
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Reference RPC did not return an attachment record.");
  }
  const attachmentId = (data as Record<string, unknown>).attachment_id;
  if (typeof attachmentId !== "string") throw new Error("Reference RPC did not return its ID.");
  return { attachmentId, objectPath };
}

async function loadLatestSubmission(
  admin: ReturnType<typeof localRoleClient>,
  workItemId: string,
) {
  const { data, error } = await admin
    .from("build_submissions")
    .select("id, revision_number")
    .eq("work_item_id", workItemId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .single();
  expect(error).toBeNull();
  if (!data) throw new Error("Submitted Build & Prove revision was not readable.");
  return data;
}

async function reviewLatestSubmission(
  admin: ReturnType<typeof localRoleClient>,
  workItemId: string,
  decision: "changes_requested" | "approved",
  feedback: string,
) {
  const latest = await loadLatestSubmission(admin, workItemId);
  const { error } = await admin.rpc("review_build_submission", {
    p_submission_id: latest.id,
    p_decision: decision,
    p_feedback: feedback,
  });
  expect(error, `Authorized local admin review (${decision}) must succeed`).toBeNull();
  return latest;
}

test("Build & Prove member workbench persists drafts, evidence, review feedback, and revisions", async ({
  contributorPage,
  ownerPage,
}) => {
  const { client: admin, userId: adminId } = await signIn("ADMIN");
  const { client: member, userId: memberId } = await signIn("CONTRIBUTOR");
  const { client: otherMember } = await signIn("OWNER");
  expect(adminId).not.toBe(memberId);

  let workItemId: string | null = null;
  let cancelledWorkItemId: string | null = null;
  let referencePath: string | null = null;
  try {
    const task = await createTask(admin, memberId, "e2e-workbench");
    workItemId = task.workItemId;
    const taskUrl = `/member/learn/tasks/${task.workItemId}`;
    const reference = await uploadReference(admin, task.assignmentId);
    referencePath = reference.objectPath;

    await contributorPage.goto(taskUrl);
    await expect(contributorPage.getByText("Assigned", { exact: true })).toBeVisible();
    await expect(contributorPage.getByText("Complete and describe a small practical artifact.")).toBeVisible();
    await expect(contributorPage.getByRole("button", { name: "Download reference" })).toBeVisible();
    for (const width of VIEWPORT_WIDTHS) {
      await contributorPage.setViewportSize({ width, height: 900 });
      expect(
        await contributorPage.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `Assigned task detail overflows at ${width}px`,
      ).toBe(true);
    }
    const referenceDownloadPromise = contributorPage.waitForEvent("download");
    await contributorPage.getByRole("button", { name: "Download reference" }).click();
    expect((await referenceDownloadPromise).suggestedFilename()).toContain("build-reference-");
    const otherReference = await ownerPage.request.get(`${REFERENCE_URL}/${reference.attachmentId}`);
    expect([403, 404]).toContain(otherReference.status());

    await contributorPage.getByRole("button", { name: "Start work" }).click();
    await expect(contributorPage.getByText("In progress", { exact: true })).toBeVisible();
    await expect(contributorPage.getByRole("heading", { name: "Your work" })).toBeVisible();
    await contributorPage.getByLabel("Submission title").fill("Revision one");
    await contributorPage.getByLabel("Description / note").fill("The initial work is documented here.");
    await contributorPage.getByLabel("Approach").fill("I organized the information into a clear guide.");
    await contributorPage.getByLabel("Technologies").fill("Markdown\nTypeScript");
    await contributorPage.getByLabel("Challenges").fill("Keeping the instructions concise.");
    await contributorPage.getByLabel("Learnings").fill("Clear examples help readers.");
    await contributorPage.getByLabel("Future improvements").fill("Add more examples.");
    await contributorPage.getByLabel("Repository link").fill("https://example.test/repository");
    await contributorPage.getByRole("button", { name: "Save draft" }).click();
    await expect(contributorPage.getByText("Your draft was saved.")).toBeVisible();
    await contributorPage.reload();
    await expect(contributorPage.getByLabel("Submission title")).toHaveValue("Revision one");
    await expect(contributorPage.getByLabel("Technologies")).toHaveValue("Markdown\nTypeScript");
    for (const width of VIEWPORT_WIDTHS) {
      await contributorPage.setViewportSize({ width, height: 900 });
      expect(
        await contributorPage.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `Editable workbench overflows at ${width}px`,
      ).toBe(true);
    }
    await contributorPage.setViewportSize({ width: 1440, height: 900 });

    await contributorPage.getByLabel("Evidence file").setInputFiles({
      name: "unsupported.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a supported evidence file"),
    });
    await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
    await expect(contributorPage.getByText("Choose a matching JPEG, PNG, WebP, or PDF file.")).toBeVisible();
    await contributorPage.getByLabel("Evidence file").setInputFiles({
      name: "initial-proof.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });
    await contributorPage.getByLabel("Caption").fill("Revision one proof");
    await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
    await expect(contributorPage.getByText("Evidence uploaded and saved.")).toBeVisible();
    await contributorPage.reload();
    await expect(contributorPage.getByText("Revision one proof")).toBeVisible();
    const renderedHtml = await contributorPage.locator("body").innerHTML();
    expect(renderedHtml).not.toContain("submissions/");
    expect(renderedHtml).not.toContain(`assignments/${task.assignmentId}/`);

    const evidenceDownloadPromise = contributorPage.waitForEvent("download");
    await contributorPage.getByRole("button", { name: "Download", exact: true }).click();
    expect((await evidenceDownloadPromise).suggestedFilename()).toContain("build-evidence-");
    contributorPage.once("dialog", (dialog) => dialog.accept());
    await contributorPage.getByRole("button", { name: "Remove" }).click();
    await expect(contributorPage.getByText("Evidence removed.")).toBeVisible();
    await contributorPage.reload();
    await expect(contributorPage.getByText("No evidence attached yet.")).toBeVisible();

    await contributorPage.getByLabel("Evidence file").setInputFiles({
      name: "submitted-proof.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });
    await contributorPage.getByLabel("Caption").fill("Immutable revision one proof");
    await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
    await expect(contributorPage.getByText("Evidence uploaded and saved.")).toBeVisible();
    contributorPage.once("dialog", (dialog) => dialog.accept());
    await contributorPage.getByRole("button", { name: "Submit for review" }).click();
    await expect(contributorPage.getByText("Your submitted revision is read-only and awaiting review.")).toBeVisible();
    await expect(contributorPage.getByLabel("Submission title")).toHaveCount(0);
    await contributorPage.reload();
    await expect(contributorPage.getByText("Revision 1: Revision one")).toBeVisible();
    await expect(contributorPage.getByText("Immutable revision one proof")).toBeVisible();
    await expect(contributorPage.getByRole("button", { name: "Remove" })).toHaveCount(0);

    const baseURL = process.env.E2E_BASE_URL;
    if (!baseURL) throw new Error("Local disposable app URL is missing.");
    const anonymous = await request.newContext({ baseURL });
    try {
      const submittedRevisionOne = await loadLatestSubmission(admin, task.workItemId);
      const { data: revisionOneEvidence, error: revisionOneError } = await admin
        .from("build_submission_evidence")
        .select("id, draft_id, submission_id")
        .eq("submission_id", submittedRevisionOne.id)
        .eq("caption", "Immutable revision one proof")
        .single();
      expect(revisionOneError).toBeNull();
      if (!revisionOneEvidence) throw new Error("Submitted evidence metadata was not readable.");

      const anonEvidence = await anonymous.get(`${EVIDENCE_URL}/${revisionOneEvidence.id}`);
      expect(anonEvidence.status()).toBe(401);
      const crossOwnerEvidence = await ownerPage.request.get(`${EVIDENCE_URL}/${revisionOneEvidence.id}`);
      expect([403, 404]).toContain(crossOwnerEvidence.status());

      const firstSubmission = await reviewLatestSubmission(
        admin,
        task.workItemId,
        "changes_requested",
        "Please add one concrete example and explain the decision.",
      );
      await contributorPage.reload();
      await expect(contributorPage.getByRole("heading", { name: "Reviewer feedback" })).toBeVisible();
      await expect(
        contributorPage.locator(".build-review-feedback")
          .getByText("Please add one concrete example and explain the decision."),
      ).toBeVisible();
      await expect(contributorPage.getByLabel("Submission title")).toHaveValue("Revision one");
      await expect(contributorPage.getByText("Revision 1: Revision one")).toBeVisible();

      await contributorPage.getByLabel("Submission title").fill("Revision two");
      await contributorPage.getByLabel("Description / note").fill("The new revision adds the requested example.");
      await contributorPage.getByLabel("Approach").fill("I added a concrete example without changing the prior revision.");
      await contributorPage.getByRole("button", { name: "Save draft" }).click();
      await expect(contributorPage.getByText("Saved draft · revision 2")).toBeVisible();
      await contributorPage.reload();
      await expect(contributorPage.getByLabel("Submission title")).toHaveValue("Revision two");
      await expect(contributorPage.getByText("Revision 1: Revision one")).toBeVisible();

      await contributorPage.getByLabel("Evidence file").setInputFiles({
        name: "revision-two-proof.pdf",
        mimeType: "application/pdf",
        buffer: PDF_BYTES,
      });
      await contributorPage.getByLabel("Caption").fill("Revision two proof");
      await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
      await expect(contributorPage.getByText("Evidence uploaded and saved.")).toBeVisible();
      const { data: revisionTwoDraft, error: draftError } = await admin
        .from("build_submission_drafts")
        .select("id, revision_number")
        .eq("work_item_id", task.workItemId)
        .eq("state", "open")
        .single();
      expect(draftError).toBeNull();
      expect(revisionTwoDraft?.revision_number).toBe(2);
      if (!revisionTwoDraft) throw new Error("Revision two draft was not persisted.");
      const { data: revisionTwoEvidence, error: revisionTwoEvidenceError } = await admin
        .from("build_submission_evidence")
        .select("id, draft_id, submission_id")
        .eq("draft_id", revisionTwoDraft.id);
      expect(revisionTwoEvidenceError).toBeNull();
      expect(revisionTwoEvidence).toHaveLength(1);
      expect(revisionTwoEvidence?.[0].submission_id).toBeNull();
      expect(revisionTwoEvidence?.[0].id).not.toBe(revisionOneEvidence.id);

      contributorPage.once("dialog", (dialog) => dialog.accept());
      await contributorPage.getByRole("button", { name: "Resubmit for review" }).click();
      await expect(contributorPage.getByText("Your submitted revision is read-only and awaiting review.")).toBeVisible();
      await contributorPage.reload();
      await expect(contributorPage.getByText("Resubmitted", { exact: true })).toBeVisible();
      await expect(contributorPage.getByText("Revision 1: Revision one")).toBeVisible();
      await expect(contributorPage.getByText("Revision 2: Revision two")).toBeVisible();
      await expect(contributorPage.getByText("Revision two proof")).toBeVisible();
      const secondSubmission = await reviewLatestSubmission(
        admin,
        task.workItemId,
        "approved",
        "Approved after the requested example was added.",
      );
      expect(secondSubmission.revision_number).toBe(2);
      expect(firstSubmission.id).not.toBe(secondSubmission.id);
      await contributorPage.reload();
      await expect(contributorPage.getByRole("heading", { name: "Work approved" })).toBeVisible();
      await expect(contributorPage.getByLabel("Submission title")).toHaveCount(0);
      await expect(contributorPage.getByRole("button", { name: "Remove" })).toHaveCount(0);
      await expect(contributorPage.getByText("Revision 1: Revision one")).toBeVisible();
      await expect(contributorPage.getByText("Revision 2: Revision two")).toBeVisible();
    } finally {
      await anonymous.dispose();
    }

    const otherMemberPage = await ownerPage.goto(taskUrl);
    expect(otherMemberPage?.status()).toBeLessThan(500);
    await expect(ownerPage.getByRole("heading", { name: task.title })).toHaveCount(0);
    await expect(ownerPage.getByLabel("Submission title")).toHaveCount(0);
    await expect(ownerPage.getByText("Revision one")).toHaveCount(0);

    const cancelledTask = await createTask(admin, memberId, "e2e-workbench-cancelled");
    cancelledWorkItemId = cancelledTask.workItemId;
    await contributorPage.goto(`/member/learn/tasks/${cancelledTask.workItemId}`);
    await contributorPage.getByRole("button", { name: "Start work" }).click();
    await contributorPage.getByLabel("Submission title").fill("Cancelled draft");
    await contributorPage.getByLabel("Description / note").fill("This draft must become unavailable.");
    await contributorPage.getByLabel("Approach").fill("This work is intentionally cancelled in the local test.");
    await contributorPage.getByRole("button", { name: "Save draft" }).click();
    await expect(contributorPage.getByText("Your draft was saved.")).toBeVisible();
    await contributorPage.getByLabel("Evidence file").setInputFiles({
      name: "cancelled-proof.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });
    await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
    await expect(contributorPage.getByText("Evidence uploaded and saved.")).toBeVisible();
    const { data: cancelledDraft, error: cancelledDraftError } = await admin
      .from("build_submission_drafts")
      .select("id")
      .eq("work_item_id", cancelledTask.workItemId)
      .eq("state", "open")
      .single();
    expect(cancelledDraftError).toBeNull();
    if (!cancelledDraft) throw new Error("Cancelled test draft was not readable.");
    const { data: cancelledEvidence, error: cancelledEvidenceError } = await admin
      .from("build_submission_evidence")
      .select("id")
      .eq("draft_id", cancelledDraft.id)
      .single();
    expect(cancelledEvidenceError).toBeNull();
    if (!cancelledEvidence) throw new Error("Cancelled test evidence was not readable.");
    const { error: cancellationError } = await admin.rpc("cancel_build_work_item", {
      p_work_item_id: cancelledTask.workItemId,
    });
    expect(cancellationError).toBeNull();
    const forbiddenRequests: string[] = [];
    const recordPrivateRequest = (url: string) => {
      if (url.includes(EVIDENCE_URL) || url.includes("/storage/v1/")) forbiddenRequests.push(url);
    };
    contributorPage.on("request", (request) => recordPrivateRequest(request.url()));
    const cancelledResponse = await contributorPage.goto(
      `/member/learn/tasks/${cancelledTask.workItemId}`,
    );
    expect(cancelledResponse?.status()).toBeLessThan(500);
    await expect(contributorPage.getByRole("heading", { name: cancelledTask.title })).toHaveCount(0);
    await expect(contributorPage.getByLabel("Submission title")).toHaveCount(0);
    expect(forbiddenRequests).toEqual([]);
    const cancelledMemberEvidence = await member
      .from("build_submission_evidence")
      .select("id")
      .eq("id", cancelledEvidence.id);
    expect(cancelledMemberEvidence.error).toBeNull();
    expect(cancelledMemberEvidence.data).toHaveLength(0);
    const anonymousContext = await request.newContext({ baseURL });
    try {
      expect((await anonymousContext.get(`${EVIDENCE_URL}/${cancelledEvidence.id}`)).status()).toBe(401);
    } finally {
      await anonymousContext.dispose();
    }
  } finally {
    if (workItemId) await admin.rpc("cancel_build_work_item", { p_work_item_id: workItemId });
    if (cancelledWorkItemId) {
      await admin.rpc("cancel_build_work_item", { p_work_item_id: cancelledWorkItemId });
    }
    if (referencePath) await admin.storage.from(BUCKET).remove([referencePath]);
    await Promise.all([admin.auth.signOut(), member.auth.signOut(), otherMember.auth.signOut()]);
  }
});
