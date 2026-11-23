# Running tests

- `npx playwright test` serves the existing `dist/` without building — run `npm run bake && npm run build` first in the checkout under test, or results come from a stale bundle.
- Stop servers and test runs only by the PID you saved, never by process name or pattern kill — other agents run Playwright in parallel.
- PID files, logs and scratch go under `/var/tmp/Game/<task>/`, never inside a checkout.

# Editing large files

- Never rewrite a whole file from `read` output. `read` stops at 2000 lines or 50 KB and appends a footer (`[Showing lines 1-N of M ... Use offset=...]`); a rewrite from it drops the unread tail and keeps the footer. `research/*.md` and `docs/approvals.md` lost content this way twice.
- Change files over a few hundred lines with targeted `edit` calls or appends, and check `git diff --stat` for unexpected deletions before committing.
