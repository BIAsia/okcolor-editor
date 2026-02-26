#!/usr/bin/env node
import { readFile, access } from 'node:fs/promises';

async function ensureFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing required file: ${path}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifestRaw = await readFile('manifest.json', 'utf8');
const manifest = JSON.parse(manifestRaw);

const mainPath = manifest.main;
const uiPath = manifest.ui;

assert(typeof mainPath === 'string' && mainPath.length > 0, 'manifest.main must be a non-empty string');
assert(typeof uiPath === 'string' && uiPath.length > 0, 'manifest.ui must be a non-empty string');

await ensureFile(mainPath);
await ensureFile(uiPath);

const codeBundle = await readFile(mainPath, 'utf8');
assert(codeBundle.includes('figma.showUI'), 'Plugin bundle is missing figma.showUI entry wiring');
assert(codeBundle.includes('figma.ui.onmessage'), 'Plugin bundle is missing figma.ui.onmessage handler wiring');

console.log('[smoke:plugin] OK manifest + dist wiring checks passed');
