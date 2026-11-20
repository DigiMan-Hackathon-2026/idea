# 환경 설정·secret 운영 계약 v0.1

작성일: 2026-11-21 · 상태: 외부 계정·제품 환경 생성 전 기준

이 문서는 DigiMan의 local·test·preview·production 설정 schema, secret 저장·주입·검증·교체·폐기 기준을 정의한다. 실제 값, 계정 ID, project ID와 개인 owner는 저장소에 기록하지 않는다.

## 원칙

- configuration 이름·형식·필수 환경은 코드와 `.env.example`에 공개할 수 있다.
- secret 값·hash·일부 마스킹 값도 Git, issue, log, screenshot, test artifact에 넣지 않는다.
- 누락·오구성은 startup 또는 해당 기능 진입 전에 명확히 실패하되 값을 출력하지 않는다.
- local·test·preview·production은 credential과 데이터 plane을 공유하지 않는다.
- server-only 값은 client bundle, HTML, source map, `NEXT_PUBLIC_*`에 들어가지 않는다.
- secret rotation은 값을 바꾸는 작업이 아니라 이전 값 폐기와 영향 검수까지 포함한다.
- 행사 규칙과 외부 계정 승인이 열리기 전 실제 secret·provider 설정을 만들지 않는다.

## 분류

| 분류 | 예 | 저장소 | browser | log·artifact |
| --- | --- | --- | --- | --- |
| public config | 공개 base path, 명시적 UI mode 후보 | 이름·안전한 값 가능 | 필요한 최소만 | 값 허용 여부 검토 |
| server config | `APP_ENV`, `APP_ORIGIN` | 이름·형식만 | 금지 | allowlist 요약만 |
| credential | DB URL, OAuth client secret | 이름만 | 금지 | 값·부분값 금지 |
| key material | session pepper, auth secret, HMAC key | 이름만 | 금지 | 값·hash·길이 금지 |
| identity config | OAuth client ID, issuer, callback | 환경별 제한 | callback 일부 공개 | 계정·principal과 결합 금지 |
| operational reference | project·backup·alert destination | 저장소 밖 관리 | 금지 | 내부 ID 대신 환경 category |

OAuth client ID처럼 본질적으로 browser에 보일 수 있는 값도 다른 환경 ID와 owner를 repository에 모아 두지 않는다. “secret이 아님”과 “공개할 필요가 있음”은 다르다.

## 환경

| 환경 | 데이터·credential | 허용 연결 | 기본 실패 조건 |
| --- | --- | --- | --- |
| local | 개발 전용·가상 seed | local PostgreSQL 후보 | production host·credential 탐지 |
| test | test별 격리 | 전용 PostgreSQL | preview·production URL 탐지 |
| preview | demo·test data | preview DB·OIDC client | production DB·callback 공유 |
| production | 검수 완료 운영 data | production 전용 | preview credential·test mode |

`APP_ENV`는 `local`, `test`, `preview`, `production` 중 하나로 고정할 후보이며 분석 event의 `demo`, `test`, `production`과 별도 축이다. build가 production mode라는 이유로 `APP_ENV=production`을 추측하지 않는다.

환경 판별을 hostname 하나에만 의존하지 않는다. DB host·database·role, marker, canonical origin 중 두 신호 이상으로 위험 연결을 차단한다.

## 변수 inventory

실제 구현 시 이름을 변경하면 이 표, `.env.example`, validation schema, 운영 런북을 같은 기능 단위로 갱신한다.

| 변수 | 분류 | 환경 | 소비자 | 검증·불변식 |
| --- | --- | --- | --- | --- |
| `APP_ENV` | server config | 전체 | 환경 guard·log | 허용 enum, 명시적 |
| `APP_ORIGIN` | server config | 전체 | Origin·cookie·auth | HTTPS 후보, path/query 없음, exact origin |
| `DATABASE_URL` | credential | F1 이후 | runtime pooled connection | 허용 DB·role, password 출력 금지 |
| `DATABASE_DIRECT_URL` | credential | migration 환경만 | migration command | runtime 사용 금지, DDL role 분리 |
| `TEST_DATABASE_URL` | credential | local·CI test | integration test | production host·marker 차단 |
| `SESSION_TOKEN_PEPPER` | key material | F3 이후 | visitor token hash | 전용 key, version 필요 |
| `AUTH_SECRET` | key material | F7 이후 | Auth.js server session | 환경별 분리, version 호환 검수 |
| `AUTH_GOOGLE_ID` | identity config | F7 이후 | Google OIDC | 환경별 client, callback 일치 |
| `AUTH_GOOGLE_SECRET` | credential | F7 이후 | Google OIDC | client와 같은 환경 |

rate limiter IP HMAC, cursor 서명, monitoring DSN, backup credential을 추가하면 session·Auth secret을 재사용하지 않고 inventory에 별도 purpose·rotation·consumer를 먼저 정의한다.

P0에 browser가 직접 호출할 secret API가 없으므로 `NEXT_PUBLIC_` secret은 없다. public 변수가 필요하면 공개돼도 안전한 값인지, 사용자가 바꿔도 권한·환경을 선택하지 못하는지 검토한다.

