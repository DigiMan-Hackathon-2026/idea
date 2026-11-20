# 로그·지표·오류 관측 계약 v0.1

작성일: 2026-11-21 · 상태: monitoring 도구 확정 전 검토 기준

이 문서는 DigiMan의 request ID, 구조화 로그, 기술 지표, 알림과 보존 범위를 정의한다. 관측 데이터는 사용자 원문을 복제하는 저장소가 아니며, monitoring 장애가 핵심 run transaction을 실패시키지 않게 한다.

신호를 발견한 뒤 incident 선언·완화·복구·종료하는 절차는 [장애 대응 런북](INCIDENT_RESPONSE_v0.1.md)을 따른다.

## 목표

- 사용자가 본 request ID로 서버 요청·오류 범주를 찾을 수 있다.
- 목록·시작·단계 완료·운영 공개의 오류율과 지연을 route template별로 본다.
- DB 연결 고갈·잠금 대기·transaction retry를 사용자 오류와 연결한다.
- token·cookie·자유 입력·주소·OIDC 정보가 log·metric label에 들어가지 않는다.
- demo·test·production 신호를 섞어 운영 성과나 장애를 왜곡하지 않는다.

## request ID

서버는 모든 HTTP 응답에 `X-Request-Id`를 넣고 같은 값을 해당 요청의 구조화 로그에 사용한다.

### 입력 규칙

- client ID는 16~64자의 ASCII 영문·숫자·`-`·`_`만 후보로 받는다.
- newline, 공백, 제어 문자와 길이 초과 값은 버리고 서버 ID를 생성한다.
- 허용 형식이어도 현재 관측 구간에서 충돌하면 새 ID로 교체한다.
- user가 보낸 값을 그대로 HTML·SQL·log message에 보간하지 않는다.
- response에 보낸 최종 ID만 UI와 support reference에 사용한다.

ID는 인증 수단이 아니며 ID만으로 개인 기록이나 운영 정보를 조회하는 공개 endpoint를 만들지 않는다.

## 구조화 log allowlist

모든 log는 JSON object 한 건으로 출력하고 message 문자열에 동적 request body를 이어 붙이지 않는다.

| 필드 | 예 | 규칙 |
| --- | --- | --- |
| `timestamp` | UTC ISO 8601 | logger가 생성 |
| `level` | info·warn·error | debug는 production 기본 비활성 |
| `environment` | local·preview·production | server config에서 결정 |
| `release` | commit SHA | secret 아닌 배포 metadata |
| `requestId` | 제한된 문자열 | 최종 server ID |
| `route` | `/api/v1/runs/:runId` | raw URL 대신 template |
| `method` | GET·POST·PUT·PATCH·DELETE | 허용 method |
| `status` | 200·409·503 | 정수 |
| `durationMs` | 123 | 상한을 둔 number |
| `errorCode` | `STEP_ORDER_CONFLICT` | 공개 계약 code 또는 내부 분류 |
| `retryCount` | 0~제한값 | transaction 내부 재시도 |
| `dbCategory` | timeout·constraint·deadlock | driver 원문 대신 allowlist |
| `operation` | quest_start·step_complete | 허용된 domain action |

일반 success log에는 quest·run·visitor·admin ID를 넣지 않는다. 장애 조사에 객체 상관관계가 꼭 필요하면 production 정책에 따라 짧은 수명의 별도 제한 필드를 검토하되, 기본 계약을 바꾸고 삭제·접근 범위를 확인하기 전 도입하지 않는다.

## 절대 기록 금지

- Cookie·Set-Cookie·Authorization header
- visitor token 원문·hash·pepper와 admin session token
- OIDC authorization code·access token·ID token·subject·email
- `DATABASE_URL`, password, API secret와 환경 변수 전체
- request·response body 전체
- feedback comment·report comment·internalNote
- quest body·한국어 전체 주소·좌표·검색어
- browser User-Agent·referrer 원문과 IP의 장기 값
- SQL parameter·전체 query·constraint error object·stack의 민감 값
- 인터뷰 원문·연락처·녹음 경로

error object 전체를 serializer에 넘기지 않는다. exception은 알려진 class, 내부 error identifier와 안전한 stack 정책으로 변환한다.

## HTTP request log

한 요청에 최소 start·end 두 건을 무조건 남기기보다 완료 시점의 요약 한 건을 기본으로 한다. 장기 요청 진단이 필요하면 sampling된 start 신호를 별도 사용한다.

### 성공

- route template, method, status, duration, environment, release
- mutation이면 allowlist operation
- 2xx 개인 요청이라는 이유로 visitor ID를 추가하지 않음

### 예상 오류

400·401·403·404·409·429는 계약된 결과로 level을 무조건 error로 올리지 않는다. 비율과 route를 metric으로 집계하고, 공격·오구성 패턴이 반복될 때 warn 집계를 만든다.

### 예상 밖 오류

500·503은 error 또는 warn으로 기록하되 다음만 포함한다.

- 안전한 내부 오류 분류
- request ID·route·release
- retry 횟수와 DB category
- stack이 필요하면 source map 접근이 제한된 server-side 도구에만 저장

응답에는 stack, SQL, 내부 파일 경로와 provider 원문을 넣지 않는다.

## metric과 label cardinality

| metric | 종류 | label |
| --- | --- | --- |
| HTTP 요청 수 | counter | environment, route, method, status class |
| HTTP duration | histogram | environment, route, method |
| domain 오류 수 | counter | environment, operation, errorCode |
| DB 연결 대기 | histogram | environment |
| DB pool 사용 | gauge | environment, state |
| transaction retry | counter | environment, operation, dbCategory |
| step 완료 실패 | counter | environment, errorCode |
| event 저장 실패 | counter | analytics environment, eventName, category |
| cleanup 처리 | counter | environment, result category |

request ID, UUID, raw path, IP, User-Agent, query, error message를 metric label로 사용하지 않는다. area·tag처럼 값이 늘 수 있는 제품 필드도 기술 metric label에서 제외한다.

분석 지표는 [분석 이벤트 계약](ANALYTICS_EVENT_CONTRACT_v0.1.md)을 따르고 기술 monitoring과 분리한다. run 시작·완료 수를 HTTP counter에서 제품 성과로 계산하지 않는다.

## SLI와 초기 목표

다음 수치는 공개 SLA가 아니라 검수 환경의 초기 목표다.

workload와 측정 구간·판정·증거는 [성능·부하 검수 계약](PERFORMANCE_LOAD_TEST_v0.1.md)에 고정한다.

| 항목 | 계산 | 초기 검수 목표 |
| --- | --- | --- |
| 공개 조회 가용성 | 성공·계약된 4xx / 전체, provider 장애 구분 | 기준선 측정 후 결정 |
| 공개 조회 지연 | server duration p50·p95 | p95 1초 이내 후보 |
| 단계 완료 성공 | 2xx / 유효한 step mutation | 기능 검수에서 실패 0 |
| DB 연결 대기 | acquire duration p95 | timeout 전 여유 확인 |
| 5xx 비율 | 5xx / 전체 | 시연·검수 중 0 목표 |
| cleanup 지연 | cutoff부터 정리 완료 | 만료 후 24시간 이내 정책 |

401·403·404·409를 무조건 가용성 실패로 세지 않는다. 유효한 사용자 행동에서 발생한 비율과 공격·잘못된 요청을 구분할 근거가 없으면 숫자를 과도하게 해석하지 않는다.

## alert 후보

실제 traffic 기준선을 보기 전 고정 임계값을 운영 보장으로 쓰지 않는다.

| 신호 | 후보 조건 | 첫 확인 |
| --- | --- | --- |
| 5xx 급증 | 짧은 구간 최소 요청 수 + 비율 초과 | release·route·DB 연결 |
| 진행 실패 | step_complete 5xx·503 연속 | lock·connection·최근 migration |
| DB pool 포화 | 대기와 timeout 동시 증가 | 함수 동시성·pool 설정 |
| auth 오류 급증 | admin 401·403 기준선 초과 | OIDC callback·principal 상태·공격 패턴 |
| cleanup 실패 | 연속 실패 또는 cutoff 초과 | 대상 수·DB 오류·삭제 transaction |
| event 저장 실패 | 제품 흐름 정상 + event 실패 지속 | analytics table·용량·schema |

한 건의 예상 404나 사용자 validation 오류로 on-call alert를 보내지 않는다. 알림에는 token·URL query·사용자 입력을 포함하지 않는다.

## 환경 분리

- local log는 개발 console에 제한하고 production monitoring으로 보내지 않는다.
- preview signal은 production dashboard·alert 분모에서 제외한다.
- production demo quest의 분석 environment는 demo지만 기술 HTTP environment는 production일 수 있다. 두 축을 혼동하지 않는다.
- release SHA와 schema version을 배포 기록에 연결한다.
- test fault injection은 명확한 test environment에서만 실행한다.

