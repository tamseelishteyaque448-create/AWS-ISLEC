import { expect, test } from "./fixtures/roles";

const viewports = [320, 360, 390, 412, 768, 1024, 1440];

test("authenticated Build & Prove member screens fit the requested viewport widths", async ({
  contributorPage: page,
}) => {
  test.setTimeout(60_000);
  for (const width of viewports) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/member/learn");

    await expect(page.getByRole("heading", { name: "Build & Prove" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Innovation & Research tasks" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `Build & Prove overview overflows at ${width}px`,
    ).toBe(true);

    await page.goto("/member/learn/innovation-research");
    await expect(page.getByRole("heading", { name: "Innovation & Research" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Filter assigned work" })).toBeVisible();
    await expect(page.locator(".build-empty, .build-work-card").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `Build & Prove domain page overflows at ${width}px`,
    ).toBe(true);
  }
});
