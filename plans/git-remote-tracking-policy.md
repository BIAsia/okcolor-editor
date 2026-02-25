# Git Remote and Branch Tracking Policy

## Repository Roles
- Workspace repo: `/root/.openclaw/workspace`
  - Remote: `okcolor-legacy` -> `https://github.com/BIAsia/okcolor-editor.git`
  - Active workspace branch: `feat/okcolor-v0.3-pr-clean`
- Product repo: `/root/.openclaw/workspace/repos/okcolor-editor`
  - Remote: `origin` -> `https://github.com/BIAsia/okcolor-editor.git`
  - Active product branch: `feat/okcolor-v0.3-pr-clean`

## Tracking Alignment Rule
- Workspace branch must track `okcolor-legacy/<branch>`.
- Product branch must track `origin/<branch>`.
- Do not push product work from workspace root when the same branch exists in product repo.

## Local Git Config Baseline
- `fetch.prune=true`
- Workspace `remote.pushDefault=okcolor-legacy`
- Product `remote.pushDefault=origin`

## Verification Commands
Run these checks before push:

```bash
# workspace
cd /root/.openclaw/workspace
git status -sb
git remote -v
git branch -vv | grep "^*"
git config --get remote.pushDefault

# product repo
cd /root/.openclaw/workspace/repos/okcolor-editor
git status -sb
git remote -v
git branch -vv | grep "^*"
git config --get remote.pushDefault
```
