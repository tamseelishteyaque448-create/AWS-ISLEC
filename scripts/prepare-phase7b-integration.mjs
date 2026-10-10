import { appendFileSync, cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";

function requireHostedDispatchEnvironment(env) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REPOSITORY !== "tamseelishteyaque448-create/AWS-ISLEC" ||
    !env.GITHUB_SHA ||
    !/^[0-9a-f]{40}$/i.test(env.GITHUB_SHA) ||
    !/^\d+$/.test(env.GITHUB_RUN_ID ?? "") ||
    !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? "") ||
    !env.RUNNER_TEMP ||
    !isAbsolute(env.RUNNER_TEMP) ||
    !env.GITHUB_ENV ||
    !isAbsolute(env.GITHUB_ENV)
  ) {
    throw new Error("Phase 7B integration setup requires the repository's GitHub-hosted main dispatch runner.");
  }
}

requireHostedDispatchEnvironment(process.env);

const developerEnvironmentFiles = readdirSync(process.cwd()).filter(
  (fileName) => fileName.startsWith(".env") && fileName !== ".env.example",
);
if (developerEnvironmentFiles.length) {
  throw new Error("Unexpected developer environment file detected on the ephemeral runner.");
}

const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (revision !== process.env.GITHUB_SHA) {
  throw new Error("Checked-out revision does not match the GitHub workflow dispatch revision.");
}

const projectId = `aws-islec-e2e-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
const runnerTemp = resolve(process.env.RUNNER_TEMP);
const workdir = resolve(runnerTemp, `phase7b-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`);
const pathFromTemp = relative(runnerTemp, workdir);
if (
  pathFromTemp === "" ||
  pathFromTemp === ".." ||
  pathFromTemp.startsWith(`..${sep}`) ||
  isAbsolute(pathFromTemp)
) {
  throw new Error("Temporary Supabase work directory escaped the GitHub runner's temporary directory.");
}

const supabaseSource = resolve("supabase");
const supabaseTarget = resolve(workdir, "supabase");
const sourceConfig = readFileSync(resolve(supabaseSource, "config.toml"), "utf8");
const isolatedConfig = sourceConfig.replace(
  /^project_id\s*=\s*"AWS-ISLEC"\s*$/m,
  `project_id = "${projectId}"`,
);
if (isolatedConfig === sourceConfig) {
  throw new Error("The repository Supabase project ID no longer matches the expected isolated-copy contract.");
}

mkdirSync(workdir);
mkdirSync(supabaseTarget);
writeFileSync(resolve(supabaseTarget, "config.toml"), isolatedConfig, { flag: "wx" });
writeFileSync(
  resolve(supabaseTarget, "seed.sql"),
  readFileSync(resolve(supabaseSource, "seed.sql")),
  { flag: "wx" },
);
cpSync(resolve(supabaseSource, "migrations"), resolve(supabaseTarget, "migrations"), {
  recursive: true,
  errorOnExist: true,
  force: false,
});
cpSync(resolve(supabaseSource, ".gitignore"), resolve(supabaseTarget, ".gitignore"), {
  errorOnExist: true,
  force: false,
});

const envFile = resolve(workdir, ".env.e2e.local");
const githubEnvFile = resolve(process.env.GITHUB_ENV);
const envFileRelative = relative(runnerTemp, envFile);
const githubEnvRelative = relative(runnerTemp, githubEnvFile);
if (
  envFileRelative === "" ||
  envFileRelative === ".." ||
  envFileRelative.startsWith(`..${sep}`) ||
  isAbsolute(envFileRelative) ||
  githubEnvRelative === "" ||
  githubEnvRelative === ".." ||
  githubEnvRelative.startsWith(`..${sep}`) ||
  isAbsolute(githubEnvRelative)
) {
  throw new Error("Phase 7B integration environment files must remain inside the runner's temporary directory.");
}

appendFileSync(
  githubEnvFile,
  [
    `E2E_SUPABASE_WORKDIR=${workdir}`,
    `E2E_SUPABASE_PROJECT_ID=${projectId}`,
    `E2E_ENV_FILE=${envFile}`,
    "",
  ].join("\n"),
  { encoding: "utf8" },
);

console.log(`Prepared isolated Supabase work directory for ${projectId}.`);
console.log(`Checked-out revision: ${revision}`);
