import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  getSafeDisposableChildEnvironment,
  loadDisposableE2EEnvironment,
} from "./disposable-e2e-env.mjs";

let validated;
try {
  validated = loadDisposableE2EEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Disposable E2E configuration is invalid.");
  process.exit(1);
}

const cliPath = resolve(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
const child = spawn(
  process.execPath,
  [cliPath, "test", "--config=playwright.disposable.config.ts", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: getSafeDisposableChildEnvironment(validated.environment),
    stdio: "inherit",
  },
);

child.on("error", () => {
  console.error("Unable to start the disposable Playwright runner.");
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
