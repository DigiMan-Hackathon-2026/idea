# 여기서울 B2C 구현 계획 v0.1

작성일: 2026-11-21 · 상태: F0 완료, 제품 세로 흐름 착수

첫 배포는 퀘스트 하나를 실제 PostgreSQL에 연결해 탐색, 시작, 단계 수행, 완료, 기록까지 통과시키는 세로 흐름을 먼저 만든다. 각 작업 단위는 독립적으로 검수하고 커밋하며, 화면만 연결된 것처럼 보이게 만드는 임시 상태를 `main`에 남기지 않는다.

역할 묶음, handoff, reviewer와 checkpoint 운영은 [팀 실행·인수인계 계획](TEAM_EXECUTION_v0.1.md)을 따른다.

B2C 화면 mock과 서버 계약 테스트의 구체적인 필드·상태 예시는 [B2C API 요청과 응답 예시 v0.1](API_EXAMPLES_B2C_v0.1.md), 운영 화면과 서버 계약은 [운영 API 요청과 응답 예시 v0.1](API_EXAMPLES_ADMIN_v0.1.md)을 따른다.

B2C 경로별 로딩·빈 상태·오류·주요 행동과 일본어 초안은 [B2C 화면 상태와 일본어 문구 계약 v0.1](SCREEN_STATES_v0.1.md)을 따른다.

제품 코드는 사용자 지시에 따라 구현한다. 주최 측의 행사 전 개발 허용 범위는 제출·공개 전 확인하고 그전 변경 이력과 demo 표시를 유지한다.

## 구현 원칙

- `main`에는 문서와 검사에 통과한 작은 기능 단위만 합친다.
- 권한·세션·입력·로그·삭제 통제는 [보안과 개인정보 위협 모델](SECURITY_PRIVACY_v0.1.md)을 따른다.
- DB가 진행 상태의 최종 기준이며 브라우저 저장소를 원본으로 사용하지 않는다.
- 허용 전이와 오류는 [도메인 상태 머신 계약](STATE_MACHINES_v0.1.md)을 기준으로 구현한다.
- Route Handler는 요청·응답 변환을 맡고 상태 전이와 트랜잭션은 도메인 모듈에 둔다.
- module import 방향, transaction owner, DTO·DB row와 client/server 경계는 [module·import 계약](MODULE_BOUNDARIES_v0.1.md)을 따른다.
- 화면과 API는 같은 기능 단위에서 계약을 맞추되, DB 제약과 API 테스트를 UI 테스트보다 먼저 만든다.
- 외부 지도, 인증, 분석 저장 실패가 핵심 진행 흐름을 조용히 왜곡하지 않게 한다.
- 가짜 데이터 경로와 실제 DB 경로를 환경 변수로 전환하는 임시 구조는 두지 않는다. 시연 데이터도 정상 공개 절차와 DB를 사용한다.

## 착수 게이트

| 게이트 | 완료 증거 | 상태 |
| --- | --- | --- |
| 행사 규칙 | [사전 개발 범위 확인서](EVENT_RULES_CHECKLIST.md)에 기록한 공식 답변 또는 안내 원문 | 미확인·구현 비차단 |
| 첫 타깃 | 익명화된 인터뷰 기록과 조사 합성 | 미실행 |
| 첫 지역·퀘스트 | 현장·일본어·이용 조건을 확인한 후보 1개 | 미선정 |
| 기술 환경 | Node·pnpm 고정, PostgreSQL 연결, 깨끗한 설치 | F0·clean clone 완료, PostgreSQL 미연결 |
| 외부 서비스 | Vercel·Neon 요금제와 지역, Google OIDC callback | 미확정 |

제품 코드 작업은 지금 시작할 수 있다. 행사 규칙 미확인은 제출·공개 전 해결할 위험이며 구현을 차단하지 않는다. 사용자 조사와 첫 콘텐츠가 늦어져도 가상 데모와 실제 콘텐츠를 섞어 빈칸을 채우지 않는다.

## 작업 단위와 의존성

