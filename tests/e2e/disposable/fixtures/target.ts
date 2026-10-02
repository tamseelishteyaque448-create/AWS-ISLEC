import { expect, type Page } from "@playwright/test";

export async function expectLocalDisposableTarget(page: Page) {
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/e2e/environment", { cache: "no-store" });
    return {
      ok: result.ok,
      identity: (await result.json().catch(() => null)) as unknown,
    };
  });

  expect(response.ok).toBe(true);
  expect(response.identity).toEqual({
    environment: "local-disposable",
    backend: { host: "127.0.0.1", port: 54321 },
  });
}
