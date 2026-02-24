# GitHub Collaboration Workflow

This document is the single source of truth for how `okcolor-edit` ships code.

## Branching model

- `main` is protected and never receives direct pushes.
- Use short-lived branches named:
  - `feat/<topic>`
  - `fix/<topic>`
  - `chore/<topic>`
- Open a Pull Request to `main` for every change.

## Daily development flow

1. Sync local default branch:
   - `git checkout master`
   - `git pull --ff-only`
2. Create a short-lived branch from latest default branch.
3. Implement changes and run local checks (`npm run test`, `npm run build`).
4. Push the branch and open a PR to `main`.
5. Merge only after checks/review pass.

## Guardrails

- Before coding, run `npm run preflight:collab`.
- If your current branch is `main` or `master`, preflight fails to prevent accidental direct work on protected branches.
- If this workflow changes, update this file first, then update scripts that enforce it.
