# 목록 pagination·cursor 계약 v0.1

작성일: 2026-11-21 · 상태: API 구현 전 기준

이 문서는 여기서울 목록 API의 정렬, keyset pagination, 불투명 cursor, 필터 변경과 동시 데이터 변경 시 의미를 정의한다. 목적은 page를 넘길 때 같은 항목이 반복되거나 정상 항목이 임의로 건너뛰는 구현 차이를 줄이고, cursor가 권한·개인정보·secret 경계를 우회하지 않게 하는 것이다.

## P0 범위

| route | 목록 범위 | canonical 정렬 tuple |
| --- | --- | --- |
| `GET /api/v1/quests` | 현재 공개·시작 가능, visitor가 완료한 quest 제외 | `firstPublishedAt DESC, questId ASC` |
| `GET /api/v1/me/runs` | 현재 visitor 소유 run | `startedAt DESC, runId ASC` |
| `GET /api/v1/admin/quests` | 운영자가 볼 수 있는 전체 quest | `createdAt DESC, questId ASC` |
| `GET /api/v1/admin/reports` | 허용된 상태의 report | `createdAt DESC, reportId ASC` |
| 향후 audit 조회 | 허용된 entity·기간·action | `createdAt DESC, auditId ASC` |

정렬의 두 번째 UUID는 같은 시각의 total order를 만든다. 첫 번째 정렬 값은 생성 뒤 바뀌지 않는 값을 사용한다. `updatedAt`, status, 집계 수, 제목과 relevance 점수처럼 page를 넘기는 동안 변할 수 있는 값은 cursor 정렬 key로 쓰지 않는다.

P0에는 client가 선택하는 `sort` query가 없다. 정렬 옵션을 추가할 때는 option별 tuple, index, cursor version, 화면 label과 동시 변경 의미를 먼저 이 문서에 추가한다.

## 응답 envelope

모든 목록 성공 응답은 같은 envelope를 사용한다.

```json
{
  "items": [],
  "nextCursor": null
}
```

- `items`는 요청한 `limit` 이하 배열이다.
- 다음 항목이 있을 때만 `nextCursor`는 non-empty string이다.
- 마지막 page와 빈 첫 page의 `nextCursor`는 `null`이다.
- `hasMore`, 전체 건수와 page 번호는 P0 응답에 없다.
- 목록 항목별 shape은 각 API 예시를 따른다.

전체 건수를 알아내기 위해 별도 `COUNT(*)`를 실행하지 않는다. 운영 화면에 수치가 필요하면 동일 transaction snapshot을 보장한다고 가장하지 않고 별도 집계의 시각과 의미를 정의한다.

## limit

- 생략하면 20이다.
- canonical decimal integer 1~50만 허용한다.
- `0`, 음수, 소수, 지수 표기, 앞뒤 공백, 반복 query key와 범위 초과는 400 `VALIDATION_ERROR`다.
- 다음 page에서 limit을 바꾸는 것은 허용하지 않는다. cursor의 filter fingerprint에는 effective limit이 포함된다.
- server가 요청 limit을 조용히 낮추거나 높이지 않는다.

응답은 `limit + 1`개를 내부 조회해 다음 항목 존재 여부를 판정하고, client에는 최대 `limit`개만 반환한다. `items.length === limit`만으로 다음 page가 있다고 추측하지 않는다.

## keyset 조회

offset pagination은 사용하지 않는다. 첫 page는 canonical filter와 정렬로 조회하고, 다음 page는 cursor의 마지막 tuple 뒤에서 시작한다.

내림차순 시각과 오름차순 UUID tuple `(t, id)`의 다음 page 조건은 의미상 다음과 같다.

```text
t < lastTime OR (t = lastTime AND id > lastId)
```

