import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { validateDisposableE2EEnvironment } from "./disposable-e2e-env.mjs";

const workdir = process.env.E2E_SUPABASE_WORKDIR;
const envFile = process.env.E2E_ENV_FILE;
const runnerTemp = process.env.RUNNER_TEMP;
const runId = process.env.GITHUB_RUN_ID;
const runAttempt = process.env.GITHUB_RUN_ATTEMPT;
const expectedProjectId = `aws-islec-e2e-${runId}-${runAttempt}`;

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.RUNNER_ENVIRONMENT !== "github-hosted" ||
  process.env.RUNNER_OS !== "Linux" ||
  process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
  process.env.GITHUB_REF !== "refs/heads/main" ||
  process.env.GITHUB_REPOSITORY !== "tamseelishteyaque448-create/AWS-ISLEC" ||
  !workdir ||
  !envFile ||
  !runnerTemp ||
  process.env.E2E_SUPABASE_PROJECT_ID !== expectedProjectId
) {
  throw new Error("Test identity provisioning requires the validated GitHub-hosted isolated project.");
}

const isolatedSupabaseDir = resolve(workdir, "supabase");
const configText = readFileSync(resolve(isolatedSupabaseDir, "config.toml"), "utf8");
const expectedWorkdir = resolve(workdir);
const envFilePath = resolve(envFile);
const targetProjectId = process.env.E2E_SUPABASE_PROJECT_ID;
const localApiUrl = "http://127.0.0.1:54321";

function runLocalSupabase(args) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  try {
    return execFileSync(
      npx,
      ["supabase", "--workdir", expectedWorkdir, ...args],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
        windowsHide: true,
        env: getIsolatedCliEnvironment(),
      },
    );
  } catch {
    throw new Error(`Isolated Supabase CLI command failed: ${args[0]} ${args[1] ?? ""}.`);
  }
}

function getIsolatedCliEnvironment() {
  const safeEnvironment = { ...process.env };
  for (const key of Object.keys(safeEnvironment)) {
    if (/^(?:E2E_|QA_|NEXT_PUBLIC_SUPABASE_|SUPABASE_|APP_URL$|DATABASE_URL$|POSTGRES_)/i.test(key)) {
      delete safeEnvironment[key];
    }
  }
  safeEnvironment.SUPABASE_TELEMETRY_DISABLED = "1";
  return safeEnvironment;
}

function parseCliEnvironment(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const rawValue = match[2];
    try {
      values[match[1]] = rawValue.startsWith('"') ? JSON.parse(rawValue) : rawValue;
    } catch {
      throw new Error("Supabase CLI returned malformed local status output.");
    }
  }
  return values;
}

