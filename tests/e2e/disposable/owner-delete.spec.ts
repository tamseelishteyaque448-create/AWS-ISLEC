import { expect, test } from "./fixtures/roles";
import { getDisposableProjectFixtures } from "./fixtures/projects";
import { expectLocalDisposableTarget } from "./fixtures/target";

test("owner permanently deletes only Project A through the member workspace", async ({ ownerPage }) => {
  const { deleteProjectId } = getDisposableProjectFixtures();
  await expectLocalDisposableTarget(ownerPage);

  await ownerPage.goto(`/member/projects/${deleteProjectId}`);
  const projectTitle = await ownerPage.locator("h1").innerText();
  expect(projectTitle).toBeTruthy();

  await ownerPage.getByText("Project settings", { exact: true }).click();
  const deleteButton = ownerPage.getByRole("button", { name: "Delete project permanently" });
  await expect(deleteButton).toBeVisible();
  ownerPage.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Permanently delete this project");
    await dialog.accept();
  });
  await deleteButton.click();
  await expect(ownerPage).toHaveURL(/\/member\/projects$/);
  await expect(ownerPage.locator("h1")).toHaveText("Build something real.");
  await expect(ownerPage.getByRole("heading", { name: projectTitle, exact: true })).toHaveCount(0);
  await expect(ownerPage.getByRole("button", { name: "Deleting…" })).toHaveCount(0);

  await ownerPage.goto(`/member/projects/${deleteProjectId}`);
  await expect(ownerPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: projectTitle, exact: true })).toHaveCount(0);
});
