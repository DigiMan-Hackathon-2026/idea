# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 상태

일본인 여행자 핸드캐리 중개 서비스(가칭)의 **시연용 프로토타입** 저장소다. 백엔드 없이 브라우저 localStorage만으로 거래 한 건을 주문부터 정산까지 진행할 수 있다.

- `PRD.md`: 제품 요구사항. 정책·수치·범위는 모두 이 문서를 따른다.
- `DESIGN.md`: ShopVibe 디자인 시스템(색·타이포·간격·컴포넌트 토큰).
- `DEMO.md`: 5분 시연 대본. 단계가 verify 스킬의 `golden-path`·`dispute` journey와 1:1로 대응하므로, 화면 흐름을 바꾸면 셋을 함께 고친다.
- 시연용 가정값(영수증 날짜 환율 851.20원, 최소 보상금 10% 등)은 모두 `lib/config.ts`에 `TODO(PRD 미정)`로 모여 있다.

PRD에 "미정"으로 적힌 값(자동 수령 확정 기간, 보상금 최소액, 패널티 기준, 환율 고시 기준 등)은 임의로 정하지 않는다. 사용자에게 묻거나, 한곳의 설정 상수로 빼고 `TODO(PRD 미정)` 표시를 단다.

## 기술 스택과 명령어

Next.js 16(App Router, `src/` 없이 루트의 `app/`) + React 19 + TypeScript + Tailwind CSS 4를 쓴다. 단위 테스트는 Vitest로 대상 파일 옆(`lib/**/*.test.ts`)에 둔다. 화면 검증은 `verify-prototype` 스킬(`.claude/skills/verify-prototype/`)의 Playwright journey로 한다. 패키지 매니저는 npm이다.

@AGENTS.md

```bash
npm run dev                          # 개발 서버 (http://localhost:3000)
npm run build && npm run start       # 프로덕션 실행 (시연은 이쪽)
npm run lint                         # ESLint
npx tsc --noEmit                     # 타입 검사 (LayoutProps 등 전역 타입은 build/dev가 .next/types에 생성하므로 그 뒤에 실행. 라우트를 지운 뒤에는 build로 갱신)
npx vitest run                       # 단위 테스트 전체 1회
npx vitest run --coverage            # + lib/domain 커버리지 (라인 90% 미만이면 실패)
npx vitest run lib/domain/money.test.ts  # 파일 하나
npx vitest run -t "테스트 이름"       # 이름으로 테스트 하나

# 화면 검증 (verify-prototype 스킬, 포트 3100에 격리 서버)
node .claude/skills/verify-prototype/scripts/verify.mjs launch
npx playwright test --config .claude/skills/verify-prototype/playwright.verify.config.ts            # journey 전체
npx playwright test --config .claude/skills/verify-prototype/playwright.verify.config.ts journeys/golden-path.spec.ts
node .claude/skills/verify-prototype/scripts/verify.mjs cleanup
```

- verify journey는 시연 조건인 데스크톱(1440×900)에서 돌고, `*.mobile.spec.ts`만 Pixel 7에서 돈다. 증거는 `.verify/evidence/<run-id>/`에 남는다. 브라우저가 없으면 `npx playwright install chromium`을 실행한다.
- `npm run test:e2e`(`e2e/`)는 루트 리다이렉트만 보는 스모크 테스트다.
- Vitest는 `async` 서버 컴포넌트를 렌더링하지 못한다. 그런 화면은 E2E로 검증한다.
- `next dev`는 `AGENTS.md`의 관리 블록을 다시 쓴다. 그 블록을 손으로 지우지 않는다.

## 아키텍처

데이터는 한 방향으로 흐른다: 화면 → `dispatch(action)` → reducer → 상태 머신 → localStorage → `useSyncExternalStore`로 다시 화면.

- `lib/domain/`: React에 의존하지 않는 순수 도메인. `order-machine.ts`는 이벤트별 허용 상태·행위자·가드를 표(`RULES`)로 정의하고, `transition()`이 불가능한 전이를 `DomainError`로 막는다. `availableEvents()`/`nextActor()`도 같은 표에서 나온다. 금액은 브랜드 타입 `Yen`/`Won`과 정수 연산(`money.ts`)으로 계산하고, 주문 폼 입력은 `catalog.ts`의 `parseItem()`이 경계에서 검증한다. 테스트를 먼저 쓴다(TDD).
- `lib/store/`: `state.ts`의 reducer가 주문 이벤트를 상태 머신에 넘기고, `store.ts`가 localStorage에 저장한다(키 `handcarry-demo:v1`, 형태가 이상하면 시드로 복구). `dispatch`는 예외 대신 `{ ok: false, error }`를 돌려주므로, 화면은 `ErrorNotice`로 에러 코드를 번역해 보여준다.
- `lib/demo/`: 시드(`seed.ts`는 실제 이벤트를 재생해 만들므로 시드도 반드시 도달 가능한 상태다), 인물(`users.ts`), 고정 번역 사전(`translations.ts`). 상품명·채팅 번역은 이 사전의 문장 단위 일치로만 동작한다.
- `lib/i18n/`: `ko.ts`가 키의 기준이고 `ja.ts`는 `Messages` 타입으로 같은 키를 강제한다. 언어는 역할에서 정해진다(구매자·운영자 ko, 여행자 ja). 발표자 패널에서 덮어쓸 수 있다.
- `app/(demo)/`: 역할별 라우트(`/buyer`, `/traveler`, `/operator`)와 `/chat/[orderId]`. 역할은 URL 첫 세그먼트에서 정하고, 역할이 없는 채팅은 셸이 동기화해 둔 세션 역할을 쓴다. 모든 페이지는 클라이언트 컴포넌트다.
- `components/shell/`: 1024px 이상에서 발표자 패널(항상 한국어)과 390×844 폰 프레임을 나란히 둔다. 그보다 좁으면 플로팅 버튼으로 패널을 연다.

