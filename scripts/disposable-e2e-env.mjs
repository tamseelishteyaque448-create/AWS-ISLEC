import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const root = process.cwd();
const envFilePath = resolve(root, ".env.e2e.local");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const credentialKeys = [
  "E2E_OWNER_EMAIL",
  "E2E_OWNER_PASSWORD",
  "E2E_CONTRIBUTOR_EMAIL",
  "E2E_CONTRIBUTOR_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_NON_ADMIN_EMAIL",
  "E2E_NON_ADMIN_PASSWORD",
];
const projectFixtureKeys = [
  "E2E_DELETE_PROJECT_ID",
  "E2E_ARCHIVED_PROJECT_ID",
  "E2E_PENDING_PROJECT_ID",
  "E2E_JOIN_PROOF_PROJECT_ID",
];
const allowedKeys = new Set([
  "E2E_ENV",
  "E2E_BASE_URL",
  "E2E_SUPABASE_WORKDIR",
  "E2E_SUPABASE_PROJECT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "APP_URL",
  ...credentialKeys,
  ...projectFixtureKeys,
]);

export class DisposableE2EConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "DisposableE2EConfigError";
  }
}

function parseEnvironmentFile(contents) {
  const values = {};

  for (const [index, sourceLine] of contents.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new DisposableE2EConfigError(`Invalid .env.e2e.local entry on line ${index + 1}.`);
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!allowedKeys.has(key)) {
      throw new DisposableE2EConfigError(`Unsupported .env.e2e.local setting: ${key}.`);
    }
    if (Object.hasOwn(values, key)) {
      throw new DisposableE2EConfigError(`Duplicate .env.e2e.local setting: ${key}.`);
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function readProjectId(configText) {
  const match = configText.match(/^\s*project_id\s*=\s*"([^"]+)"\s*$/m);
  if (!match) {
    throw new DisposableE2EConfigError("Could not determine the project ID from supabase/config.toml.");
  }
  return match[1];
}

function readLocalApiPort(configText) {
  let inApiSection = false;

  for (const line of configText.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (section) {
      inApiSection = section[1] === "api";
      continue;
    }

    if (!inApiSection || /^\s*#/.test(line)) continue;
    const port = line.match(/^\s*port\s*=\s*(\d+)\s*(?:#.*)?$/);
    if (port) {
      const parsed = Number(port[1]);
      if (parsed >= 1 && parsed <= 65535) return parsed;
      break;
    }
  }

  throw new DisposableE2EConfigError("Could not determine the local Supabase API port from supabase/config.toml.");
}

function isPathInside(directory, candidate) {
  const pathFromDirectory = relative(directory, candidate);
  return pathFromDirectory !== "" &&
    pathFromDirectory !== ".." &&
    !pathFromDirectory.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromDirectory);
}

function validateHostedWorkflowTarget(env, workdir, projectId) {
  if (env.GITHUB_ACTIONS !== "true") return;

  if (
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REPOSITORY !== "tamseelishteyaque448-create/AWS-ISLEC"
  ) {
    throw new DisposableE2EConfigError(
      "Disposable integration requires GitHub-hosted workflow_dispatch on the repository main branch.",
    );
  }

  const runId = env.GITHUB_RUN_ID;
  const runAttempt = env.GITHUB_RUN_ATTEMPT;
  const runnerTemp = env.RUNNER_TEMP;
  if (
    !runId ||
    !/^\d+$/.test(runId) ||
    !runAttempt ||
    !/^\d+$/.test(runAttempt) ||
    !runnerTemp ||
    !isAbsolute(runnerTemp) ||
    !env.E2E_SUPABASE_WORKDIR ||
    !isAbsolute(env.E2E_SUPABASE_WORKDIR) ||
    !isPathInside(resolve(runnerTemp), workdir) ||
    !env.E2E_ENV_FILE ||
    !isAbsolute(env.E2E_ENV_FILE) ||
    !isPathInside(resolve(runnerTemp), resolve(env.E2E_ENV_FILE)) ||
    projectId !== `aws-islec-e2e-${runId}-${runAttempt}` ||
    env.E2E_SUPABASE_PROJECT_ID !== projectId ||
    projectId === "AWS-ISLEC"
  ) {
    throw new DisposableE2EConfigError(
      "Disposable integration requires an isolated temporary Supabase project for this workflow run.",
    );
  }
}

function parseLoopbackHttpUrl(value, name, allowedHosts) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new DisposableE2EConfigError(`${name} must be a valid local HTTP URL.`);
  }

  if (
    url.protocol !== "http:" ||
    !allowedHosts.has(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new DisposableE2EConfigError(`${name} must use an allowed loopback HTTP URL with an explicit port.`);
  }

  return url;
}

function requireNonEmpty(env, key) {
  const value = env[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DisposableE2EConfigError(`Missing required disposable E2E setting: ${key}.`);
  }
  return value;
}

export function validateDisposableE2EEnvironment(env, { configText } = {}) {
  if (env.E2E_ENV !== "local-disposable") {
    throw new DisposableE2EConfigError("E2E_ENV must be exactly local-disposable.");
  }

  if (
    env.GITHUB_ACTIONS === "true" &&
    (
      env.RUNNER_ENVIRONMENT !== "github-hosted" ||
      env.RUNNER_OS !== "Linux" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_REF !== "refs/heads/main" ||
      env.GITHUB_REPOSITORY !== "tamseelishteyaque448-create/AWS-ISLEC"
    )
  ) {
    throw new DisposableE2EConfigError(
      "Disposable integration requires GitHub-hosted workflow_dispatch on the repository main branch.",
    );
  }

  if (
    env.GITHUB_ACTIONS === "true" &&
    (
      !env.RUNNER_TEMP ||
      !isAbsolute(env.RUNNER_TEMP) ||
      !env.E2E_SUPABASE_WORKDIR ||
      !isAbsolute(env.E2E_SUPABASE_WORKDIR) ||
      !env.E2E_ENV_FILE ||
      !isAbsolute(env.E2E_ENV_FILE) ||
      !isPathInside(resolve(env.RUNNER_TEMP), resolve(env.E2E_SUPABASE_WORKDIR)) ||
      !isPathInside(resolve(env.RUNNER_TEMP), resolve(env.E2E_ENV_FILE))
    )
  ) {
    throw new DisposableE2EConfigError(
      "Disposable integration requires an isolated temporary Supabase project for this workflow run.",
    );
  }

  const workdir = resolve(env.E2E_SUPABASE_WORKDIR || root);
  const supabaseConfig = configText ??
    readFileSync(resolve(workdir, "supabase", "config.toml"), "utf8");
  const projectId = readProjectId(supabaseConfig);
  validateHostedWorkflowTarget(env, workdir, projectId);
  if (env.GITHUB_ACTIONS === "true" && existsSync(resolve(workdir, "supabase", ".temp", "project-ref"))) {
    throw new DisposableE2EConfigError("Disposable integration must not use a linked Supabase project.");
  }

  const appUrl = parseLoopbackHttpUrl(
    requireNonEmpty(env, "E2E_BASE_URL"),
    "E2E_BASE_URL",
    new Set(["127.0.0.1", "localhost"]),
  );
  const configuredAppUrl = parseLoopbackHttpUrl(
    requireNonEmpty(env, "APP_URL"),
    "APP_URL",
    new Set(["127.0.0.1", "localhost"]),
  );
  if (appUrl.origin !== configuredAppUrl.origin) {
    throw new DisposableE2EConfigError("APP_URL must match E2E_BASE_URL.");
  }

  const localApiPort = readLocalApiPort(supabaseConfig);
  const supabaseUrl = parseLoopbackHttpUrl(
    requireNonEmpty(env, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
    new Set(["127.0.0.1"]),
  );
  if (supabaseUrl.port !== String(localApiPort)) {
    throw new DisposableE2EConfigError("NEXT_PUBLIC_SUPABASE_URL does not match the local Supabase API endpoint.");
  }

  const publishableKey = requireNonEmpty(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const credentials = {};
  for (const key of credentialKeys) credentials[key] = requireNonEmpty(env, key);

  const roleEmails = [
    credentials.E2E_OWNER_EMAIL,
    credentials.E2E_CONTRIBUTOR_EMAIL,
    credentials.E2E_ADMIN_EMAIL,
    credentials.E2E_NON_ADMIN_EMAIL,
  ].map((email) => email.toLowerCase());
  if (new Set(roleEmails).size !== roleEmails.length) {
    throw new DisposableE2EConfigError("Each disposable E2E role must use a distinct account.");
  }

  const projectIds = {};
  for (const key of projectFixtureKeys) {
    const value = requireNonEmpty(env, key);
    if (!uuidPattern.test(value)) {
      throw new DisposableE2EConfigError(`${key} must be an explicitly configured UUID.`);
    }
    projectIds[key] = value;
  }
  if (new Set(Object.values(projectIds)).size !== projectFixtureKeys.length) {
    throw new DisposableE2EConfigError("Disposable project fixture IDs must be distinct.");
  }

  return {
    appUrl: appUrl.origin,
    appHost: appUrl.hostname,
    appPort: Number(appUrl.port),
    supabaseWorkdir: workdir,
    supabaseUrl: supabaseUrl.origin,
    supabaseHost: supabaseUrl.hostname,
    supabasePort: localApiPort,
    projectId,
    environment: {
      E2E_ENV: "local-disposable",
      E2E_BASE_URL: appUrl.origin,
      APP_URL: appUrl.origin,
      E2E_SUPABASE_PORT: String(localApiPort),
      ...(env.E2E_ENV_FILE ? { E2E_ENV_FILE: resolve(env.E2E_ENV_FILE) } : {}),
      E2E_SUPABASE_WORKDIR: workdir,
      E2E_SUPABASE_PROJECT_ID: projectId,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl.origin,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      ...credentials,
      ...projectIds,
    },
  };
}

export function loadDisposableE2EEnvironment(path = process.env.E2E_ENV_FILE || envFilePath) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw new DisposableE2EConfigError(
      "Missing .env.e2e.local. Create it only after approval for disposable local fixture provisioning.",
    );
  }

  const values = parseEnvironmentFile(contents);
  const runnerContextKeys = [
    "GITHUB_ACTIONS",
    "GITHUB_EVENT_NAME",
    "GITHUB_REF",
    "GITHUB_REPOSITORY",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "RUNNER_ENVIRONMENT",
    "RUNNER_OS",
    "RUNNER_TEMP",
  ];
  const runnerContext = Object.fromEntries(
    runnerContextKeys
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  return validateDisposableE2EEnvironment({
    ...values,
    ...runnerContext,
    E2E_ENV_FILE: resolve(path),
  });
}

export function getSafeDisposableChildEnvironment(environment, inherited = process.env) {
  const childEnvironment = { ...inherited };
  for (const key of Object.keys(childEnvironment)) {
    if (/^(?:E2E_|QA_|NEXT_PUBLIC_SUPABASE_|SUPABASE_|APP_URL$|DATABASE_URL$|POSTGRES_)/i.test(key)) {
      delete childEnvironment[key];
    }
  }
  return { ...childEnvironment, ...environment };
}
