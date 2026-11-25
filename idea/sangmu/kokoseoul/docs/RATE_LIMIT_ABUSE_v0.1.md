# 속도 제한·남용 대응 계약 v0.1

작성일: 2026-11-21 · 상태: provider·저장소 확정 전 초기 정책

이 문서는 공개 탐색, visitor session, 진행 mutation, report와 운영 API의 속도 제한 의미, 식별 key, 429 응답, 장애와 개인정보 경계를 정의한다. 초기 숫자는 검수 후보이며 실제 공유 Wi-Fi·preview traffic을 측정한 뒤 낮추거나 높인다.

## 목표

- 자동 요청이 session·DB connection·자유 입력 처리량을 고갈시키지 않는다.
- 같은 행사장 Wi-Fi의 정상 사용자 여러 명을 한 사람처럼 과도하게 막지 않는다.
- visitor token·IP를 제품 analytics나 장기 profile로 사용하지 않는다.
- 429가 mutation 성공 여부를 모호하게 만들지 않는다.
- rate limiter가 권한·소유권·DB unique·transaction을 대신하지 않는다.

## 초기 limit 후보

| 범위 | key | window | 후보 | 비고 |
| --- | --- | ---: | ---: | --- |
| 공개 목록·상세 | privacy-safe IP key | 1분 | 120회 | CDN·platform 보호와 중복 여부 확인 |
| visitor session 생성 | privacy-safe IP key | 1분 | 10회 | 응답 유실 orphan과 session churn 제한 |
| 일반 visitor mutation | visitor ID | 1분 | 60회 | run·step·feedback·delete 합산 |
| report 생성 | visitor ID | 1시간 | 5회 | 자유 입력 남용 제한 |
| report IP 보조 | privacy-safe IP key | 1시간 | 20회 | 새 session 반복 우회 완화 |
| admin 조회 | admin principal ID | 1분 | 300회 | 운영 화면 polling 상한 |
| admin mutation | admin principal ID | 1분 | 60회 | revision·audit가 최종 정합성 보장 |
| OIDC 로그인 | provider + platform | provider 정책 | 별도 측정 | application callback 반복도 관찰 |

“IP당”은 가정한 client header가 아니라 신뢰한 edge·reverse proxy가 확정한 remote address에서 만든 단기 key다. 실제 provider의 header 계약을 배포 전에 검증한다.

동일 요청이 여러 bucket에 해당하면 가장 먼저 초과한 범위로 429를 반환하되 내부 bucket 이름과 threshold를 client에 공개하지 않는다.

## key 신뢰 경계

### IP key

- browser가 직접 보낸 `X-Forwarded-For`·`X-Real-IP`를 신뢰하지 않는다.
- 신뢰할 proxy hop과 platform이 보장한 source만 사용한다.
- 여러 forwarded value를 임의로 첫 번째 client IP로 선택하지 않는다.
- raw IP를 limiter key, log, metric label에 저장하지 않는다.
- 짧은 rotation secret으로 HMAC한 값 또는 provider의 privacy-safe key를 사용한다.
- rotation이 window 도중 limit을 무력화하지 않게 현재·이전 key 허용 범위를 설계한다.

IP HMAC secret은 session·Auth·cursor secret과 분리한다. abuse 조사 목적으로 원래 IP를 복원할 수 있는 암호화를 추가하지 않는다.

### visitor key

유효 session을 검증한 뒤 server의 visitor ID로 bucket을 찾는다. cookie token 원문·hash를 limiter key나 error details에 사용하지 않는다. visitor 만료·삭제 뒤 limiter state도 window 만료 또는 명시적 cleanup으로 제거한다.

### admin key

Auth.js user ID나 email이 아니라 활성 `admin_principals.id`를 사용한다. disabled principal은 rate limit보다 권한 검사에서 즉시 403이다.

## 검사 순서

권한 존재 여부와 limiter 자원 소모를 모두 고려해 endpoint별로 순서를 고정한다.

### 인증 없는 endpoint

1. 신뢰할 IP key 생성 가능 여부
2. coarse IP limit
3. request parsing·domain 처리

### visitor mutation

1. Origin·작은 body 상한의 안전한 선검사
2. session 검증과 visitor key
3. visitor limit과 report IP 보조 limit
4. strict 입력·소유권·state transaction

### admin mutation

