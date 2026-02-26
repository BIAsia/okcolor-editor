#!/usr/bin/env node
import { execSync } from 'node:child_process';

const checks = [
  { name: 'preflight', command: 'npm run preflight:collab' },
  { name: 'unit tests', command: 'npm run test' },
  { name: 'build', command: 'npm run build' },
  { name: 'plugin smoke', command: 'npm run smoke:plugin' }
];

const results = [];

for (const check of checks) {
  process.stdout.write(`[release] ${check.name}... `);
  try {
    execSync(check.command, { stdio: 'ignore' });
    results.push({ ...check, status: 'pass' });
    console.log('PASS');
  } catch {
    results.push({ ...check, status: 'fail' });
    console.log('FAIL');
    break;
  }
}

const failed = results.find((r) => r.status === 'fail');
if (failed) {
  console.error(`\n[release] blocked by failed check: ${failed.name}`);
  process.exit(1);
}

console.log('\n[release] readiness gate passed. Plugin is ready for manual Figma verification and RC tagging.');
