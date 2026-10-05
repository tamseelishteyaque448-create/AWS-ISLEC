import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { expect, test } from "./fixtures/roles";
import { expectLocalDisposableTarget } from "./fixtures/target";

test.describe.configure({ timeout: 300_000 });

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type LocalRole = "ADMIN" | "CONTRIBUTOR" | "NON_ADMIN";

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

function rpcRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object from the local Build & Prove RPC.");
  }
  return value as Record<string, unknown>;
}

async function signIn(client: ReturnType<typeof localRoleClient>, role: LocalRole) {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing disposable ${role} credentials.`);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  expect(error, `Local ${role} identity must authenticate`).toBeNull();
  if (!data.user) throw new Error(`Local ${role} identity did not resolve.`);
  return data.user.id;
}

async function createTask(
  admin: ReturnType<typeof localRoleClient>,
  memberId: string,
  taskTitle: string,
  slug: string,
) {
  const { data, error } = await admin.rpc("save_build_assignment", {
    p_slug: slug,
    p_title: taskTitle,
    p_summary: "Disposable Phase 6 review workflow.",
    p_objective: "Submit, revise, and approve one practical artifact.",
    p_difficulty: "easy",
    p_domain: "documentation",
    p_assignment_scope: "individual",
    p_publication_state: "published",
    p_deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    p_priority: "high",
    p_requirements: ["Provide a clear explanation"],
    p_deliverables: ["A documented artifact"],
    p_submission_requirements: ["Title", "Explanation"],
    p_evaluation_criteria: ["Clear, useful explanation"],
    p_reward_points: 37,
    p_member_ids: [memberId],
  });
  expect(error, "Task fixture must be created through the authorized admin RPC").toBeNull();
  const assignmentId = rpcRecord(data).assignment_id;
  if (typeof assignmentId !== "string") throw new Error("Task creation returned no assignment ID.");

  const { data: workItem, error: workItemError } = await admin
    .from("build_assignment_members")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("member_id", memberId)
    .single();
  expect(workItemError).toBeNull();
  if (!workItem) throw new Error("Task fixture did not create its member work item.");
  return { assignmentId, workItemId: workItem.id };
}

async function submitThroughRpc(
  member: ReturnType<typeof localRoleClient>,
  workItemId: string,
) {
  const { error: startError } = await member.rpc("start_build_assignment", {
    p_work_item_id: workItemId,
  });
  expect(startError, "Member must start the assigned work through its RPC").toBeNull();
  const { data: draftData, error: draftError } = await member.rpc("save_build_submission_draft", {
    p_work_item_id: workItemId,
    p_project_title: "Cancelled work submission",
    p_explanation: "This submission exists only to verify cancellation blocks review.",
    p_approach: "Created using the member-owned draft RPC.",
  });
  expect(draftError).toBeNull();
  const draftId = rpcRecord(draftData).draft_id;
  if (typeof draftId !== "string") throw new Error("Draft RPC returned no identifier.");
  const { error: submitError } = await member.rpc("submit_build_submission_draft", {
    p_draft_id: draftId,
  });
  expect(submitError, "Member must submit through the existing revision RPC").toBeNull();
}

test("Build & Prove completes SUBMITTED → CHANGES_REQUESTED → RESUBMITTED → APPROVED", async ({
  adminPage,
  contributorPage,
  nonAdminPage,
}) => {
  await Promise.all([
    expectLocalDisposableTarget(adminPage),
    expectLocalDisposableTarget(contributorPage),
    expectLocalDisposableTarget(nonAdminPage),
  ]);
  const admin = localRoleClient("ADMIN");
  const member = localRoleClient("CONTRIBUTOR");
  const nonAdmin = localRoleClient("NON_ADMIN");
  const anonymous = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const testKey = randomUUID().replaceAll("-", "");
  const taskTitle = `Phase 6 review ${testKey.slice(-8)}`;
  const slug = `phase-6-review-${testKey}`;
  const cancelledTaskTitle = `Phase 6 cancelled ${testKey.slice(-8)}`;
  const cancelledSlug = `phase-6-cancelled-${testKey}`;
  const taskIds: string[] = [];
  const submissionIds: string[] = [];
  let mainWorkItemId: string | null = null;

  console.log(`PHASE6_TASK_SLUG=${slug}`);
  console.log(`PHASE6_CANCELLED_TASK_SLUG=${cancelledSlug}`);

  try {
    const [adminId, memberId, nonAdminId] = await Promise.all([
      signIn(admin, "ADMIN"),
      signIn(member, "CONTRIBUTOR"),
      signIn(nonAdmin, "NON_ADMIN"),
    ]);
    expect(adminId).not.toBe(memberId);
    expect(nonAdminId).not.toBe(adminId);
    const { data: initialProfile, error: initialProfileError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(initialProfileError).toBeNull();
    if (!initialProfile) throw new Error("Could not read the member's initial points.");
    const pointsBefore = initialProfile.points;
    const { data: memberProfile, error: memberProfileError } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", memberId)
      .single();
    expect(memberProfileError).toBeNull();
    if (!memberProfile) throw new Error("Could not resolve the assigned member profile.");
    await contributorPage.goto("/member");
    await expect(contributorPage.getByRole("link", {
      name: `Open profile for ${memberProfile.full_name}`,
    })).toBeVisible({ timeout: 10_000 });

    const mainTask = await createTask(admin, memberId, taskTitle, slug);
    taskIds.push(mainTask.assignmentId);
    mainWorkItemId = mainTask.workItemId;
    console.log(`PHASE6_TASK_ID=${mainTask.assignmentId}`);
    console.log(`PHASE6_WORK_ITEM_ID=${mainTask.workItemId}`);

    await contributorPage.goto(`/member/learn/tasks/${mainTask.workItemId}`);
    await contributorPage.getByRole("button", { name: "Start work" }).click({ timeout: 10_000 });
    await contributorPage.getByLabel("Submission title").fill("Revision one");
    await contributorPage.getByLabel("Description / note").fill("Initial explanation awaiting review.");
    await contributorPage.getByLabel("Approach").fill("A concise first attempt.");
    await contributorPage.getByRole("button", { name: "Save draft" }).click();
    await expect(contributorPage.getByLabel("Caption (optional)")).toBeEnabled({ timeout: 30_000 });
    await contributorPage.getByLabel("Evidence file").setInputFiles({
      name: "phase-six-revision-one.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });
    await contributorPage.getByLabel("Caption").fill("Revision one evidence");
    await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
    await expect(contributorPage.getByText("Evidence uploaded and saved."))
      .toBeVisible({ timeout: 30_000 });
    contributorPage.once("dialog", (dialog) => dialog.accept());
    await contributorPage.getByRole("button", { name: "Submit for review" }).click();
    await expect.poll(async () => {
      const { data, error } = await admin
        .from("build_assignment_members")
        .select("status")
        .eq("id", mainTask.workItemId)
        .single();
      return error ? "error" : data.status;
    }, { timeout: 30_000 }).toBe("submitted");
    await contributorPage.reload();
    await expect(
      contributorPage.getByText("Your submitted revision is read-only and awaiting review."),
    ).toBeVisible();
    const { data: revisionOne, error: revisionOneError } = await admin
      .from("build_submissions")
      .select("id, revision_number")
      .eq("work_item_id", mainTask.workItemId)
      .single();
    expect(revisionOneError).toBeNull();
    if (!revisionOne) throw new Error("Revision one was not persisted.");
    expect(revisionOne.revision_number).toBe(1);
    submissionIds.push(revisionOne.id);

    await adminPage.goto("/admin/build-prove/review");
    const firstQueueRow = adminPage.locator(".admin-build-review-row")
      .filter({ hasText: taskTitle });
    await expect(firstQueueRow).toContainText("revision 1");
    await expect(firstQueueRow).toContainText("Initial explanation awaiting review.");
    await expect(firstQueueRow).toContainText("1 evidence file");
    await expect(firstQueueRow).toContainText("high priority");
    await expect(firstQueueRow).toContainText("Due");

    const { error: nonAdminReviewError } = await nonAdmin.rpc("review_build_submission", {
      p_submission_id: revisionOne.id,
      p_decision: "changes_requested",
      p_feedback: "Unauthorized review attempt.",
    });
    expect(nonAdminReviewError?.code).toBe("42501");
    const { error: anonymousReviewError } = await anonymous.rpc("review_build_submission", {
      p_submission_id: revisionOne.id,
      p_decision: "changes_requested",
      p_feedback: "Anonymous review attempt.",
    });
    expect(anonymousReviewError?.code).toBe("42501");

    await firstQueueRow.getByRole("link", { name: "Review" }).click();
    await expect(adminPage).toHaveURL(
      new RegExp(`/admin/build-prove/tasks/${mainTask.assignmentId}#review-${mainTask.workItemId}$`),
      { timeout: 60_000 },
    );
    const revisionOneReview = adminPage.locator(`#review-${mainTask.workItemId}`);
    await expect(revisionOneReview.getByText("Revision one evidence")).toBeVisible();
    await expect(revisionOneReview.getByText("Initial explanation awaiting review.")).toBeVisible();
    await expect(revisionOneReview.getByText("37 points snapshot")).toBeVisible();
    const renderedAdminHtml = await revisionOneReview.innerHTML();
    expect(renderedAdminHtml).not.toContain("submissions/");
    expect(renderedAdminHtml).not.toContain("storage_path");
    const evidenceDownload = adminPage.waitForEvent("download");
    await revisionOneReview.getByRole("link", { name: "Download evidence" }).click();
    expect((await evidenceDownload).suggestedFilename()).toContain("build-evidence-");

    await revisionOneReview.getByRole("radio", { name: "Request changes" }).check();
    await revisionOneReview.getByLabel("Feedback (required)")
      .fill("Please add one concrete example and explain why it supports the result.");
    await revisionOneReview.getByRole("button", { name: "Request changes" }).click();
    await expect(revisionOneReview.locator(
      ":scope > .admin-build-section-heading > .admin-build-status",
    ))
      .toHaveText("Changes requested");
    await expect(revisionOneReview.getByText(
      "Please add one concrete example and explain why it supports the result.",
    )).toBeVisible();

    await contributorPage.reload();
    await expect(contributorPage.getByRole("heading", { name: "Reviewer feedback" })).toBeVisible();
    await expect(contributorPage.locator(".build-review-feedback").getByText(
      "Please add one concrete example and explain why it supports the result.",
    )).toBeVisible();
    await expect(contributorPage.getByLabel("Submission title")).toHaveValue("Revision one");
    await contributorPage.getByLabel("Submission title").fill("Revision two");
    await contributorPage.getByLabel("Description / note")
      .fill("Updated explanation with the requested concrete example.");
    await contributorPage.getByLabel("Approach").fill("The example now supports the documented result.");
    await contributorPage.getByRole("button", { name: "Save draft" }).click();
    await expect(contributorPage.getByText("Saved draft · revision 2")).toBeVisible();
    await contributorPage.getByLabel("Evidence file").setInputFiles({
      name: "phase-six-revision-two.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });
    await contributorPage.getByLabel("Caption").fill("Revision two evidence");
    await contributorPage.getByRole("button", { name: "Upload evidence" }).click();
    await expect(contributorPage.getByText("Evidence uploaded and saved.")).toBeVisible();
    contributorPage.once("dialog", (dialog) => dialog.accept());
    await contributorPage.getByRole("button", { name: "Resubmit for review" }).click();
    await expect.poll(async () => {
      const { data, error } = await admin
        .from("build_assignment_members")
        .select("status")
        .eq("id", mainTask.workItemId)
        .single();
      return error ? "error" : data.status;
    }, { timeout: 30_000 }).toBe("resubmitted");
    await contributorPage.reload();
    await expect(
      contributorPage.getByText("Your submitted revision is read-only and awaiting review."),
    ).toBeVisible();

    const { data: revisionRows, error: revisionRowsError } = await admin
      .from("build_submissions")
      .select("id, revision_number, explanation")
      .eq("work_item_id", mainTask.workItemId)
      .order("revision_number", { ascending: true });
    expect(revisionRowsError).toBeNull();
    expect(revisionRows).toHaveLength(2);
    if (!revisionRows || revisionRows.length !== 2) throw new Error("Expected two immutable revisions.");
    expect(revisionRows[0].explanation).toBe("Initial explanation awaiting review.");
    expect(revisionRows[1].revision_number).toBe(2);
    submissionIds.push(revisionRows[1].id);

    await adminPage.goto("/admin/build-prove/review");
    const latestQueueRow = adminPage.locator(".admin-build-review-row")
      .filter({ hasText: taskTitle });
    await expect(latestQueueRow).toContainText("revision 2");
    await expect(latestQueueRow).toContainText("Updated explanation with the requested concrete example.");
    await expect(latestQueueRow).toContainText("1 evidence file");
    await expect(latestQueueRow).not.toContainText("revision 1");
    await expect(adminPage.locator(".admin-build-review-row").filter({ hasText: taskTitle }))
      .toHaveCount(1);

    const { error: staleReviewError } = await admin.rpc("review_build_submission", {
      p_submission_id: revisionOne.id,
      p_decision: "approved",
      p_feedback: "Stale revision must be rejected.",
    });
    expect(staleReviewError?.code).toBe("PT409");
    await expect(latestQueueRow).toContainText("revision 2");
    await latestQueueRow.getByRole("link", { name: "Review" }).click();
    const revisionTwoReview = adminPage.locator(`#review-${mainTask.workItemId}`);
    await expect(revisionTwoReview.getByText("Revision two evidence")).toBeVisible();
    await expect(revisionTwoReview.getByText(
      "Please add one concrete example and explain why it supports the result.",
    )).toBeVisible();
    await expect(revisionTwoReview.getByText("Initial explanation awaiting review.")).toBeVisible();
    await expect(revisionTwoReview.getByText("Updated explanation with the requested concrete example."))
      .toBeVisible();
    const [, concurrentApproval] = await Promise.all([
      revisionTwoReview.getByRole("button", { name: "Approve submission" }).click(),
      admin.rpc("review_build_submission", {
        p_submission_id: revisionRows[1].id,
        p_decision: "approved",
        p_feedback: "Concurrent approval retry.",
      }),
    ]);
    expect(concurrentApproval.error).toBeNull();
    const concurrentApprovalResult = rpcRecord(concurrentApproval.data);
    expect(concurrentApprovalResult).toMatchObject({
      status: "approved",
      points_awarded: 37,
    });
    expect(["awarded", "already_awarded"]).toContain(concurrentApprovalResult.reward_status);
    expect(concurrentApprovalResult.idempotent).toBe(
      concurrentApprovalResult.reward_status === "already_awarded",
    );
    await expect(revisionTwoReview.locator(
      ":scope > .admin-build-section-heading > .admin-build-status",
    ))
      .toHaveText("Approved");

    const { data: duplicateResult, error: duplicateError } = await admin.rpc("review_build_submission", {
      p_submission_id: revisionRows[1].id,
      p_decision: "approved",
      p_feedback: "Duplicate approval retry.",
    });
    expect(duplicateError).toBeNull();
    expect(rpcRecord(duplicateResult)).toMatchObject({
      status: "approved",
      idempotent: true,
      reward_status: "already_awarded",
      points_awarded: 37,
    });
    const { data: rewardRows, error: rewardRowsError } = await admin
      .from("build_submission_rewards")
      .select("id, submission_id, profile_id, points_awarded, awarded_by")
      .eq("work_item_id", mainTask.workItemId);
    expect(rewardRowsError).toBeNull();
    expect(rewardRows).toHaveLength(1);
    expect(rewardRows?.[0]).toMatchObject({
      submission_id: revisionRows[1].id,
      profile_id: memberId,
      points_awarded: 37,
      awarded_by: adminId,
    });
    const { data: rewardActivities, error: rewardActivitiesError } = await admin
      .from("activities")
      .select("id, activity_key, points")
      .eq("build_assignment_member_id", mainTask.workItemId);
    expect(rewardActivitiesError).toBeNull();
    expect(rewardActivities).toHaveLength(1);
    expect(rewardActivities?.[0].points).toBe(37);
    const { data: reviews, error: reviewsError } = await admin
      .from("build_submission_reviews")
      .select("id, submission_id, decision, feedback")
      .eq("work_item_id", mainTask.workItemId);
    expect(reviewsError).toBeNull();
    expect(reviews).toHaveLength(2);
    expect(reviews?.map((review) => review.submission_id).sort()).toEqual([...submissionIds].sort());

    await contributorPage.reload();
    await expect(contributorPage.getByRole("heading", { name: "Work approved" })).toBeVisible();
    await expect(contributorPage.getByText(
      "This task is closed for editing. 37 points were awarded.",
    )).toBeVisible();
    await expect(contributorPage.getByLabel("Submission title")).toHaveCount(0);
    const { data: finalProfile, error: finalProfileError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(finalProfileError).toBeNull();
    expect(finalProfile?.points).toBe(pointsBefore + 37);

    const cancelledTask = await createTask(admin, memberId, cancelledTaskTitle, cancelledSlug);
    taskIds.push(cancelledTask.assignmentId);
    console.log(`PHASE6_CANCELLED_TASK_ID=${cancelledTask.assignmentId}`);
    await submitThroughRpc(member, cancelledTask.workItemId);
    const { data: cancelledSubmission, error: cancelledSubmissionError } = await admin
      .from("build_submissions")
      .select("id")
      .eq("work_item_id", cancelledTask.workItemId)
      .single();
    expect(cancelledSubmissionError).toBeNull();
    if (!cancelledSubmission) throw new Error("Cancelled test submission was not created.");
    submissionIds.push(cancelledSubmission.id);
    const { error: cancellationError } = await admin.rpc("cancel_build_work_item", {
      p_work_item_id: cancelledTask.workItemId,
    });
    expect(cancellationError).toBeNull();
    const { error: cancelledReviewError } = await admin.rpc("review_build_submission", {
      p_submission_id: cancelledSubmission.id,
      p_decision: "approved",
      p_feedback: "Cancelled work must not be reviewed.",
    });
    expect(cancelledReviewError?.code).toBe("PT409");
    const { error: cancelledRewardError } = await admin.rpc("award_build_submission_reward", {
      p_work_item_id: cancelledTask.workItemId,
    });
    expect(cancelledRewardError?.code).toBe("PT409");
    const { data: cancelledReviews, error: cancelledReviewsError } = await admin
      .from("build_submission_reviews")
      .select("id")
      .eq("submission_id", cancelledSubmission.id);
    expect(cancelledReviewsError).toBeNull();
    expect(cancelledReviews).toHaveLength(0);
    await adminPage.goto("/admin/build-prove/review");
    await expect(adminPage.locator(".admin-build-review-row").filter({ hasText: cancelledTaskTitle }))
      .toHaveCount(0);
  } finally {
    console.log(`PHASE6_DISPOSABLE_TASK_IDS=${taskIds.join(",")}`);
    console.log(`PHASE6_DISPOSABLE_SUBMISSION_IDS=${submissionIds.join(",")}`);
    if (mainWorkItemId) console.log(`PHASE6_MAIN_WORK_ITEM_ID=${mainWorkItemId}`);
    await Promise.all([
      admin.auth.signOut(),
      member.auth.signOut(),
      nonAdmin.auth.signOut(),
      anonymous.auth.signOut(),
    ]);
  }
});
