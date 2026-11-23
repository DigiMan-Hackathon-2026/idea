# Presenter shell

The presenter shell is how the demo is shown. On a laptop screen it puts a Korean presenter panel beside a phone frame. The panel switches the acting role (buyer 김민지, traveler 佐藤 ハルト, operator 운영팀), overrides the app language, and resets the demo to the seed. State persists across reloads.

## Sub-features

- `shell-open` opens `/`, which redirects to `/buyer` and lists the seeded orders.
- `shell-role` switches role from the panel, navigates to that role's home, and marks the active role button pressed.
- `shell-locale-auto` shows Japanese for the traveler and Korean for buyer and operator.
- `shell-locale-override` forces 한국어 or 日本語 for any role, and "역할 기준" returns to automatic.
- `shell-persist` keeps the role and language override after a reload.
- `shell-reset` restores the seed after a two-step confirm and returns to `/buyer`.
- `shell-mobile` below 1024px shows the app full screen and opens the panel as a dialog from the floating "시연 패널" button.

## How to get to it (user POV)

- Open `http://localhost:3100/` on a laptop-sized window. The panel is on the left.
- On a narrow window, tap the floating "시연 패널" button at the bottom right.

## Driving it with Playwright

Preconditions:

- Doctor reports `HEALTHY`. Fresh browser context (seed state).

- **Open.** `page.goto("/buyer")`. Heading level 1 is `내 주문`. Link `팬클럽 한정 포토북 (가상)` is visible.
- **Switch to traveler.** `panel.getByRole("button", { name: /여행자/ }).click()`. URL ends `/traveler`. Heading is `注文を探す`. The button has `aria-pressed="true"`.
- **Override language.** `panel.getByRole("button", { name: "한국어" })`. Heading becomes `주문 찾기`. `역할 기준` returns it to `注文を探す`.
- **Operator.** `panel.getByRole("button", { name: /운영자/ })`. URL ends `/operator`. Heading is `거점 입고·출고`.
- **Persist.** As buyer, choose `日本語`, then `page.reload()`. Heading stays `注文一覧`.
- **Reset.** `데모 초기화`, then `확인` in the panel. URL ends `/buyer`, heading is `내 주문`, and `역할 기준` is pressed again.
- **Mobile.** In `mobile-chrome`, click button `시연 패널`. Dialog `시연 패널` opens. Choosing `운영자` closes it and shows `거점 입고·출고`.
- **Proof.** Journeys `journeys/presenter-shell.spec.ts` (desktop) and `journeys/shell.mobile.spec.ts` (mobile). Screenshots `01-buyer-home` through `04-after-reset` and `01-panel-open`, `02-operator`.

## Gotchas

- Role buttons' accessible names include the persona (`여행자 佐藤 ハルト`). Match with a regex such as `/여행자/`.
- Reset uses an in-panel confirm, not `window.confirm`. No dialog handler is needed.
- The role follows the URL on `/buyer`, `/traveler`, and `/operator` routes, and the saved session role elsewhere (chat). Navigating by URL changes the language too.
- The panel is `display: none` below 1024px. In the mobile project, use the floating button and the dialog instead.
