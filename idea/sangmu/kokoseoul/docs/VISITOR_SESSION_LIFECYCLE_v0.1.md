# 익명 방문자 session 수명주기 계약 v0.1

작성일: 2026-11-21 · 상태: F3 구현 전 기준

이 문서는 DigiMan P0 익명 방문자 session의 생성, cookie 전달, keyed hash 조회, pepper 교체, 고정 만료, 전체 삭제와 장애 복구를 repository 수준으로 정의한다. 운영자 OIDC session과는 이름·저장소·검증 함수를 공유하지 않는다.

## 사용자 약속

- 탐색만 할 때는 session과 개인 기록을 만들지 않는다.
- 사용자가 시작 또는 신고 의도를 보이고 30일 기록 안내를 확인한 뒤에만 생성한다.
- 진행·완료·feedback은 이 browser에만 연결되며 계정·다른 기기와 동기화되지 않는다.
- 생성 시점부터 30일 뒤 만료하고 일반 사용으로 연장하지 않는다.
- 사용자는 유효한 session에서 전체 기록을 삭제할 수 있다.
- cookie를 지우거나 기기를 잃은 뒤 과거 기록을 복구·병합할 수 있다고 약속하지 않는다.

정확한 일본어 문구와 KST 만료 표시는 화면·locale 계약을 따르고, backup 경계는 [데이터 보존·삭제·복구 계약](DATA_RETENTION_ERASURE_v0.1.md)을 따른다.

## 범위와 비범위

P0에는 host-only opaque cookie 한 개, visitor·session row, 소유권 확인, 고정 30일 만료, 24시간 이내 cleanup 목표와 pepper 전환이 있다.

다음은 P0에 없다.

- 로그인·이메일·전화번호·social identity
- 기기 fingerprint, 복구 code, QR·link transfer
- 여러 기기·browser session 병합
- sliding expiry, refresh token, “remember me” 선택
- client가 생성하는 session ID 또는 bearer token
- session 목록·원격 로그아웃 UI

향후 계정 연결을 추가할 때 익명 visitor를 이메일에 조용히 결합하지 않고 별도 동의·충돌·삭제·보존 migration을 설계한다.

## 데이터 shape

| table | 필수 값 | 보안·수명 불변식 |
| --- | --- | --- |
| `visitors` | id, created_at, expires_at | 개인 기록 root, 생성 뒤 expiry 연장 금지 |
| `visitor_sessions` | id, visitor_id, token_hash_version, token_hash, created_at, expires_at | 원문 token 없음, `(version, hash)` unique |

P0 신규 visitor는 session 한 개로 시작한다. schema가 여러 session row를 허용해도 cookie 분실 뒤 기존 visitor에 새 session을 연결할 인증 근거가 없으므로 임의 연결하지 않는다.

두 expiry는 같은 DB transaction clock의 `created_at + 2,592,000 seconds`다. application clock과 DB clock을 섞지 않는다. DB timestamp는 UTC instant이며 화면에서만 Asia/Seoul로 표시한다.

## token 생성·표현

1. server가 OS CSPRNG로 32 random bytes를 생성한다.
2. cookie 값은 padding 없는 base64url로 encode한다.
3. decode하면 정확히 32 bytes여야 한다.
4. raw bytes는 response cookie를 만드는 request scope 밖에 보존하지 않는다.

32 bytes를 UUID로 줄이지 않고 client의 신규 token 후보를 받지 않는다. collision이면 DB unique 오류 뒤 내부에서 제한 재생성하며 token·hash를 오류에 넣지 않는다.

token은 response JSON, URL, HTML, log, trace, metric, analytics, audit, screenshot, queue, cache key, idempotency key와 test artifact에 나타나면 안 된다.

## keyed hash

DB lookup 값은 다음 의미의 HMAC-SHA-256이다.

```text
tokenHash = HMAC-SHA-256(pepper[hashVersion], rawTokenBytes)
```

