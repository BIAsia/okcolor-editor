#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

const branch = run("git rev-parse --abbrev-ref HEAD");
const blocked = new Set(["main", "master"]);

if (blocked.has(branch)) {
  console.error(
    `[preflight:collab] Blocked: current branch is '${branch}'. Start work from a short-lived branch (feat/*, fix/*, chore/*).`
  );
  process.exit(1);
}

console.log(
  `[preflight:collab] OK on '${branch}'. Workflow source: docs/github-collab.md`
);
