import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { request, type Page } from "@playwright/test";
import { expect, test } from "./fixtures/roles";

test.describe.configure({ timeout: 180_000 });

const EVIDENCE_URL = "/api/member/build-prove/evidence";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const PDF_BYTES = Buffer.from("%PDF-1.7\nlocal Build & Prove test\n");

type LocalRole = "CONTRIBUTOR" | "OWNER" | "ADMIN";

function localRoleClient(role: LocalRole) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!url || !key || !email || !password) {
    throw new Error(`Missing disposable local ${role} runtime credentials.`);
  }
  return {
    client: createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    email,
    password,
  };
}

async function signInLocalRole(role: LocalRole) {
  const { client, email, password } = localRoleClient(role);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  expect(error, `Local ${role} test identity must authenticate`).toBeNull();
  if (!data.user) throw new Error(`Local ${role} test identity did not resolve.`);
  return { client, userId: data.user.id };
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object from the local Build & Prove RPC.");
  }
  return value as Record<string, unknown>;
}

async function createInProgressWork(admin: Awaited<ReturnType<typeof signInLocalRole>>["client"], memberId: string) {
  const slug = `e2e-storage-${randomUUID().replaceAll("-", "")}`;
  const { error: saveError } = await admin.rpc("save_build_assignment", {
    p_slug: slug,
    p_title: `Disposable Build & Prove Storage test ${slug.slice(-8)}`,
    p_difficulty: "easy",
    p_domain: "documentation",
    p_assignment_scope: "individual",
    p_publication_state: "published",
    p_priority: "normal",
    p_reward_points: 0,
    p_member_ids: [memberId],
  });
  expect(saveError, "Admin fixture task must be created through the authorized RPC").toBeNull();

  const { data: assignment, error: assignmentError } = await admin
    .from("build_assignments")
    .select("id")
    .eq("slug", slug)
    .single();
  expect(assignmentError).toBeNull();
  if (!assignment) throw new Error("Disposable Build & Prove assignment was not readable.");

  const { data: workItem, error: workItemError } = await admin
    .from("build_assignment_members")
    .select("id")
    .eq("assignment_id", assignment.id)
    .eq("member_id", memberId)
    .single();
  expect(workItemError).toBeNull();
  if (!workItem) throw new Error("Disposable Build & Prove work item was not assigned.");
  return { assignmentId: assignment.id, workItemId: workItem.id };
}

async function createOpenDraft(
  member: Awaited<ReturnType<typeof signInLocalRole>>["client"],
  workItemId: string,
) {
  const { error: startError } = await member.rpc("start_build_assignment", {
    p_work_item_id: workItemId,
  });
  expect(startError).toBeNull();
  const { data, error } = await member.rpc("save_build_submission_draft", {
    p_work_item_id: workItemId,
    p_project_title: "Disposable evidence draft",
    p_explanation: "Created through the authenticated local member RPC.",
    p_approach: "Exercise the protected Storage HTTP routes.",
  });
  expect(error).toBeNull();
  const draftId = jsonObject(data).draft_id;
  if (typeof draftId !== "string") throw new Error("Draft RPC did not return its identifier.");
  return draftId;
}

async function upload(
  page: Page,
  draftId: string,
  buffer: Buffer,
  name: string,
  mimeType: string,
  extras: Record<string, string> = {},
) {
  return page.request.post(EVIDENCE_URL, {
    multipart: {
      draftId,
      file: { name, mimeType, buffer },
      caption: "Local disposable proof",
      ...extras,
    },
  });
}

