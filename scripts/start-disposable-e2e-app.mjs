import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateDisposableE2EEnvironment } from "./disposable-e2e-env.mjs";

let validated;
try {
  validated = validateDisposableE2EEnvironment(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Disposable E2E application target is invalid.");
  process.exit(1);
}

const localEnvironmentFile = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvironmentFile)) {
  const localEnvironment = readFileSync(localEnvironmentFile, "utf8");
  for (const line of localEnvironment.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = "";
    }
  }
}

const nextCli = resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(
  process.execPath,
  [nextCli, "dev", "--hostname", validated.appHost, "--port", String(validated.appPort)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

child.on("error", () => {
  console.error("Unable to start the disposable local application.");
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
