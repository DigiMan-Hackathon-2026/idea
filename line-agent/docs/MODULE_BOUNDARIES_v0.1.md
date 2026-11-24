# 애플리케이션 module·import 경계 계약 v0.1

작성일: 2026-11-21 · 상태: F0 scaffold 전 기준

이 문서는 하나의 Next.js application 안에서 화면·HTTP, domain, DB, 인증, 설정, 관측과 background job의 의존 방향을 정의한다. 목적은 Route Handler·React component에 SQL과 상태 전이가 퍼지거나 server secret이 client bundle로 전파되는 것을 막는 것이다.

## 기본 구조

F0에서는 실제 domain 구현을 만들지 않고, 행사 규칙 gate 뒤 필요한 기능 단계에서만 directory를 추가한다.

```text
src/app/                         page, layout, Route Handler
src/components/                  표현 중심 공용 UI
src/modules/content/             quest, version, place snapshot, publish
src/modules/session/             visitor session, admin principal context
src/modules/progress/            run, step, completion
src/modules/feedback/            feedback, report triage
src/modules/privacy/             visitor erase, expiry orchestration
src/modules/analytics/           event allowlist, best-effort emit
src/server/http/                 request ID, error, header, parsing adapter
src/server/config/               validated server-only configuration
src/server/observability/        allowlist log·metric adapter
src/server/jobs/                 authenticated scheduled entrypoint
src/db/                          schema, client, transaction primitive
tests/integration/               실제 PostgreSQL contract
tests/e2e/                       mobile browser flow
```

folder가 architecture를 자동 보장하지 않는다. import restriction, `server-only` guard, build canary와 review로 경계를 검수한다.

## 의존 방향

```text
page/client component ──► public DTO·UI helper
server component ───────► application query service ──► repository ──► DB
Route Handler ──────────► HTTP adapter ──► application command ─────► DB
scheduled entrypoint ───► privacy·analytics application command ────► DB

server config·auth·observability ──► entrypoint/application adapter
domain result ─────────────────────► HTTP DTO mapper ───────────────► response
```

아래 방향은 금지한다.

- DB·server config·cookie parser → React client component
- repository → Route Handler·Next response object
- domain service → `window`, browser storage, router navigation
- module A의 repository 내부 → module B의 Route Handler
- analytics·monitoring adapter → 핵심 transaction 성공 여부 변경
- test fixture → production runtime import
- background job → public HTTP endpoint를 loopback 호출

순환 import를 해결하기 위해 넓은 `shared` module을 만들지 않는다. 두 module의 공통 개념이 실제 domain invariant인지 adapter utility인지 먼저 분류한다.

## entrypoint 책임

### Route Handler

허용:

- request ID 확정
- method·header·body·query parsing
- visitor/admin context 구성
- application command/query 호출
- domain result를 HTTP status·DTO·header로 변환
- API 오류 catalog로 알려진 오류 mapping

금지:

- SQL·Drizzle query 직접 작성
- row lock·transaction callback 직접 조합
- quest·run 상태 전이 if/else 구현
- request body를 DB row로 그대로 spread
- provider·DB exception을 response에 serialize
- mutation 성공을 analytics 전송 성공에 묶음

Route Handler는 얇다는 이유로 보안 검사를 생략하지 않는다. 공통 adapter를 호출하되 endpoint의 auth·Origin·ownership 요구가 type·test에서 보인다.

### page·server component

- query service의 public view model만 받는다.
- cookie·header를 직접 hash하거나 DB client를 열지 않는다.
- status에서 `canStart`·`canContinue`를 다시 계산하지 않는다.
- 개인화 response는 framework data cache에 저장하지 않는다.
- redirect·not found도 API와 같은 존재 노출 정책을 따른다.

### client component

- button·form·focus·pending·recovery 상태를 관리한다.
- server enum을 일본어로 즉석 조합하지 않고 검수된 copy source를 사용한다.
- token, visitor ID, admin identity와 DB key를 localStorage에 저장하지 않는다.
- HTTP response DTO만 사용하고 DB row type을 import하지 않는다.
- optimistic update가 domain commit을 대신하지 않는다.

핵심 mutation을 Server Action과 Route Handler 두 경로로 중복 구현하지 않는다. P0 public contract는 Route Handler를 기준으로 하고 Server Action이 필요하면 같은 application command만 호출한다.

## domain module 내부

각 module은 다음 역할을 필요할 때 분리한다.

```text
contract.ts       domain input·result·error type
service.server.ts application command/query
repository.server.ts DB access owned by the module
mapper.ts         safe public DTO mapping
policy.ts         pure state·validation decision 후보
```