test("Build & Prove evidence HTTP routes enforce authenticated draft ownership and privacy", async ({
  contributorPage,
  ownerPage,
  adminPage,
}) => {
  const { client: admin, userId: adminId } = await signInLocalRole("ADMIN");
  const { client: member, userId: memberId } = await signInLocalRole("CONTRIBUTOR");
  const { client: otherMember } = await signInLocalRole("OWNER");
  expect(adminId).not.toBe(memberId);

  let workItemId: string | null = null;
  let draftId: string | null = null;
  let cancelledWorkItemId: string | null = null;
  let registeredEvidenceIds: string[] = [];
  try {
    const fixture = await createInProgressWork(admin, memberId);
    const activeWorkItemId = fixture.workItemId;
    workItemId = activeWorkItemId;
    const activeDraftId = await createOpenDraft(member, activeWorkItemId);
    draftId = activeDraftId;

    const firstUpload = await upload(
      contributorPage,
      activeDraftId,
      PNG_BYTES,
      "../outside-proof.png",
      "image/png",
      { bucket: "arbitrary-bucket", path: "../../outside" },
    );
    expect(firstUpload.status()).toBe(201);
    const firstBody = jsonObject(await firstUpload.json());
    const firstEvidence = jsonObject(firstBody.evidence);
    const firstEvidenceId = firstEvidence.id;
    expect(typeof firstEvidenceId).toBe("string");
    expect(firstBody).not.toHaveProperty("storagePath");
    if (typeof firstEvidenceId !== "string") throw new Error("Upload response did not contain evidence ID.");
    registeredEvidenceIds.push(firstEvidenceId);

    const { data: evidenceRow, error: evidenceError } = await admin
      .from("build_submission_evidence")
      .select("storage_path")
      .eq("id", firstEvidenceId)
      .single();
    expect(evidenceError).toBeNull();
    expect(evidenceRow?.storage_path).toMatch(
      new RegExp(`^submissions/${memberId}/${activeDraftId}/[0-9a-f-]{36}$`, "i"),
    );
    const storageFolder = `submissions/${memberId}/${activeDraftId}`;
    const { data: storedObjects, error: listError } = await admin.storage
      .from("build-prove-private")
      .list(storageFolder);
    expect(listError).toBeNull();
    expect(storedObjects?.map((object) => object.name)).toEqual([
      evidenceRow?.storage_path.split("/").at(-1),
    ]);

    const ownDownload = await contributorPage.request.get(
      `${EVIDENCE_URL}/${firstEvidenceId}`,
    );
    expect(ownDownload.status()).toBe(200);
    expect(ownDownload.headers()["content-type"]).toBe("image/png");
    expect(ownDownload.headers()["x-content-type-options"]).toBe("nosniff");
    expect(ownDownload.headers()["cache-control"]).toContain("no-store");
    expect(ownDownload.headers()["content-disposition"]).toContain("attachment;");
    expect(await ownDownload.body()).toEqual(PNG_BYTES);

    for (const validFile of [
      { buffer: JPEG_BYTES, name: "proof.jpg", mimeType: "image/jpeg" },
      { buffer: WEBP_BYTES, name: "proof.webp", mimeType: "image/webp" },
    ]) {
      const response = await upload(
        contributorPage,
        activeDraftId,
        validFile.buffer,
        validFile.name,
        validFile.mimeType,
      );
      expect(response.status(), validFile.mimeType).toBe(201);
      const responseJson = jsonObject(await response.json());
      const uploaded = jsonObject(responseJson.evidence);
      if (typeof uploaded.id !== "string") throw new Error("Valid signature upload did not return metadata.");
      const removeResponse = await contributorPage.request.delete(`${EVIDENCE_URL}/${uploaded.id}`);
      expect(removeResponse.status()).toBe(200);
    }

    const crossOwnerDownload = await ownerPage.request.get(`${EVIDENCE_URL}/${firstEvidenceId}`);
    expect([403, 404]).toContain(crossOwnerDownload.status());
    const crossOwnerDelete = await ownerPage.request.delete(`${EVIDENCE_URL}/${firstEvidenceId}`);
    expect([403, 404]).toContain(crossOwnerDelete.status());
    const crossOwnerUpload = await upload(ownerPage, activeDraftId, PNG_BYTES, "proof.png", "image/png");
    expect([403, 404]).toContain(crossOwnerUpload.status());
    const { error: crossRegisterError } = await otherMember.rpc("register_build_draft_evidence", {
      p_draft_id: activeDraftId,
      p_object_uuid: randomUUID(),
      p_caption: "cross-owner",
    });
    expect(crossRegisterError?.code).toBe("42501");
    const storedPath = evidenceRow?.storage_path;
    if (!storedPath) throw new Error("Registered evidence path is unavailable to the local admin fixture.");
    const directCrossDownload = await otherMember.storage
      .from("build-prove-private")
      .download(storedPath);
    expect(directCrossDownload.error).not.toBeNull();
    const directCrossUpload = await otherMember.storage
      .from("build-prove-private")
      .upload(`submissions/${memberId}/${activeDraftId}/${randomUUID()}`, PNG_BYTES, {
        contentType: "image/png",
      });
    expect(directCrossUpload.error).not.toBeNull();
    await otherMember.storage.from("build-prove-private").remove([storedPath]);
    const { data: stillStored, error: stillStoredError } = await admin.storage
      .from("build-prove-private")
      .list(storageFolder);
    expect(stillStoredError).toBeNull();
    expect(stillStored?.map((object) => object.name)).toContain(storedPath.split("/").at(-1));

    const invalidCases = [
      { name: "mime-mismatch", buffer: PNG_BYTES, mimeType: "application/pdf", status: 415 },
      { name: "unsupported.txt", buffer: Buffer.from("%PDF-1.7"), mimeType: "text/plain", status: 415 },
      {
        name: "too-large.pdf",
        buffer: Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(10 * 1024 * 1024)]),
        mimeType: "application/pdf",
        status: 413,
      },
      { name: "empty.pdf", buffer: Buffer.alloc(0), mimeType: "application/pdf", status: 400 },
      { name: "truncated.pdf", buffer: Buffer.from("%PD"), mimeType: "application/pdf", status: 415 },
    ];
    for (const invalid of invalidCases) {
      const response = await upload(
        contributorPage,
        activeDraftId,
        invalid.buffer,
        invalid.name,
        invalid.mimeType,
      );
      expect(response.status(), invalid.name).toBe(invalid.status);
    }

    const removeFirst = await contributorPage.request.delete(`${EVIDENCE_URL}/${firstEvidenceId}`);
    expect(removeFirst.status()).toBe(200);
    registeredEvidenceIds = registeredEvidenceIds.filter((id) => id !== firstEvidenceId);
    const firstMissing = await contributorPage.request.get(`${EVIDENCE_URL}/${firstEvidenceId}`);
    expect(firstMissing.status()).toBe(404);
    const { data: afterRemove, error: afterRemoveError } = await admin
      .from("build_submission_evidence")
      .select("id")
      .eq("id", firstEvidenceId);
    expect(afterRemoveError).toBeNull();
    expect(afterRemove).toHaveLength(0);

    const submittedUpload = await upload(
      contributorPage,
      activeDraftId,
      PDF_BYTES,
      "submitted-proof.pdf",
      "application/pdf",
    );
    expect(submittedUpload.status()).toBe(201);
    const submittedBody = jsonObject(await submittedUpload.json());
    const submittedEvidence = jsonObject(submittedBody.evidence);
    const submittedEvidenceId = submittedEvidence.id;
    if (typeof submittedEvidenceId !== "string") throw new Error("Submitted evidence ID is missing.");
    registeredEvidenceIds.push(submittedEvidenceId);

    await contributorPage.goto(`/member/learn/tasks/${workItemId}`);
    await contributorPage.getByLabel("Submission title").fill("Storage runtime submission");
    await contributorPage.getByLabel("Description / note").fill("Submitted through the server action.");
    await contributorPage.getByLabel("Approach").fill("The action saves and seals the authenticated draft.");
    const submitActionResponse = contributorPage.waitForResponse(
      (response) => response.request().method() === "POST"
        && Boolean(response.request().headers()["next-action"]),
      { timeout: 60_000 },
    );
    contributorPage.once("dialog", (dialog) => dialog.accept());
    await contributorPage.getByRole("button", { name: "Submit for review" }).click();
    expect((await submitActionResponse).status()).toBe(200);
    await expect(contributorPage.getByText("Your submitted revision is read-only and awaiting review."))
      .toBeVisible({ timeout: 30_000 });

    const sealedUpload = await upload(contributorPage, activeDraftId, PNG_BYTES, "late.png", "image/png");
    expect([404, 409]).toContain(sealedUpload.status());
    const sealedDelete = await contributorPage.request.delete(
      `${EVIDENCE_URL}/${submittedEvidenceId}`,
    );
    expect(sealedDelete.status()).toBe(409);

    const cancelledFixture = await createInProgressWork(admin, memberId);
    const activeCancelledWorkItemId = cancelledFixture.workItemId;
    cancelledWorkItemId = activeCancelledWorkItemId;
    const cancelledDraftId = await createOpenDraft(member, activeCancelledWorkItemId);
    const { error: cancelOpenError } = await admin.rpc("cancel_build_work_item", {
      p_work_item_id: activeCancelledWorkItemId,
    });
    expect(cancelOpenError).toBeNull();
    const cancelledUpload = await upload(
      contributorPage,
      cancelledDraftId,
      PNG_BYTES,
      "cancelled.png",
      "image/png",
    );
    expect([403, 404, 409]).toContain(cancelledUpload.status());

    const memberDownload = await contributorPage.request.get(
      `${EVIDENCE_URL}/${submittedEvidenceId}`,
    );
    expect(memberDownload.status()).toBe(200);
    const adminDownload = await adminPage.request.get(`${EVIDENCE_URL}/${submittedEvidenceId}`);
    expect(adminDownload.status()).toBe(200);
    expect(await adminDownload.body()).toEqual(PDF_BYTES);

    const { error: cancelError } = await admin.rpc("cancel_build_work_item", {
      p_work_item_id: workItemId,
    });
    expect(cancelError).toBeNull();
    const cancelledDownload = await contributorPage.request.get(
      `${EVIDENCE_URL}/${submittedEvidenceId}`,
    );
    expect([403, 404]).toContain(cancelledDownload.status());
    const cancelledDelete = await contributorPage.request.delete(
      `${EVIDENCE_URL}/${submittedEvidenceId}`,
    );
    expect([403, 404, 409]).toContain(cancelledDelete.status());
    const { data: hiddenEvidence, error: hiddenEvidenceError } = await member
      .from("build_submission_evidence")
      .select("id")
      .eq("id", submittedEvidenceId);
    expect(hiddenEvidenceError).toBeNull();
    expect(hiddenEvidence).toHaveLength(0);
    const adminAfterCancel = await adminPage.request.get(
      `${EVIDENCE_URL}/${submittedEvidenceId}`,
    );
    expect(adminAfterCancel.status()).toBe(200);

    const anonymous = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    try {
      expect((await anonymous.get(`${EVIDENCE_URL}/${submittedEvidenceId}`)).status()).toBe(401);
      expect((await anonymous.delete(`${EVIDENCE_URL}/${submittedEvidenceId}`)).status()).toBe(401);
      const anonymousUpload = await anonymous.post(EVIDENCE_URL, {
        multipart: {
          draftId: activeDraftId,
          file: { name: "proof.png", mimeType: "image/png", buffer: PNG_BYTES },
        },
      });
      expect(anonymousUpload.status()).toBe(401);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !publishableKey) throw new Error("Local Supabase test target is missing.");
      const anonymousSupabase = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const anonymousStorageRead = await anonymousSupabase.storage
        .from("build-prove-private")
        .download(storedPath);
      expect(anonymousStorageRead.error).not.toBeNull();
      const anonymousStorageUpload = await anonymousSupabase.storage
        .from("build-prove-private")
        .upload(`submissions/${memberId}/${activeDraftId}/${randomUUID()}`, PNG_BYTES, {
          contentType: "image/png",
        });
      expect(anonymousStorageUpload.error).not.toBeNull();
    } finally {
      await anonymous.dispose();
    }
  } finally {
    if (draftId && registeredEvidenceIds.length) {
      for (const evidenceId of registeredEvidenceIds) {
        await contributorPage.request.delete(`${EVIDENCE_URL}/${evidenceId}`).catch(() => null);
      }
    }
    if (workItemId) {
      await admin.rpc("cancel_build_work_item", { p_work_item_id: workItemId });
    }
    if (cancelledWorkItemId) {
      await admin.rpc("cancel_build_work_item", { p_work_item_id: cancelledWorkItemId });
    }
    await Promise.all([
      admin.auth.signOut(),
      member.auth.signOut(),
      otherMember.auth.signOut(),
    ]);
  }
});
