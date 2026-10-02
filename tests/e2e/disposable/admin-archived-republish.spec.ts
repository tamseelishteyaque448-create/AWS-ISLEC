import { expect, test } from "./fixtures/roles";
import { getDisposableProjectFixtures } from "./fixtures/projects";
import { expectLocalDisposableTarget } from "./fixtures/target";

test("admin republishes only Project B through publication review", async ({ adminPage }) => {
  const { archivedProjectId } = getDisposableProjectFixtures();
  await expectLocalDisposableTarget(adminPage);

  await adminPage.goto("/admin/projects");
  const project = adminPage.locator(`#project-${archivedProjectId}`);
  await expect(project).toContainText("E2E Archived Republish Project");
  await expect(project.locator(".admin-project-review-label")).toHaveText("Archived");

  adminPage.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Republish this archived project");
    await dialog.accept();
  });
  await project.getByRole("button", { name: "Republish", exact: true }).click();
  await expect(project.locator(".admin-project-review-label")).toHaveText("Published");
  await expect(project.getByText("Project review recorded.")).toBeVisible();
});