- `token_hash`는 32-byte binary로 저장한다.
- `token_hash_version`은 secret이 아닌 bounded identifier다.
- pepper는 환경별 secret store에 있고 DB·Git·browser에 없다.
- 단순 SHA-256(token), password hash와 reversible encryption으로 대체하지 않는다.
- token은 256-bit random이므로 password KDF로 request 비용을 키우지 않는다.

hash를 log·metric·request ID로 쓰지 않는다.

## cookie 계약

production·preview의 성공 cookie는 다음 속성을 가진다.

```text
digiman_visitor=<opaque>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax
```

- `Domain`을 생략한 host-only cookie다.
- `Max-Age`와 API `expiresAt`은 같은 server instant 기준이다.
- framework가 `Expires`도 출력하면 `expiresAt`과 모순되지 않아야 한다.
- production과 preview는 hostname·namespace·pepper·DB를 공유하지 않는다.
- local HTTP에서만 검증된 Secure 예외를 허용하고 배포 환경은 이를 거절한다.
- cookie value와 전체 `Set-Cookie` header를 관측 도구에서 redact한다.

P0 이름은 `digiman_visitor`다. 이름을 바꾸면 생성·검증·삭제 header, API 예시, browser migration과 기존 기록 접근 영향을 같은 release에서 설계한다.

## 생성 endpoint

`POST /api/v1/visitor-sessions`는 `{}` JSON, exact allowed Origin과 JSON Content-Type을 요구한다. UI는 시작·신고 안내 확인 전에 호출하지 않는다.

### cookie 없음

1. body·Origin·rate limit을 검증한다.
2. server가 token을 만들고 active pepper로 HMAC한다.
3. 하나의 DB transaction에서 visitor와 session을 만든다.
4. commit 성공 뒤에만 201 JSON과 `Set-Cookie`를 반환한다.
5. body는 `expiresAt`과 검수된 일본어 안내만 포함한다.

rollback·timeout이면 cookie를 보내지 않는다. commit 뒤 응답이 유실돼 orphan visitor가 생길 수 있으나 아직 run·report가 없으며 cleanup 대상이다.

### 유효한 cookie 있음

- hash lookup, expiry와 visitor 존재를 확인한다.
- 같은 visitor·session의 기존 `expiresAt`으로 200을 반환한다.
- 생성·만료 시각을 수정하지 않고 token·cookie를 재발급하지 않는다.
- 새 visitor·session row를 만들지 않는다.

### malformed·unknown·expired cookie 있음

명시적인 새 시작·신고 의도 뒤 생성 endpoint가 호출됐다면 새 visitor·session을 201로 만들고 cookie를 교체한다. unknown cookie를 기존 visitor와 연결하지 않는다.

다른 개인 API는 새 session을 자동 생성하지 않는다. 401 `SESSION_REQUIRED`를 반환하고 stale cookie를 같은 scope로 만료할 수 있다.

## request 인증 순서

1. cookie header 크기와 개수를 제한한다.
2. 이름이 정확한 cookie 하나인지 확인한다.
3. base64url 문자·길이와 32-byte decode를 검사한다.
4. 허용된 current·previous pepper version별 HMAC 후보를 계산한다.
5. `(token_hash_version, token_hash)`로 session을 찾는다.
6. DB clock으로 session과 visitor expiry를 확인한다.
7. 대상이 현재 visitor 소유인지 query 안에서 확인한다.
8. mutation이면 exact Origin·JSON·rate limit과 domain transaction을 검사한다.

malformed, unknown, expired는 모두 401 `SESSION_REQUIRED`이며 어느 단계가 맞았는지 공개하지 않는다. 다른 visitor 소유 object는 404다. token 검증이 object 소유권을 대신하지 않는다.

## pepper rotation

정상 rotation 동안 accepted version은 current와 previous 최대 두 개다.