DB query는 이 조건, 권한·상태 filter와 canonical `ORDER BY t DESC, id ASC`를 같은 statement에 적용한다. 메모리에서 page를 자른 뒤 권한·상태를 제거하지 않는다. 그러면 항목 수가 부족해지고 다음 cursor가 잘못될 수 있다.

정렬 tuple과 filter에 맞는 복합 index 후보를 migration 전 `EXPLAIN`으로 확인한다. index가 보안을 대신하지 않으며 visitor·admin 소유권 조건은 모든 page에서 다시 적용한다.

## cursor 의미

cursor는 client가 해석·수정·조립하지 않는 versioned opaque token이다. P0는 stateless authenticated token을 사용하며 발급 뒤 30분에 만료한다. TTL은 환경별로 달라지지 않는 code constant다.

논리 payload에는 다음만 포함한다.

- cursor format version
- route kind
- canonical filter fingerprint
- 마지막 정렬 tuple
- 발급 시각과 만료 시각
- cursor signing key version

payload에 다음을 넣지 않는다.

- visitor ID, run owner, admin subject·email
- cookie, session token·hash, bearer token
- title, comment, report 내용, 한국어 주소와 자유 입력
- raw filter string, IP, user-agent
- signing secret이나 내부 DB connection 정보

token은 길이 상한이 있는 base64url 계열 transport-safe encoding과 인증된 서명/MAC을 사용한다. 단순 base64 encoding만으로 변조를 막았다고 보지 않는다. 암호화가 필요하지 않은 최소 metadata만 넣되, decoded payload를 public 계약으로 문서화하지 않는다.

## 서명 key·rotation

- cursor 전용 secret을 session, Auth, IP HMAC과 분리한다.
- secret은 환경별로 분리하고 browser bundle·log·error에 넣지 않는다.
- issuer는 활성 key version으로 서명한다.
- rotation 동안 verifier는 제한된 이전 key version을 cursor 최대 TTL만큼만 허용한다.
- 알 수 없는 key version, 서명 실패와 만료는 모두 공개 detail을 최소화한 400이다.
- 이전 key 제거는 최대 TTL과 배포 rollback window가 지난 뒤 한다.

secret inventory, 소유자, rotation과 비상 폐기는 [설정·secret 운영 계약](CONFIGURATION_SECRETS_v0.1.md)을 따른다. key 유출이 의심되면 cursor를 영구 세션처럼 보존하지 않고 해당 version을 폐기해 재탐색하게 한다.

## filter fingerprint

fingerprint는 route마다 허용된 query를 검증·정규화한 뒤 만든 canonical object에서 계산한다.

공개 quest 예:

```json
{
  "route": "public-quests",
  "area": "seongsu",
  "tags": ["craft", "food"],
  "durationMax": 120,
  "limit": 20
}
```

- tag는 의미상 순서가 없으므로 unique canonical code 순으로 정렬한다.
- 생략된 값과 명시적 기본값을 같은 의미로 볼지 route별로 고정한다. P0에서 생략 `limit`과 `limit=20`은 같은 effective 값이다.
- status, duration과 UUID는 검증된 canonical 값만 사용한다.
- query 문자열 원문·parameter 순서·percent encoding 차이로 다른 fingerprint를 만들지 않는다.
- route kind를 포함해 admin cursor를 public route에서 재사용하지 못하게 한다.

fingerprint는 server secret을 노출하지 않는 고정 길이 digest로 비교한다. token 안의 fingerprint와 현재 요청의 canonical fingerprint가 다르면 400이다. 어떤 field가 달랐는지, 서명이 맞았는지 details로 알려 주지 않는다.

## 권한·개인화

cursor가 인증을 담거나 대신하지 않는다.

