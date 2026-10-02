import { expect, test } from "./fixtures/roles";
import { getDisposableProjectFixtures } from "./fixtures/projects";
import { expectLocalDisposableTarget } from "./fixtures/target";

test("admin approves only Project C through the pending-review workflow", async ({ adminPage }) => {
  const { pendingReviewProjectId } = getDisposableProjectFixtures();
  await expectLocalDisposableTarget(adminPage);

  await adminPage.goto("/admin/projects");
  const project = adminPage.locator(`#project-${pendingReviewProjectId}`);
  await expect(project).toContainText("E2E Pending Review Project");
  await expect(project.locator(".admin-project-review-label")).toHaveText("Awaiting review");

  await project.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(project.locator(".admin-project-review-label")).toHaveText("Published");
  await expect(project.getByText("Project review recorded.")).toBeVisible();
});
