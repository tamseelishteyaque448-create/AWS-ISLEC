import { expect, test } from "./fixtures/roles";
import { getDisposableProjectFixtures } from "./fixtures/projects";
import { expectLocalDisposableTarget } from "./fixtures/target";

test("owner permanently deletes only Project A through the member workspace", async ({ ownerPage }) => {
  const { deleteProjectId } = getDisposableProjectFixtures();
  await expectLocalDisposableTarget(ownerPage);

  await ownerPage.goto(`/member/projects/${deleteProjectId}`);
  await expect(ownerPage.locator("h1")).toHaveText("E2E Delete Project Replacement 20261002 31808aa0");

  await ownerPage.getByText("Project settings", { exact: true }).click();
  const deleteButton = ownerPage.getByRole("button", { name: "Delete project permanently" });
  await expect(deleteButton).toBeVisible();
  ownerPage.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Permanently delete this project");
    await dialog.accept();
  });
  await deleteButton.click();
  await expect(ownerPage).toHaveURL(/\/member\/projects$/);

  const response = await ownerPage.goto(`/member/projects/${deleteProjectId}`);
  expect(response?.status()).toBe(404);
});
