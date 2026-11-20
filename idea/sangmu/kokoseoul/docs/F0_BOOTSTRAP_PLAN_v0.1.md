# F0 개발 환경 착수 계획 v0.1

작성일: 2026-11-21 · 상태: 완료

이 문서는 [구현 계획](IMPLEMENTATION_PLAN_v0.1.md)의 F0를 재현 가능하게 시작하기 위한 실행 순서다. 사용자 지시에 따라 code scope 제한은 해제됐으며 제품 파일, package manifest, lockfile과 CI workflow를 지금 생성할 수 있다. 행사 규칙 불확실성은 구현을 막지 않되 제출·공개 전 별도로 확인한다. F0 검증 뒤 F1로 진행한다.

## 현재 로컬 도구 관찰

2026-11-21 이 Mac에서 F0 구현과 clean clone 검증에 사용한 값이다.

| 도구 | 관찰 값 | 판정 |
| --- | --- | --- |
| Node.js | `v24.19.0` | `.node-version`·`engines`에 고정 |
| Corepack | `0.35.0` | pnpm 활성화에 사용 |
| pnpm | `12.21.0` | `packageManager`·lockfile에 고정 |
| Docker | `29.9.2` | 설치됨; daemon과 PostgreSQL 실행은 미확인 |
| Git | `2.55.0` | 설치됨 |
| GitHub CLI | `2.103.3` | 설치됨 |

Node 24.19.0은 Next.js 16.4.6의 최소 Node 20.9 조건과 설치 패키지의 engine 검사를 통과해 F0 표준으로 채택했다. 팀원 환경과 실제 호스팅 호환성은 별도 확인하며 Auth.js는 F7 결정 전까지 추가하지 않는다.

## F0가 만드는 것과 만들지 않는 것

### 생성 대상

- 하나의 Next.js App Router 애플리케이션과 TypeScript strict 설정
- 접근 가능한 빈 HTML 한 화면과 360px smoke test
- Tailwind CSS, ESLint, formatter 정책
- Vitest와 Playwright runner의 최소 smoke test
- 정확한 Node·pnpm version, `packageManager`, lockfile
- 환경 변수 schema와 값 없는 `.env.example`
- install, lint, typecheck, unit test, build를 실행하는 CI
- 실행 명령과 clean clone 검증 절차

### F0에서 금지

- DigiMan 제품 문구·퀘스트 화면·도메인 API
- Drizzle schema·migration·seed
- 실제 데이터베이스·OIDC·Vercel·Neon 계정 연결
- 실제 secret 또는 개인 callback URL
- production 배포
- UI kit 대량 도입과 이후 사용을 전제로 한 패키지

규칙이 빈 scaffold만 허용하면 smoke 화면도 `Development environment ready` 같은 중립 문구만 사용한다.

## 착수 전 입력

| 입력 | 확정 방법 | 기록 위치 |
| --- | --- | --- |
| 허용 범위와 시작 시각 | 주최 측 공식 답변 | [행사 규칙 확인서](EVENT_RULES_CHECKLIST.md) |
| Node 정확한 버전 | 프레임워크 지원 범위 + 팀 공통 설치 가능성 | `.node-version`, `package.json#engines` |
| pnpm 정확한 버전 | Corepack 사용 가능한 안정 version | `package.json#packageManager` |
| framework version | 공식 release·security 상태와 plugin 호환성 확인 | `package.json`, lockfile |
| 기본 branch와 CI 권한 | 저장소 settings 확인 | GitHub settings, README |
| 패키지 출처 요구 | 행사 오픈소스·AI 표시 규칙 | NOTICE 또는 제출 문서 |

`latest` 범위나 caret만으로 도구 버전을 설명하지 않는다. manifest와 lockfile의 실제 결과를 clean clone에서 확인한다.

package·template·font·icon과 AI 보조 결과의 검토·기록은 [의존성·에셋·AI 출처 관리](DEPENDENCY_ATTRIBUTION_v0.1.md)를 따른다.

## 실행 순서

### 1. 규칙 gate commit

1. 공식 답변의 공개 가능한 요약·시각·근거를 기록한다.
2. 허용된 범위를 `문서만`, `F0`, `제품 코드`로 판정한다.
3. 구현 계획과 준비도 상태를 갱신한다.
4. 이 변경만 먼저 커밋·푸시한다.

gate commit 이전 시각의 제품 파일을 “행사 중 작성”으로 옮겨 표시하지 않는다.

### 2. 버전 고정

