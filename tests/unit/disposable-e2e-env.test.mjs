import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  getSafeDisposableChildEnvironment,
  loadDisposableE2EEnvironment,
  validateDisposableE2EEnvironment,
} from "../../scripts/disposable-e2e-env.mjs";

const configText = readFileSync(resolve("supabase", "config.toml"), "utf8");
const completeEnvironment = {
  E2E_ENV: "local-disposable",
  E2E_BASE_URL: "http://127.0.0.1:3001",
  APP_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-publishable-test-value",
  SUPABASE_SECRET_KEY: "local-secret-test-value",
  E2E_OWNER_EMAIL: "owner@example.test",
  E2E_OWNER_PASSWORD: "owner-test-password",
  E2E_CONTRIBUTOR_EMAIL: "contributor@example.test",
  E2E_CONTRIBUTOR_PASSWORD: "contributor-test-password",
  E2E_ADMIN_EMAIL: "admin@example.test",
  E2E_ADMIN_PASSWORD: "admin-test-password",
  E2E_NON_ADMIN_EMAIL: "non-admin@example.test",
  E2E_NON_ADMIN_PASSWORD: "non-admin-test-password",
  E2E_DELETE_PROJECT_ID: "10000000-0000-4000-8000-000000000001",
  E2E_ARCHIVED_PROJECT_ID: "10000000-0000-4000-8000-000000000002",
  E2E_PENDING_PROJECT_ID: "10000000-0000-4000-8000-000000000003",
  E2E_JOIN_PROOF_PROJECT_ID: "10000000-0000-4000-8000-000000000004",
};
const runnerTemp = resolve("runner-temp");
const isolatedWorkdir = resolve(runnerTemp, "aws-islec-phase7b-12345-1");
const isolatedProjectId = "aws-islec-e2e-12345-1";
const isolatedConfigText = `project_id = "${isolatedProjectId}"\n[api]\nport = 54321`;
const hostedWorkflowEnvironment = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "tamseelishteyaque448-create/AWS-ISLEC",
  GITHUB_RUN_ID: "12345",
  GITHUB_RUN_ATTEMPT: "1",
  RUNNER_ENVIRONMENT: "github-hosted",
  RUNNER_OS: "Linux",
  RUNNER_TEMP: runnerTemp,
  E2E_ENV_FILE: resolve(runnerTemp, "phase7b", ".env.e2e.local"),
  E2E_SUPABASE_WORKDIR: isolatedWorkdir,
  E2E_SUPABASE_PROJECT_ID: isolatedProjectId,
};

function validate(overrides = {}) {
  return validateDisposableE2EEnvironment(
    { ...completeEnvironment, ...overrides },
    { configText },
  );
}

test("accepts the explicit disposable marker, loopback app, and configured local Supabase endpoint", () => {
  const target = validate();
  assert.equal(target.environment.E2E_ENV, "local-disposable");
  assert.equal(target.appUrl, "http://127.0.0.1:3001");
  assert.equal(target.supabaseUrl, "http://127.0.0.1:54321");
  assert.equal(target.supabasePort, 54321);
});

test("accepts a per-run isolated project only on the expected GitHub-hosted manual runner", () => {
  const target = validateDisposableE2EEnvironment(
    { ...completeEnvironment, ...hostedWorkflowEnvironment },
    { configText: isolatedConfigText },
  );

  assert.equal(target.projectId, isolatedProjectId);
  assert.equal(target.supabaseWorkdir, isolatedWorkdir);
});

test("rejects a non-hosted runner, non-manual event, or non-main revision", () => {
  for (const [key, value] of [
    ["RUNNER_ENVIRONMENT", "self-hosted"],
    ["GITHUB_EVENT_NAME", "push"],
    ["GITHUB_REF", "refs/heads/feature"],
    ["GITHUB_REPOSITORY", "someone-else/AWS-ISLEC"],
  ]) {
    assert.throws(
      () => validateDisposableE2EEnvironment(
        { ...completeEnvironment, ...hostedWorkflowEnvironment, [key]: value },
        { configText: isolatedConfigText },
      ),
      /GitHub-hosted workflow_dispatch on the repository main branch/,
    );
  }
});

test("rejects missing, non-temporary, or non-unique CI Supabase targets", () => {
  for (const [key, value] of [
    ["E2E_SUPABASE_WORKDIR", undefined],
    ["E2E_SUPABASE_WORKDIR", resolve("supabase")],
    ["E2E_SUPABASE_PROJECT_ID", "AWS-ISLEC"],
    ["E2E_SUPABASE_PROJECT_ID", "aws-islec-e2e-other-run"],
  ]) {
    assert.throws(
      () => validateDisposableE2EEnvironment(
        { ...completeEnvironment, ...hostedWorkflowEnvironment, [key]: value },
        { configText: isolatedConfigText },
      ),
      /isolated temporary Supabase project for this workflow run/,
    );
  }
});

