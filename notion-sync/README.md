# Mona x Notion Sync

This folder provides a local sync service for Mona's planning and records.

## What gets synced
- Daily planning
- Todos
- Agreements / owner directives
- Reading notes / summaries (next step)

## One-time setup (Owner)
1. Create a Notion integration at https://www.notion.so/my-integrations
2. Copy Internal Integration Token
3. Create 2 databases in Notion (or use existing):
   - Daily DB (properties: Name title, Date date, Type select)
   - Todo DB (properties: Name title, Status select, Priority select)
4. Share both databases with your integration (Invite -> integration)
5. Copy `.env.example` to `.env` and fill IDs/token

## Install

```bash
cd notion-sync
npm install
```

## Test sync

```bash
npm run sync:daily -- "Owner morning focus" "Mona execution plan" "first report"
npm run sync:tasks -- "okcolor-edit: ship v0.3 diagnostics" "P1" "Doing"
```

## Todo rule (must-read before sync)
- Canonical status is `Todo | Doing | Done | Dropped` (`Dropped` means no longer needed).
- Canonical priority is `P0 | P1 | P2` (`High/Medium/Low` will be normalized to `P1/P2/P2`).
- Todo item naming should follow `<project>: <version/milestone> <clear deliverable>`.
- `okcolor` family names are canonicalized to `okcolor-edit: ...` during sync/cleanup.
- Avoid noisy status text in title (`[status]`, `[done]`, commit hash, progress chatter).
- Sync scripts read `config/todo-rules.json` first; this is the single rule source.
- Use `npm run normalize:tasks` to clean status/priority/naming drift.
- Use `npm run dedupe:tasks` to merge duplicate items and archive duplicates.

## Operating mode (local-first)
- Source of truth is local files/state in workspace.
- Notion is a periodic sync target (write-out), not a read dependency for daily logic.
- `scripts/log-agreement.mjs` first appends to `notion-sync/logs/agreements.jsonl`, then writes to Notion.
- Heartbeat should avoid network-heavy sync; use cron/manual runs for Notion sync.

## Notes
- Database IDs are from Notion URL (32-char UUID without query params).
- If property names differ, edit scripts in `scripts/`.
