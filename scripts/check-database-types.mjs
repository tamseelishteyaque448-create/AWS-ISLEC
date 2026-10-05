#!/usr/bin/env node
/**
 * Fails when the committed `lib/types/database.ts` does not match the schema
 * that Supabase generates from a real database.
 *
 * Modes:
 *   --local    generate from the local dev database (correctness: migrations
 *              are the source of truth per AGENTS.md)
 *   --linked   generate from the linked hosted project (parity: proves a hosted
 *              environment has actually received the migrations)
 *   --db-url   generate from an explicit Postgres connection string
 *   --write    rewrite lib/types/database.ts instead of failing
 *
 * The Supabase CLI adds scaffolding that has nothing to do with this project's
 * schema (the `__InternalSupabase` block, banner comments). Those lines are
 * stripped before comparison so the check reports real schema drift instead of
 * CLI-version churn.
 *
 * Exit codes: 0 = in sync (or rewritten), 1 = drift detected, 2 = could not run.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGET = resolve("lib", "types", "database.ts");
const SCAFFOLDING = [/^\s*\/\//, /^\s*__InternalSupabase:\s*\{/, /^\s*\/\/ Allows to automatically/];

function parseArgs(argv) {
  const options = { mode: "local", write: false };
  for (const arg of argv) {
    if (arg === "--write") options.write = true;
    else if (arg === "--local") options.mode = "local";
    else if (arg === "--linked") options.mode = "linked";
    else if (arg === "--db-url") options.mode = "db-url";
    else if (arg.startsWith("--db-url=")) {
      options.mode = "db-url";
      options.url = arg.slice("--db-url=".length);
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }
  return options;
}

const POSTGRES_URL = /^postgres(ql)?:\/\/[A-Za-z0-9._~%!$&'()*+,;=:@/?-]+$/;

function generate(options) {
  const args = ["supabase", "gen", "types", "typescript"];
  if (options.mode === "local") args.push("--local");
  else if (options.mode === "linked") args.push("--linked");
  else if (options.mode === "db-url") {
    // `shell: true` is required for npx on Windows. Validate the one piece of
    // caller-controlled input so it cannot break out into a shell command.
    if (!options.url || !POSTGRES_URL.test(options.url)) {
      process.stderr.write("--db-url must be a postgres:// or postgresql:// URL.\n");
      process.exit(2);
    }
    args.push("--db-url", options.url);
  }

  // The CLI writes the type file to stdout.
  try {
    return execFileSync("npx", args, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      shell: true,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error.stderr || error.stdout || error.message;
    process.stderr.write(
      `Could not generate types (--${options.mode}).\n` +
        "Start a database first, or point at a reachable one.\n" +
        `${String(detail).split("\n").slice(0, 4).join("\n")}\n`,
    );
    process.exit(2);
  }
}

function normalize(text) {
  return text
    .split("\n")
    .filter((line) => !SCAFFOLDING.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function describe(label, text) {
  const objects = new Set();
  // Supabase CLI renders functions two ways depending on version: the classic
  // multi-line form (`name: {` then Args/Returns) and a newer single-line form
  // (`name: { Args: never; Returns: boolean }`). Match both, or zero-argument
  // functions look like they vanished and the report becomes false drift.
  const pattern = /^ {6}([a-z_][a-z0-9_]*): \{.*$/gm;
  for (const match of text.matchAll(pattern)) objects.add(match[1]);
  return { label, objects };
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(
    "Usage: npm run types:check -- [--local|--linked|--db-url=URL] [--write]\n",
  );
  process.exit(0);
}

let committed;
try {
  committed = readFileSync(TARGET, "utf8");
} catch {
  process.stderr.write(`Missing ${TARGET}. Run with --write to create it.\n`);
  process.exit(2);
}

const generatedRaw = generate(options);
const generated = normalize(generatedRaw);
const current = normalize(committed);

if (generated === current) {
  process.stdout.write(
    `types:check PASS - lib/types/database.ts matches the ${options.mode} schema.\n`,
  );
  process.exit(0);
}

if (options.write) {
  writeFileSync(TARGET, generatedRaw, "utf8");
  process.stdout.write(
    `types:check WROTE lib/types/database.ts from the ${options.mode} schema.\n`,
  );
  process.exit(0);
}

const before = describe("committed", current);
const after = describe("generated", generated);
const missing = [...after.objects].filter((name) => !before.objects.has(name)).sort();
const extra = [...before.objects].filter((name) => !after.objects.has(name)).sort();

process.stderr.write("types:check FAIL - lib/types/database.ts has drifted.\n\n");
if (missing.length) {
  process.stderr.write(`In the ${options.mode} schema but not in the committed types:\n`);
  for (const name of missing) process.stderr.write(`  + ${name}\n`);
}
if (extra.length) {
  process.stderr.write(`In the committed types but not in the ${options.mode} schema:\n`);
  for (const name of extra) process.stderr.write(`  - ${name}\n`);
}
if (!missing.length && !extra.length) {
  process.stderr.write(
    "Object names match, so the difference is in a column, type, or function body.\n",
  );
}
process.stderr.write(
  "\nIf the database is the source of truth, re-run with --write.\n" +
    "Per AGENTS.md, checked-in migrations are the source of truth for the project;\n" +
    "a mismatch may mean a hosted environment has not received its migrations yet.\n",
);
process.exit(1);