1. Node 지원 범위를 공식 문서에서 확인한다.
2. 팀원이 설치할 수 있는 한 patch를 선택한다.
3. pnpm을 Corepack으로 활성화하고 exact version을 `packageManager`에 기록한다.
4. `.node-version`, `engines.node`, CI Node가 같은 line인지 검사한다.
5. clean shell에서 `node --version`, `pnpm --version`을 기록한다.

전역 설치에 우연히 있는 pnpm을 기준으로 lockfile을 만들지 않는다. Corepack 활성화가 실패하면 원인을 해결하기 전 다른 package manager로 조용히 바꾸지 않는다.

### 3. 중립 scaffold

App Router, TypeScript, Tailwind, ESLint, `src/` 구조와 import alias를 명시적으로 선택한다. 생성 도구가 만든 다음 항목은 첫 commit 전에 검토한다.

- telemetry·Git 초기화 여부
- package script와 dependency 범위
- TypeScript strict 관련 설정
- server/client component 기본 경계
- CSS reset과 모바일 viewport
- 생성된 README와 기존 프로젝트 문서 충돌

기존 `.git`, README, docs, research, `.github`를 덮어쓰지 않는다. scaffold 도구는 임시 디렉터리에서 생성 결과를 확인하고 필요한 파일만 저장소에 적용한다.

### 4. 품질 명령 통일

F0 종료 시 다음 script 이름을 제공한다.

| script | 책임 | 외부 서비스 |
| --- | --- | --- |
| `dev` | local 개발 서버 | 없음 |
| `build` | production bundle과 server/client 경계 검사 | 없음 |
| `start` | build 결과 실행 | 없음 |
| `lint` | ESLint | 없음 |
| `typecheck` | emit 없는 TypeScript 검사 | 없음 |
| `test` | 빠른 Vitest suite | 없음 |
| `test:watch` | local watch | 없음 |
| `test:e2e` | Playwright smoke | local server만 |
| `verify` | lint → typecheck → test → build | 없음 |

`test:integration`, `db:migrate`, `db:check`는 F1에서 실제 PostgreSQL 경계와 함께 추가한다. 이름만 성공하는 빈 script를 두지 않는다.

### 5. 환경 변수 경계

변수 분류, 환경 불변식, build/runtime 경계, rotation·revoke와 누출 대응은 [환경 설정·secret 운영 계약](CONFIGURATION_SECRETS_v0.1.md)을 따른다.

`.env.example`은 값 없이 목적과 필수 환경을 설명한다.

| 변수 | 공개 여부 | 첫 사용 단계 |
| --- | --- | --- |
| `APP_ENV` | server only | F0 환경 검증 |
| `APP_ORIGIN` | server only | F3 Origin·cookie |
| `DATABASE_URL` | secret | F1 runtime DB |
| `DATABASE_DIRECT_URL` | secret | F1 migration 필요 시 |
| `TEST_DATABASE_URL` | secret | F1 PostgreSQL integration |
| `SESSION_TOKEN_PEPPERS` | secret | F3 visitor session lookup·rotation |
| `SESSION_TOKEN_ACTIVE_VERSION` | server only | F3 신규 session hash version |
| `AUTH_SECRET` | secret | F7 admin session |
| `AUTH_GOOGLE_ID` | secret | F7 OIDC |
| `AUTH_GOOGLE_SECRET` | secret | F7 OIDC |

브라우저에 필요한 값이 생기기 전에는 `NEXT_PUBLIC_` 변수를 만들지 않는다. `APP_ENV`는 `local`, `test`, `preview`, `production`만 허용하고 분석의 `demo`, `test`, `production`과 섞지 않는다.

환경 검사 모듈은 다음 원칙을 따른다.

- import 시 secret 값을 출력하지 않는다.
- 누락 변수 이름과 필요한 환경만 오류로 알린다.
- test가 production URL과 일치하면 시작 전에 실패한다.
- preview가 production DB·OIDC callback을 공유하지 않게 이후 host allowlist를 추가한다.

### 6. 최소 테스트

F0 테스트는 runner가 실제 실패를 검출한다는 증거만 만든다.

- Vitest: 순수 함수 또는 환경 값 parsing의 success·failure
- Playwright: 360px Chromium에서 빈 화면 heading 접근 가능, 가로 overflow 없음
- build: client bundle에 server-only 환경 참조가 없는지 확인
- 문서·조사 tooling: 기존 `python3 scripts/verify_all.py` 유지

Playwright browser 다운로드가 CI에서 필요한지 설치 로그로 확인하고 cache가 없어도 재현되는 명령을 문서화한다.

