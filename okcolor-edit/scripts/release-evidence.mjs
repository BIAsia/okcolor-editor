#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function runOk(command) {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const checks = [
  { name: 'preflight', command: 'npm run preflight:collab' },
  { name: 'unit tests', command: 'npm run test' },
  { name: 'build', command: 'npm run build' },
  { name: 'plugin smoke', command: 'npm run smoke:plugin' }
];

const startedAt = new Date();
const startedAtIso = startedAt.toISOString();

const results = checks.map((check) => ({
  ...check,
  status: runOk(check.command) ? 'pass' : 'fail'
}));

const failed = results.find((item) => item.status === 'fail');
const branch = run('git rev-parse --abbrev-ref HEAD');
const commit = run('git rev-parse HEAD');

const evidence = {
  generatedAt: startedAtIso,
  branch,
  commit,
  releaseGate: failed ? 'blocked' : 'passed',
  checks: results
};

await mkdir('docs/release-evidence', { recursive: true });
await writeFile('docs/release-evidence/latest.json', `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

if (failed) {
  console.error(`[release:evidence] blocked by failed check: ${failed.name}`);
  process.exit(1);
}

console.log('[release:evidence] automated gate passed and evidence written to docs/release-evidence/latest.json');