- `/me/runs`는 매 page마다 현재 유효 visitor session과 `visitor_id` 소유권을 다시 검사한다.
- admin 목록은 매 page마다 OIDC server session과 활성 principal을 다시 검사한다.
- cursor 발급 뒤 session이 만료·삭제·비활성화되면 401 또는 403이며 cursor가 접근을 복구하지 않는다.
- 다른 사용자가 token을 재사용해도 query는 그 사용자의 scope로 다시 제한되며 원 소유자의 항목을 반환하지 않는다.
- 공개 quest는 유효 visitor가 있으면 그 visitor의 완료 제외 조건을 매 page에 적용한다.

권한 차이를 cursor 오류보다 먼저 얼마나 구분할지는 endpoint의 인증 순서를 따른다. malformed token으로 principal 존재 여부를 추측할 수 있는 상세 오류나 timing 약속을 만들지 않는다.

## 동시 데이터 변경

P0 목록 순회는 DB snapshot export가 아니라 요청 시점의 live view다. 다만 immutable sort tuple과 keyset 조건으로 다음을 보장한다.

- 첫 page 뒤 새로 생성·최초 공개돼 cursor 앞에 정렬되는 항목은 기존 순회에 끼워 넣지 않는다. 새로고침한 첫 page에서 본다.
- 기존 항목의 제목·집계·내용이 바뀌어도 sort tuple은 바뀌지 않아 같은 순회에서 위치가 이동하지 않는다.
- 삭제·pause·archive·권한 변경으로 다음 page 전에 제외된 항목은 반환하지 않는다.
- cursor 뒤에 있던 항목이 제외되면 server는 조회 시점 조건으로 가능한 항목을 채우지만 snapshot 일관성을 약속하지 않는다.
- pause된 quest가 resume돼 원래 tuple 위치로 돌아오면 아직 지나지 않은 경계에 있을 때 보일 수 있다.
- visitor가 순회 중 quest를 완료하면 이후 page에서 해당 quest는 제외된다.

client는 `id` 기준으로 현재 렌더 목록을 deduplicate해 방어할 수 있지만 server 중복의 정상화를 위한 대체 수단으로 사용하지 않는다. 새 검색·pull-to-refresh는 cursor와 기존 목록을 버리고 첫 page부터 시작한다.

완전한 snapshot export가 필요하면 일반 목록 cursor를 재사용하지 않고 export job, snapshot 시각, 보존과 접근 통제를 별도 설계한다.

## 오류 계약

다음은 400 `VALIDATION_ERROR`, `retryable: false`다.

- cursor 길이·문자·encoding 오류
- 서명·key version 검증 실패
- 만료된 cursor
- 지원하지 않는 format version
- route kind 불일치
- filter·effective limit fingerprint 불일치
- sort tuple type·range 오류

`details`는 필요하면 `{ "field": "cursor" }` 수준으로 제한한다. payload, digest, signature, key version, 마지막 row ID와 내부 parse 오류를 반환하지 않는다.

DB·secret provider·내부 dependency의 일시 장애는 503 `SERVICE_UNAVAILABLE`이며 유효하지 않은 cursor처럼 400으로 숨기지 않는다. client는 같은 cursor로 제한 재시도할 수 있다. 429는 기존 cursor를 유지하고 `Retry-After` 전 요청하지 않는다.

400이면 client는 자동 반복하지 않고 목록을 유지한 채 첫 page 새로고침 행동을 제공한다. session 401은 cursor를 버리고 세션 복구 흐름을 따른다.

## logging·observability

log·metric에는 raw cursor와 decoded payload를 남기지 않는다.

허용 후보:

- route kind
- first/next page 구분
- requested/effective limit
- 반환 item 수와 nextCursor 존재 boolean
- cursor validation category의 bounded enum
- query·DB latency, request ID

금지:

- cursor 원문·signature·fingerprint
- last UUID·visitor/admin identity를 metric label로 사용
- report comment·quest title·filter 자유 입력
- invalid token sample 수집

높은 invalid cursor 비율은 client contract mismatch, 만료 정책과 공격 입력을 구분해 조사하되 token 원문을 수집하지 않는다.

## 성능·부하