1. Origin과 운영 session
2. active principal·role
3. admin limit
4. strict 입력·revision·transaction

공격자에게 admin principal 존재나 허용 Origin 목록을 알려 주기 위해 응답 차이를 세밀하게 만들지 않는다. 실제 middleware 순서는 timing·load test로 검토한다.

## 429 응답

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
Retry-After: 30
X-Request-Id: 01KAMERATELIMIT00000000000
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "messageJa": "しばらく待ってから、もう一度お試しください。",
    "requestId": "01KAMERATELIMIT00000000000",
    "retryable": true,
    "details": {
      "retryAfterSeconds": 30
    }
  }
}
```

`Retry-After`는 정수 초 또는 일관된 HTTP date 중 하나로 고정하며 P0는 정수 초를 사용한다. details 값과 header가 일치해야 한다. bucket key·limit·남은 횟수·IP는 반환하지 않는다.

## mutation과 429 의미

limit은 domain transaction 전에 원자적으로 소비한다. 429를 반환한 요청은 run·step·feedback·report·audit를 변경하지 않는다.

응답 유실로 이미 commit된 mutation을 같은 body로 재전송했을 때 limiter가 먼저 429를 반환할 수 있다. client는 다음을 따른다.

- run·step: current run GET으로 상태 확인
- report: Retry-After 뒤 같은 clientRequestId와 body로 재전송
- quest 생성: Retry-After 뒤 같은 clientRequestId 재전송
- 운영 상태 변경: 최신 상세와 revision을 조회하고 자동 재전송하지 않음

429를 받았다는 이유로 새 idempotency key나 새 visitor session을 만들지 않는다.

## UI 처리

- 입력과 현재 run 상태를 유지한다.
- server가 준 대기 시간을 일본어로 표시한다.
- 대기 전 button 연타·background 자동 재시도를 막는다.
- countdown을 매초 screen reader live region으로 읽지 않는다.
- 대기 뒤 사용자가 명시적으로 다시 시도하거나 한 번만 자동 재시도하는 정책을 endpoint별로 정한다.
- 전체 앱이 차단된 것처럼 표시하지 않고 제한된 행동을 설명한다.

report 제한은 “신고가 거절됐다”가 아니라 잠시 뒤 재시도할 수 있음을 알리되 즉시 처리·해결을 약속하지 않는다.

## limiter state와 원자성

window counter는 여러 server instance에서 같은 결과를 내는 shared 저장소 또는 provider 기능을 사용한다. process memory만으로 production limit을 충족했다고 간주하지 않는다.

필수 성질:

- check와 increment가 원자적
- TTL 또는 window cleanup
- server clock 기준
- key·window versioning
- instance·region 간 일관성 범위 기록
- retry와 provider timeout 상한
- raw IP·token 저장 금지

PostgreSQL을 limiter 저장소로 사용할 경우 hot row·connection 비용이 핵심 transaction을 방해하지 않는지 부하 검수한다. 새 KV provider를 쓰면 region·비용·보존·삭제·license·장애를 외부 서비스 결정에 추가한다.

## limiter 장애

저장소 timeout을 “제한 안 걸림”으로 조용히 처리하지 않는다. P0 기본값:

| endpoint | limiter 불가 | 이유 |
| --- | --- | --- |
| 공개 GET | 짧은 local emergency cap이 검증됐으면 제한적 fail-open, 아니면 503 | 읽기 가용성과 DB 보호 균형 |
| session 생성 | 503 `SERVICE_UNAVAILABLE` | session churn 방지 |
| visitor mutation | 503 | DB write 남용·모호한 counter 방지 |
| report | 503 | 자유 입력·새 session 우회 방지 |
| admin mutation | 503 | 운영 audit와 변경 보호 |

emergency cap이 serverless instance별이라 전체 방어를 보장하지 않는다는 제한을 기록한다. limiter 장애가 domain transaction 도중 발생하지 않게 transaction 전에 짧은 timeout으로 확인한다.

## 공유 Wi-Fi와 오탐

행사장·호텔·카페에서는 많은 사용자가 한 public IP를 공유한다.

- authenticated visitor mutation은 IP보다 visitor bucket을 우선한다.
- IP 보조 제한은 session 생성·report처럼 session churn이 가능한 경로에 한정한다.
- 정상 20명이 5분 동안 demo를 실행하는 시나리오를 한 IP로 검수한다.
- 429 비율을 IP별로 log하지 않고 route·environment 집계로 본다.
- 정상 시연을 위해 production limiter를 끄지 않고 demo 환경의 명시적 정책을 사용한다.
- 특정 IP allowlist로 심사 기기만 우회하는 숨은 경로를 만들지 않는다.

필요하면 limit을 높이되 권한·unique·input 검사를 낮추지 않는다.

## report 남용

- category enum과 500자·2KB 상한을 먼저 적용한다.
- HTML·link preview·attachment를 허용하지 않는다.
- 같은 clientRequestId·같은 body는 기존 결과, 다른 body는 409다.
- 반복 5회 이후 429가 기존 report를 삭제하거나 status를 바꾸지 않는다.
- 운영 화면은 comment를 plain text로 escape한다.
- report count를 사용자 신뢰 점수나 fingerprint profile로 확장하지 않는다.

P0는 CAPTCHA를 기본 도입하지 않는다. 도입을 검토하면 접근성, 개인정보, 국외 전송, 비용과 실패 fallback을 먼저 결정한다.

## 운영 API 남용

rate limit보다 OIDC·active principal·expectedRevision·audit가 우선 보안 경계다.

- 로그인 성공만으로 bucket을 부여하지 않고 principal 확인 뒤 사용한다.
- 401·403 반복은 threshold와 별개로 aggregate 보안 신호로 관찰한다.
- admin limit 초과가 public API에 영향을 주지 않는 namespace를 사용한다.
- batch publish·수정 기능을 만들기 전 limit과 audit granularity를 다시 설계한다.

## privacy와 관측

기록 가능:

- route template, environment, 429 count
- limiter provider timeout·error category
- Retry-After 구간의 aggregate 분포
- shared-Wi-Fi test의 전체 성공·429 수

기록 금지:

- raw IP와 IP HMAC key
- visitor·admin limiter key
- cookie·token·request body
- report 원문과 User-Agent
- UUID를 metric label로 사용

limiter state의 TTL이 지났는데 key가 남는지 provider 설정과 test에서 확인한다.

## 검수 matrix

- [ ] 정확히 limit 직전·도달·초과 요청
- [ ] window 경계와 server clock
- [ ] 두 instance의 같은 key 동시 요청
- [ ] 같은 visitor·다른 IP, 같은 IP·다른 visitor
- [ ] 한 IP에서 정상 visitor 20명·5분 흐름
- [ ] 새 session 반복으로 report limit 우회 시도
- [ ] 429에서 DB·audit·event 무변경
- [ ] Retry-After header·details 일치
- [ ] 429 뒤 run 조회와 idempotent retry
- [ ] raw IP·key·body canary가 log·metric에 없음
- [ ] limiter timeout·unavailable에서 endpoint별 503/fallback
- [ ] disabled admin·타인 run이 rate limit보다 권한을 우회하지 않음
- [ ] IPv4·IPv6와 신뢰 proxy header 변조

## 증거 양식

```markdown
# 속도 제한 검수 YYYY-MM-DD

- commit·release:
- 환경·region:
- limiter provider·저장 위치:
- proxy IP source와 신뢰 설정:
- key rotation·TTL:

| 범위 | limit·window | 정상 결과 | 초과 결과 | 동시 instance | 비고 |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

- 공유 Wi-Fi 20명 시나리오:
- limiter 장애 주입:
- log·metric canary:
- 비용·latency:
- 알려진 제한:
```

실제 IP·limiter key·provider credential은 기록하지 않는다.

## 출시 gate

- [ ] 신뢰할 proxy source와 IP key 생성이 검증됐다.
- [ ] shared limiter가 여러 instance에서 원자적으로 동작한다.
- [ ] 공유 Wi-Fi 정상 20명 흐름을 과도하게 막지 않는다.
- [ ] report·session churn 우회를 검수했다.
- [ ] 429가 mutation을 만들지 않고 안전한 retry 경로가 있다.
- [ ] limiter 장애의 503·fallback을 endpoint별로 검수했다.
- [ ] raw IP·key·자유 입력이 log·metric에 없다.
- [ ] 실제 provider 비용·region·TTL·보존을 결정 큐와 운영 문서에 반영했다.

연결 검수: AC03, AC05, AC09, AC12, AC15, AC16
