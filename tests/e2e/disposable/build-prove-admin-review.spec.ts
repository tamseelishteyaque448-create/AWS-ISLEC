import { expect, test } from "./fixtures/roles";
import { expectLocalDisposableTarget } from "./fixtures/target";

/**
 * Authorization boundaries for the admin Build & Prove review surface.
 *
 * These are read-only and denial-focused on purpose. They do not create or
 * mutate fixtures, so they can run against a disposable environment that has
 * not yet been provisioned with a submitted submission. The mutating approval
 * and cancellation flows are covered by the SQL workflow suites, which assert
 * the same transitions at the authoritative layer.
 */

// scripts/start-disposable-e2e-app.mjs runs `next dev`, so the first request to
// a newly added route pays full JIT compilation before any redirect is issued.
// The default 30s budget does not cover that cold compile; later tests against
// the same warm route finish in seconds. This widens the budget only.
test.describe.configure({ timeout: 90_000 });

test("anonymous visitors are redirected away from the admin review queue", async ({ page }) => {
  await page.goto("/admin/build-prove/review");
  await expect(page).toHaveURL(/\/join\?mode=login&next=/);
});

test("anonymous visitors cannot reach the Build & Prove admin catalogue", async ({ page }) => {
  await page.goto("/admin/build-prove");
  await expect(page).toHaveURL(/\/join\?mode=login&next=/);
});

test("authenticated non-admin is denied the admin review queue", async ({ nonAdminPage }) => {
  await expectLocalDisposableTarget(nonAdminPage);

  await nonAdminPage.goto("/admin/build-prove/review");

  await expect(nonAdminPage).toHaveURL(/\/member$/);
  await expect(
    nonAdminPage.getByRole("heading", { name: "Review queue." }),
  ).toHaveCount(0);
});

test("authenticated non-admin is denied the Build & Prove catalogue", async ({ nonAdminPage }) => {
  await expectLocalDisposableTarget(nonAdminPage);

  await nonAdminPage.goto("/admin/build-prove");

  await expect(nonAdminPage).toHaveURL(/\/member$/);
  await expect(
    nonAdminPage.getByRole("heading", { name: "Build & Prove, in motion." }),
  ).toHaveCount(0);
});

test("an admin reaches the review queue from the catalogue", async ({ adminPage }) => {
  await expectLocalDisposableTarget(adminPage);

  await adminPage.goto("/admin/build-prove");
  await adminPage.getByRole("link", { name: "Review queue" }).click();

  await expect(adminPage).toHaveURL(/\/admin\/build-prove\/review$/);
  // Either the queue heading or the explicit empty state must render; an
  // unavailable/error state is a failure, not an acceptable outcome.
  await expect(adminPage.getByText("The review queue is unavailable.")).toHaveCount(0);
  await expect(
    adminPage.getByRole("heading", { name: "Review queue." }),
  ).toBeVisible();
});

test("requesting changes requires feedback before the review is submitted", async ({ adminPage }) => {
  await expectLocalDisposableTarget(adminPage);

  await adminPage.goto("/admin/build-prove/review");

  // A review control only exists once a member has submitted work. Without a
  // provisioned submission the surface must show its empty state instead.
  const requestChangesRadio = adminPage.getByRole("radio", { name: "Request changes" });
  if (await requestChangesRadio.count() === 0) {
    await expect(adminPage.getByText("Nothing is waiting for review.")).toBeVisible();
    return;
  }

  await requestChangesRadio.check();
  const form = adminPage.locator("form", { has: requestChangesRadio }).first();
  const feedback = form.locator('textarea[name="feedback"]');

  await expect(feedback).toHaveAttribute("required", "");
  await expect(feedback).toHaveAttribute("maxlength", "2000");

  // Submitting an empty review must not record a decision.
  await form.getByRole("button", { name: "Request changes" }).click();
  await expect(
    adminPage.getByText("Requesting changes requires feedback explaining what to improve."),
  ).toBeVisible();
});

test("the task detail review surface never renders an error state", async ({ adminPage }) => {
  await expectLocalDisposableTarget(adminPage);

  await adminPage.goto("/admin/build-prove/review");
  const reviewLink = adminPage.getByRole("link", { name: "Review" }).first();

  if (await reviewLink.count() === 0) {
    await expect(adminPage.getByText("Nothing is waiting for review.")).toBeVisible();
    return;
  }

  await reviewLink.click();
  await expect(adminPage).toHaveURL(/\/admin\/build-prove\/tasks\/[0-9a-f-]+/);

  // The task detail must render the operations surface, not a failure state.
  await expect(adminPage.getByText("Build & Prove data is unavailable.")).toHaveCount(0);
  await expect(adminPage.getByRole("heading", { name: "Task operations." })).toBeVisible();

  // Real dichotomy: either a decidable revision exposes working review
  // controls, or there is no decidable revision and at least one member work
  // item explains why it is read-only. Neither branch may be silently empty.
  const reviewForms = adminPage.locator("form:has(input[value='approved'])");
  const decidable = await reviewForms.count();
  const explained = await adminPage
    .getByText("No decision is available in the current state.")
    .count()
    + await adminPage.getByText("This revision has already been reviewed.").count();

  if (decidable > 0) {
    await expect(
      adminPage.getByRole("radio", { name: "Approve this submission" }).first(),
    ).toBeVisible();
  } else {
    expect(explained, "a task with submitted work must explain why it is read-only")
      .toBeGreaterThan(0);
  }
});