1. 새 version·pepper를 secret store에 추가한다.
2. issuer는 current version으로만 신규 hash를 만든다.
3. verifier는 current, previous를 bounded하게 확인한다.
4. previous row가 일치하면 같은 raw cookie의 current HMAC으로 조건부 갱신한다.
5. 최대 session 수명과 잔존 건수를 확인한 뒤 previous를 제거한다.
6. previous-only synthetic session이 401인지 검수한다.

두 request의 동시 rehash도 한 current hash로 수렴해야 한다. unique 충돌을 500으로 노출하지 않고 row를 다시 읽는다. rotation 때문에 expiry를 연장하거나 cookie를 재발급하지 않는다.

pepper 노출이 의심되면 해당 version을 즉시 폐기한다. 영향 session은 401이 되며 새 명시적 행동으로 새 session을 만든다. 탈취 가능성보다 기록 연결 유지를 우선하지 않는다. 설정·폐기 절차는 [설정·secret 운영 계약](CONFIGURATION_SECRETS_v0.1.md)을 따른다.

## 고정 만료·cleanup

- 인증 조건은 `expires_at > DB now`다. 같은 instant면 expired다.
- GET·mutation·200 재사용·pepper rehash는 expiry를 연장하지 않는다.
- 만료 판정은 cleanup job 성공과 독립적이다.
- cleanup은 작은 batch, deterministic order와 visitor 단위 transaction을 사용한다.
- 만료 뒤 24시간 안에 active DB의 연결 기록을 정리하는 목표를 측정한다.
- cleanup 재시도와 두 worker 경합은 같은 최종 결과여야 한다.

만료와 mutation이 경합하면 visitor row lock 또는 동등한 serialization 아래 DB clock을 다시 확인한다. 만료 뒤 새 step·feedback·report가 commit되면 안 된다.

job 호출 인증, `SKIP LOCKED`, invocation budget, cadence와 restore mode는 [background job 계약](BACKGROUND_JOBS_v0.1.md)을 따른다.

## 전체 삭제와 cookie

`DELETE /api/v1/me/data`는 valid session, exact Origin과 `{}` JSON을 요구한다.

- visitor row를 잠그고 expiry를 다시 확인한다.
- 개인 기록을 삭제하고 report는 보존 계약대로 삭제 또는 익명화한다.
- 모든 session과 visitor row를 같은 transaction에서 삭제한다.
- commit 뒤 204와 같은 이름·scope의 `Max-Age=0` cookie를 보낸다.
- rollback이면 삭제 완료 문구와 cookie 만료를 보내지 않는다.
- 응답 유실 뒤 401은 접근 불가를 뜻하지만 삭제 commit 여부를 단독으로 증명하지 않는다.

새 session을 자동 생성해 삭제 상태를 확인하지 않는다.

## 여러 탭·네트워크 실패

- 같은 browser 탭들은 같은 cookie와 visitor를 사용한다.
- cookie 없는 동시 생성은 서로 다른 visitor가 될 수 있다. UI request lock과 rate limit으로 줄이되 server가 두 token을 병합하지 않는다.
- 첫 응답 유실 시 cookie 수신 여부를 먼저 확인한다.
- cookie가 있으면 개인 endpoint로 확인하고, 없으면 제한된 생성 재시도를 허용한다.
- 새 session 생성은 이미 보낸 run·report mutation 상태 확인 수단이 아니다.
- offline cache에 cookie·private response·개인 상태를 영구 저장하지 않는다.

## cache·CSRF·CORS

- session 생성·개인 조회·변경 응답은 `Cache-Control: no-store`다.
- cookie에 따라 달라지는 조회는 `Vary: Cookie`를 사용한다.
- credential CORS wildcard를 사용하지 않는다.
- mutation은 SameSite와 별도로 exact Origin을 검사한다.
- GET은 session·expiry·last-seen을 변경하지 않는다.
- service worker는 개인·session·admin response를 cache하지 않는다.