```text
F0 프로젝트 기반
 ├─ F1 DB와 공통 API
 │   ├─ F2 공개 탐색
 │   ├─ F3 익명 세션
 │   │   └─ F4 진행과 완료
 │   │       ├─ F5 나의 기록과 삭제
 │   │       └─ F6 피드백과 신고
 │   └─ F7 운영자 인증과 콘텐츠 운영
 └──────────────┬──────────────
                F8 통합 검수와 배포
```

F2와 F3은 F1 이후 병렬로 진행할 수 있다. F7은 공개 콘텐츠가 필요하므로 F1 이후 시작할 수 있지만, 공개·중지 동작은 F2와 F4의 상태 처리와 함께 통합 검수한다.

현재는 DB 연결 전 구조·화면 검수용으로 `デモ体験`을 모든 관련 화면에 표시한 랜딩·조건 탐색·상세·순차 진행·완료·기록 이어하기·전체 삭제·피드백·정보 신고를 구현했다. 진행 기록과 신고는 브라우저 localStorage에만 두고 순서 검사·손상 기록 정규화·신고 category와 500자 제한을 적용한다. 이 demo는 D04~D06 사용자·현장 근거 또는 실제 공개 콘텐츠로 세지 않으며 F1 이후 서버 세션·DB를 최종 기준으로 교체한다.

demo UI는 조건 결과 없음, quest·run 찾을 수 없음과 예상치 못한 렌더 오류의 일본어 복구 상태를 포함한다. 네트워크 응답 유실·권한·중지 상태는 F1 이후 실제 HTTP 계약과 fault injection으로 검수한다.

## F0 프로젝트 기반

목표는 모든 팀원이 같은 명령으로 개발·검사를 실행하는 것이다.

상태: `4a33be9`에서 scaffold·고정 버전·로컬 품질 gate를 만들고 새 clone 검증을 통과했다. `5622316`에서 최초 CI의 pnpm 초기화 순서를 수정했다.

세부 실행 순서, 환경 변수 경계와 clean clone 증거는 [F0 개발 환경 착수 계획](F0_BOOTSTRAP_PLAN_v0.1.md)을 따른다.

### 포함

- Next.js App Router, TypeScript, Tailwind CSS
- pnpm 버전과 lockfile, Node.js 버전 고정
- ESLint, TypeScript 검사, Vitest, Playwright 기본 설정
- `local`, `test`, `preview`, `production` 환경 검증
- `.env.example`과 비밀값 누락 시 명확한 시작 오류
- CI에서 설치, 정적 검사, 단위 테스트, 빌드 실행

### 제외

- 제품 화면, 실제 API, 데이터 모델
- 외부 서비스 계정 생성과 운영 비밀값

### 완료 조건

- 새 복제본에서 문서의 명령만으로 설치와 검사가 성공한다.
- 비밀값이 로그·번들·Git에 포함되지 않는다.
- 빈 애플리케이션이 360px에서 가로 스크롤 없이 열린다.

권장 커밋: `chore: initialize Next.js development environment`

## F1 DB와 공통 API

목표는 이후 모든 기능이 사용할 PostgreSQL 계약과 오류 응답을 만든다.

schema 생성 순서, 연결 역할, 동시성 검수와 migration 증거는 [F1 PostgreSQL 구현·검수 계획](F1_DATABASE_PLAN_v0.1.md)을 따른다.

### 포함

- Drizzle 스키마와 첫 SQL 마이그레이션
- [PostgreSQL 데이터 정합성 계약](DATA_CONSTRAINTS_v0.1.md)에 정의한 제약·인덱스·트랜잭션
- 주요 UUID, UTC 시각, 상태 enum, 외래키, 유일 제약
- DB 연결과 트랜잭션 실행 경계
- API 오류 형식, 요청 ID, 입력 검증, `Cache-Control` 정책
- 통합 테스트용 격리 PostgreSQL과 seed helper

### 먼저 검수할 제약