- 첫 page와 깊은 page의 query plan이 offset 크기에 비례해 느려지지 않아야 한다.
- 각 route의 실제 filter 조합과 `limit=50`에서 index scan·row scan을 측정한다.
- 개인화 완료 제외 join이 N+1 query를 만들지 않는다.
- `limit + 1` 밖의 전체 row를 application memory로 읽지 않는다.
- invalid cursor는 DB query 전에 길이·encoding·signature·fingerprint를 제한된 비용으로 검사한다.
- 서명 검증 실패와 정상 요청 모두 token 크기 상한을 먼저 적용한다.

목표와 증거 형식은 [성능·부하 검수 계획](PERFORMANCE_LOAD_TEST_v0.1.md)을 따른다.

## test matrix

- [ ] 생략 limit·1·20·50 성공, 0·51·소수·반복 key 거절
- [ ] 같은 timestamp의 UUID tie-break 순서가 page 경계에서도 안정적
- [ ] 첫 page 빈 결과와 마지막 page `nextCursor: null`
- [ ] 정확히 limit개뿐인 결과에서 nextCursor가 null
- [ ] limit+1 결과에서 다음 page가 나머지 하나만 반환
- [ ] page 전체 순회에서 ID 중복·정상 상태의 누락 없음
- [ ] 첫 page 뒤 앞쪽 insert가 기존 순회에 끼어들지 않고 새 첫 page에 표시
- [ ] title·count 수정이 page 위치를 바꾸지 않음
- [ ] pause·archive·삭제·visitor 완료가 다음 page에서 제외됨
- [ ] area·tags·duration·status·limit 변경 뒤 이전 cursor 거절
- [ ] parameter 순서·canonical tag 순서 차이는 같은 fingerprint
- [ ] public·me·admin·report route 사이 cursor 재사용 거절
- [ ] 한 글자 변조·truncation·과대 token·잘못된 base64url 거절
- [ ] 만료·알 수 없는 version·이전 key grace 종료 거절
- [ ] 이전 key grace 동안 발급된 유효 cursor 허용
- [ ] visitor 삭제·session 만료·admin 비활성 뒤 cursor로 접근 불가
- [ ] 다른 visitor cursor 재사용으로 원 소유자 데이터 노출 없음
- [ ] 503·429 뒤 같은 cursor 재시도 결과가 계약에 맞음
- [ ] raw cursor·payload·ID가 log·metric에 없음
- [ ] 깊은 page query plan과 `limit=50` 부하 증거

## 증거 양식

```markdown
# pagination·cursor 검수 YYYY-MM-DD HH:mm KST

- commit·environment:
- route·filter·effective limit:
- canonical order·index·query plan:
- page 수·전체 unique ID 수:
- boundary tie·concurrent insert/update/remove:
- filter·route·limit mismatch:
- tamper·expiry·key rotation:
- visitor/admin authorization replay:
- 400·429·503 client recovery:
- latency·rows scanned·memory:
- log·metric redaction:
- 알려진 제한:
```

실제 cursor, UUID, session, admin identity, secret과 report 내용을 증거에 넣지 않는다. 식별자는 synthetic fixture code로 치환한다.

## 구현 gate

- [ ] route별 immutable total-order tuple과 복합 index 후보가 확정됐다.
- [ ] filter canonicalization과 effective limit fingerprint가 공통 함수로 검수된다.
- [ ] cursor 전용 secret, TTL, key version과 rotation grace가 환경 inventory에 있다.
- [ ] 모든 page에서 권한·소유권·공개 상태를 DB query에 적용한다.
- [ ] 400·401·403·429·503의 client 복구 행동이 화면 계약과 일치한다.
- [ ] 동시 insert·update·제외와 tie boundary 통합 테스트가 통과했다.
- [ ] raw cursor·payload·identity가 log·metric·error에 없다.

연결 검수: AC01, AC02, AC06, AC10, AC15, AC16, AC19