test("the env-file loader validates the actual GitHub runner context", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "phase7b-runner-context-"));
  const workdir = join(tempRoot, "supabase-project");
  const configDir = join(workdir, "supabase");
  const envFile = join(workdir, ".env.e2e.local");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "config.toml"), isolatedConfigText);
  writeFileSync(
    envFile,
    Object.entries({
      ...completeEnvironment,
      SUPABASE_SECRET_KEY: undefined,
      E2E_SUPABASE_WORKDIR: workdir,
      E2E_SUPABASE_PROJECT_ID: isolatedProjectId,
    })
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );

  const runnerVariables = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "tamseelishteyaque448-create/AWS-ISLEC",
    GITHUB_RUN_ID: "12345",
    GITHUB_RUN_ATTEMPT: "1",
    RUNNER_ENVIRONMENT: "self-hosted",
    RUNNER_OS: "Linux",
    RUNNER_TEMP: tempRoot,
    E2E_ENV_FILE: envFile,
  };
  const originalValues = Object.fromEntries(
    Object.keys(runnerVariables).map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, runnerVariables);
    assert.throws(
      () => loadDisposableE2EEnvironment(envFile),
      /GitHub-hosted workflow_dispatch on the repository main branch/,
    );
  } finally {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("rejects a missing environment marker", () => {
  assert.throws(() => validate({ E2E_ENV: undefined }), /E2E_ENV must be exactly local-disposable/);
});

test("rejects QA and production environment markers", () => {
  for (const E2E_ENV of ["qa", "production"]) {
    assert.throws(() => validate({ E2E_ENV }), /E2E_ENV must be exactly local-disposable/);
  }
});

test("rejects hosted, QA-class, and production-class Supabase URLs", () => {
  for (const NEXT_PUBLIC_SUPABASE_URL of [
    "https://project.supabase.co",
    "https://qa-project.supabase.co",
    "https://production-project.supabase.co",
  ]) {
    assert.throws(
      () => validate({ NEXT_PUBLIC_SUPABASE_URL }),
      /NEXT_PUBLIC_SUPABASE_URL must use an allowed loopback HTTP URL/,
    );
  }
});

test("rejects an app URL hosted away from loopback", () => {
  assert.throws(
    () => validate({ E2E_BASE_URL: "https://app.example.test:3001", APP_URL: "https://app.example.test:3001" }),
    /E2E_BASE_URL must use an allowed loopback HTTP URL/,
  );
});

test("rejects missing Supabase and app URLs", () => {
  assert.throws(() => validate({ NEXT_PUBLIC_SUPABASE_URL: undefined }), /Missing required disposable E2E setting/);
  assert.throws(() => validate({ E2E_BASE_URL: undefined }), /Missing required disposable E2E setting/);
  assert.throws(() => validate({ APP_URL: undefined }), /Missing required disposable E2E setting/);
});

test("rejects a Supabase URL on a port different from supabase/config.toml", () => {
  assert.throws(
    () => validate({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54322" }),
    /does not match the local Supabase API endpoint/,
  );
});

test("rejects a different app URL and APP_URL", () => {
  assert.throws(
    () => validate({ APP_URL: "http://localhost:3001" }),
    /APP_URL must match E2E_BASE_URL/,
  );
});

test("rejects missing credentials and fixture IDs", () => {
  for (const key of [
    "E2E_OWNER_EMAIL",
    "E2E_OWNER_PASSWORD",
    "E2E_CONTRIBUTOR_EMAIL",
    "E2E_CONTRIBUTOR_PASSWORD",
    "E2E_ADMIN_EMAIL",
    "E2E_ADMIN_PASSWORD",
    "E2E_NON_ADMIN_EMAIL",
    "E2E_NON_ADMIN_PASSWORD",
    "E2E_DELETE_PROJECT_ID",
    "E2E_ARCHIVED_PROJECT_ID",
    "E2E_PENDING_PROJECT_ID",
    "E2E_JOIN_PROOF_PROJECT_ID",
  ]) {
    assert.throws(() => validate({ [key]: undefined }), /Missing required disposable E2E setting/);
  }
});

test("rejects duplicate identities across all roles and duplicate project fixture IDs", () => {
  assert.throws(
    () => validate({ E2E_NON_ADMIN_EMAIL: "contributor@example.test" }),
    /Each disposable E2E role must use a distinct account/,
  );
  assert.throws(() => validate({ E2E_ADMIN_EMAIL: "owner@example.test" }), /distinct account/);
  assert.throws(
    () => validate({ E2E_PENDING_PROJECT_ID: completeEnvironment.E2E_DELETE_PROJECT_ID }),
    /fixture IDs must be distinct/,
  );
  assert.throws(
    () => validate({ E2E_JOIN_PROOF_PROJECT_ID: completeEnvironment.E2E_DELETE_PROJECT_ID }),
    /fixture IDs must be distinct/,
  );
});

test("does not require or pass a server-side database secret to the disposable app", () => {
  const target = validate({ SUPABASE_SECRET_KEY: "unnecessary-secret" });
  assert.equal("SUPABASE_SECRET_KEY" in target.environment, false);
});

test("removes inherited hosted targets and replaces them with validated local values", () => {
  const target = validate();
  const child = getSafeDisposableChildEnvironment(target.environment, {
    E2E_ENV: "qa",
    QA_BASE_URL: "https://qa.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
    SUPABASE_SECRET_KEY: "inherited-secret",
    APP_URL: "https://production.example.test",
    PATH: "preserved",
  });

  assert.equal(child.E2E_ENV, "local-disposable");
  assert.equal(child.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.notEqual(child.SUPABASE_SECRET_KEY, "inherited-secret");
  assert.equal(child.APP_URL, "http://127.0.0.1:3001");
  assert.equal(child.QA_BASE_URL, undefined);
  assert.equal(child.E2E_NON_ADMIN_EMAIL, "non-admin@example.test");
  assert.equal(child.SUPABASE_SECRET_KEY, undefined);
  assert.equal(child.PATH, "preserved");
});

test("keeps disposable server reuse disabled", () => {
  const config = readFileSync(resolve("playwright.disposable.config.ts"), "utf8");
  assert.match(config, /reuseExistingServer:\s*false/);
});

test("routes legacy reward fixture SQL through the validated Supabase work directory", () => {
  const spec = readFileSync(
    resolve("tests", "e2e", "disposable", "build-prove-phase6-review.spec.ts"),
    "utf8",
  );
  assert.match(spec, /["']supabase["'],\s*["']--workdir["'],\s*supabaseWorkdir/);
});

test("authenticates non-admin using its own credentials and browser context", () => {
  const roles = readFileSync(resolve("tests", "e2e", "disposable", "fixtures", "roles.ts"), "utf8");
  assert.match(roles, /nonAdmin:\s*\["E2E_NON_ADMIN_EMAIL",\s*"E2E_NON_ADMIN_PASSWORD"\]/);
  assert.match(roles, /nonAdminPage:[\s\S]*newAuthenticatedRolePage\(browser,\s*"nonAdmin"\)/);
  assert.match(roles, /browser\.newContext\(\{\s*baseURL\s*\}\)/);
});

test("keeps .env.e2e.local ignored by git", () => {
  assert.doesNotThrow(() => execFileSync("git", ["check-ignore", "-q", ".env.e2e.local"]));
});

test(".env.example carries placeholders, never a real project reference", () => {
  const example = readFileSync(resolve(".env.example"), "utf8");

  // A Supabase project ref is 20 lowercase letters. Shipping one in the public
  // template means a fresh `cp .env.example .env.local` points a new machine at
  // someone's real database, which is exactly what AGENTS.md forbids.
  const projectRefs = example.match(/[a-z]{20}/g) ?? [];
  assert.deepEqual(
    projectRefs,
    [],
    `.env.example must not contain a Supabase project ref, found: ${projectRefs.join(", ")}`,
  );

  // Publishable keys are public by design, but the template should still use an
  // obvious placeholder rather than a working credential.
  for (const key of example.match(/sb_publishable_[^\s"']+/g) ?? []) {
    assert.match(
      key,
      /replace|your|example|placeholder/i,
      `.env.example must use an obvious placeholder publishable key, found: ${key}`,
    );
  }

  // Never let a secret key slip into the public template. Match the value only,
  // not the `sb_secret_` name appearing inside explanatory prose.
  for (const key of example.match(/sb_secret_[^\s"']+/g) ?? []) {
    assert.match(
      key,
      /replace|your|example|placeholder/i,
      `.env.example must not hold a real secret key, found: ${key}`,
    );
  }
});

test("keeps next-env.d.ts out of version control", () => {
  // Next.js regenerates this file and rewrites its type imports depending on
  // whether `next dev` or `next build` ran last, so a tracked copy churns.
  assert.doesNotThrow(() => execFileSync("git", ["check-ignore", "-q", "next-env.d.ts"]));
});
