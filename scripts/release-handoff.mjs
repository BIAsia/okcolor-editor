#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const evidencePath = 'docs/release-evidence/latest.json';
const outPath = 'docs/release-evidence/rc-handoff.md';
const limitations = process.argv.slice(2).join(' ').trim() || 'None noted.';

const raw = await readFile(evidencePath, 'utf8');
const evidence = JSON.parse(raw);

if (evidence.releaseGate !== 'passed') {
  console.error('[release:handoff] release gate is not passed; run npm run release:evidence first');
  process.exit(1);
}

const rows = evidence.checks
  .map((check) => `- ${check.name}: ${check.status}`)
  .join('\n');

const markdown = [
  '# RC Handoff',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Evidence generated at: ${evidence.generatedAt}`,
  `- Branch: ${evidence.branch}`,
  `- Commit: ${evidence.commit}`,
  `- Automated gate: ${evidence.releaseGate}`,
  '',
  '## Automated checks',
  rows,
  '',
  '## Known limitations',
  `- ${limitations}`,
  ''
].join('\n');

await mkdir('docs/release-evidence', { recursive: true });
await writeFile(outPath, markdown, 'utf8');
console.log('[release:handoff] wrote docs/release-evidence/rc-handoff.md');
