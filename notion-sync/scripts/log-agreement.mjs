import 'dotenv/config';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Client } from '@notionhq/client';

const required = ['NOTION_TOKEN'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const topic = process.argv[2] || 'Agreement';
const sourceUrl = process.argv[3] || '';
const keyPoints = process.argv[4] || '';
const actionables = process.argv[5] || '';

const agreementDbId = process.env.NOTION_AGREEMENTS_DB_ID || process.env.NOTION_READING_DB_ID;
if (!agreementDbId) {
  console.error('Missing env: NOTION_AGREEMENTS_DB_ID (or legacy NOTION_READING_DB_ID fallback)');
  process.exit(1);
}

if (!process.env.NOTION_AGREEMENTS_DB_ID && process.env.NOTION_READING_DB_ID) {
  console.warn('NOTION_AGREEMENTS_DB_ID not set, falling back to NOTION_READING_DB_ID');
}

const localLogPath = resolve(process.cwd(), 'logs', 'agreements.jsonl');
mkdirSync(dirname(localLogPath), { recursive: true });
appendFileSync(
  localLogPath,
  `${JSON.stringify({
    timestamp: new Date().toISOString(),
    topic,
    sourceUrl,
    keyPoints,
    actionables
  })}\n`,
  'utf8'
);

function rt(content) {
  return [{ type: 'text', text: { content } }];
}

await notion.pages.create({
  parent: { database_id: agreementDbId },
  properties: {
    Name: { title: rt(topic) },
    Type: { select: { name: 'Agreement' } },
    Source: sourceUrl ? { url: sourceUrl } : { url: null },
    'Key Points': { rich_text: rt(keyPoints.slice(0, 1900)) },
    Actionables: { rich_text: rt(actionables.slice(0, 1900)) },
    Date: { date: { start: new Date().toISOString().slice(0, 10) } }
  }
});

console.log('Agreement saved (local + Notion).');