## `.env.example`

D01이 허용돼 F0를 시작할 때만 생성한다. 실제 값처럼 보이는 random 문자열·실제 hostname·개인 callback을 넣지 않는다.

각 항목에 다음을 주석으로 설명한다.

- secret인지 server config인지
- 필요한 환경·기능 단계
- 형식 예시가 필요하면 예약된 `.invalid` domain 또는 명시적 placeholder
- 어디서 발급하는지가 아니라 어떤 승인된 secret store key를 참조하는지
- rotation 시 영향받는 기능

`AUTH_SECRET=changeme`, production과 비슷한 URL, 작동하는 shared test credential을 예시로 두지 않는다. example 값으로 application이 production-like 환경에서 시작되면 안 된다.

## validation schema

server startup은 현재 환경·활성 기능에 필요한 변수만 읽고, 다음 순서로 검증한다.

1. 허용된 변수 이름과 `APP_ENV`를 확인한다.
2. required·optional을 기능별로 판단한다.
3. 길이·enum·URL scheme·origin shape를 검증한다.
4. environment 간 금지 조합을 확인한다.
5. DB·OIDC 등 외부 연결은 startup schema와 별도 readiness에서 확인한다.
6. 실패하면 변수 이름·규칙·환경만 알리고 값은 redaction한다.

환경 전체 객체, parser error의 input dump, URL 객체의 password, provider error config를 serialize하지 않는다.

### fail-fast와 lazy validation

- 핵심 runtime DB·origin은 해당 server process 시작 전 fail-fast 후보다.
- 아직 구현되지 않은 F7 OIDC 변수를 F0 build에 강제로 요구하지 않는다.
- production에서 admin route가 활성화됐는데 OIDC 값이 없으면 route를 우회 login으로 대체하지 않고 배포를 실패시킨다.
- monitoring 값 누락이 핵심 transaction을 rollback할지는 관측 계약에 따른다.

“optional”은 안전하지 않은 fallback을 써도 된다는 뜻이 아니다.

## build·runtime 경계

- server-only config module에 client import guard를 둔다.
- build 중 secret이 없어도 가능한 static 검사는 가짜 secret을 만들지 않고 실행한다.
- runtime에 필요한 값을 build artifact에 bake하지 않는다.
- source map·error overlay·framework telemetry가 env를 수집하는지 검토한다.
- config object를 React props, route response, hydration data로 넘기지 않는다.
- build cache·Docker layer·CI artifact에 `.env`가 포함되지 않는지 검사한다.

client bundle 검수는 변수 이름 검색만으로 끝내지 않고 명백한 test canary를 test build에 주입해 browser asset·HTML·source map에 없는지 확인한다. production secret은 canary로 사용하지 않는다.

## secret store와 접근

실제 provider 확정 뒤 환경별 secret store를 하나의 source of truth로 정한다.

| 원칙 | 기준 |
| --- | --- |
| 최소 권한 | 배포 runtime은 필요한 key만 읽고 수정·목록 권한 없음 |
| 사람 접근 | 역할·기간·환경별, production은 최소 인원 |
| CI | fork PR·문서 검증에 production secret 없음 |
| local | 승인된 개발 값만, shell history·dotfile 공유 금지 |
| audit | 누가 어떤 key를 변경했는지 값 없이 기록 |
| export | 개인 PC·채팅·issue·AI prompt로 복사 금지 |
| 폐기 | project·branch·preview 종료 시 credential revoke |

secret manager 위치의 내부 URL이나 계정 ID도 public repository에 적지 않고 handoff에는 key 이름과 책임 역할만 남긴다.

## rotation 공통 절차

1. 이유·범위·영향 기능·환경과 commander를 기록한다.
2. 새 credential을 기존과 다른 값으로 생성한다.
3. 가능하면 새 값과 이전 값을 겹쳐 검증할 bounded window를 정한다.
4. preview 또는 제한된 production 경로에서 새 값을 검증한다.
5. application을 새 값으로 전환하고 health·auth·DB·log를 확인한다.
6. 이전 값을 provider에서 폐기한다.
7. 이전 값이 더는 성공하지 않는 negative test를 한다.
8. cache·CI·preview·local copy와 불필요 session을 정리한다.
9. 시작·완료 시각, 영향, 검수와 다음 rotation 조건을 값 없이 기록한다.

새 값 배포 성공만으로 rotation을 완료하지 않는다. 이전 값이 여전히 유효하면 진행 중이다.

## key별 rotation

### DB credential

- runtime pooled role과 migration direct role을 별도로 교체한다.
- 새 credential로 read-only health와 제한된 transaction을 검수한다.
- connection pool이 이전 connection을 유지할 수 있으므로 drain·redeploy 후 revoke를 확인한다.
- revoke 뒤 이전 credential negative connection test를 안전한 환경에서 실행한다.
- migration role을 runtime에 넣지 않는다.

### visitor session pepper

