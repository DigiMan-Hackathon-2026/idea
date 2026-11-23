---
name: verify-prototype
description: Drive the real hand-carry prototype (Next.js 16 mobile web app in this repo) in a browser and prove a user-facing change works. Launches an isolated server on port 3100, runs Playwright journeys at the demo's desktop viewport (presenter panel + phone frame) plus a Pixel 7 smoke, and saves screenshots, ARIA snapshots, and traces as evidence. Use after changing any page, route, or UI flow, or whenever you need proof that a feature behaves as a user would see it.
---

# verify-prototype

Proves behavior by driving the app the way a user does: real server, real browser, the viewport the demo is shown in. Unit tests (`npx vitest run`) and the repo's own E2E (`npm run test:e2e`) do not replace this. They test code. This skill produces evidence of what a user sees.

All commands run from the repo root. `V=.claude/skills/verify-prototype` below.

## Launch

```bash
node $V/scripts/verify.mjs launch            # next dev on :3100 (default)
node $V/scripts/verify.mjs launch --prod     # next build + next start on :3100
node $V/scripts/verify.mjs launch --port 3200
```

- Ready means the script printed `READY http://localhost:3100 mode=<dev|prod> pid=<pid>` and exited 0. It polls `GET /` (following the redirect to `/buyer`) until it answers 200, so the first route compile has already finished.
- No migrations or env vars. The app has no backend: all demo state lives in the browser's localStorage and starts from a built-in seed. Every Playwright test gets a fresh browser context, so every journey starts from the seed. Payments, identity, and translation are mocks.
- **Isolation.** Next.js 16 allows only one `next dev` per folder. If the user already runs `npm run dev`, the dev attempt hits `Another next dev server is already running` and launch falls back to `--prod` by itself (prints a `NOTE:` line). The user's server is never touched or reused. Prod mode runs `next build` first, so a half-edited file the user is working on can fail the launch. The failure is in `.verify/run/server.log`.
- Launch refuses when port 3100 is held by anything it did not start, or when a previous instance from this skill is still alive. Run `cleanup` or pick `--port`.
- Server output goes to `.verify/run/server.log`. Process state goes to `.verify/run/state.json`.

## Doctor

```bash
node $V/scripts/verify.mjs doctor
```

Read-only. Checks the recorded root process is alive, every listener on the port belongs to that process tree, and `GET /` answers 200 after redirects. Prints mode and Next.js version. Ends with `HEALTHY` (exit 0) or prints the failing check plus the last log lines (exit 1). Run it first whenever anything looks off. If it fails, run `cleanup`, then `launch` again.

## Drive

Journeys are Playwright specs in `$V/journeys/`, one per feature in [features/](features/README.md). The config `$V/playwright.verify.config.ts` reads the URL from `state.json` and never starts a server itself. It has two projects:

- `desktop` (1440×900 Chromium) runs every journey except `*.mobile.spec.ts`. This is how the demo is shown: presenter panel (region "시연 패널") on the left, phone frame on the right.
- `mobile-chrome` (Pixel 7) runs only `*.mobile.spec.ts`. Below 1024px the app fills the screen and the presenter panel opens from the floating "시연 패널" button as a dialog.

```bash
npx playwright test --config $V/playwright.verify.config.ts                                     # every journey
npx playwright test --config $V/playwright.verify.config.ts journeys/presenter-shell.spec.ts    # one journey
```

To prove a new change, add or extend a journey for the feature you touched, then run it.

- Use role-based locators (`getByRole`, `getByText`) and accessible names, as the existing journeys do. Avoid CSS classes. They are Tailwind utilities and change constantly.
- Call `capture(page, testInfo, "<step>")` from `journeys/evidence.ts` after each meaningful action and after the resulting state appears. Call `watchErrors(page)` at the start of a journey and assert it is empty at the end.
- Update the matching `features/<feature>.md` in the same change. A new user-facing feature gets a new feature file and a line in `features/README.md`.
- If Chromium is missing: `npx playwright install chromium`.

## Evidence

Each Playwright invocation writes to `.verify/evidence/<run-id>/`. The run id is an ISO timestamp. Inside it:

- `<test-dir>/<step>.png`: full-page screenshot per `capture` call
- `<test-dir>/<step>.aria.yml`: ARIA snapshot of `<body>`, first line is the URL
- `<test-dir>/trace.zip`: full trace with every action. Open with `npx playwright show-trace <path>`
- `<test-dir>/test-finished-1.png`: final screen
- `report.json`: pass/fail per journey

Proof standards:

- Drive the real user path: navigate, tap, type. Do not call internal setters, poke React state, or add test-only routes to make a journey pass.
- Capture the action and the state it produced, not only the final screen.
- Assert side effects alongside what is visible. Today there are none: no persistence, no network calls of its own. When mock services or stored state arrive, check them too (e.g. the order appears in a second view after reload).
- Mocks belong only behind the production boundary PRD already isolates (payments/escrow, identity, translation). Do not mock the app's own pages or state.
- Report the run id and the paths of the artifacts that prove the claim. A failing journey is reported as a failure with its error, never weakened to pass.

## Cleanup

```bash
node $V/scripts/verify.mjs cleanup
```

Kills only the process tree recorded in `state.json` (Windows `taskkill /T /F`, POSIX process-group `SIGTERM`), waits for the port to free, and deletes `.verify/run/`. It never kills by process name and never touches `.verify/evidence/`. Run it after every run, including failed ones. If it reports the port is still listening, stop and inspect. Do not kill node processes broadly. The user may have their own dev server running.

## Helpers

| File | What it is |
| --- | --- |
| `scripts/verify.mjs` | `launch [--prod] [--port N]`, `doctor`, `cleanup`. Node only, no extra deps. |
| `playwright.verify.config.ts` | Journey config. Requires a launched instance. Throws `No verify instance` otherwise. |
| `journeys/evidence.ts` | `capture()` screenshot + ARIA snapshot, `watchErrors()` console/page error collector |
| `journeys/*.spec.ts` | One journey per mapped feature |

`.verify/` is git-ignored. `vitest.config.mts` excludes `.claude/**` so Vitest does not pick up journeys.