파일 이름은 후보이며 package 수를 늘리기 위해 빈 layer를 만들지 않는다. 중요한 것은 다음이다.

- service가 use case와 transaction 경계를 소유한다.
- repository는 DB row·query를 module 밖에 노출하지 않는다.
- pure policy는 request·DB·clock global을 읽지 않는다.
- mapper는 allowlist DTO를 만들며 object spread로 내부 field를 노출하지 않는다.
- domain error는 14개 public error code와 별개인 typed 내부 원인일 수 있다.

barrel `index.ts`는 client가 server export를 함께 끌어올 위험이 있으면 사용하지 않는다. import는 의도한 public file을 명시한다.

## transaction 소유권

한 use case의 최상위 application service 하나만 transaction을 시작한다.

- repository 함수는 transaction handle을 받을 수 있지만 스스로 중첩 transaction을 열지 않는다.
- 하위 module이 독립 commit한 뒤 상위 module이 실패하는 구조를 만들지 않는다.
- cross-module mutation은 소유 service가 lock order와 rollback을 책임진다.
- audit는 운영 mutation transaction 안에 포함한다.
- analytics는 domain commit 뒤 best-effort로 분리한다.
- response DTO는 가능하면 commit된 결과로 만들며 commit 전 성공 response를 준비하지 않는다.

주요 소유 후보:

| use case | transaction owner | 참여 경계 |
| --- | --- | --- |
| quest publish | content service | version·steps·quest·audit |
| quest start | progress service | session context, quest lock, run |
| step complete | progress service | quest·run·run_step |
| feedback upsert | feedback service | run ownership·feedback |
| report submit | feedback service | session context·report idempotency |
| visitor erase | privacy service | progress·feedback·analytics·session rows |
| expiry cleanup | privacy service | 같은 erase primitive, job entrypoint |

module 간 행 삭제 순서를 복제하지 않고 privacy service의 DB primitive를 사용자 삭제와 cleanup이 공유한다. 공유는 HTTP handler 호출이 아니라 transaction-aware function 호출이다.

## 인증 context

session module은 cookie 원문 대신 검증 결과를 application layer에 전달한다.

```text
AnonymousContext
VisitorContext { visitorId, expiresAt }
AdminContext { principalId, role }
```

실제 TypeScript 이름은 F3·F7에서 확정하지만 다음 원칙을 지킨다.

- raw token·hash·OIDC subject를 context에 넣지 않는다.
- visitor와 admin을 union 하나의 `User`로 합치지 않는다.
- route가 요구하는 context를 명시하며 optional admin으로 권한을 우회하지 않는다.
- repository가 cookie를 parse하거나 OIDC provider를 호출하지 않는다.
- context ID를 log·metric label로 자동 첨부하지 않는다.

## DTO와 DB row

- DB select type을 그대로 API response type으로 export하지 않는다.
- internalNote, createdBy, token hash, evidence 원문과 audit summary는 기본 비공개다.
- API는 camelCase, DB는 snake_case를 유지한다.
- timestamp·cost·null·unknown은 mapper에서 명시적으로 변환한다.
- public quest와 own run은 각기 다른 DTO이며 “필드가 많으니 하나로 합침”을 금지한다.
- admin DTO도 allowlist이며 DB row 전체를 반환하지 않는다.
- API example JSON을 contract test fixture로 사용하되 production serializer를 snapshot에 그대로 덤프하지 않는다.

DTO에 field를 추가할 때 cache, 개인정보, 일본어 표시, backward compatibility와 API example을 함께 검토한다.

## server-only 경계

다음은 import 시점부터 server-only다.

- `src/db/**`
- `src/server/config/**`
- session cookie·HMAC·OIDC verifier
- admin authorization·audit writer
- repository·transaction service
- background job entrypoint
- provider SDK와 monitoring transport

server file은 `server-only` guard 또는 채택 framework의 동등한 compile-time 방어를 사용한다. 파일 이름 `.server.ts`만으로 충분하다고 보지 않는다.

client build canary는 가짜 server-only 값을 test build에 주입해 JS·HTML·source map에 없는지 확인한다. production secret을 canary로 사용하지 않는다.

## config·clock·ID 주입

- validated config는 server config module 한 곳에서 읽고 domain에 필요한 안전한 값만 전달한다.
- module마다 `process.env`를 직접 읽지 않는다.
- unit test는 clock·ID generator·random source의 interface를 주입한다.
- production default가 test fake로 조용히 fallback하지 않는다.
- DB 정합성 시각은 transaction DB clock을 기준으로 한다.
- request ID와 clientRequestId·eventId·entity ID generator를 구분한다.

