# 운영자 인증·인가 계약 v0.1

작성일: 2026-11-21 · 상태: Auth.js·Google OIDC 구현 전 기준

이 문서는 Google OIDC 인증, Auth.js database session과 여기서울 `admin_principals` 권한을 분리하고, 운영 API마다 활성 principal을 재확인하는 계약이다. 실제 package version·callback·cookie 이름은 D07·D09·D10 결정 후 고정한다.

## 보안 경계

세 단계는 서로 대체하지 않는다.

1. **OIDC 인증**: Google이 인증한 issuer·subject를 Auth.js가 검증한다.
2. **server session**: browser cookie가 DB session을 가리키며 서버에서 폐기할 수 있다.
3. **제품 인가**: `(issuer, subject)`와 일치하는 active `admin_principals`가 있어야 운영 resource에 접근한다.

Google 로그인 성공, 이메일 domain, Auth.js user row 존재만으로 운영 권한을 주지 않는다. 방문자 `digiman_visitor` cookie는 어느 단계에서도 운영 인증으로 해석하지 않는다.

## identity 기준

| 값 | 용도 | 권한 키 여부 | 저장·노출 원칙 |
| --- | --- | --- | --- |
| OIDC issuer | 제공자 경계 | 예 | exact allowlist |
| OIDC subject | 제공자 내 안정 식별자 | 예 | principal DB에만 제한 |
| email | 로그인 UI·운영자 확인 후보 | 아니오 | API·log·audit 기본 제외 |
| name·picture | 필수 아님 | 아니오 | P0 미수집 또는 UI 일시 표시 |
| access·ID token | callback 검증에 필요한 provider 값 | 아니오 | application DB·log에 장기 저장 금지 |
| Auth.js user ID | session adapter 내부 연결 | 아니오 | public·audit 응답 제외 |
| admin principal ID | 제품 권한·audit actor | 내부 기준 | public 응답·metric label 제외 |

issuer와 subject는 trim·case 변환으로 추측 보정하지 않고 provider가 검증한 exact value를 사용한다. 이메일 변경이나 alias가 권한을 이전하지 않는다.

## 환경 분리

local, preview, production은 다음을 공유하지 않는다.

- Google OAuth client와 client secret
- exact callback URL과 허용 host
- Auth.js secret과 session cookie namespace
- Auth.js session DB와 제품 DB credential
- `admin_principals` 데이터

preview client가 production callback을 갖거나 preview session이 production에서 유효하면 배포를 중단한다. wildcard redirect URI, 임의 `returnTo`, request header로 callback host를 만드는 구성을 사용하지 않는다.

## 로그인 흐름

1. 사용자가 명시적으로 운영 로그인 버튼을 누른다.
2. server가 허용된 environment·host를 확인하고 Auth.js sign-in을 시작한다.
3. Auth.js의 state·PKCE·nonce·CSRF 통제를 해당 version의 공식 방식대로 유지한다.
4. callback은 exact redirect URI에서 authorization response를 검증한다.
5. 허용 Google issuer와 subject가 있는 인증 결과만 server session 후보가 된다.
6. 새 server session은 client가 제시한 session ID를 재사용하지 않고 server가 생성한다.
7. callback 뒤 `/admin` 진입 시 active principal을 조회한다.
8. principal이 없거나 disabled이면 운영 데이터 없이 접근 거부 화면을 보여 준다.

callback query의 code·state·error를 log, analytics, referrer와 incident 문서에 남기지 않는다. callback response와 session endpoint는 `Cache-Control: no-store`를 사용한다.

## 로그인 성공과 권한 거절

P0는 OIDC 인증과 제품 인가를 구분한다.

| 상태 | 운영 shell | 운영 API | 응답 |
| --- | --- | --- | --- |
| server session 없음·만료 | 로그인 화면 | 거절 | 401 `SESSION_REQUIRED` |
| 인증됐지만 principal 없음 | 거절 안내만 | 거절 | 403 `ADMIN_FORBIDDEN` |
| principal disabled | 거절 안내만 | 거절 | 403 `ADMIN_FORBIDDEN` |
| active principal | 최소 운영 shell | 허용 endpoint | 정상·domain 결과 |

principal 없음과 disabled에서 quest·report의 존재, count, title, comment를 반환하지 않는다. UI는 이메일 domain이나 허용 목록을 보여 주지 않고 “권한이 없습니다”와 logout만 제공한다.

인증은 됐지만 권한 없는 server session을 유지할지 callback에서 즉시 종료할지는 Auth.js version 검수 뒤 정한다. 어느 선택이든 운영 API는 403이고 권한 부여를 자동 polling하거나 email로 추측하지 않는다.

## 매 요청 인가

운영 route와 API는 공통 server-side guard를 사용한다.

