import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const qaEnvPath = resolve(process.cwd(), ".env.qa.local");
const productionSupabaseUrl = "https://xokpzusmtmcfeqxjovbz.supabase.co";
const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "APP_URL",
];

function readEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error("Missing .env.qa.local. Copy .env.qa.local.example and add the QA values locally.");
  }
  const contents = readFileSync(path, "utf8");

  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    values[key] = value;
  }
  return values;
}

const qaValues = readEnvFile(qaEnvPath);
const missingKeys = requiredKeys.filter((key) => !qaValues[key]);
if (missingKeys.length > 0) {
  throw new Error(`Missing required QA environment values: ${missingKeys.join(", ")}`);
}

if (qaValues.NEXT_PUBLIC_SUPABASE_URL === productionSupabaseUrl) {
  throw new Error("Refusing to start QA mode with the production Supabase URL.");
}

const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev", "--", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, ...qaValues },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Unable to start QA development server: ${error.message}`);
  process.exit(1);
});