- `runs(visitor_id, quest_id)`
- `run_steps(run_id, step_id)`
- `feedback(run_id)`
- `reports(visitor_id, client_request_id)`
- `quest_versions(quest_id, version_no)`
- `quest_steps(version_id, position)`
- 운영자 issuer·subject 유일성

### 완료 조건

- 빈 DB와 이미 적용된 DB에서 마이그레이션이 재현 가능하다.
- 유일 제약과 외래키 실패가 예상한 오류로 변환된다.
- 테스트 DB가 운영·preview DB와 연결되지 않는다.

권장 커밋 분리:

1. `feat(db): add initial domain schema`
2. `feat(api): add validation and error response contract`
3. `test(db): verify core constraints and transactions`

## F2 공개 퀘스트 탐색

목표는 세션 없이 일본어로 공개 퀘스트를 찾고 상세를 이해하게 하는 것이다.

### 포함

- `GET /api/v1/quests`, `GET /api/v1/quests/:questId`
- 지역·관심사·최대 시간 필터와 cursor
- 고정 정렬과 실제 조건 기반 추천 이유
- `/`, `/quests`, `/quests/:questId`
- 로딩, 결과 없음, 네트워크 오류, 미공개 404
- 모바일·키보드 탐색과 일본어 기본 문구

### 완료 조건

- 쿠키 없이 목록과 상세를 열어도 개인 기록을 만들지 않는다.
- 조건 결과가 없을 때 자동으로 조건을 바꾸지 않는다.
- paused·archived는 목록에서 빠지고 기존 공개 상세는 시작 불가 상태로 열린다.

연결 검수: AC01, AC02, AC18, AC19

권장 커밋 분리:

1. `feat(catalog): add public quest query service`
2. `feat(catalog): add Japanese quest discovery screens`
3. `test(catalog): cover filters visibility and empty states`

## F3 익명 방문자 세션

목표는 명시적인 시작·신고 행동 뒤에만 브라우저 전용 기록 소유자를 만드는 것이다.

### 포함