### 7. CI 최소 권한

pull request와 main push에서 frozen install, 문서 검증, lint, typecheck, unit test, build를 실행한다. workflow는 contents read 이상의 권한을 기본으로 받지 않는다.

- 실제 `.env` 또는 repository secret 없이 F0 검사가 통과해야 한다.
- dependency install script가 필요한 이유를 확인한다.
- fork PR에 production secret을 제공하지 않는다.
- E2E browser 설치와 cache key는 lockfile을 기준으로 한다.
- 동일 commit의 중복 실행은 concurrency group으로 취소할 수 있다.

외부 배포·DB migration은 F0 CI에 넣지 않는다.

## 예상 디렉터리 경계

F0에서는 실제 도메인 파일을 만들지 않지만 F1 이후 다음 경계를 유지한다.

실제 module 책임·의존 방향·server-only guard와 자동 import restriction은 [module·import 경계 계약](MODULE_BOUNDARIES_v0.1.md)을 따른다.

```text
app/ 또는 src/app/       route와 화면 조합
src/modules/content/     quest·version·공개 상태
src/modules/session/     visitor·admin 세션과 권한
src/modules/progress/    run·step·completion
src/modules/feedback/    feedback·report
src/db/                  schema·migration·connection
tests/integration/       실제 PostgreSQL 계약
tests/e2e/               모바일 사용자 흐름
```

Route Handler가 SQL을 직접 조합하거나 React component가 도메인 상태 전이를 결정하지 않는다.

## clean clone 검증

F0 완료 후보 commit을 새 임시 디렉터리에 clone해 다음을 확인한다.

1. 문서에 적힌 Node·Corepack·pnpm 버전이 실제 값과 같다.
2. 환경 파일 없이 frozen install이 성공한다.
3. `verify`와 문서 검증이 성공한다.
4. Playwright smoke가 360px에서 성공한다.
5. `git status --short`가 비어 있다.
6. 저장소와 build output에서 secret 패턴·개인 경로가 없다.
7. macOS 외 CI Linux에서도 같은 lockfile을 사용한다.

검증에 사용한 임시 디렉터리와 browser cache는 저장소에 복사하지 않는다.

2026-11-21 `4a33be9`를 `/private/tmp`의 새 디렉터리에 clone해 Node `v24.19.0`, Corepack `0.35.0`, pnpm `12.21.0`을 확인했다. `pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm test:e2e`가 성공했고 마지막 `git status --short`는 비어 있었다. 최초 CI는 pnpm 활성화 전 cache 조회 순서 문제로 실패해 `5622316`에서 cache 의존을 제거했다. 수정된 GitHub Actions run `44809901153`은 frozen install, 전체 검사, Chromium 설치와 mobile smoke를 1분 19초에 모두 통과했다.

## 커밋 단위

| 순서 | 권장 commit | 포함 |
| ---: | --- | --- |
| 1 | `docs: record hackathon implementation permission` | 규칙 근거와 열린 gate |
| 2 | `chore: initialize Next.js development environment` | exact versions, scaffold, lockfile |
| 3 | `test: add development quality gates` | Vitest·Playwright smoke와 scripts |
| 4 | `ci: verify clean project builds` | 최소 권한 workflow |
| 5 | `docs: record F0 clean clone verification` | 실행 환경·명령·결과·제한 |

각 commit은 독립적으로 설치 가능해야 한다. scaffold와 대량 dependency 추가, CI 수정, 제품 기능을 한 commit에 섞지 않는다.

## F0 종료 판정

- [x] 사용자 지시로 해제한 코드 범위와 시작 상태가 gate commit `0d4fbd6`에 있다. 주최 측 공식 허용 범위는 제출·공개 전 별도 확인한다.
- [x] Node·pnpm exact version이 manifest·version file·CI에서 일치한다.
- [x] lockfile frozen install이 새 clone에서 성공한다.
- [x] lint, typecheck, unit test, build, 문서 검증이 성공한다.
- [x] 360px Playwright smoke가 성공한다.
- [x] 환경 누락이 secret 노출 없이 명확히 실패한다.
- [x] CI가 최소 권한이며 production secret·DB를 사용하지 않는다.
- [x] 실제 제품 화면·API·schema가 F0 commit에 없다.
- [x] 실행 증거와 알려진 제한이 준비도 문서에 반영됐다.

하나라도 확인하지 못하면 F0를 완료로 바꾸지 않고 구체적인 미확인 항목을 남긴다.