1. trusted environment·host를 확인한다.
2. 유효한 Auth.js server session을 조회한다.
3. 검증된 identity의 issuer·subject를 얻는다.
4. `(issuer, subject)` unique key로 principal을 조회한다.
5. 현재 status가 active인지 확인한다.
6. endpoint가 요구하는 최소 role을 확인한다.
7. mutation이면 exact Origin, rate limit, strict input을 이어서 검사한다.
8. DB transaction 안에서 action과 audit actor를 연결한다.

middleware에서 한 번 확인한 principal을 장시간 client state로 신뢰하지 않는다. server component의 숨긴 button이나 `/admin` route 보호만으로 API 인가를 끝내지 않는다.

## role

schema 후보에는 `editor`, `admin`이 있지만 P0에서 둘의 허용 동작 차이는 없다. 구현은 하나의 최소 운영 permission set으로 다루고 UI에 넓은 권한 계층을 암시하지 않는다.

역할 차이를 도입하려면 먼저 다음을 추가한다.

- endpoint·action별 permission matrix
- 거부 응답과 존재 은닉 계약
- role 변경의 actor·reviewer·audit
- 기존 session에서 변경이 적용되는 시점
- editor가 admin을 만들거나 자기 권한을 올리지 못하는 test

role 문자열이 존재한다는 이유로 권한 분리를 구현했다고 표시하지 않는다.

## principal lifecycle

| 현재 | 행동 | 다음 | session 영향 |
| --- | --- | --- | --- |
| 없음 | 승인된 bootstrap·관리 operation | active | 다음 요청부터 허용 가능 |
| active | disable | disabled | 다음 운영 요청 즉시 403 |
| disabled | reviewer 승인 enable | active | 기존 인증 session 재사용 여부 검토 |
| active·disabled | identity 교체 | 새 principal 별도 생성 | 기존 principal 자동 이동 금지 |

principal row를 hard delete하지 않고 disabled와 audit를 유지한다. 과거 content·audit의 actor 참조는 유지하되 이메일·OIDC subject를 일반 운영 응답에 노출하지 않는다.

### bootstrap

첫 principal은 public endpoint나 “첫 로그인 사용자” 규칙으로 만들지 않는다. 환경 owner가 승인한 migration·관리 operation으로 exact issuer·subject를 입력하고 두 사람이 다음을 확인한다.

- 대상 environment
- issuer·subject source
- 최소 role
- 요청자·실행자 역할
- 적용 시각과 change reference
- 로그인·거절·disable 검수 결과

credential이나 이메일을 Git issue·migration source에 직접 넣지 않는다. 실제 값은 secret이 아닐 수 있어도 운영자 식별 정보이므로 제한된 관리 경로를 사용한다.

P0에 principal 생성·role 변경 public UI·API를 두지 않는다. 이후 추가할 때 자기 승인, 마지막 관리자 제거, 재인증과 audit 계약을 별도로 설계한다.

## session lifecycle

정확한 idle·absolute TTL은 provider와 행사 운영 시간을 확인해 D10에서 결정한다.

필수 성질:

- database session이며 server가 즉시 폐기 가능
- cookie token은 URL·body·analytics·log에 없음
- cookie는 `HttpOnly`, HTTPS의 `Secure`, 검증된 `SameSite`, 최소 Path·Domain
- login·privilege context 변경에서 fixation 방지
- logout은 server session 폐기 뒤 cookie 만료
- principal disabled는 session TTL과 무관하게 다음 요청에서 거절
- environment secret 교체 시 영향받는 session과 강제 재로그인 기록
- session refresh가 principal status 확인을 건너뛰지 않음

운영 UI가 열려 있다는 이유로 무한 session을 제공하지 않는다. browser가 닫힌 것만으로 server session이 폐기됐다고 가정하지 않는다.

## logout·폐기

정상 logout:

1. exact Origin과 Auth.js가 요구하는 CSRF control을 확인한다.
2. 현재 server session을 폐기한다.
3. session cookie를 같은 Path·Domain 속성으로 만료한다.
4. `/admin` 재접근과 운영 API가 401인지 확인한다.
5. visitor cookie는 별도 사용자 행동이 없으면 건드리지 않는다.

보안 사고·퇴사·기기 분실 후보에서는 principal을 먼저 disable해 새 요청을 막고, 관련 server session을 폐기한다. session 목록을 찾기 위해 email·token 원문을 log로 export하지 않는다.

## CSRF·redirect·host

- 운영 mutation은 visitor와 동일하게 exact allowed Origin을 요구한다.
- login·callback·logout에는 채택한 Auth.js version의 state·PKCE·CSRF 방식을 유지한다.
- `returnTo`는 same-origin의 허용 path만 선택하고 외부 URL·protocol-relative URL을 거절한다.
- browser가 보낸 임의 `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`를 신뢰해 callback을 조립하지 않는다.
- 신뢰할 proxy hop과 canonical origin을 environment config로 고정한다.
- credential CORS wildcard를 사용하지 않는다.

