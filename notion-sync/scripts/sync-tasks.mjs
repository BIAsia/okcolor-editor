import 'dotenv/config';
import { Client } from '@notionhq/client';
import { loadTodoRules, normalizeTaskFields } from './lib/todo-rules.mjs';

const required = ['NOTION_TOKEN', 'NOTION_TODO_DB_ID'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const rules = await loadTodoRules();

const task = process.argv[2] || 'Unspecified task';
const priorityArg = process.argv[3] || '';
const statusArg = process.argv[4] || '';

const normalized = normalizeTaskFields(
  {
    title: task,
    status: statusArg,
    priority: priorityArg
  },
  rules
);

function getTitle(page) {
  return (page.properties?.Name?.title || []).map((t) => t.plain_text).join('');
}

async function findByTitle(databaseId, title) {
  const res = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Name',
      title: { equals: title }
    },
    page_size: 1
  });
  return res.results[0];
}

const existing = await findByTitle(process.env.NOTION_TODO_DB_ID, normalized.title);

if (existing) {
  await notion.pages.update({
    page_id: existing.id,
    properties: {
      Status: { select: { name: normalized.status } },
      Priority: { select: { name: normalized.priority } }
    }
  });
  const previousTitle = getTitle(existing);
  console.log(
    `Task updated in Notion (${normalized.status}, ${normalized.priority}): ${previousTitle}`
  );
} else {
  await notion.pages.create({
    parent: { database_id: process.env.NOTION_TODO_DB_ID },
    properties: {
      Name: { title: [{ text: { content: normalized.title } }] },
      Status: { select: { name: normalized.status } },
      Priority: { select: { name: normalized.priority } }
    }
  });
  console.log(
    `Task created in Notion (${normalized.status}, ${normalized.priority}): ${normalized.title}`
  );
}
