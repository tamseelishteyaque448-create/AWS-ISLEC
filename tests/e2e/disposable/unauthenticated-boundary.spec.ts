import { expect, test } from "@playwright/test";
import { getDisposableProjectFixtures } from "./fixtures/projects";

const memberRoutes = [
  "/member",
  "/member/profile",
  "/member/journey",
  "/member/learn",
  "/member/challenges",
  "/member/events",
  "/member/explore",
  "/member/projects",
  "/member/activities",
  "/member/achievements",
  "/member/leaderboard",
];

test("anonymous requests are redirected from every member boundary and admin", async ({ page }) => {
  for (const route of memberRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/join\?mode=login/);
  }

  const { deleteProjectId } = getDisposableProjectFixtures();
  await page.goto(`/member/projects/${deleteProjectId}`);
  await expect(page).toHaveURL(/\/join\?mode=login/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/join\?mode=login/);
  expect(new URL(page.url()).pathname).not.toBe("/admin");

  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/join\?mode=login/);
  expect(new URL(page.url()).pathname).not.toBe("/admin/projects");
});