header 기준은 [HTTP 보안·캐시 header 계약](HTTP_SECURITY_HEADERS_v0.1.md)을 따른다.

## 관측

허용 metric 후보는 create 201·reuse 200·401 category, active hash version별 row 수, rehash 결과, cleanup overdue age·batch, create·lookup·delete latency와 429·503이다.

cookie·token·hash·pepper·visitor ID, token 일부, IP·user-agent fingerprint와 사용자 원문은 log·metric에 금지한다. 남용 경계는 [속도 제한·남용 대응 계약](RATE_LIMIT_ABUSE_v0.1.md)을 따른다.

## test matrix

- [ ] 탐색만으로 visitor·session row와 cookie가 생기지 않음
- [ ] 안내 뒤 cookie 없음은 201과 한 visitor·session
- [ ] CSPRNG 32-byte, base64url decode 길이, invalid 문자 거절
- [ ] raw token이 DB·body·URL·log·analytics·artifact에 없음
- [ ] HMAC-SHA-256 current version lookup과 binary hash unique
- [ ] 유효 cookie 재호출은 200, 같은 expiry, row·Set-Cookie 증가 없음
- [ ] malformed·unknown·expired 개인 API는 동일 401
- [ ] 생성 endpoint의 stale cookie는 새 201, 기존 visitor와 병합 안 됨
- [ ] DB rollback은 Set-Cookie 없음, response 유실 orphan에 개인 기록 없음
- [ ] Secure·HttpOnly·SameSite=Lax·Path=/·Domain 없음·Max-Age 2592000
- [ ] preview·production 분리와 local Secure 예외 차단
- [ ] current·previous lookup과 조건부 rehash, 동시 요청 수렴
- [ ] rehash는 expiry를 연장하지 않음
- [ ] previous grace 종료·compromise 폐기 뒤 synthetic token 401
- [ ] expiry 1초 전 성공, 같은 instant·1초 뒤 실패
- [ ] 만료와 mutation 경합에서 만료 뒤 commit 없음
- [ ] cleanup 중복·worker 경합과 24시간 overdue metric
- [ ] 전체 삭제 commit 뒤 연결 row 없음과 cookie Max-Age=0
- [ ] 삭제 rollback은 cookie 유지·완료 문구 없음
- [ ] 타 visitor 대상은 404, Origin 불일치는 403
- [ ] rate limit·limiter 장애에서 부분 row 생성 없음
- [ ] private response no-store·Vary, service worker cache 없음

## 증거 양식

```markdown
# visitor session 검수 YYYY-MM-DD HH:mm KST

- commit·environment·DB marker:
- create 201·reuse 200·invalid 401:
- token length·encoding·HMAC version:
- cookie attributes·host scope:
- DB transaction·response loss:
- fixed expiry boundary·clock:
- current/previous rotation·negative test:
- ownership·Origin·rate limit:
- cleanup·delete race:
- cache·token/hash/log redaction:
- 알려진 제한:
```

실제 cookie, token, hash, visitor ID, IP, secret과 사용자 원문을 증거에 넣지 않는다.

## 구현 gate

- [ ] token encoding·HMAC algorithm·versioned pepper와 DB binary shape가 확정됐다.
- [ ] create transaction commit 전 cookie를 내보내지 않는다.
- [ ] 고정 30일을 DB clock 하나에서 계산하고 모든 경로가 연장하지 않는다.
- [ ] 개인 route마다 session·expiry·visitor 소유권을 다시 검사한다.
- [ ] current·previous rehash·grace 종료·compromise 폐기 test가 통과했다.
- [ ] 만료·cleanup·전체 삭제와 mutation 경합 test가 통과했다.
- [ ] cookie·token·hash·pepper가 client bundle·log·artifact에 없다.
- [ ] UI가 다른 기기 복구 불가, 만료일과 전체 삭제 결과를 일본어로 전달한다.

연결 검수: AC01, AC03, AC06, AC10, AC16, AC20