global singleton은 connection pool·immutable validated config처럼 lifecycle이 명확한 adapter에 제한한다. mutable domain state를 process memory에 원본으로 두지 않는다.

## error mapping

repository는 driver·constraint error를 typed internal result로 제한 변환한다. application service는 domain 의미를 결정하고 HTTP adapter가 [오류 catalog](API_ERROR_CATALOG_v0.1.md)의 code·status·details로 serialize한다.

- constraint 이름·SQL·row를 Route Handler로 넘기지 않는다.
- `catch (error) { return 500 }`을 각 handler에 복제하지 않는다.
- known unique는 idempotent success·conflict·internal invariant 중 use case에 맞게 구분한다.
- unknown exception은 `INTERNAL_ERROR`, dependency/retry 소진은 `SERVICE_UNAVAILABLE`로 구분한다.
- client는 public code만 switch하며 내부 class 이름에 의존하지 않는다.

## background job 경계

`src/server/jobs`는 scheduler 인증·environment guard·budget·run result만 담당한다. 삭제 query를 직접 소유하지 않고 privacy·analytics command를 호출한다.

- public API를 HTTP로 호출하지 않는다.
- admin browser session을 job 권한으로 쓰지 않는다.
- job result는 aggregate count·category만 가진다.
- scheduler retry가 application idempotency를 대신하지 않는다.
- restore mode는 일반 schedule과 다른 explicit command·traffic gate를 사용한다.

세부 기준은 [background job 계약](BACKGROUND_JOBS_v0.1.md)을 따른다.

## test 경계

| test | 대상 | 금지할 대체 |
| --- | --- | --- |
| unit | pure policy·mapper·canonicalization | DB transaction 검증 주장 |
| integration | service·repository·실제 PostgreSQL | in-memory DB로 constraint 주장 |
| contract | Route Handler status·header·JSON | component snapshot만 |
| e2e | 360px 핵심 사용자 흐름 | 모든 concurrency 조합 |
| build | client/server import·secret canary | 변수 이름 grep만 |

mock은 외부 adapter와 clock·ID에 제한한다. repository를 전부 mock한 unit test만으로 lock·unique·rollback을 통과했다고 하지 않는다.

test helper·seed·fixture는 production entrypoint에서 import할 수 없게 restriction을 둔다. test profile은 실제 사용자 원문과 credential을 포함하지 않는다.

## 자동 경계 검사

F0·F1에서 실제 경로가 생기면 다음을 도구로 강제한다.

- client component의 `src/db`, server config, `.server` import 금지
- module repository의 `next/*`, React, browser API import 금지
- Route Handler의 DB schema/client 직접 import 금지
- production source의 test fixture·seed import 금지
- 순환 dependency 검사 후보
- server-only canary의 client artifact 부재
- API route별 runtime이 Node.js이며 Edge opt-in 없음

package·lint plugin은 D07에서 최소 도구로 선택한다. 검사가 false positive라면 전체 rule을 끄지 않고 경계·예외를 좁혀 문서화한다.

## review checklist

- [ ] entrypoint가 parsing·auth context·mapping만 수행함
- [ ] use case transaction owner가 하나임
- [ ] repository row가 module·response 밖으로 새지 않음
- [ ] client import graph에 DB·secret·auth·job module이 없음
- [ ] visitor/admin context가 분리됨
- [ ] error가 driver에서 public response로 직접 serialize되지 않음
- [ ] audit는 transaction 내부, analytics는 commit 뒤 best-effort임
- [ ] user delete와 expiry cleanup이 같은 privacy primitive를 사용함
- [ ] framework cache가 개인·운영 DTO를 저장하지 않음
- [ ] test가 검증하려는 실제 층을 사용함

## 구현 gate

- [ ] F0의 실제 `src/` 선택과 alias가 이 구조에 반영됐다.
- [ ] lint/build가 client→server, repository→framework 금지 import를 검출한다.
- [ ] 주요 mutation마다 transaction owner·lock order·error mapping test가 있다.
- [ ] server-only canary가 client JS·HTML·source map에 없다.
- [ ] background job·admin·visitor entrypoint가 각기 최소 context를 요구한다.
- [ ] clean clone에서 verify·build·integration이 같은 경계를 재현한다.

연결 검수: AC03, AC04, AC05, AC08, AC13, AC15, AC16, AC20