SameSite cookie와 CSP는 OIDC state·Origin 검사를 대신하지 않는다.

## 운영 mutation audit

허용된 mutation은 domain 변경과 같은 transaction에서 active principal ID를 audit actor로 기록한다. audit에는 다음만 둔다.

- request ID
- action·target type
- target 내부 reference
- 제한된 before·after 상태·revision summary
- principal 내부 ID
- DB 시각

OIDC subject·email·session token·request body·report comment·internalNote 원문을 audit에 복제하지 않는다. audit 실패 시 운영 mutation을 rollback한다.

로그인 성공·실패는 application log에서 route·status·안전한 category로 집계하되 identity를 metric label이나 일반 log에 넣지 않는다.

## 오류와 화면

| 상황 | HTTP | 공개 code | client 행동 |
| --- | ---: | --- | --- |
| session 없음·만료 | 401 | `SESSION_REQUIRED` | 입력 보존 금지, 로그인 화면 |
| principal 없음·disabled | 403 | `ADMIN_FORBIDDEN` | 운영 데이터 제거, logout 제공 |
| Origin 누락·불일치 | 403 | `ORIGIN_FORBIDDEN` | 자동 재시도 금지 |
| 대상 없음·권한 밖 | 404 | `NOT_FOUND` | 존재 추측 금지 |
| 오래된 revision | 409 | `VERSION_CONFLICT` | 최신 상세 재조회 |
| auth DB 일시 장애 | 503 | `SERVICE_UNAVAILABLE` | 제한 재시도, mutation 성공 추측 금지 |

provider 원문, email, issuer·subject, 허용 principal 목록과 callback config를 error details에 넣지 않는다.

## 검수 matrix

### 로그인·환경

- [ ] local·preview·production client·secret·callback이 분리됨
- [ ] 잘못된 host·callback·state·issuer 거절
- [ ] callback query·token이 log·referrer·analytics에 없음
- [ ] session fixation cookie가 새 로그인에서 채택되지 않음
- [ ] logout 뒤 DB session·cookie·API 접근 거절

### 권한

- [ ] visitor cookie만으로 운영 route·API 401
- [ ] 인증 session만 있고 principal 없음 403
- [ ] disabled principal 403, 목록·상세·report body 없음
- [ ] active principal 정상 조회·mutation
- [ ] 요청 중 disable 뒤 다음 요청 즉시 403
- [ ] email·domain 변경이 권한을 만들거나 이전하지 않음
- [ ] editor·admin이 P0의 동일 최소 범위로 동작

### 변경·동시성

- [ ] 모든 mutation exact Origin 거절 test
- [ ] expectedRevision 충돌이 최신 내용을 보존
- [ ] domain 변경과 audit insert가 같은 transaction
- [ ] audit 실패 시 mutation rollback
- [ ] 응답 유실 뒤 최신 상태 조회, 자동 mutation 반복 없음

### privacy·관측

- [ ] cookie·token·authorization code·email·subject canary가 log·metric·error에 없음
- [ ] 운영 response가 `no-store`, cookie 의존 응답이 `Vary: Cookie`
- [ ] public serializer에 principal·audit·internal note가 없음
- [ ] incident·test artifact에 실제 OIDC identity 없음

## 증거 양식

```markdown
# 운영 인증 검수 YYYY-MM-DD HH:mm KST

- commit·Auth.js·adapter version:
- 환경·canonical origin:
- OAuth client 분리: pass / fail
- callback·state·issuer negative test:
- session cookie·DB 폐기:
- principal 없음·disabled·active:
- disable 즉시성:
- visitor/admin cookie 상호 거절:
- Origin·redirect·host:
- audit 원자성:
- canary·log·cache 검사:
- 알려진 제한·session TTL 결정:
```

실제 callback query, cookie, token, issuer·subject, email과 client secret은 증거에 넣지 않는다.

## 구현 gate

- [ ] D07 package 조합과 D09 environment·domain이 결정됐다.
- [ ] D10에 OAuth owner·callback·principal bootstrap·session TTL이 기록됐다.
- [ ] 첫 principal이 public bootstrap 없이 승인된 관리 경로로 준비됐다.
- [ ] 공통 server-side guard가 모든 운영 route·API에 적용됐다.
- [ ] disabled principal이 existing session에서도 즉시 거절된다.
- [ ] logout·강제 폐기·secret 교체를 검수했다.
- [ ] callback과 운영 response의 cache·header 계약이 통과했다.
- [ ] 실제 identity·token 없이 AC13~AC15 증거를 보관했다.

연결 검수: AC13, AC14, AC15
