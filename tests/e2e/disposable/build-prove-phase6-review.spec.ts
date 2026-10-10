import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "./fixtures/roles";
import { expectLocalDisposableTarget } from "./fixtures/target";
import { assertLegacyApprovalFixtureResult } from "./legacy-approval-query-result.mjs";

test.describe.configure({ timeout: 300_000 });

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type LocalRole = "ADMIN" | "CONTRIBUTOR" | "NON_ADMIN";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function seedLegacyApprovedWorkItem(
  adminId: string,
  workItemId: string,
  submissionId: string,
) {
  const supabaseWorkdir = process.env.E2E_SUPABASE_WORKDIR;
  if (!supabaseWorkdir) {
    throw new Error("Legacy reward fixture requires the validated disposable Supabase work directory.");
  }
  if (![adminId, workItemId, submissionId].every((id) => UUID_PATTERN.test(id))) {
    throw new Error("Legacy reward fixture requires UUID identifiers.");
  }
  const sql = `with actor as materialized (
    select set_config('request.jwt.claim.sub', '${adminId}', true)
  ), approved as (
    update public.build_assignment_members
    set status = 'approved', updated_at = timezone('utc', now())
    where id = '${workItemId}' and status = 'submitted'
    returning id
  ), inserted_review as (
    insert into public.build_submission_reviews(
      submission_id, work_item_id, reviewer_id, decision, feedback
    )
    select '${submissionId}', approved.id, '${adminId}', 'approved', 'Local legacy approval fixture.'
    from approved cross join actor
    returning id
  )
  select count(*) as inserted_reviews from inserted_review`;
  const tempDir = mkdtempSync(join(tmpdir(), "build-prove-sql-"));
  const tempSqlPath = join(tempDir, "legacy-approval.sql");
  writeFileSync(tempSqlPath, sql, "utf8");
  try {
    const output = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      [
        "supabase",
        "--workdir",
        supabaseWorkdir,
        "--agent",
        "yes",
        "db",
        "query",
        "--local",
        "--file",
        tempSqlPath,
      ],
      {
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: 30_000,
        windowsHide: true,
      },
    );
    assertLegacyApprovalFixtureResult(output);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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
  rewardPoints = 37,
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
    p_reward_points: rewardPoints,
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
  projectTitle = "Cancelled work submission",
) {
  const { error: startError } = await member.rpc("start_build_assignment", {
    p_work_item_id: workItemId,
  });
  expect(startError, "Member must start the assigned work through its RPC").toBeNull();
  const { data: draftData, error: draftError } = await member.rpc("save_build_submission_draft", {
    p_work_item_id: workItemId,
    p_project_title: projectTitle,
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
  page,
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
  const legacyTaskTitle = `Phase 7B legacy reward ${testKey.slice(-8)}`;
  const revisionTwoTitle = `Revision two ${testKey.slice(-8)}`;
  const legacySlug = `phase-7b-legacy-reward-${testKey}`;
  const taskIds: string[] = [];
  const submissionIds: string[] = [];
  const workItemIds: string[] = [];
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
    await page.goto("/");
    await expectLocalDisposableTarget(page);
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
    workItemIds.push(mainTask.workItemId);
    console.log(`PHASE6_TASK_ID=${mainTask.assignmentId}`);
    console.log(`PHASE6_WORK_ITEM_ID=${mainTask.workItemId}`);
    const { error: assignedAwardError } = await admin.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(assignedAwardError?.code).toBe("PT409");
    const { error: assignedMemberAwardError } = await member.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(assignedMemberAwardError?.code).toBe("42501");
    const { error: assignedNonAdminAwardError } = await nonAdmin.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(assignedNonAdminAwardError?.code).toBe("42501");
    const { error: assignedAnonymousAwardError } = await anonymous.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(assignedAnonymousAwardError?.code).toBe("42501");
    await page.goto(`/admin/build-prove/tasks/${mainTask.assignmentId}`);
    await expect(page).toHaveURL(/\/join\?mode=login&next=/);
    await nonAdminPage.goto(`/admin/build-prove/tasks/${mainTask.assignmentId}`);
    await expect(nonAdminPage).toHaveURL(/\/member$/);

    await contributorPage.goto(`/member/learn/tasks/${mainTask.workItemId}`);
    await contributorPage.getByRole("button", { name: "Start work" }).click({ timeout: 10_000 });
    const { error: inProgressAwardError } = await admin.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(inProgressAwardError?.code).toBe("PT409");
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
    const { error: submittedAwardError } = await admin.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(submittedAwardError?.code).toBe("PT409");
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
    const { error: changesRequestedAwardError } = await admin.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(changesRequestedAwardError?.code).toBe("PT409");

    await contributorPage.reload();
    await expect(contributorPage.getByRole("heading", { name: "Reviewer feedback" })).toBeVisible();
    await expect(contributorPage.locator(".build-review-feedback").getByText(
      "Please add one concrete example and explain why it supports the result.",
    )).toBeVisible();
    await expect(contributorPage.getByLabel("Submission title")).toHaveValue("Revision one");
    await contributorPage.getByLabel("Submission title").fill(revisionTwoTitle);
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
    const { error: resubmittedAwardError } = await admin.rpc("award_build_submission_reward", {
      p_work_item_id: mainTask.workItemId,
    });
    expect(resubmittedAwardError?.code).toBe("PT409");
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
    await expect(revisionTwoReview)
      .toContainText("Reward awarded: 37 points");

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
    await expect(contributorPage.getByText("Your work was approved. You earned 37 points."))
      .toBeVisible();
    await expect(contributorPage.getByText(
      "Any points awarded for Build & Prove work are added to your existing points total on your profile and leaderboard.",
    )).toBeVisible();
    await expect(contributorPage.getByLabel("Submission title")).toHaveCount(0);
    const { data: finalProfile, error: finalProfileError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(finalProfileError).toBeNull();
    expect(finalProfile?.points).toBe(pointsBefore + 37);
    await expect(contributorPage.getByText(/Reward recorded on/)).toBeVisible();

    await contributorPage.goto("/member");
    const recentMainReward = contributorPage.locator(".list-item").filter({ hasText: revisionTwoTitle });
    await expect(recentMainReward).toContainText("+37");

    await contributorPage.goto("/member/activities");
    const rewardActivity = contributorPage.locator(".activity-timeline-item")
      .filter({ hasText: revisionTwoTitle });
    await expect(rewardActivity.getByText("Build & Prove", { exact: true })).toBeVisible();
    await expect(rewardActivity).toContainText("+37");

    await contributorPage.goto("/member/leaderboard");
    await expect(contributorPage.locator(".leaderboard-summary"))
      .toContainText(`${(pointsBefore + 37).toLocaleString()} points earned`);
    await contributorPage.goto("/member/profile");
    await expect(contributorPage.getByRole("heading", { name: "Points" }).locator(".."))
      .toContainText((pointsBefore + 37).toLocaleString());

    await adminPage.goto(`/admin/build-prove/tasks/${mainTask.assignmentId}`);
    const approvedAdminWork = adminPage.locator(`#review-${mainTask.workItemId}`);
    await expect(approvedAdminWork).toContainText("Reward awarded: 37 points");
    await expect(approvedAdminWork.getByRole("button", { name: "Award reward" })).toHaveCount(0);

    const cancelledTask = await createTask(admin, memberId, cancelledTaskTitle, cancelledSlug);
    taskIds.push(cancelledTask.assignmentId);
    workItemIds.push(cancelledTask.workItemId);
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

    const legacyTask = await createTask(admin, memberId, legacyTaskTitle, legacySlug);
    taskIds.push(legacyTask.assignmentId);
    workItemIds.push(legacyTask.workItemId);
    console.log(`PHASE7B_LEGACY_TASK_ID=${legacyTask.assignmentId}`);
    console.log(`PHASE7B_LEGACY_WORK_ITEM_ID=${legacyTask.workItemId}`);
    await submitThroughRpc(member, legacyTask.workItemId, legacyTaskTitle);
    const { data: legacySubmission, error: legacySubmissionError } = await admin
      .from("build_submissions")
      .select("id")
      .eq("work_item_id", legacyTask.workItemId)
      .single();
    expect(legacySubmissionError).toBeNull();
    if (!legacySubmission) throw new Error("Legacy reward fixture submission was not created.");
    submissionIds.push(legacySubmission.id);
    const { data: beforeLegacyProfile, error: beforeLegacyProfileError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(beforeLegacyProfileError).toBeNull();
    if (!beforeLegacyProfile) throw new Error("Could not read points before the explicit award.");
    seedLegacyApprovedWorkItem(adminId, legacyTask.workItemId, legacySubmission.id);

    const { data: legacyRewardBefore, error: legacyRewardBeforeError } = await admin
      .from("build_submission_rewards")
      .select("id")
      .eq("work_item_id", legacyTask.workItemId)
      .maybeSingle();
    expect(legacyRewardBeforeError).toBeNull();
    expect(legacyRewardBefore).toBeNull();

    await contributorPage.goto(`/member/learn/tasks/${legacyTask.workItemId}`);
    await expect(contributorPage.getByRole("heading", { name: "Work approved" })).toBeVisible();
    await expect(contributorPage.getByText(
      "Your work is approved. This assignment’s configured reward of 37 points has not yet been recorded.",
    )).toBeVisible();
    const { error: legacyMemberAwardError } = await member.rpc("award_build_submission_reward", {
      p_work_item_id: legacyTask.workItemId,
    });
    expect(legacyMemberAwardError?.code).toBe("42501");
    const { error: legacyAnonymousAwardError } = await anonymous.rpc("award_build_submission_reward", {
      p_work_item_id: legacyTask.workItemId,
    });
    expect(legacyAnonymousAwardError?.code).toBe("42501");

    await page.goto(`/admin/build-prove/tasks/${legacyTask.assignmentId}`);
    await expect(page).toHaveURL(/\/join\?mode=login&next=/);
    await nonAdminPage.goto(`/admin/build-prove/tasks/${legacyTask.assignmentId}`);
    await expect(nonAdminPage).toHaveURL(/\/member$/);
    await expect(nonAdminPage.getByRole("button", { name: "Award reward" })).toHaveCount(0);

    await adminPage.goto(`/admin/build-prove/tasks/${legacyTask.assignmentId}`);
    const legacyAdminWork = adminPage.locator(`#review-${legacyTask.workItemId}`);
    await expect(legacyAdminWork).toContainText("eligible for its configured 37-point reward");
    const awardConfirmation = legacyAdminWork.getByLabel(
      "I confirm awarding the configured 37 points to this member.",
    );
    await awardConfirmation.check();
    await legacyAdminWork.getByRole("button", { name: "Award reward" }).click();
    await expect(legacyAdminWork.locator(".admin-build-message.success"))
      .toHaveText("37 reward points were awarded.");
    await expect(legacyAdminWork.getByRole("status").filter({
      hasText: "Reward awarded: 37 points",
    })).toBeVisible();
    await expect(legacyAdminWork.getByRole("button", { name: "Award reward" })).toHaveCount(0);

    const { data: legacyRewards, error: legacyRewardsError } = await admin
      .from("build_submission_rewards")
      .select("id, submission_id, profile_id, points_awarded")
      .eq("work_item_id", legacyTask.workItemId);
    expect(legacyRewardsError).toBeNull();
    expect(legacyRewards).toHaveLength(1);
    expect(legacyRewards?.[0]).toMatchObject({
      submission_id: legacySubmission.id,
      profile_id: memberId,
      points_awarded: 37,
    });
    const { data: afterLegacyProfile, error: afterLegacyProfileError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(afterLegacyProfileError).toBeNull();
    expect(afterLegacyProfile?.points).toBe(beforeLegacyProfile.points + 37);
    const { data: legacyActivities, error: legacyActivitiesError } = await admin
      .from("activities")
      .select("id, points, activity_type")
      .eq("build_assignment_member_id", legacyTask.workItemId);
    expect(legacyActivitiesError).toBeNull();
    expect(legacyActivities).toHaveLength(1);
    expect(legacyActivities?.[0]).toMatchObject({ activity_type: "build_prove", points: 37 });

    const { data: legacyRetry, error: legacyRetryError } = await admin.rpc(
      "award_build_submission_reward",
      { p_work_item_id: legacyTask.workItemId },
    );
    expect(legacyRetryError).toBeNull();
    expect(rpcRecord(legacyRetry)).toMatchObject({
      status: "already_awarded",
      idempotent: true,
      points_awarded: 37,
    });
    await adminPage.reload();
    await expect(legacyAdminWork.getByRole("button", { name: "Award reward" })).toHaveCount(0);
    await expect(legacyAdminWork).toContainText("Reward awarded: 37 points");
    const { data: afterRetryProfile, error: afterRetryProfileError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(afterRetryProfileError).toBeNull();
    expect(afterRetryProfile?.points).toBe(beforeLegacyProfile.points + 37);
    const { data: legacyActivitiesAfterRetry, error: legacyActivitiesAfterRetryError } = await admin
      .from("activities")
      .select("id")
      .eq("build_assignment_member_id", legacyTask.workItemId);
    expect(legacyActivitiesAfterRetryError).toBeNull();
    expect(legacyActivitiesAfterRetry).toHaveLength(1);

    await contributorPage.reload();
    await expect(contributorPage.getByText("Your work was approved. You earned 37 points."))
      .toBeVisible();
    await expect(contributorPage.getByText(/Reward recorded on/)).toBeVisible();
    await contributorPage.goto("/member/activities");
    const legacyRewardActivity = contributorPage.locator(".activity-timeline-item")
      .filter({ hasText: legacyTaskTitle });
    await expect(legacyRewardActivity.getByText("Build & Prove", { exact: true })).toBeVisible();
    await contributorPage.goto("/member");
    const recentLegacyReward = contributorPage.locator(".list-item").filter({ hasText: legacyTaskTitle });
    await expect(recentLegacyReward).toContainText("+37");
    await contributorPage.goto("/member/profile");
    await expect(contributorPage.getByRole("heading", { name: "Points" }).locator(".."))
      .toContainText((beforeLegacyProfile.points + 37).toLocaleString());
    await contributorPage.goto("/member/leaderboard");
    await expect(contributorPage.locator(".leaderboard-summary"))
      .toContainText(`${(beforeLegacyProfile.points + 37).toLocaleString()} points earned`);

    const zeroTaskTitle = `Phase 7B zero reward ${testKey.slice(-8)}`;
    const zeroTask = await createTask(
      admin,
      memberId,
      zeroTaskTitle,
      `phase-7b-zero-reward-${testKey}`,
      0,
    );
    taskIds.push(zeroTask.assignmentId);
    workItemIds.push(zeroTask.workItemId);
    await submitThroughRpc(member, zeroTask.workItemId, zeroTaskTitle);
    const { data: zeroSubmission, error: zeroSubmissionError } = await admin
      .from("build_submissions")
      .select("id")
      .eq("work_item_id", zeroTask.workItemId)
      .single();
    expect(zeroSubmissionError).toBeNull();
    if (!zeroSubmission) throw new Error("Zero-reward test submission was not created.");
    submissionIds.push(zeroSubmission.id);
    const { data: beforeZeroReward, error: beforeZeroRewardError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(beforeZeroRewardError).toBeNull();
    if (!beforeZeroReward) throw new Error("Could not read points before the zero-point reward.");

    await adminPage.goto("/admin/build-prove/review");
    const zeroRewardQueueRow = adminPage.locator(".admin-build-review-row")
      .filter({ hasText: zeroTaskTitle });
    await zeroRewardQueueRow.getByRole("link", { name: "Review" }).click();
    const zeroRewardReview = adminPage.locator(`#review-${zeroTask.workItemId}`);
    await zeroRewardReview.getByRole("button", { name: "Approve submission" }).click();
    await expect(zeroRewardReview.locator(
      ":scope > .admin-build-section-heading > .admin-build-status",
    )).toHaveText("Approved");

    await contributorPage.goto(`/member/learn/tasks/${zeroTask.workItemId}`);
    await expect(contributorPage.getByRole("heading", { name: "Work approved" })).toBeVisible();
    await expect(contributorPage.getByText(
      "Your work was approved. This assignment’s configured reward was 0 points, so no points were added.",
      { exact: true },
    )).toBeVisible();
    await expect(contributorPage.getByText(
      "Any points awarded for Build & Prove work are added to your existing points total on your profile and leaderboard.",
    )).toBeVisible();
    await expect(contributorPage.getByText(/0 points were awarded/)).toHaveCount(0);

    const { data: zeroRewardRows, error: zeroRewardRowsError } = await admin
      .from("build_submission_rewards")
      .select("points_awarded")
      .eq("work_item_id", zeroTask.workItemId);
    expect(zeroRewardRowsError).toBeNull();
    expect(zeroRewardRows).toEqual([{ points_awarded: 0 }]);
    const { data: afterZeroReward, error: afterZeroRewardError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", memberId)
      .single();
    expect(afterZeroRewardError).toBeNull();
    expect(afterZeroReward?.points).toBe(beforeZeroReward.points);

    await contributorPage.goto("/member/activities");
    const zeroRewardActivity = contributorPage.locator(".activity-timeline-item")
      .filter({ hasText: zeroTaskTitle });
    await expect(zeroRewardActivity).toHaveCount(1);
    await expect(zeroRewardActivity.getByText("Build & Prove", { exact: true })).toBeVisible();
    await expect(zeroRewardActivity.locator(".activity-timeline-points")).toHaveText("0 points");
    await expect(zeroRewardActivity.locator(".activity-timeline-points")).not.toHaveText("+0");
    await contributorPage.goto("/member");
    const recentZeroReward = contributorPage.locator(".list-item").filter({ hasText: zeroTaskTitle });
    await expect(recentZeroReward).toHaveCount(1);
    await expect(recentZeroReward.getByText("0 points", { exact: true })).toBeVisible();
    await expect(recentZeroReward.getByText("+0", { exact: true })).toHaveCount(0);
    await contributorPage.goto("/member/profile");
    await expect(contributorPage.getByRole("heading", { name: "Points" }).locator(".."))
      .toContainText(beforeZeroReward.points.toLocaleString());
    await contributorPage.goto("/member/leaderboard");
    await expect(contributorPage.locator(".leaderboard-summary"))
      .toContainText(`${beforeZeroReward.points.toLocaleString()} points earned`);

    await adminPage.goto("/admin/build-prove/review");
    await expect(adminPage.locator(".admin-build-review-row").filter({ hasText: cancelledTaskTitle }))
      .toHaveCount(0);
  } finally {
    console.log(`PHASE6_DISPOSABLE_TASK_IDS=${taskIds.join(",")}`);
    console.log(`PHASE6_DISPOSABLE_WORK_ITEM_IDS=${workItemIds.join(",")}`);
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
