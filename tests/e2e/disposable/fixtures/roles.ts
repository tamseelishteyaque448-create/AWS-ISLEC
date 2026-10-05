import { expect, test as base, type Browser, type Page } from "@playwright/test";

/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures use `use` as their lifecycle callback. */
export type E2ERole = "owner" | "contributor" | "admin" | "nonAdmin";
type RoleFixtures = {
  ownerPage: Page;
  contributorPage: Page;
  adminPage: Page;
  nonAdminPage: Page;
};

const roleEnvironment = {
  owner: ["E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"],
  contributor: ["E2E_CONTRIBUTOR_EMAIL", "E2E_CONTRIBUTOR_PASSWORD"],
  admin: ["E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"],
  nonAdmin: ["E2E_NON_ADMIN_EMAIL", "E2E_NON_ADMIN_PASSWORD"],
} as const satisfies Record<E2ERole, readonly [string, string]>;

function requireRoleCredentials(role: E2ERole) {
  const [emailKey, passwordKey] = roleEnvironment[role];
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  if (!email?.trim() || !password?.trim()) {
    throw new Error(`Missing ${emailKey} or ${passwordKey}; no account fallback is allowed.`);
  }
  return { email, password };
}

async function newAuthenticatedRolePage(browser: Browser, role: E2ERole) {
  const credentials = requireRoleCredentials(role);
  const baseURL = process.env.E2E_BASE_URL;
  if (!baseURL) {
    throw new Error("Missing E2E_BASE_URL; disposable role login cannot start.");
  }
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto(`/join?mode=login&next=${encodeURIComponent("/member")}`);
    await page.getByLabel("Email").fill(credentials.email);
    await page.getByLabel("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(
      (url) => url.pathname.startsWith("/member") || url.pathname.startsWith("/admin"),
      { timeout: 30_000 },
    );
    await expect(page).not.toHaveURL(/\/join/);
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export const test = base.extend<RoleFixtures>({
  ownerPage: async ({ browser }, use) => {
    const { context, page } = await newAuthenticatedRolePage(browser, "owner");
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
  contributorPage: async ({ browser }, use) => {
    const { context, page } = await newAuthenticatedRolePage(browser, "contributor");
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
  adminPage: async ({ browser }, use) => {
    const { context, page } = await newAuthenticatedRolePage(browser, "admin");
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
  nonAdminPage: async ({ browser }, use) => {
    const { context, page } = await newAuthenticatedRolePage(browser, "nonAdmin");
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect };
