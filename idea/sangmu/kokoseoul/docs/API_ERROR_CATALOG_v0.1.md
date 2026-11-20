# API 오류·request ID catalog v0.1

작성일: 2026-11-21 · 상태: 공통 API 구현 전 기준

이 문서는 DigiMan API의 오류 envelope, HTTP status, code, 공개 가능한 details, request ID, 재시도 의미와 판정 우선순위를 정의한다. 화면의 일본어 문구는 code를 그대로 번역하지 않고 문맥별 다음 행동을 전달한다.

## 공통 envelope

모든 API 오류 응답은 JSON이며 다음 shape를 사용한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "messageJa": "入力内容を確認してください。",
    "requestId": "01KAMEERRORREFERENCE0000000",
    "retryable": false,
    "details": {}
  }
}
```

- `code`는 이 catalog의 closed enum이다.
- `messageJa`는 검수된 안전한 문구이며 exception·provider 원문이 아니다.
- `requestId`는 response `X-Request-Id`와 정확히 같다.
- `retryable`은 server가 같은 종류 요청을 영구 금지한다는 뜻이 아니라 제한된 복구 가능성이다.
- `details`는 code별 allowlist object이며 unknown field를 넣지 않는다.
- 오류 응답은 `Cache-Control: no-store`다.
- stack, SQL, constraint, 환경 값, token, 사용자 원문과 타인 존재 여부를 포함하지 않는다.

HTML framework 오류 화면, redirect login과 빈 body로 API 오류를 대신하지 않는다. JSON serialization 자체가 실패한 최후 상황도 proxy HTML에 의존하지 않게 운영 검수한다.

## request ID

서버는 route 처리 시작에 최종 request ID를 확정하고 성공·오류·405·500을 포함한 모든 응답 header와 구조화 log에 사용한다.

- client 후보는 16~64 ASCII 영문·숫자·`-`·`_`만 받는다.
- invalid·충돌 후보는 요청을 실패시키지 않고 server ID로 교체한다.
- response body에는 오류일 때만 같은 최종 ID를 넣는다.
- ID는 인증·소유권·idempotency key가 아니다.
- ID로 데이터를 조회하는 공개 endpoint를 만들지 않는다.
- raw URL·body·cookie와 결합해 support 화면에 노출하지 않는다.
- audit가 필요한 운영 mutation은 같은 ID를 `audit_logs.request_id`에 기록한다.

사용자에게는 복사 가능한 진단 reference로 제공하되 사용자 잘못처럼 표현하지 않는다. 허용 형식과 log 보존은 [관측 계약](OBSERVABILITY_CONTRACT_v0.1.md)을 따른다.

## code catalog

| code | HTTP | retryable | 사용 경계 |
| --- | ---: | --- | --- |
| `VALIDATION_ERROR` | 400 | false | body·query·field·공개 필수값 오류 |
| `SESSION_REQUIRED` | 401 | false | visitor/admin session 없음·malformed·만료 |
| `ORIGIN_FORBIDDEN` | 403 | false | mutation Origin 누락·불일치 |
| `ADMIN_FORBIDDEN` | 403 | false | 인증됐으나 active principal·role 없음 |
| `NOT_FOUND` | 404 | false | 없음·미공개·타인 소유를 숨김 |
| `METHOD_NOT_ALLOWED` | 405 | false | 알려진 route의 허용되지 않은 method |
| `QUEST_UNAVAILABLE` | 409 | false | quest 상태가 시작·진행 mutation을 막음 |
| `STEP_ORDER_CONFLICT` | 409 | false | 다음 허용 step이 아님 |
| `RUN_NOT_COMPLETED` | 409 | false | completion·feedback 선행 상태 미충족 |
| `VERSION_CONFLICT` | 409 | false | 운영 expectedRevision 불일치 |
| `REQUEST_CONFLICT` | 409 | false | 같은 idempotency key의 다른 canonical 요청 |
| `RATE_LIMITED` | 429 | true | bounded bucket의 재시도 시각 전 제한 |
| `INTERNAL_ERROR` | 500 | false | 예상하지 못한 server 결함·매핑 누락 |
| `SERVICE_UNAVAILABLE` | 503 | true | dependency·timeout·transaction retry 한도 |

같은 code에 다른 HTTP status를 사용하지 않는다. 같은 HTTP 409여도 상태 충돌의 원인과 복구가 다르므로 code를 합치지 않는다.

## code별 details

### VALIDATION_ERROR

허용 shape:

```json
{
  "fields": [
    {
      "path": "comment",
      "reason": "TOO_LONG"
    }
  ]
}
```

- `fields`는 없거나 bounded array다.
- `path`는 public API field path만 사용한다.
- `reason`은 allowlist enum이며 입력값·regex·schema 이름이 아니다.
- body 전체 오류는 `{ "reason": "MALFORMED_JSON" }` 같은 route 공통 후보를 사용할 수 있다.
- cursor는 `{ "field": "cursor" }` 수준으로 signature·tuple을 숨긴다.

### SESSION_REQUIRED·ORIGIN_FORBIDDEN·ADMIN_FORBIDDEN

`details`는 빈 object다. cookie 상태, 허용 Origin, issuer·subject, email, principal 목록과 role 정책을 반환하지 않는다. session이 만료인지 malformed인지 구분하지 않는다.

### NOT_FOUND

`details`는 빈 object다. ID format은 앞선 validation에서 400일 수 있지만 well-formed 대상의 없음·미공개·타인 소유는 같은 404다. 목록의 정상 빈 결과는 200과 `items: []`다.

### METHOD_NOT_ALLOWED

`details`는 빈 object이고 HTTP `Allow` header에 해당 route의 허용 method만 넣는다. route 존재 여부를 숨겨야 하는 권한 경계에서는 인증 전 method 차이로 private route 존재를 추가 노출하지 않게 routing 정책을 검수한다.

### QUEST_UNAVAILABLE

공개 가능한 `availability`와 검수된 `reasonJa` 후보만 허용한다. unpublished draft 존재, 내부 pause note, report 수와 운영자 정보는 금지한다. 기존 own run을 읽을 수 있는지는 정상 resource 응답의 server 능력으로 판단한다.

### STEP_ORDER_CONFLICT

소유권 확인 뒤 공개 가능한 `expectedStepId`만 허용한다. 타 visitor run, 내부 position query와 완료 시각을 details로 누설하지 않는다. 화면은 run을 재조회한다.

### RUN_NOT_COMPLETED

`details`는 비우거나 소유권 확인된 `status: in_progress`만 허용한다. client가 completion card를 추측 생성하지 않고 run으로 돌아간다.

### VERSION_CONFLICT

허용 shape는 `{ "currentRevision": 3 }`다. 최신 draft·internal note·다른 운영자 identity를 포함하지 않는다. client가 상세를 별도 GET하고 local 입력을 유지한다.

### REQUEST_CONFLICT

`details`는 빈 object다. 기존 request hash·body·resource ID를 반환하지 않는다. client가 자동으로 새 key를 만들어 같은 의도를 제출하지 않는다.

### RATE_LIMITED

허용 shape는 `{ "retryAfterSeconds": 30 }`이며 HTTP `Retry-After: 30`과 일치한다. bucket key, limit, remaining count, IP·session identity는 금지한다.

### INTERNAL_ERROR

`details`는 빈 object다. 내부 log에는 allowlist error category와 request ID만 연결한다. stack·driver·provider 원문은 response에 없다. mutation commit 여부를 client가 추측할 수 없으므로 `retryable: false`이고 상태 조회를 우선한다.

### SERVICE_UNAVAILABLE

`details`는 기본 빈 object다. 공개해도 안전한 bounded dependency category가 필요하면 별도 catalog 변경과 화면 검수를 먼저 한다. `retryable: true`여도 mutation 자동 반복을 허용하지 않는다.

## 판정 우선순위

오류가 여러 개 겹쳐도 임의 code를 반환하지 않는다.

1. request ID와 route template을 확정한다.
2. 알려진 route의 method를 확인해 405와 `Allow`를 결정한다.
3. header 크기, Content-Type, body 크기·JSON·query 형식을 검증한다.
4. route가 요구하는 visitor/admin session을 검증한다.
5. admin이면 active principal·role을 확인한다.
6. mutation이면 exact Origin을 확인한다.
7. endpoint별 rate limit을 [남용 대응 계약](RATE_LIMIT_ABUSE_v0.1.md)의 순서로 소비한다.
8. 대상 소유권과 공개 가능성을 같은 query에서 확인한다.
9. field 의미·domain 선행 상태·revision·idempotency를 확인한다.
10. transaction을 실행하고 retry 한도 뒤 503으로 끝낸다.

route 존재 자체가 비공개인 경우 routing·auth 순서를 별도로 검수한다. 인증되지 않은 요청에 “타인 소유”나 revision·step 정보를 먼저 반환하지 않는다. Origin보다 권한을 먼저 확인하는 운영 route가 principal 존재를 노출하지 않는지도 통합 테스트한다.

## 409 선택

| 질문 | code |
| --- | --- |
| quest가 paused·archived라 action 자체가 불가한가 | `QUEST_UNAVAILABLE` |
| run에서 요청 step보다 앞선 step이 남았는가 | `STEP_ORDER_CONFLICT` |
| completion·feedback 전에 run이 미완료인가 | `RUN_NOT_COMPLETED` |
| admin이 보낸 expectedRevision이 현재와 다른가 | `VERSION_CONFLICT` |
| 같은 clientRequestId에 canonical body가 다른가 | `REQUEST_CONFLICT` |

DB unique 오류를 그대로 409로 보내지 않는다. 동일한 의미의 재요청이면 기존 결과 200을 반환할 수 있고, 다른 의미일 때만 계약된 conflict로 변환한다.

## 500과 503

- 예상·분류 가능한 dependency timeout, DB connection 불가, bounded transaction retry 소진은 503이다.
- 불변식 누락, 처리하지 않은 exception과 오류 mapping 누락은 500이다.
- validation·constraint·권한 오류를 500/503으로 숨기지 않는다.
- 500을 503으로 바꿔 자동 재시도를 유도하지 않는다.
- commit 전 domain transaction 안에서 발생하면 전체 rollback되고 partial write가 없어야 한다.
- commit 뒤 response 생성·전달이 실패하면 mutation은 이미 성공했을 수 있으므로 client는 상태 조회로 확인한다.
- analytics·monitoring 전송 실패만으로 핵심 transaction을 500/503으로 바꾸지 않는다.

500 비율은 release blocker·incident 후보이며 `INTERNAL_ERROR`를 정상 제어 흐름으로 사용하지 않는다.

## messageJa와 화면 행동

- server `messageJa`는 안전한 기본 문구이며 화면은 code·route 문맥에 맞는 검수된 문구를 사용할 수 있다.
- server와 화면 문구가 달라도 허용 행동·손실·재시도 의미는 같아야 한다.
- error code, enum, field path를 그대로 사용자 문장으로 보여 주지 않는다.
- unknown code는 일반 일본어 오류와 request ID를 표시하고 mutation을 자동 반복하지 않는다.
- screen reader live region은 오류를 한 번 알리고 countdown을 매초 낭독하지 않는다.

입력 유지·재조회·재시도 동작은 [클라이언트 요청·복구 계약](CLIENT_RECOVERY_v0.1.md)을 따른다.

## log·metric

구조화 log 허용 후보:

- 최종 request ID, route template, method, status, error code
- environment·release, duration, bounded operation
- transaction retry count와 allowlist DB category

금지:

- response details 전체, request body·query 원문
- cookie·token·idempotency key·cursor
- user·visitor·admin·quest·run ID를 metric label로 사용
- provider error·SQL·constraint object 직렬화

4xx를 모두 error log로 올리지 않고 route·code별 bounded metric으로 본다. 500·503은 안전한 내부 category와 request ID로 조사한다.

## test matrix

- [ ] 모든 code가 표의 HTTP·retryable과 정확히 일치
- [ ] header `X-Request-Id`와 body `error.requestId` 일치
- [ ] invalid client request ID가 response splitting 없이 server ID로 교체
- [ ] 성공·400·401·403·404·405·409·429·500·503에 request ID 있음
- [ ] 모든 error response JSON·no-store·nosniff
- [ ] 405 `Allow` 정확, route mutation 없음
- [ ] validation fields가 public path·reason allowlist만 포함
- [ ] session·Origin·admin·not found details가 비어 있음
- [ ] 타 visitor·미공개·없는 대상의 404 shape가 같음
- [ ] 각 409가 다른 conflict 원인으로 섞이지 않음
- [ ] VERSION_CONFLICT는 currentRevision 외 최신 body를 노출하지 않음
- [ ] 429 header·details 일치, 제한 전 재시도 없음
- [ ] 500 처리하지 않은 exception에 stack·SQL·provider 원문 없음
- [ ] commit 전 500·503에 partial write 없음, commit 뒤 응답 실패는 상태 조회로 확인
- [ ] mutation 500·503 뒤 자동 재전송 대신 상태 확인
- [ ] unknown code UI가 안전한 일반 문구·request ID 제공
- [ ] log·metric에 details·ID·body·token이 없음

## 구현 gate

- [ ] code enum이 server·client 공유 source 또는 contract test로 일치한다.
- [ ] error factory가 header·body request ID와 no-store를 한 곳에서 설정한다.
- [ ] code별 details serializer가 allowlist이고 exception object를 받지 않는다.
- [ ] route·auth·Origin·ownership·domain 오류 우선순위 통합 테스트가 있다.
- [ ] 405·500도 framework 기본 HTML이 아닌 공통 JSON을 반환한다.
- [ ] 화면 행동과 일본어 문구가 code만 아니라 operation 상태를 반영한다.

연결 검수: AC03, AC04, AC07, AC08, AC11, AC13, AC15, AC16, AC19, AC20