Next.js 16 주의점:

- `cacheComponents`가 켜져 있어 동적 라우트에서 `useParams`/`usePathname`이 suspend된다. `app/(demo)/layout.tsx`의 `Suspense` 하나가 셸 전체를 감싸므로 이 구조를 유지한다.
- 이전 페이지가 숨겨진 채 마운트되어 남는다(Activity). journey에서 텍스트는 `journeys/helpers.ts`의 `seen()`으로 찾는다.
- 루트 `/` → `/buyer` 리다이렉트는 `next.config.ts`에 있다. 페이지의 `redirect()`는 dev 검증 에러를 낸다.

## 프로토타입 범위

프론트엔드와 목 데이터만으로 만든다. 한 건의 거래를 주문부터 정산까지 화면에서 끝까지 진행해 볼 수 있으면 된다.
pstack의 검증 위주의 개발 철학을 따라가되, 백엔드만 개발하지 않는다.

- 외부 연동(본인인증, 여권 인증, SNS 연동, PG·에스크로, 선불카드, 자동 번역)은 모두 mock이다. 제휴사가 정해지지 않았다(PRD "결제·정산·에스크로"). 나중에 실제 연동으로 바꿀 수 있게 인터페이스 뒤에 숨긴다.
- 모바일 웹이 기준이다. 모든 화면이 **한국어·일본어**를 지원해야 한다. 구매자는 한국어, 여행자는 일본어 화면을 쓴다.
- 사용자 역할은 세 가지다: 한국 구매자, 일본인 여행자, 운영자(분쟁 판정, 거점 입고·출고 기록, 여행자 승인).
- PRD의 "MVP 제외" 기능(평점·리뷰, 일정별 주문 묶기, 세금 계산기, 반대 방향, 네이티브 앱)과 "추가 기능 후보" 표에 있는 기능은 사용자가 요청할 때만 만든다. 예외로 "결제 전 총액 자동 계산"은 시연 범위에 넣었다(세금은 "발생 시 별도" 한 줄만).
- 시연 범위에서 뺀 것: 가입·인증·여행자 승인, 노쇼 환불·패널티, 거점 자동 수령 확정.

## 도메인 규칙 (PRD 요약)

### 거래 흐름

순서는 **주문 등록 → 여행자 입찰 → 구매자의 입찰 선택 → 에스크로 결제** → 일본에서 구매하고 영수증·상품 사진 올리기 → 반입 → 전달(명동·홍대 거점 또는 직접 대면) → 수령 확인이다. 결제 금액에 선택한 입찰의 보상금이 들어가므로 결제는 반드시 입찰 선택 다음에 온다.

- 수령 거부: 운영팀이 영수증·구매 사진·현장 사진을 보고 판정한다.
- 거점 미수령: 보관 기간이 지나면 자동으로 수령 확정되고 정산이 진행된다.
- 여행자 노쇼: 구매자에게 전액 환불하고 여행자에게 패널티를 준다.
- PRD의 7단계 흐름도는 임베드 이미지라 본문에서 볼 수 없다. 흐름도와 위 순서가 다르면 위 순서를 따른다.

### 금액 계산

- 구매자 총부담 = 상품가(원화 환산) + 여행자 보상금 + 플랫폼 수수료 + 세금(발생 시)
- 플랫폼 수수료 = **상품가의 5%**. 보상금에는 붙지 않고 구매자만 낸다. 여행자 수수료는 없다.
- 건당 상품가 상한은 10만 엔이다.
- 원화 환산은 **여행자 영수증 날짜의 환율**로 한다. 에스크로 금액과 영수증 기준 금액의 차이는 플랫폼이 떠안는다. 구매자에게 추가로 받거나 돌려주지 않는다.
- 여행자 정산액 = 상품가(영수증 날짜 환율로 환산) + 보상금. 지급 수단(선불카드 충전 또는 거점 현금)은 여행자가 고른다.

### 취급 품목 (허용 목록 방식)

목록에 있는 품목만 주문할 수 있다.

- 포켓몬 카드: 미개봉 박스·팩, 미개봉 프로모·한정 카드만. 개봉된 싱글 카드와 등급 카드(PSA 등)는 제외한다.
- 일본 한정 K팝 굿즈, 일본 아이돌 굿즈, 아이돌 표지 일본 잡지, 애니·캐릭터 굿즈
- 위조품과 비공식 굿즈는 모든 분류에서 금지한다.

### 자격·인증

- 구매자: 한국 거주자는 누구나(본인인증). 미성년자도 가입할 수 있다.
- 여행자: 일본 거주 일본인만. 여권 인증과 SNS 연동을 거친 뒤 운영자가 승인한다.

## 디자인

`DESIGN.md`의 토큰을 따르되 아래 사항을 지킨다.

- **폰트**: Poppins·Nunito·Space Mono에는 한글·일본어 글리프가 없다. 폰트 스택 뒤에 Noto Sans KR / Noto Sans JP를 폴백으로 붙인다. 예: `Nunito, "Noto Sans KR", "Noto Sans JP", sans-serif`
- **Primary 퓨시아(#D946EF)는 누를 수 있는 요소에만** 쓴다. 장식용으로 쓰지 않는다.
- DESIGN.md는 패션 이커머스용이라 "Add to Bag", 장바구니 드로어, 뉴스레터 팝업 같은 항목이 있다. 이 서비스에 맞는 개념(주문 등록, 입찰 선택, 수령 확인 등)으로 바꿔 적용한다.
