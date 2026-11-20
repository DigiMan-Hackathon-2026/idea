# 운영 감사 로그 계약 v0.1

작성일: 2026-11-21 · 상태: schema·운영 mutation 구현 전 기준

이 문서는 콘텐츠와 신고 운영 변경의 actor·action·대상·revision을 재구성하면서도 request body, 사용자 원문, OIDC identity와 secret을 복제하지 않는 감사 로그 schema와 검수 기준을 정의한다. 감사 로그는 application 관측 로그나 제품 analytics가 아니라 운영 domain transaction의 일부다.

## 목적

- 어떤 active principal이 어떤 운영 변경을 언제 commit했는지 확인한다.
- quest·report revision과 상태 전이를 순서대로 재구성한다.
- 오래된 편집 덮어쓰기·부분 commit·감사 누락을 검출한다.
- 장애·신고 처리에서 제한된 request ID로 기술 log와 연결한다.
- 자유 입력·개인정보·credential의 두 번째 보관소가 되지 않는다.

## 비목표

- 운영자 키 입력·화면 조회·모든 로그인 시도를 기록하지 않는다.
- 사용자 행동 분석이나 성과 지표에 사용하지 않는다.
- before·after 전체 document를 저장하거나 rollback source로 쓰지 않는다.
- DB 관리자까지 막는 cryptographic tamper-proof 원장이라고 주장하지 않는다.
- application log·provider audit·Git history를 대체하지 않는다.

## schema

| field | 형식 | 생성·제약 |
| --- | --- | --- |
| `id` | UUID | server 생성 primary key |
| `admin_id` | UUID FK | transaction에서 재확인한 active principal |
| `request_id` | 정규화된 request ID | response·allowlist log와 연결, 사용자 입력 아님 |
| `action` | enum | 아래 허용 action만 |
| `entity_type` | `quest` 또는 `report` | action prefix와 일치 |
| `entity_id` | UUID | 변경 대상 내부 ID |
| `before_summary` | JSON object 또는 null | action별 exact schema |
| `after_summary` | JSON object | action별 exact schema |
| `created_at` | timestamptz | 변경 transaction의 DB 시각 |

`request_id`는 cookie·token·idempotency key가 아니다. 동일 HTTP operation의 domain change와 audit가 같은 값으로 연결되며 metric label에 사용하지 않는다.

index 후보:

- `(entity_type, entity_id, created_at desc, id desc)`
- `(admin_id, created_at desc, id desc)`
- `(request_id)`의 unique가 아닌 조회 index
- retention batch용 `(created_at, id)`

entity UUID만으로 type을 추측하지 않는다. request ID는 충돌 가능성을 검수하되 domain uniqueness key로 쓰지 않는다.

## action catalog

| action | 전이·변경 | before | after |
| --- | --- | --- | --- |
| `quest.created` | 없음 → draft quest | null | status·revision·draftVersionNo |
| `quest.draft_saved` | draft content 전체 저장 | revision·draftVersionNo | revision·draftVersionNo·fieldGroups·stepCount |
| `quest.published` | draft 확정·pointer 교체 | status·revision·publishedVersionNo | status·revision·publishedVersionNo·reviewCategories |
| `quest.paused` | published → paused | status·revision | status·revision·reasonPresent |
| `quest.resumed` | paused → published | status·revision·reasonPresent | status·revision |
| `quest.archived` | 허용 상태 → archived | status·revision | status·revision·archivedAt |
| `report.triaged` | new → in_progress | status·revision | status·revision·notePresent |
| `report.resolved` | new·in_progress → resolved | status·revision | status·revision·notePresent |
| `report.reopened` | resolved → in_progress | status·revision | status·revision·notePresent |
| `report.note_updated` | status 유지, note 의미 변경 | status·revision·notePresent | status·revision·notePresent |

한 mutation이 status와 note를 함께 바꾸면 상태 전이 action 하나만 기록한다. `note_updated`와 중복 행을 만들지 않는다. 같은 상태·같은 note의 빈 PATCH는 domain에서 거절되므로 audit도 없다.

새 action을 문자열로 즉시 저장하지 않는다. action enum, summary schema, retention·privacy 영향, failure injection test와 이 표를 같은 기능 변경에서 추가한다.

## summary allowlist

### 공통 허용 값

