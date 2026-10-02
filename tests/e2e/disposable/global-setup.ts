import { request, type FullConfig } from "@playwright/test";
import { validateDisposableE2EEnvironment } from "../../../scripts/disposable-e2e-env.mjs";

export default async function globalSetup(config: FullConfig) {
  const target = validateDisposableE2EEnvironment(process.env);
  const api = await request.newContext({
    baseURL: target.appUrl,
    timeout: 5_000,
  });

  try {
    const response = await api.get("/api/e2e/environment");
    if (!response.ok()) {
      throw new Error("Disposable app identity check failed before E2E tests.");
    }
    const identity: unknown = await response.json();
    if (
      !identity ||
      typeof identity !== "object" ||
      !("environment" in identity) ||
      identity.environment !== "local-disposable" ||
      !("backend" in identity) ||
      !identity.backend ||
      typeof identity.backend !== "object" ||
      !("host" in identity.backend) ||
      identity.backend.host !== target.supabaseHost ||
      !("port" in identity.backend) ||
      identity.backend.port !== target.supabasePort
    ) {
      throw new Error("Disposable app identity did not match the validated local Supabase target.");
    }
  } finally {
    await api.dispose();
  }

  if (!config.projects.length) {
    throw new Error("No disposable Playwright project is configured.");
  }
}
