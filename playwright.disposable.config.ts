import { defineConfig, devices } from "@playwright/test";
import { validateDisposableE2EEnvironment } from "./scripts/disposable-e2e-env.mjs";

const target = validateDisposableE2EEnvironment(process.env);

export default defineConfig({
  testDir: "./tests/e2e/disposable",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  globalSetup: "./tests/e2e/disposable/global-setup.ts",
  use: {
    baseURL: target.appUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "node scripts/start-disposable-e2e-app.mjs",
    url: `${target.appUrl}/api/e2e/environment`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