- status enum
- revision 전후 정수
- versionNo와 step count 같은 비식별 정수
- `reasonPresent`, `notePresent` 같은 boolean
- 고정된 field group·review category enum 배열
- archivedAt 같은 domain DB 시각

### field group

draft 저장은 실제 값 대신 변경 category만 기록한다.

- `copy`
- `classification`
- `duration_cost_solo`
- `steps`
- `places`
- `phrases`
- `sources`
- `demo_flag`

배열은 정렬·dedupe하고 현재 허용 값 외 문자열을 거절한다. field path·title·주소·phrase·source URL을 저장하지 않는다.

### review category

- `japanese`
- `facts`
- `map_links`
- `rights`
- `demo_label`

boolean 확인을 category 이름으로만 남기며 reviewer 이름·이메일과 비공개 근거를 summary에 넣지 않는다.

## 금지 필드·내용

- cookie·Authorization·session token·OIDC token·authorization code
- issuer·subject·email·name·profile image
- visitor ID·run ID·clientRequestId·IP·User-Agent
- feedback·report comment·internalNote 원문
- quest title·body·step·한국어 주소·phrase 원문
- pause reason 원문과 source 담당자 답변
- request·response body와 header 전체
- DB URL·constraint error·stack·provider response
- before·after entity 전체 JSON

사용자에게 공개되는 pause reason도 audit에는 `reasonPresent=true`만 둔다. 실제 현재 값은 domain table·version에 있고 audit가 content backup이 되지 않게 한다.

## 원자성

운영 mutation의 transaction은 다음을 함께 commit한다.

1. active principal과 current revision 재확인
2. domain state·content 변경
3. revision 증가
4. exact action·summary validation
5. audit row insert

audit insert, JSON schema, FK, size constraint가 실패하면 domain 변경도 rollback한다. audit를 queue·monitoring sink·best-effort event로 보내지 않는다.

분석 event 또는 application log 전송 실패는 별도 계약에 따라 domain mutation을 rollback하지 않을 수 있다. 세 종류를 같은 helper의 “log failure”로 취급하지 않는다.

## 실패·거절 기록

다음은 domain audit row를 만들지 않는다.

- current revision에서 canonical draft가 완전히 같은 no-op 저장
- 400 validation 실패
- 401·403 인증·Origin·권한 실패
- 404 존재 은닉
- 409 revision·state·idempotency 충돌
- 429 rate limit
- transaction rollback·503

commit되지 않은 변경을 audit history에 성공처럼 남기지 않기 위해서다. 반복된 auth·validation 실패는 개인정보 없는 application security signal로 집계할 수 있다.

필요하면 incident record에 request ID·route·status를 연결하되 audit table에 실패 body를 추가하지 않는다.

## actor lifecycle

- `admin_id`는 request마다 재확인한 active principal이다.
- principal을 disabled해도 과거 audit FK는 유지한다.
- principal hard delete로 audit actor를 null로 만들지 않는다.
- audit 조회에서 OIDC subject·email을 join해 export하지 않는다.
- P0에 impersonation·service account mutation은 없다.

관리 operation으로 principal lifecycle을 추가하면 application audit action과 provider·DB 관리 audit의 책임을 먼저 정한다. bootstrap script가 actor를 가짜 admin으로 기록하지 않는다.

## request ID 연결

audit의 request ID는 response `X-Request-Id`와 allowlist application log의 같은 값이다.

- inbound 값 형식을 검증하고 server가 최종 값을 결정한다.
- invalid·collision이면 새 값으로 교체한다.
- raw URL·query·body를 함께 저장하지 않는다.
- request ID 조회 권한은 audit 접근자에게만 준다.
- 같은 request에서 domain mutation 하나면 audit 하나가 기본이다.

향후 batch operation은 한 request ID에 여러 entity audit가 가능하므로 action 수·부분 실패·transaction 경계를 별도로 설계한다. P0에는 batch publish를 두지 않는다.

## 읽기·접근

P0 public·visitor API는 audit를 반환하지 않는다. 일반 운영 quest·report response에도 audit history를 자동 포함하지 않는다.

감사 조회가 필요하면:

- active principal보다 별도의 최소 운영 권한 필요 여부를 결정한다.
- entity·기간·action cursor pagination만 허용한다.
- 자유 검색·body 검색·actor email 검색은 두지 않는다.
- response serializer는 summary allowlist를 다시 적용한다.
- export는 기본 비활성이고 목적·기간·폐기 시점을 승인한다.