DB의 token hash에 `hash_version`을 둔다. 계획 rotation은 current·previous version을 bounded 기간 검증하고, 새 session은 current만 사용한다. 유효 요청에서 raw cookie가 들어올 때 안전하게 current hash로 전환할 수 있지만 token을 log·queue에 저장하지 않는다.

이전 pepper 노출 가능성이 있으면 overlap으로 유효성을 유지하지 않고 해당 version session을 폐기한다. 최대 30일 보존이 compromise된 session을 계속 허용할 이유가 아니다. 사용자에게 기기 기록을 다시 연결할 수 없다는 영향도 함께 판단한다.

### Auth.js secret

채택 version이 dual-key rotation을 지원한다고 가정하지 않는다. 공식 동작을 확인하고, 지원되지 않거나 노출 사고면 운영 session 전체 폐기와 재로그인을 기본으로 한다. callback·CSRF·session cookie·active principal을 재검수한다.

### Google OIDC client secret

provider가 여러 client secret overlap을 지원하는지 실제 console·공식 문서에서 확인한다. 새 secret 배포와 callback login 검수 후 이전 secret을 revoke한다. client ID·redirect URI까지 바뀌면 환경·consent·callback contract를 다시 검수한다.

### limiter IP HMAC

raw IP를 저장하지 않고 current·previous key를 window보다 짧지 않은 계획으로 전환한다. key 전환이 counter를 초기화해 남용 방어를 우회하거나 shared Wi-Fi를 이중 제한하지 않는지 확인한다. compromise면 privacy와 abuse 영향을 함께 보고 즉시 key를 폐기할 수 있다.

## 누출 대응

secret이 Git, CI, log, screenshot, issue, chat 또는 provider 화면에 노출됐을 가능성이 있으면:

1. 값을 다시 복사하거나 “일부 마스킹 증거”를 만들지 않는다.
2. 노출된 secret 종류와 권한으로 영향 범위를 정한다.
3. revoke·rotate를 history 삭제보다 먼저 한다.
4. 관련 session·downstream credential을 폐기한다.
5. 노출 가능 시작·종료 시각과 사용 흔적을 제한된 log로 확인한다.
6. Git history·artifact·cache 정리는 교체 뒤 수행한다.
7. canary·scanner·권한 축소·log redaction 후속 통제를 만든다.

Git에서 문자열을 지워도 provider 값이 유효하면 사고는 끝나지 않는다. 실제 값이나 hash를 incident 문서에 넣지 않는다.

## test·CI

- unit test는 형식에 맞는 명백한 fake 값을 process scope에만 주입한다.
- integration은 test DB credential만 사용하고 production marker를 거절한다.
- snapshot·exception·test name에 secret을 넣지 않는다.
- CI command tracing이 env assignment를 출력하지 않게 한다.
- fork PR에는 production·preview secret을 제공하지 않는다.
- dependency install·build가 env 전체를 외부로 보내지 않는지 검토한다.
- secret scanner allowlist는 실제 secret과 비슷하다는 이유만으로 넓게 만들지 않는다.

문서·조사 verifier는 외부 secret 없이 실행돼야 한다.

## 배포 검수

- [ ] environment·canonical origin·DB marker가 일치한다.
- [ ] required key 이름과 source는 있으나 값이 출력되지 않는다.
- [ ] preview가 production DB·OIDC·cookie namespace를 공유하지 않는다.
- [ ] direct migration credential이 runtime 설정에 없다.
- [ ] client asset·HTML·source map에 server canary가 없다.
- [ ] log·metric·error·trace에 env dump와 URL password가 없다.
- [ ] rotation owner·revoke 시점·negative test가 있다.
- [ ] rollback release가 현재 key version을 사용할 수 있는지 확인했다.

## 증거 양식

```markdown
# 환경·secret 검수 YYYY-MM-DD HH:mm KST

- commit·release:
- 환경·canonical origin category:
- config schema version:
- required / optional key 이름:
- secret store·access 역할:
- 환경 분리 검수:
- missing·invalid config negative test:
- client bundle·source map canary:
- log·artifact canary:
- rotation 대상·old revoke 확인:
- session·DB·OIDC 영향:
- 알려진 제한·다음 rotation 조건:
```

값, 길이, prefix, hash, 계정·project ID와 내부 secret manager URL을 기록하지 않는다.

## 구현 gate

- [ ] D01이 해당 환경·provider 작업을 허용한다.
- [ ] D07 package/runtime과 D09 environment·region이 결정됐다.
- [ ] config schema와 `.env.example`이 inventory와 일치한다.
- [ ] 환경 교차 연결을 두 신호 이상으로 fail-fast한다.
- [ ] server-only 값이 client·artifact·log에 없음을 canary로 확인했다.
- [ ] 각 key의 생성·rotation·revoke 역할과 절차가 있다.
- [ ] compromise rotation에서 session·DB·OIDC 영향을 연습했다.
- [ ] 실제 값 없이 handoff·incident·release 증거를 남길 수 있다.

연결 검수: AC01, AC03, AC05, AC15, AC16, AC20