- `POST /api/v1/visitor-sessions`
- 암호학적 난수 토큰, 버전이 있는 해시와 pepper
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` 쿠키
- 생성 후 30일 고정 만료와 만료 세션 거절
- 시작 전 일본어 기록·삭제 안내
- 개인 응답 `Cache-Control: no-store`

### 완료 조건

- 목록·상세 열람만으로 세션이 생기지 않는다.
- 같은 유효 쿠키 요청은 새 방문자를 만들거나 만료를 연장하지 않는다.
- DB·로그·응답 본문에 원문 토큰이 남지 않는다.

연결 검수: AC01, AC06, AC16

권장 커밋 분리:

1. `feat(session): add anonymous visitor sessions`
2. `test(session): cover issuance reuse and expiry`

## F4 진행과 완료

목표는 퀘스트 하나를 중복 없이 시작하고 순서대로 수행해 한 번만 완료하는 것이다.

### 포함

- `POST /api/v1/quests/:questId/runs`
- `GET /api/v1/runs/:runId`
- `PUT /api/v1/runs/:runId/steps/:stepId`
- `/runs/:runId`, `/runs/:runId/completion`
- 시작 버전 고정, 선행 단계 검사, 본인 소유권 검사
- 마지막 단계와 run 완료의 단일 트랜잭션
- Google Maps URL, 한국어 주소 복사, 한국어 요청 카드
- 응답 유실 후 현재 상태 재조회

### 완료 조건

- 두 탭에서 동시에 시작해도 같은 run 하나만 반환한다.
- 순서가 아닌 단계는 DB 변화 없이 409를 반환한다.
- 마지막 단계 동시 요청에서 완료 시각과 완료 기록이 하나다.
- 콘텐츠가 중지되면 읽기는 가능하고 미완료 단계 변경은 차단된다.
- 위치 권한이나 지도 앱 없이 주소로 계속 진행할 수 있다.

연결 검수: AC03~AC10, AC17~AC19

권장 커밋 분리:

1. `feat(progress): add idempotent quest start`
2. `feat(progress): add ordered step completion`
3. `feat(progress): add run and completion screens`
4. `test(progress): cover concurrency ownership and version pinning`

## F5 나의 기록과 삭제

목표는 같은 브라우저에서 진행을 이어가고 개인 기록을 제거하게 하는 것이다.

### 포함

- `GET /api/v1/me/runs`
- `GET /api/v1/runs/:runId/completion`
- `DELETE /api/v1/me/data`
- `/my` 진행 중·완료 목록
- 보존 만료일과 다른 기기에서 복구 불가 안내
- 삭제 트랜잭션과 쿠키 만료

### 완료 조건

- 새로고침과 탭 종료 뒤 같은 유효 세션에서 이어간다.
- 타인의 ID는 존재 여부를 드러내지 않고 404다.
- 204 이후 기존 쿠키로 기록에 접근할 수 없다.

연결 검수: AC06, AC10, AC16

권장 커밋: `feat(history): add personal runs and data deletion`

## F6 피드백과 신고

목표는 완료 후 기쁨과 새 경험 여부를 기록하고 잘못된 정보를 중복 없이 신고하게 하는 것이다.

### 포함

- `PUT /api/v1/runs/:runId/feedback`
- `POST /api/v1/quests/:questId/reports`
- 점수·문자 수·category 검증
- `clientRequestId` 멱등성과 같은 키·다른 본문 충돌
- 자유 입력에 민감정보를 쓰지 말라는 일본어 안내

### 완료 조건

- 미완료 run의 피드백은 409다.
- 반복 피드백은 새 행을 만들지 않고 갱신한다.
- 신고 응답 유실 후 같은 요청은 기존 접수 결과를 반환한다.
- 자유 입력 원문이 오류 로그나 분석 이벤트에 들어가지 않는다.

연결 검수: AC11, AC12, AC16

권장 커밋 분리:

1. `feat(feedback): add completion feedback`
2. `feat(reports): add idempotent information reports`

## F7 운영자 인증과 콘텐츠 운영

목표는 허용된 내부 운영자만 콘텐츠를 편집·검수·공개·중지하게 하는 것이다.

### 포함

- Auth.js Google OIDC와 DB 세션
- issuer·subject 기반 `admin_principals` 허용 목록
- `/admin/quests`, `/admin/quests/:questId`
- 운영 퀘스트·신고 API
- draft 저장, 공개, 중지, 재개, 보관
- `expectedRevision` 충돌과 감사 로그
- 공개 전 필수 필드·일본어·사실 정보 검수

### 완료 조건

- 로그인했지만 허용 목록에 없는 사용자는 운영 API를 사용할 수 없다.
- 방문자 쿠키는 운영 API 인증으로 인정되지 않는다.
- 오래된 revision으로 저장하면 최신 내용을 보존하고 409를 반환한다.
- 필수 정보가 없는 draft는 공개되지 않는다.
- 상태 변경과 감사 기록이 한 트랜잭션이다.

연결 검수: AC08, AC13~AC15, AC19

권장 커밋 분리:

1. `feat(admin): add OIDC admin authorization`
2. `feat(admin): add versioned quest editing`
3. `feat(admin): add publish pause and archive workflow`
4. `feat(admin): add report triage`
5. `test(admin): cover authorization revision and publication rules`

## F8 통합 검수와 배포

목표는 실제 모바일·preview·복구 환경에서 첫 버전 완료 기준을 확인하는 것이다.

### 포함

- Playwright Chromium·WebKit 모바일 흐름
- [B2C 검수와 테스트 계획](TEST_PLAN_v0.1.md)에 따른 AC01~AC20 실행과 증거
- 20명 동시 이용·5분 검수 시나리오
- 요청 ID, API 지연, DB 오류, 단계 실패 모니터링
- preview와 production 분리
- 백업을 별도 검수 DB로 복구하고 만료·삭제 정리 실행
- [배포와 복구 운영 런북](OPERATIONS_RUNBOOK_v0.1.md)에 따른 배포·rollback·장애 기록
- 1~2분 가상 데모와 실제 사용자 사례 구분

### 완료 조건

- AC01~AC20 결과와 미달 항목을 기록한다.
- 실제 기기에서 일본어, 지도 링크, 주소 복사, 360px 흐름을 확인한다.
- 복구한 DB에서 만료 정리와 검증된 erasure ledger replay 또는 privacy-first visitor purge를 완료해 삭제 데이터가 다시 노출되지 않는다.
- 시연 이벤트와 실제 운영 이벤트가 환경 값으로 구분된다.

권장 커밋 분리:

1. `test(e2e): cover the B2C vertical journey`
2. `chore(observability): add request and progress monitoring`
3. `chore(deploy): configure preview and production`
4. `docs(ops): record recovery and release verification`

## 기능 단위 완료 기준

각 기능은 다음을 모두 만족해야 완료로 표시한다.

- 스펙의 입력, 상태, 오류, 권한 계약이 구현돼 있다.
- 정상 흐름뿐 아니라 중복·응답 유실·권한·상태 충돌 테스트가 있다.
- 마이그레이션과 환경 변수가 문서화돼 있다.
- 일본어 사용자 문구는 검수 상태가 표시돼 있다.
- 관련 AC를 실행했거나 아직 실행할 수 없는 이유가 기록돼 있다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, 관련 통합·E2E 검사가 통과한다.
- 비밀값, 개인 식별 정보, 녹음·원본 미디어가 diff에 없다.
- B2C 계약을 바꿨다면 스펙과 변경 기록도 같은 기능 단위에서 갱신했다.

## Git 작업 규칙

- 기능 브랜치는 `feature/catalog`, `feature/progress`처럼 하나의 책임으로 만든다.
- 커밋은 스키마, 서비스, 화면, 검수처럼 되돌릴 수 있는 단위로 나눈다.
- 포맷 변경과 기능 변경을 같은 커밋에 섞지 않는다.
- 마이그레이션을 이미 공유했다면 수정하지 않고 다음 마이그레이션을 추가한다.
- `main` 푸시 전 staged diff와 관련 검사를 실행한다.
- 외부 계정·배포·데이터 삭제처럼 저장소 밖 상태를 바꾸는 작업은 대상과 영향을 확인한다.

현재 개인 저장소에서는 문서 변경을 기능 단위로 직접 `main`에 커밋·푸시한다. 팀이 합류하면 같은 단위를 짧은 브랜치와 PR로 전환한다.

## 팀 작업 배치

6명이 동시에 작업한다면 아래처럼 나누되, 계약 변경은 관련 담당자가 함께 검토한다.

| 작업 축 | 주 책임 | 함께 검수할 영역 |
| --- | --- | --- |
| 제품·조사 | 인터뷰, 첫 지역·퀘스트, 일본어 검수 | 화면 정보 우선순위, 시연 |
| 공개 탐색 | F2 화면과 접근성 | 콘텐츠 API, 모바일 |
| 진행·완료 | F4·F5 화면 | 세션, 응답 유실, 지도 |
| 콘텐츠 운영 | F7 편집·공개·신고 | 권한, 버전, 감사 로그 |
| 진행·세션 API | F3~F6 도메인·DB | 동시성, 소유권, 삭제 |
| 배포·통합 | F0·F1·F8 | CI, DB 복구, 모든 AC |

배포·통합 담당자가 모든 품질을 대신 책임지는 구조로 운영하지 않는다. 각 기능 담당자가 자신의 오류·권한·검수 계약을 함께 제출한다.

## 다음 실행 순서

1. [사전 개발 범위 확인서](EVENT_RULES_CHECKLIST.md)의 문안으로 주최 측에 제품 코드 사전 작성 허용 범위를 질문한다.
2. 사용자 인터뷰를 실행하고 첫 타깃·지역·퀘스트를 정한다.
3. 팀 기술 기준과 외부 서비스 후보를 확인한다.
4. 게이트가 열리면 F0을 시작한다.
5. F1 이후 F2·F3·F7을 병렬로 진행한다.
6. F4 세로 흐름을 가장 먼저 통합하고 나머지 P0를 붙인다.