## 보존과 접근

| 데이터 | 초기 정책 | 접근 |
| --- | --- | --- |
| application log | 7일 정책안 | 운영 최소 인원 |
| metric | 집계 형태, 제공자 확정 후 기간 결정 | 팀 dashboard |
| error stack | 7일 이하 후보 | 서버 코드 담당 최소 인원 |
| audit log | 90일 정책안, application log와 별도 | 운영 권한 |

provider 기본 보존이 더 길면 설정을 줄이거나 정책을 갱신한다. log export·download도 같은 접근·삭제 범위를 적용한다. 개인 PC에 production log를 장기 저장하지 않는다.

## monitoring 장애

- log sink·metric 전송 실패로 run·step·feedback transaction을 rollback하지 않는다.
- monitoring SDK가 request body와 header를 자동 수집하지 않게 기본 설정을 검토한다.
- 전송 queue가 memory·응답 지연을 고갈시키면 sampling·drop 정책을 적용한다.
- audit log는 관측 log가 아니라 도메인 transaction 일부이므로 쓰기 실패 시 운영 mutation을 rollback한다.
- audit의 action·summary·접근·보존·정합성 점검은 [운영 감사 로그 계약](AUDIT_LOG_CONTRACT_v0.1.md)을 따른다.
- analytics event는 별도 best-effort이며 run 상태의 원본이 아니다.

세 부류를 동일한 “로그”로 취급하지 않는다.

## 검수 방법

### allowlist capture

각 endpoint의 성공·400·401·403·404·409·429·503를 실행하고 test logger output의 key set을 검사한다.

- 허용 key 외 필드가 없음
- raw path의 UUID·query 없음
- header·body·cookie 문자열 없음
- 자유 입력에 넣은 canary가 log에 없음
- response request ID와 log request ID 일치
- route template과 status·errorCode 정확

### canary

실제 secret 대신 명백한 test 문자열을 cookie, feedback, report, internal note, query에 각각 넣고 log·metric·error response에 나타나지 않는지 검사한다. canary 값 자체를 production에 사용하지 않는다.

### 실패 주입

- DB constraint, timeout, deadlock retry exhaustion
- analytics insert failure
- audit log insert failure
- monitoring sink failure

각 실패에서 사용자 transaction 결과와 log 분류가 계약대로 다른지 확인한다.

## 장애 조사 순서

1. 사용자에게서 request ID·발생 시각·화면만 받고 원문 입력·cookie는 받지 않는다.
2. environment와 release를 확인한다.
3. route·status·errorCode·DB category를 찾는다.
4. 같은 release·route의 집계 변화와 provider 상태를 본다.
5. 재현은 demo/test 데이터로 수행한다.
6. 데이터 조회가 꼭 필요하면 최소 권한·대상·사유를 기록한다.
7. 수정 commit과 재검수 결과를 incident에 연결한다.

request ID가 없다는 이유로 사용자의 브라우저 storage나 cookie 전체를 요청하지 않는다.

## 증거 양식

```markdown
# 관측성 검수 YYYY-MM-DD HH:mm KST

- commit·release:
- schema version:
- 환경:
- monitoring provider·region:
- log 보존:
- 실행한 endpoint·오류:
- allowlist 검사:
- canary 누출 검사:
- metric cardinality 검사:
- alert test:
- monitoring 장애 주입:
- 알려진 제한:
```

실제 log sample을 문서에 붙이지 않고 field 이름과 비식별 결과만 기록한다.

## 공개 전 gate

- [ ] 모든 응답·log에 같은 최종 request ID가 있다.
- [ ] route template만 기록되고 raw URL·query·UUID가 없다.
- [ ] cookie·token·secret·자유 입력 canary가 어디에도 없다.
- [ ] 12개 공통 오류 code가 안전한 level·metric으로 분류된다.
- [ ] metric label에 고 cardinality·사용자 값이 없다.
- [ ] preview·demo·test가 production 운영 신호를 왜곡하지 않는다.
- [ ] monitoring 실패가 사용자 transaction을 rollback하지 않는다.
- [ ] audit 실패는 운영 mutation을 rollback한다.
- [ ] 보존·접근·alert 수신자를 실제 provider 설정과 맞췄다.
- [ ] request ID 기반 장애 조사 절차를 한 번 연습했다.

연결 검수: AC05, AC09, AC13~AC16, AC20
