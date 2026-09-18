import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test as base, type Page } from "@playwright/test";

type QaAuthFixtures = {
  authenticatedPage: Page;
  loginAsQaMember: (page: Page, next?: string) => Promise<void>;
};

function readQaCredentials() {
  const values = Object.fromEntries(
    readFileSync(resolve(process.cwd(), ".env.qa.local"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2")];
      }),
  );

  const email = process.env.QA_E2E_EMAIL ?? values.QA_E2E_EMAIL;
  const password = process.env.QA_E2E_PASSWORD ?? values.QA_E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("QA_E2E_EMAIL and QA_E2E_PASSWORD are required for authenticated E2E tests.");
  }

  return { email, password };
}

async function loginAsQaMember(page: Page, next = "/member") {
  const { email, password } = readQaCredentials();
  await page.goto(`/join?mode=login&next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/member") || url.pathname === "/join");
  await expect(page).not.toHaveURL(/\/join/);
}

export const test = base.extend<QaAuthFixtures>({
  loginAsQaMember: async ({}, use) => {
    await use(loginAsQaMember);
  },
  authenticatedPage: async ({ page, loginAsQaMember }, use) => {
    await loginAsQaMember(page);
    await use(page);
  },
});

export { expect };