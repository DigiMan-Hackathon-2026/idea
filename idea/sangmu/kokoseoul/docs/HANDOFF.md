# 맥북 Codex 작업 인수인계

작성일: 2026-11-21

이 문서는 Windows 데스크톱에서 시작한 제품 설계 대화를 맥북 저장소에서 이어 온 결정과 작업 상태의 요약이다. 대화 원문이나 앱 세션을 복제하는 파일은 아니다. 전체 구현 계약은 [B2C 설계 스펙 v0.1](B2C_SPEC_v0.1.md)을 따른다.

완료·준비·대기·보류를 구분한 최신 상태는 [현재 구현 준비도](READINESS_STATUS.md)를 먼저 확인한다.

## 비공개 Preview 배포 및 검증

[여기서울 전체 앱 비공개 Preview](https://yeogiseoul-platform-preview-ddqhmafbv-koko-seoul.vercel.app/)는 `c480a1de52b16f3f473eba031518e0b8749373e6` 기준 배포다. GitHub Quality 통과 후 기존 비공개 Vercel 프로젝트에 직접 배포했고, 테스트 전용 Neon PostgreSQL에 PostGIS 마이그레이션을 적용했다. 데스크톱을 꺼도 열리며 접근 권한이 있는 Vercel 계정이 필요하다. [GitHub Quality 실행 결과](https://github.com/sangmu1126/digiman/actions/runs/45034717344)

### 주변 퀘스트 검색

배포 커밋의 검색 코드를 실제 Preview DB에서 실행해 기본 반경 800m의 결과를 확인했다. 아래 거리는 각 출구에서 퀘스트 시작점까지의 직선거리다.

| 기준점 | Preview DB 검증 결과 |
| --- | --- |
| [성수역 3번 출구](https://yeogiseoul-platform-preview-ddqhmafbv-koko-seoul.vercel.app/api/v1/quests/nearby?originId=561a6218-3882-4db6-a0d4-0f70f7901101) | 올리브영N 성수에서 저장한 화장품 찾기 · 약 215m |
| [신촌역 3번 출구](https://yeogiseoul-platform-preview-ddqhmafbv-koko-seoul.vercel.app/api/v1/quests/nearby?originId=561a6218-3882-4db6-a0d4-0f70f7901201) | 신촌 KOREC 해커톤 참가 안내 · 약 379m |

- **버스 정류장**은 로컬 테스트 전용이다. 가상 정류장 두 곳은 Preview DB에 등록하지 않았고 두 ID 모두 결과를 반환하지 않는 것을 확인했다.
- **로그인 후 HTTPS 응답 검증은 보류한다.** 비인증 HTTPS 요청은 홈과 성수 검색 API 모두 `302`로 Vercel 로그인으로 이동했다. 접근 권한이 있는 계정으로 로그인한 뒤 위 두 링크의 응답을 확인하면 된다.
- **역에서 찾기는 DB 없이 동작한다.** `/quests/nearby?station=<역 코드>`는 [출구·시작점 목록](../scripts/db/quest-search-locations.json)을 앱이 직접 읽어 그 역 출구에서 시작하는 퀘스트와 역에서 800m 안의 퀘스트를 보여 준다. 퀘스트 상세에는 노선·출구·직선거리와 지하철 내부 안내(`/subway?station=<역 코드>`), 역 스탬프, 같은 역 퀘스트 링크가 붙는다. 계획은 [역에서 시작하는 퀘스트 개발 계획](QUEST_STATION_PLAN_v0.1.md)에 있다.

**자동 Preview 배포.** `main`에 push되고 `Quality` workflow가 통과하면 [Preview Deploy](../.github/workflows/preview-deploy.yml)가 같은 commit을 Vercel Preview 환경 변수(테스트 전용 PostgreSQL)로 빌드해 배포한다. Production에는 배포하지 않는다. 배포 주소는 GitHub의 `preview` environment와 workflow 실행 요약에 남고, 웹 화면은 `<배포 주소>/`, 스마트폰 틀 화면은 `<배포 주소>/mobile-preview`다. Actions 탭에서 수동 실행도 된다.

- 처음 한 번 GitHub 저장소 secret에 `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`를 넣어야 한다. 값은 저장소에 기록하지 않는다. 세 값이 없으면 배포 job은 건너뛰고 실패로 표시하지 않는다.
- Vercel 프로젝트의 Preview 환경 변수에 `APP_ENV=preview`, `DATABASE_URL`, `PREVIEW_DATABASE_HOST`, 세션 key 등 앱 실행 값이 있어야 한다. 배포 때 값을 직접 넘기지 않는다.
- DB migration은 실행하지 않는다. 새 migration이 들어간 commit은 Preview DB에 먼저 migration을 적용한 뒤 배포를 다시 실행한다.
- 배포 주소는 매번 바뀌고, 기존과 같이 접근 권한이 있는 Vercel 계정으로 로그인해야 열린다.

### 이전 배포 검증

다음 도감 검증은 이전 배포 커밋 `1d4cc39` 기준이다.

- **역 캐릭터** — 성수역 스탬프에 캐릭터가 표시됐다. 잠실역은 2호선과 8호선에서 각각 해당 호선의 색상으로 캐릭터가 표시됐다.
- **모의 GPS 획득** — 배포 주소의 모바일 브라우저에서 `홈 → 기록 → 역 스탬프 도감 → 2호선 성수역`으로 이동했다. 역에서 먼 좌표는 획득이 거절되고 가까운 좌표는 스탬프가 지급됐다.
- **PNG 저장** — 성수역 스탬프를 960×960 PNG로 다운로드했다. PNG 안의 캐릭터 영역을 화면과 픽셀 단위로 비교해 일치하는 것을 확인했다. 새로고침 후 획득 표시와 저장 버튼이 유지됐고, 도감의 한·일 전환도 확인했다.
- **이전 지하철 검증 (`5d4e19e`)** — 2호선 다음 역으로 방향 확인, 반대 방향 탑승 시 복구, 성수지선 환승, 개찰구 통과 전 안내를 한·일 UI에서 확인했다. 새로고침 후 탑승 안내가 복원됐고, 오프라인에서도 저장된 다음 역과 역무원에게 보여줄 한국어 문장이 표시됐다.
- **이전 퀘스트 검증 (`243e279`)** — 추가된 16개가 목록에 표시됐다. 서울책보고 북토크와 통인시장 김밥의 한국어·일본어 상세 화면, 용산·뷰티와 종로·쇼핑 및 종로·식도락 필터를 확인했다.

**휴대폰 실기기 검증은 보류한다.** 현장 검증을 재개하면 역 근처에서 위치 접근을 허용해 스탬프를 받고, PNG가 휴대폰에 저장되는지 확인한다. 획득 기록은 브라우저와 주소별로 저장되므로 기존 Preview의 기록은 새 주소로 이어지지 않는다.

## 저장소와 현재 상태

- 개인 비공개 저장소: https://github.com/sangmu1126/digiman
- 기본 브랜치: `main`
- Windows 작업 위치: `D:\dev\digiman`
- 맥북 작업본도 `origin/main`과 기능 단위로 동기화한다. 새 기기에서는 원하는 로컬 경로에 복제하고 Windows 경로를 그대로 사용하지 않는다.
- F0 scaffold와 품질 workflow, 명시적 가상 demo의 일본어 랜딩·탐색·상세·3단계 진행·완료·기록 이어하기·전체 삭제·피드백·정보 신고 화면이 있고 code scope는 `UNRESTRICTED`다. 우상단 언어 버튼으로 한국어·일본어를 현재 화면에서 전환하며 선택은 1년 locale cookie로 페이지 이동 뒤에도 유지된다. 진행·완료·피드백·내 기록·삭제·정보 신고는 익명 visitor session과 PostgreSQL API에 연결됐다. 신고는 공개 상세 API의 `versionId`로 보내고 재전송은 같은 `clientRequestId`로 한 건에 수렴한다.
- 고정 도구는 Node.js `24.19.0`, pnpm `12.21.0`, Next.js `16.4.6`, React `19.3.0`, TypeScript `5.9.3`, Vitest `5.1.1`, Playwright `1.65.1`이다. `4a33be9`를 새 디렉터리에 clone해 frozen install·전체 검사·360px smoke·clean status를 확인했고, CI 수정 `5622316`의 Actions run `44809901153`도 통과했다.
- 조사 실행 게이트는 `DRAFT_ONLY`다. `JRxx @ commit` 일본어 검수 근거와 완료 시각을 기록하기 전에는 공개 모집·실제 인터뷰 기록을 시작하지 않는다.
- 현재 통합 검증은 `python3 scripts/verify_all.py`다. 62개 tooling 회귀 테스트, Markdown 117개, JSON block 46개, API endpoint 23개, 오류 code 14개와 조사 안전·evidence 참조·실행 gate·사전 코드 범위·대표 credential 패턴을 외부 package 없이 검사한다.
- 구현 작업 기준은 Next.js App Router·TypeScript·PostgreSQL·Drizzle로 정리했다. Neon·Vercel은 계정과 요금제 확인 전 후보이며, 자세한 근거와 착수 게이트는 [기술 결정 v0.1](TECH_DECISIONS_v0.1.md)에 있다.
- 외부 서비스의 현재 region·복구·비용 제약과 Singapore 배치 후보는 [외부 서비스 평가 v0.1](EXTERNAL_SERVICES_EVALUATION_v0.1.md)에 정리했다.
- 세로 흐름별 의존성, 커밋 경계와 AC 연결은 [B2C 구현 계획 v0.1](IMPLEMENTATION_PLAN_v0.1.md)에 정리했다.
- DB 제약·인덱스·잠금·삭제 순서는 [PostgreSQL 데이터 정합성 계약 v0.1](DATA_CONSTRAINTS_v0.1.md)에 정리했다.
- 화면 mock과 서버 계약 테스트에 사용할 공개·진행 API JSON은 [B2C API 요청과 응답 예시 v0.1](API_EXAMPLES_B2C_v0.1.md)에 정리했다.
- 공통 error envelope·request ID·405/500·14개 code는 [API 오류 catalog](API_ERROR_CATALOG_v0.1.md), 목록 정렬·cursor·rotation은 [pagination 계약](PAGINATION_CURSOR_v0.1.md)에 정리했다.
- B2C 경로별 로딩·오류·주요 행동·일본어 초안은 [B2C 화면 상태와 일본어 문구 계약 v0.1](SCREEN_STATES_v0.1.md)에 정리했다.
- 사용자 화면은 [여기서울 UX 원칙 v0.1](UX_PRINCIPLES_v0.1.md)의 한 화면 한 핵심 행동, 예측 가능한 버튼 문구, 쉬운 말, 선택권 존중, 오류 예방·복구 기준을 따른다. [여기서울 서울색 UI 체계](SEOUL_COLOR_SYSTEM_v0.1.md)의 서울 대표색 10 원색 토큰과 의미 규칙을 사용하며, 토스나 서울시의 로고·외형은 복제하지 않는다.
- demo 웹은 필터 결과 없음, 없는 quest·run 직접 접근, 예상치 못한 화면 오류와 진행 API 실패에 일본어·한국어 복구 행동을 제공한다. 응답 유실 뒤에는 run을 다시 조회해 저장 상태를 복구한다.
- 웹 공통 skip link와 reduced-motion을 적용했고 시작·신고·삭제 modal의 초기 초점·focus trap·Escape 종료를 Playwright로 검수한다. screen reader·실제 기기 검수는 아직 남아 있다.
- 기본 경로는 `Referrer-Policy: no-referrer`, Naver 지도 도메인 인증이 필요한 `/quests`만 `origin`을 적용한다. 모든 경로에 MIME sniffing·iframe 차단과 camera·microphone 차단 header를 적용했다. geolocation은 same-origin만 허용하고 시작 화면의 현재 위치 선택 또는 탐색 지도의 위치 버튼 뒤에만 요청한다. 탐색 지도는 파란 위치 점·정확도 범위·현재 위치 복귀를 제공하지만 좌표는 browser client overlay와 지원 지역 판정에만 쓰며 URL·저장소·서버 요청·NAVER SDK 요청에 넣지 않는다. 화면을 떠나면 추적을 중단하고 GPS로 실내 층·개찰구를 추정하지 않는다. 사용자 HTML은 쿠키 기반 개인화 전환 전부터 cache `no-store`를 강제한다. Next 개발 서버는 설정의 `private, no-store`를 `no-store`로 직렬화하므로 provider의 최종 header는 배포 검수에 남긴다. CSP nonce와 production HSTS도 배포 환경 확인 뒤 남아 있다.
- production 응답의 `X-Powered-By`는 비활성화했다. framework·provider version을 공개 header나 오류 body로 추가하지 않는다.
- Playwright는 Pixel 5와 Desktop Chrome 두 project에서 언어 전환·현재 위치 개인정보 경계·지도 실패 복구·지하철/도보 안내·PWA 설치와 오프라인 복구를 포함한 10개 핵심 흐름, 총 20개 E2E를 실행한다. test 45초·expect 10초 한계를 명시했다.
- 퀘스트 상세에는 성수역 직전 역과 계단·승강기 필요 여부를 고르면 서울교통공사 빠른 하차 문과 승강기 상태를 해당 방향에 맞춰 보여 주는 지하철 현장 도우미 demo가 있다. `3F 승강장 → 2F 개찰구·대합실 → 1F 출구`의 2D 개념도, 대조할 표지, 다음 행동과 역무원용 한국어 문장을 제공하고 다른 승강장·개찰구·출구에서 복구 흐름으로 전환한다. 지상 연결 승강기는 공식 데이터가 있는 1·4번 출구만 안내하며 3번 출구를 무장애 경로로 추정하지 않는다. 3D와 실제 통로·사진은 촬영일·위치·방향·권리를 검수하기 전까지 확정 안내로 쓰지 않는다. 이는 [현장 판단·복구 가설](SUBWAY_FIELD_GUIDE_v0.1.md)을 비교 검증하기 위한 시제품이다.
- 현재 demo metadata는 검색 노출을 막는 `noindex, nofollow`다. 실제 콘텐츠 검수와 공개 결정 없이 이를 제거하지 않는다. Web App Manifest, 192·512px PNG와 Apple icon, same-origin service worker를 제공하며 설치 앱과 일반 웹은 같은 배포를 사용한다. service worker는 개인화 HTML·API·퀘스트 진행 화면을 캐시하지 않고 이중 언어 offline fallback만 보관한다. 앱 코드는 network-first로 받아 배포 뒤 일반 웹과 설치 앱이 함께 갱신되며, worker 자체 변경은 사용자에게 새 버전 적용 행동을 제공한다.
- `pnpm audit:dependencies`는 moderate 이상 알려진 취약점을 검사한다. Drizzle Kit의 취약한 transitive esbuild 범위는 pnpm override로 0.25.12에 고정했으며 2026-11-21 현재 알려진 취약점은 0건이다. 네트워크가 필요한 검사라 로컬 `pnpm verify`와 분리하고 GitHub Actions에서는 실행한다.
- F1은 PostgreSQL 17.12 digest, Drizzle ORM 0.45.4·Kit 0.31.11·pg 8.23.1을 고정했다. 전체 domain 14 tables와 password 없는 capability role은 빈 DB·재적용, `SET ROLE` 권한 거부와 실제 통합 테스트 47개를 통과했다. 가상 demo 콘텐츠는 schema migration에서 분리되어 local·test allowlist와 DB marker를 확인하는 명시적 seed 명령으로만 생성된다. 퀘스트와 단계의 일본어·한국어 콘텐츠는 DB가 관리하며 두 언어가 완전하지 않으면 공개를 거절한다. 별도 test-only login이 runtime capability에 연결돼 세션 생성→시작→조회→3단계 완료→완료 카드→피드백→내 기록→삭제와 신고 HTTP 흐름을 실제 DB로 검수한다. visitor·session은 같은 DB transaction instant의 고정 30일 만료를 가진다. 두 연결의 동시 시작·step·마지막 step·신고는 한 행·한 완료로 수렴하고, start/pause는 quest row lock 순서로 직렬화되며 audit 실패는 domain 변경도 rollback한다. production provider login mapping은 남아 있다.
- runtime DB pool은 server-only로 지연 생성되며 local/test `digiman_runtime*` role만 허용한다. transaction은 statement 5초·lock 3초·idle 5초 제한을 사용하고 오류 시 rollback 뒤 원래 오류를 다시 던진다. production provider host와 login mapping은 아직 열지 않았다.
- 첫 progress repository `startQuestRun`은 quest를 `FOR UPDATE`로 잠그고 현재 published version만 고정한다. 같은 visitor·quest 동시 시작은 `created` 한 번과 같은 run의 `existing`으로 수렴하며, 없는 quest와 paused quest는 각각 `not_found`, `unavailable`을 반환한다.
- `completeQuestStep`은 quest share lock→run update lock 순서로 pause와 단계 완료를 직렬화한다. 소유자·pinned version·position을 다시 확인하고 마지막 step과 run 완료를 한 transaction에 기록하며, 중복 단계는 최초 `completedAt`을 그대로 반환한다.
- `submitFeedback`은 visitor 소유 run을 잠그고 completed 상태만 허용하며 `feedback(run_id)` 충돌 시 같은 행을 갱신한다. 완료 전에는 쓰지 않고 `not_completed`를 반환한다.
- `submitReport`는 quest에 속한 published version만 허용하고 visitor·clientRequestId partial unique로 동시 제출을 한 행에 수렴시킨다. 같은 canonical 요청은 `existing`, 다른 요청 내용은 `request_conflict`다.
- visitor session core는 32-byte base64url token, versioned HMAC-SHA-256, current+previous 최대 두 pepper, 고정 30일 만료를 구현했다. raw token은 DB에 저장하지 않고 malformed·unknown·expired는 모두 `invalid`이며 두 연결의 rotation rehash도 version 2 한 행과 기존 expiry로 수렴한다. `POST /api/v1/visitor-sessions`는 exact Origin과 빈 JSON을 검사하고 기존 세션은 200으로 재사용하며 신규 세션은 host-only `HttpOnly`·`SameSite=Lax` cookie와 201을 반환한다. rate limit과 실제 DB를 연결한 browser 검수는 남아 있다.
- `POST /api/v1/quests/:questId/runs`는 visitor cookie를 검증한 뒤 기존 `startQuestRun` transaction을 호출한다. 신규 201·기존 200, 첫 미완료 step, 완료 경로와 `Location`을 반환하고 malformed ID, session 없음, Origin 불일치, 미공개·중지 quest를 공개 error catalog에 맞춰 분리한다.
- `PUT /api/v1/runs/:runId/steps/:stepId`는 exact `{completed:true}`와 visitor·Origin을 확인하고 순서형 `completeQuestStep` transaction을 호출한다. 정상·반복은 최초 step 완료 시각과 다음 step을 200으로 반환하며, 마지막 step은 같은 transaction의 run 완료 시각과 completion path로 수렴한다. 타인·없는 step은 404, pause와 순서 위반은 분리된 409다.
- `PUT /api/v1/runs/:runId/feedback`은 점수 1~5 정수, boolean, 선택 방문 경험 enum, 선택 500자 comment와 unknown field를 경계에서 검사한다. 완료·소유 run만 한 행으로 upsert하고, 미완료는 `RUN_NOT_COMPLETED`, 타인·없음은 `NOT_FOUND`로 분리한다.
- `POST /api/v1/quests/:questId/reports`는 공개 version·category·500자 comment·client request UUID를 검사해 최초 201, 동일 재전송 200을 반환한다. 같은 visitor의 같은 key에 다른 canonical 요청은 `REQUEST_CONFLICT`, 미공개·불일치 version은 `NOT_FOUND`다.
- mutation route는 공통 JSON object·UTF-8 byte limit·UUID·unknown-key 검증 함수를 사용한다. Content-Type이 다르거나 array·primitive·oversize·비정규 UUID인 요청은 repository와 session 조회 전에 거절한다.
- `GET /api/v1/runs/:runId`는 visitor 소유 run만 반환하고 고정 version의 제목·demo 표시·단계·문구·장소 snapshot과 완료 시각을 position 순서로 조립한다. quest가 중지되면 기록은 읽을 수 있지만 이어하기는 막고 공개 pause 문구를 반환한다.
- 구현된 visitor API route는 지원하지 않는 method에 Next 기본 body 대신 공통 `METHOD_NOT_ALLOWED` envelope, 검증된 request ID, `Allow`, `no-store`, `Vary: Cookie`를 포함한 405를 반환한다.
- visitor cookie 인증은 4 KiB를 넘는 header, 128자를 넘는 token과 같은 이름의 중복 cookie를 DB 검증 전에 거절한다. session 생성 의도에서는 이를 기존 세션으로 해석하지 않고 제한된 신규 발급 흐름으로 보낸다.
- API 예외는 연결 거절·reset·timeout, PostgreSQL 연결 class·lock/query timeout과 설정 누락만 재시도 가능한 503으로 분류한다. 예상하지 못한 repository 불변식·코드 오류는 내부 내용을 숨긴 비재시도 500으로 반환해 client의 위험한 자동 mutation 반복을 막는다.
- CI는 같은 PostgreSQL digest의 `digiman_test_ci` service에 marker와 migration을 적용한 뒤 전체 constraint 통합 테스트를 실행한다. Actions run `44818613781`에서 reports까지 DB 검사와 Pixel 5·Desktop Chrome 12개 브라우저 흐름이 `2m 19s`에 모두 통과했다. `ci-local-only`는 격리된 Actions service의 비운영 값이며 repository·production secret이 아니다.
- 내부 entity·상태·시각·삭제 동사는 [도메인 용어 계약](DOMAIN_GLOSSARY_v0.1.md), `lang`·KST·KRW 표시는 [locale 계약](LOCALIZATION_FORMATTING_v0.1.md)에 정리했다.
- AC01~AC20의 자동·수동 계층, 동시성 절차와 증거 형식은 [B2C 검수와 테스트 계획 v0.1](TEST_PLAN_v0.1.md)에 정리했다.
- 익명·운영 세션, 소유권, 입력·출력, 로그·secret과 삭제 통제는 [보안과 개인정보 위협 모델 v0.1](SECURITY_PRIVACY_v0.1.md)에 정리했다.
- 익명 cookie·HMAC·pepper rotation·고정 만료는 [visitor session 수명주기 계약](VISITOR_SESSION_LIFECYCLE_v0.1.md), cleanup 중복·budget·restore 실행은 [background job 계약](BACKGROUND_JOBS_v0.1.md)에 정리했다.
- preview·production 배포, rollback, 긴급 중지와 backup 복구 순서는 [배포와 복구 운영 런북 v0.1](OPERATIONS_RUNBOOK_v0.1.md)에 정리했다.
- 운영자 권한·revision·콘텐츠 상태·신고 처리 JSON은 [운영 API 요청과 응답 예시 v0.1](API_EXAMPLES_ADMIN_v0.1.md)에 정리했다.
- 실제 scaffold 뒤 import 방향·transaction owner·DTO/DB row·server-only 경계는 [module·import 계약](MODULE_BOUNDARIES_v0.1.md)을 따른다.
- 행사 전 제품 코드·scaffold·DB·배포 허용 여부는 [사전 개발 범위 확인서](EVENT_RULES_CHECKLIST.md)에 위험으로 남기되 구현을 차단하지 않는다. 제출·공개 전에는 공식 답변을 확인한다.
- 실제 퀘스트의 장소·가격·혼자 이용·일본어·asset 권리는 [콘텐츠 사실과 권리 검수 v0.1](CONTENT_VERIFICATION_v0.1.md)에 따라 기록한다.
- 첫 타깃·지역·quest는 [evidence coding 가이드](../research/EVIDENCE_CODING_GUIDE.md)와 [후보 선택 가이드](../research/CANDIDATE_SELECTION_GUIDE.md)에 따라 실제 사건·반대 근거·현장 사실 ID로 고른다.
- 운영자 인증은 Auth.js와 Google OIDC의 DB 세션을 후보로 둔다. 사용자 지도는 Naver Dynamic Map, 역 출구부터 목적지까지의 선은 TMAP 보행자 경로, 현재 위치에서 역까지의 대중교통과 역부터 목적지까지의 앱 길찾기는 NAVER 지도 URL Scheme을 사용한다. 서비스는 대중교통 길찾기용 현재 위치를 받거나 전송하지 않고 NAVER 지도 앱이 자체 권한으로 처리한다. 배포 domain 등록과 실제 iOS·Android 앱 fallback 검수는 남아 있다.
- 비밀값이나 로그인 세션은 저장소로 이전하지 않는다. 맥북의 GitHub 인증과 도구 가용성은 그 기기에서 확인한다.

## 사용자가 확정한 방향

1. 팀 해커톤이지만 현재는 개인 레포에서 먼저 준비한다. 나중에 팀 레포로 옮길 수 있도록 작업 이력을 유지한다.
2. B2C 사용자 경험을 먼저 완성한다. B2B 운영 영역은 실제 요구가 생기는 순서대로 붙인다.
3. 구현 전에 팀원이 나눠 작업할 수 있는 수준의 설계 스펙 v0.1을 작성한다.
4. 설계는 구현과 사용자 검증 결과에 따라 갱신한다. 초기 가설과 확정 요구를 구분한다.
5. 사용자는 운영 가능한 품질과 확장 가능한 구조를 원한다. 작은 핵심 경험에 권한·정합성·오류 복구를 갖추는 방식으로 접근한다.

## 행사 주제와 평가

사용자가 제공한 이미지와 안내 요약의 주제는 ‘서울에 있는 일본인을 기쁘게 해주세요’다. 일본인 관광객·거주자·유학생·심사위원 등이 후보이며 모든 집단을 동시에 만족시킬 필요는 없다.

기쁨은 즐거움·편리함·놀라움·감동을 포함한다. 제품 형식과 개발 도구는 자유이고 심사위원이 직접 체험할 수 있어야 한다. 인터뷰·사용자 테스트를 권장한다.

| 평가 항목 | 배점 |
| --- | --- |
| 기쁨 제공도 | 30 |
| 기술력·완성도 | 25 |
| 재미·독창성 | 20 |
| 과제 발견·해결력 | 15 |
| 팀 개발 | 10 |

이미지에 명시된 사전 준비 허용 항목은 아이디어 도출·기술 조사·개발 환경 준비다. 사전 제품 코드 작성까지 허용됐다는 근거는 아직 확보하지 않았다. 제품 구현 시점을 정할 때 공식 허용 범위를 확인한다.

행사 PDF 원문은 이 저장소에 없다. 대화에서 나온 재방문율 71%, 외부 서비스·API 특성, 행사 세부 일정 등은 필요할 때 공식 원문을 확인하고 사용한다.

## 현재 제품 설계

첫 구현 기준은 일본어 안내가 있는 자율형 로컬 퀘스트 모바일 웹이다. ‘서울에서 혼자 새로운 경험을 찾는 일본인, 특히 재방문 관광객’은 아직 검증할 타깃 가설이다.

핵심 흐름은 다음과 같다.

`목적→시간→지역 선택 → 퀘스트 탐색 → 상세 안내 → 시작 → 단계 수행 → 완료 카드 → 기록·피드백`

- 시작 화면은 목적·시간·지역만 한 질문씩 받고, 탐색 화면에서 동행·한국어 대화 부담·예산·걷기 정도를 선택 조건으로 보완한다. 서울 방문 경험은 가치를 경험한 완료 시점에만 선택적으로 묻는다.
- 일본어 행동 안내와 필요할 때 직원에게 보여주는 한국어 요청 카드를 제공한다.
- 가입 없이 탐색하고, 시작·신고 시 익명 브라우저 세션을 생성한다.
- 개인 기록은 해당 브라우저에서 유지한다. 30일 보존은 현재 설계 초안이다. 계정 연결·기기 간 기록 동기화는 후속 기능이다.
- 첫 콘텐츠는 운영자가 직접 검수·공개한다. 업체용 대시보드는 아직 만들지 않는다.
- 예약·결제·정산·채팅·현금성 보상·GPS 인증·실시간 영업 보장·AI 자동 일정 생성은 첫 범위에 없다.
- 완료는 사용자 자기 확인이며 실제 방문·출석 인증으로 표현하지 않는다.

## 중요한 기술 계약

- Next.js App Router·TypeScript·PostgreSQL·Drizzle 기반의 단일 배포 서버 안에서 콘텐츠·세션·진행·피드백 모듈을 분리한다. Neon·Vercel은 외부 서비스 후보이며 아직 프로비저닝하지 않았다.
- 콘텐츠는 공급자와 연결하고, 초기에는 내부 운영 공급자 하나를 사용한다.
- 공개 콘텐츠의 버전은 불변이며 run은 시작 시 버전을 고정한다.
- 동일 방문자·퀘스트의 run은 하나다. 중복 시작과 마지막 단계 동시 완료를 DB 제약과 트랜잭션으로 처리한다.
- 단계는 순서대로 완료한다. 진행·기록의 소유권과 운영자 권한은 서버가 검사한다.
- 콘텐츠 중지 시 기존 안내·기록은 읽을 수 있지만 신규 시작·미완료 단계 진행은 차단한다.
- 초안 저장과 운영 상태 변경은 revision으로 충돌을 감지한다.
- 예약형 체험을 추가할 때는 프로그램·회차·예약·출석 모델을 별도로 설계한다. 현재 run을 예약으로 재사용하지 않는다.

## 다음에 이어갈 일

1. `git status --short --branch`로 `main...origin/main`과 clean 상태를 확인하고 `python3 scripts/verify_all.py`를 실행한다.
2. 외부 서비스 계정·secret은 준비된 것으로 취급하지 않는다. D01 공식 답변은 제출·공개 전 [규칙 확인서](EVENT_RULES_CHECKLIST.md)에 기록하되 구현을 차단하지 않는다.
3. D02 일본어 검수자와 일정이 정해지면 모집·동의·stimulus P0 문구를 검수하고, 그전에는 모집을 공개 게시하지 않는다.
4. 검수 뒤 [사용자 검증 계획](USER_RESEARCH_v0.1.md)에 따라 최근 실제 사건 3~5개를 익명 기록한다. 각 인터뷰는 `E/O` evidence ID, 반대 사례와 도움 전/후 관찰을 가진다.
5. 3개 시점 합성에서 D04 문제 가설을 먼저 판단하고, 통과한 사건에서만 D05 지역·D06 quest 후보를 현장 사실과 함께 고른다. 가상 demo를 실제 후보 근거로 세지 않는다.
6. 완료된 [F0 계획](F0_BOOTSTRAP_PLAN_v0.1.md)의 품질 명령을 유지하면서 F1 DB·공통 API, F2 탐색·F3 session, F4 진행 세로 흐름 순서로 구현한다.
7. AC01~AC20은 아직 제품 구현에서 실행·통과한 테스트가 아니다. 문서·tooling 검증 통과를 제품 검수 통과로 표현하지 않는다.

## 문서 전달 관련 주의

별도로 만든 ChatGPT 검토용 Page 링크는 사용자 화면에서 ‘사용할 수 없는 페이지’로 표시됐다. Page는 연결 도구로 조회됐지만 사용자 화면의 접근 문제 원인은 확인하지 못했다. 해당 링크에 의존하지 않고 이 저장소의 스펙을 개발 기준으로 사용한다.

이 인수인계 파일을 읽는 것만으로 대화 원문·첨부 이미지·Windows의 로컬 도구 설정이 맥북으로 이전되는 것은 아니다. 원문이 필요하면 앱의 Hand off 기능을 사용하거나 사용자가 필요한 자료를 다시 제공할 수 있다.
