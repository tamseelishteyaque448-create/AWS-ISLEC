import { expect, test } from "./fixtures/roles";
import { getDisposableProjectFixtures } from "./fixtures/projects";
import { expectLocalDisposableTarget } from "./fixtures/target";

test("contributor cannot see owner-only deletion controls for Project A", async ({ contributorPage }) => {
  const { deleteProjectId } = getDisposableProjectFixtures();
  await expectLocalDisposableTarget(contributorPage);

  await contributorPage.goto(`/member/projects/${deleteProjectId}`);

  await expect(contributorPage.locator("h1")).toHaveText("E2E Delete Project");
  await expect(contributorPage.getByRole("button", { name: "Delete project permanently" })).toHaveCount(0);
});
