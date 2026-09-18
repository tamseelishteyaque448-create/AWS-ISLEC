import { expect, test } from "./fixtures/qa-auth";

test.describe("Authenticated QA Member verification", () => {
  test("AUTH-20: session persists across refresh and navigation", async ({ authenticatedPage }) => {
    await expect(authenticatedPage).toHaveURL(/\/member$/);

    await authenticatedPage.reload();
    await expect(authenticatedPage).toHaveURL(/\/member$/);

    await authenticatedPage.goto("/member/profile");
    await expect(authenticatedPage).toHaveURL(/\/member\/profile$/);
    await authenticatedPage.reload();
    await expect(authenticatedPage).toHaveURL(/\/member\/profile$/);
  });

  test("AUTH-21: logout invalidates the session", async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole("button", { name: "Log out" }).click();
    await expect(authenticatedPage).toHaveURL(/\/join/);

    await authenticatedPage.goto("/member");
    await expect(authenticatedPage).toHaveURL(/\/join\?mode=login/);
  });

  test("AUTH-22: authenticated internal next redirects to the requested member route", async ({ page, loginAsQaMember }) => {
    await loginAsQaMember(page, "/member/profile");
    await expect(page).toHaveURL(/\/member\/profile$/);
  });

  test("AUTH-23: authenticated unsafe next redirects stay in the member workspace", async ({ page, loginAsQaMember }) => {
    for (const unsafeNext of ["https://evil.com", "//evil.com", "javascript:alert(1)"]) {
      await loginAsQaMember(page, unsafeNext);
      await expect(page).toHaveURL(/\/member$/);
      expect(new URL(page.url()).origin).toBe(new URL("http://localhost:3000").origin);
      await page.context().clearCookies();
    }
  });
});