현재 별도 audit 조회 endpoint는 API 계약에 없다. DB console을 일상 운영 UI처럼 사용하지 않고, 구현 필요가 확인되면 endpoint·권한·test를 먼저 추가한다.

## 보존·삭제

- 90일은 provider·운영 요구 확정 전 정책안이다.
- visitor·run과 연결하지 않으므로 사용자 전체 삭제 대상이 아니다.
- report가 익명화돼도 audit에는 원래 comment·visitor 연결이 없어야 한다.
- retention job은 작은 batch로 cutoff 이전 행만 삭제한다.
- runtime application role은 audit update·delete 권한을 갖지 않는다.
- retention 전용 role·operation은 대상 기간·행 count category를 값 없이 기록한다.
- backup restore·visitor purge 뒤 audit FK와 summary schema 무결성을 확인한다.

보존 기간을 늘려 incident 편의를 얻기 전에 접근·비용·개인정보와 실제 법적 요구를 검토한다.

## append-only 경계

- application repository는 insert와 제한 조회만 제공한다.
- audit row update endpoint·method를 만들지 않는다.
- domain rollback을 위해 audit before summary를 실행 가능한 command로 사용하지 않는다.
- DB owner가 변경할 수 있다는 한계를 문서화한다.
- 필요하면 DB trigger·권한으로 runtime update·delete를 거절한다.

P0의 append-only는 application·runtime role 통제이며 외부 공증·hash chain 보장이 아니다.

## 검수 matrix

- [ ] action catalog 외 문자열 insert 거절
- [ ] action과 entity_type 불일치 거절
- [ ] action별 summary missing·unknown key 거절
- [ ] summary size 상한과 JSON type 검수
- [ ] content mutation 성공마다 revision과 audit 하나
- [ ] audit insert 실패에서 content·status·revision rollback
- [ ] 400·401·403·404·409·429·503에서 성공 audit 없음
- [ ] 두 운영자 revision 경쟁에서 승자 audit 하나
- [ ] pause·resume·archive 응답 유실 뒤 audit 중복 없음
- [ ] report note 원문·comment canary가 summary에 없음
- [ ] OIDC identity·token·address·phrase canary가 없음
- [ ] public·visitor·일반 admin serializer에 audit 없음
- [ ] disabled principal 이후 과거 audit 조회 무결성 유지
- [ ] retention 경계 시각과 runtime delete 거절
- [ ] restore·visitor purge 뒤 audit entity·actor 참조 유지

## 정합성 점검

release·incident 검수에서 비식별 집계로 다음을 비교한다.

- quest revision 증가 수와 해당 기간 audit action 수
- report revision 증가 수와 report action 수
- published·paused·archived 상태에 필요한 마지막 action 존재
- action 시간 순서에서 revision이 1씩 증가
- audit 없는 운영 변경 또는 domain 없는 audit 행

기존 데이터 보정이 필요해도 과거 actor·시각을 추측한 가짜 audit를 만들지 않는다. 차이를 incident·migration evidence로 기록하고 이후 invariant를 고친다.

## 증거 양식

```markdown
# audit 검수 YYYY-MM-DD HH:mm KST

- commit·schema·환경:
- action·summary schema version:
- 실행한 quest·report 전이:
- domain revision / audit 수:
- failure injection·rollback:
- conflict·거절 시 audit 없음:
- request ID 연결:
- canary 금지 필드 검사:
- runtime update·delete 거절:
- retention·restore 검수:
- 알려진 무결성 차이·제한:
```

실제 admin ID·request ID·entity UUID·summary row·content 원문은 증거에 붙이지 않는다.

## 구현 gate

- [ ] schema에 request_id와 entity_type이 있고 action별 summary를 검증한다.
- [ ] 모든 운영 mutation이 같은 transaction에서 audit를 insert한다.
- [ ] repository에 audit update·일반 delete 경로가 없다.
- [ ] runtime role과 retention role 권한을 분리했다.
- [ ] log·analytics·audit 실패 의미가 구현과 test에서 다르다.
- [ ] 90일 보존·조회 owner·접근 범위를 provider 설정과 맞췄다.
- [ ] AC08·AC13~AC15·AC19의 audit 원자성·privacy를 검수했다.

연결 검수: AC08, AC13, AC14, AC15, AC19, AC20