function readDatabasePort(text) {
  let inDatabaseSection = false;
  for (const line of text.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (section) {
      inDatabaseSection = section[1] === "db";
      continue;
    }
    if (!inDatabaseSection || /^\s*#/.test(line)) continue;
    const port = line.match(/^\s*port\s*=\s*(\d+)\s*(?:#.*)?$/);
    if (port) return Number(port[1]);
  }
  throw new Error("Could not determine the isolated Supabase database port.");
}

const initialEnvironment = {
  ...process.env,
  E2E_ENV: "local-disposable",
  E2E_BASE_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  E2E_ENV_FILE: envFilePath,
  E2E_SUPABASE_WORKDIR: expectedWorkdir,
  E2E_SUPABASE_PROJECT_ID: targetProjectId,
  NEXT_PUBLIC_SUPABASE_URL: localApiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "preflight-placeholder",
  E2E_OWNER_EMAIL: "owner@example.test",
  E2E_OWNER_PASSWORD: "preflight-placeholder",
  E2E_CONTRIBUTOR_EMAIL: "contributor@example.test",
  E2E_CONTRIBUTOR_PASSWORD: "preflight-placeholder",
  E2E_ADMIN_EMAIL: "admin@example.test",
  E2E_ADMIN_PASSWORD: "preflight-placeholder",
  E2E_NON_ADMIN_EMAIL: "non-admin@example.test",
  E2E_NON_ADMIN_PASSWORD: "preflight-placeholder",
  E2E_DELETE_PROJECT_ID: randomUUID(),
  E2E_ARCHIVED_PROJECT_ID: randomUUID(),
  E2E_PENDING_PROJECT_ID: randomUUID(),
  E2E_JOIN_PROOF_PROJECT_ID: randomUUID(),
};
validateDisposableE2EEnvironment(initialEnvironment);

const localStatus = parseCliEnvironment(runLocalSupabase(["status", "--output", "env"]));
const apiUrl = localStatus.API_URL;
const publishableKey = localStatus.ANON_KEY;
const serviceRoleKey = localStatus.SERVICE_ROLE_KEY;
let databaseUrl;
try {
  databaseUrl = new URL(localStatus.DB_URL);
} catch {
  throw new Error("Supabase CLI did not return a local database connection URL.");
}
if (
  apiUrl !== localApiUrl ||
  !publishableKey ||
  !serviceRoleKey ||
  !["127.0.0.1", "localhost"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== String(readDatabasePort(configText)) ||
  databaseUrl.username !== "postgres"
) {
  throw new Error("Supabase CLI status did not match the isolated loopback Supabase project.");
}

const roles = ["OWNER", "CONTRIBUTOR", "ADMIN", "NON_ADMIN"];
const credentials = {};
const userIds = {};
for (const role of roles) {
  const roleName = role.toLowerCase().replace("_", "-");
  const email = `phase7b-${runId}-${runAttempt}-${roleName}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Phase 7B ${roleName}` },
    }),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Unable to create temporary ${roleName} Auth identity (HTTP ${response.status}).`);
  }
  const result = await response.json();
  const userId = result?.user?.id ?? result?.id;
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error(`Temporary ${roleName} Auth identity returned no valid UUID.`);
  }
  userIds[role] = userId;
  credentials[`E2E_${role}_EMAIL`] = email;
  credentials[`E2E_${role}_PASSWORD`] = password;
}

const generatedProjectFixtureIds = {
  E2E_DELETE_PROJECT_ID: randomUUID(),
  E2E_ARCHIVED_PROJECT_ID: randomUUID(),
  E2E_PENDING_PROJECT_ID: randomUUID(),
  E2E_JOIN_PROOF_PROJECT_ID: randomUUID(),
};
const roleUserIds = Object.values(userIds);
if (new Set(roleUserIds).size !== roles.length) {
  throw new Error("Temporary Auth identities were not distinct.");
}

const sql = `do $phase7b$
begin
  insert into private.admin_users (user_id) values ('${userIds.ADMIN}');
  if ((
    select count(*) from public.profiles where id in (
      '${userIds.OWNER}', '${userIds.CONTRIBUTOR}', '${userIds.ADMIN}', '${userIds.NON_ADMIN}'
    )
  ) <> 4) then
    raise exception 'Expected four temporary Auth profiles in the isolated database';
  end if;
  if ((select count(*) from private.admin_users) <> 1) then
    raise exception 'Expected exactly one temporary administrator in the isolated database';
  end if;
  if ((select count(*) from public.build_assignment_members) <> 0) then
    raise exception 'Build & Prove work items must be empty before the focused test';
  end if;
  if ((select count(*) from public.build_submission_rewards) <> 0) then
    raise exception 'Build & Prove rewards must be empty before the focused test';
  end if;
  if (exists (
    select 1 from public.activities where activity_type = 'build_prove'
  )) then
    raise exception 'Build & Prove activities must be empty before the focused test';
  end if;
end
$phase7b$;`;

const sqlPath = resolve(workdir, "phase7b-preflight.sql");
writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "wx", mode: 0o600 });
try {
  runLocalSupabase(["db", "query", "--local", "--file", sqlPath]);
} finally {
  rmSync(sqlPath, { force: true });
}

const e2eEnvironment = {
  E2E_ENV: "local-disposable",
  E2E_BASE_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  E2E_SUPABASE_WORKDIR: expectedWorkdir,
  E2E_SUPABASE_PROJECT_ID: targetProjectId,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  ...credentials,
  ...generatedProjectFixtureIds,
};
validateDisposableE2EEnvironment({
  ...process.env,
  ...e2eEnvironment,
  E2E_ENV_FILE: envFilePath,
});

const environmentFileContents = Object.entries(e2eEnvironment)
  .map(([key, value]) => `${key}=${value}`)
  .join("\n") + "\n";
writeFileSync(envFilePath, environmentFileContents, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});

console.log(`Isolation preflight passed for ${targetProjectId}.`);
console.log("The Supabase API, SQL CLI, Auth identities, and Storage endpoint are runner-local.");
console.log("Four temporary Auth profiles are isolated; no Build & Prove rows existed before the test.");
