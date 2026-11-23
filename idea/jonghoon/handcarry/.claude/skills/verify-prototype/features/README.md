# Prototype verification map

This directory is the maintained source for verifying the user-facing behavior of the hand-carry prototype. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `node .claude/skills/verify-prototype/scripts/verify.mjs launch` and require a `READY` line.
- `node .claude/skills/verify-prototype/scripts/verify.mjs doctor` ends with `HEALTHY`.
- No accounts or env vars. Demo state lives in localStorage and starts from the built-in seed (`lib/demo/seed.ts`). A fresh Playwright context always starts from the seed.
- Seed orders (buyer 김민지): `투어 한정 아크릴 스탠드 세트 (가상)` open with one bid, `팬클럽 한정 포토북 (가상)` paid, `한정 아크릴 키링 세트 (가상)` at the Hongdae hub, `피규어 「밤하늘 소녀」 (가상)` delivered in person, `아이돌 표지 잡지 12월호 (가상)` completed.
- Never drive an instance this verification run did not start. That includes the user's own `npm run dev` on port 3000.

## Driving conventions

- Demo journeys run in the `desktop` project (1440×900): presenter panel region "시연 패널" beside the phone frame. Files named `*.mobile.spec.ts` run in the `mobile-chrome` project (Pixel 7).
- Switch roles only through the presenter panel (`getByRole("region", { name: "시연 패널" })`), as the presenter does.
- Language follows the role: buyer and operator screens are Korean, traveler screens are Japanese. Assert the copy for the locale under test.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position. For text, use `seen(page, text)` from `journeys/helpers.ts`: Next.js keeps earlier pages mounted but hidden, and plain `getByText` matches those copies.
- Treat every command as literal. Run them from the repo root.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof is a screenshot plus an ARIA snapshot (`capture()`), and the journey's `trace.zip`.
- Record the run id (`.verify/evidence/<run-id>/`) and the journey used with every claim.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Playwright` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command or locator and the observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Presenter shell](./presenter-shell.md) covers role switching, language override, persistence, reset, and the narrow-screen panel.
- [Buyer order and checkout](./buyer-order.md) covers order validation and creation, bid selection, the total breakdown, and escrow payment.
- [Traveler](./traveler.md) covers translated browsing, minimum-reward bidding, proof upload, in-person hand-over, and payout.
- [Operator hub and disputes](./operator.md) covers hub check-in/out, the FX summary, and dispute review and ruling.
- [Chat](./chat.md) covers quick replies, fixed KO↔JA translation, and the read-only operator view.
- [Golden path](../journeys/golden-path.spec.ts) drives DEMO.md steps 1–10 end to end (hub delivery). The dispute branch is `journeys/dispute.spec.ts`.
- [Not found](./not-found.md) covers the 404 page for unknown routes.

## Out of demo scope

These PRD flows were deliberately left out of the demo (see the demo plan). Do not mark them verified.

- Sign-up and verification (buyer identity check, traveler passport + SNS link) and operator traveler approval
- Traveler no-show refund and penalty
- Auto-confirm after hub storage
