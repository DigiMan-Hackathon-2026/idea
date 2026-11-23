# Not found

Any route the app does not define shows Next.js's built-in not-found page with HTTP status 404.

## Sub-features

- `nf-status` answers an unknown route with status 404.
- `nf-page` shows a level-1 heading `404` and the text `This page could not be found.`

## How to get to it (user POV)

- Type or follow any URL the app does not serve, such as `/this-route-does-not-exist`.

## Driving it with Playwright

Preconditions:

- Doctor reports `HEALTHY`.

- **Open unknown route.** Journey `journeys/not-found.spec.ts` runs `page.goto("/this-route-does-not-exist")`. The response status is 404.
- **Not-found page.** Locator `getByRole("heading", { level: 1 })` has text exactly `404`. `getByText("This page could not be found.")` is visible.
- **Proof.** Run `npx playwright test --config .claude/skills/verify-prototype/playwright.verify.config.ts journeys/not-found.spec.ts`. The journey writes `not-found.png` and `not-found.aria.yml` under `.verify/evidence/<run-id>/not-found-*/`.

## Gotchas

- In dev mode the browser console logs a 404 resource error for this route. That is expected, so this journey does not use `watchErrors`.
- Once the app adds a custom `not-found.tsx` or a catch-all route, the copy and possibly the status change. Update this file and the journey together.
