import { expect, test } from "@playwright/test";
import { getDisposableProjectFixtures } from "./fixtures/projects";

test("anonymous requests cannot access member project or admin review routes", async ({ page }) => {
  const { deleteProjectId } = getDisposableProjectFixtures();

  await page.goto(`/member/projects/${deleteProjectId}`);
  await expect(page).toHaveURL(/\/join\?mode=login/);

  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/join\?mode=login/);
  await expect(page).not.toHaveURL(/\/admin\/projects/);
});
