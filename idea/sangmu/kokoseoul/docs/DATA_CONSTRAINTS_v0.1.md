# PostgreSQL 데이터 정합성 계약 v0.1

작성일: 2026-11-21 · 상태: schema 구현 전 검토 기준

이 계약은 [B2C 설계 스펙](B2C_SPEC_v0.1.md)의 데이터 모델을 PostgreSQL 제약, 인덱스, 잠금과 트랜잭션 단위로 구체화한다. 실제 migration은 행사 규칙에서 제품 코드 작성이 허용된 뒤 생성한다.

엔터티별 허용 상태 전이와 사용자 가용성은 [도메인 상태 머신 계약](STATE_MACHINES_v0.1.md)을 따른다.

## 공통 규칙

- 모든 ID는 애플리케이션이 생성한 UUID다.
- 시각은 `timestamptz`로 UTC 저장하며 DB 기본 시각을 사용한다.
- 상태와 category는 허용 값이 작은 경우 PostgreSQL enum 또는 동일한 check constraint로 제한한다.
- 사용자 입력 문자열은 길이 제한과 빈 문자열 금지를 DB와 API 양쪽에서 적용한다.
- 저장 전 NFC·공백·줄바꿈과 멱등 비교 정규화는 [입력 검증 계약](INPUT_VALIDATION_v0.1.md)을 따른다.
- 외래키 삭제 동작은 명시하고 기본값에 의존하지 않는다.
- 공개 버전과 완료 기록을 깨뜨리는 물리 삭제는 허용하지 않는다.
- API의 사전 조회보다 DB 제약과 트랜잭션 결과를 최종 기준으로 삼는다.

## 상태 값

| 구분 | 허용 값 |
| --- | --- |
| supplier kind | `internal`, 후속 `external` |
| supplier status | `active`, `suspended`, `archived` |
| quest status | `draft`, `published`, `paused`, `archived` |
| quest version state | `draft`, `published` |
| solo status | `confirmed`, `unknown` |
| run status | `in_progress`, `completed` |
| report category | `information`, `unavailable`, `other` |
| report status | `new`, `in_progress`, `resolved` |
| admin role | `editor`, `admin` |
| principal status | `active`, `disabled` |
| analytics environment | `demo`, `test`, `production` |

상태 추가는 DB, API, 화면 상태, 오류 처리와 검수 시나리오를 함께 바꾸는 계약 변경이다.

## 관계와 삭제 방향

```text
supplier_orgs ──< quests ──< quest_versions ──< quest_steps
                       │                │              │
                       │                └──── runs ────┤
                       │                       │        └─< run_steps
                       │                       └─ feedback
                       └─ reports

visitors ──< visitor_sessions
    ├─< runs
    ├─< reports
    └─< analytics_events

admin_principals ──< quests
    └─< audit_logs
```

퀘스트·공개 버전·단계·run은 보존한다. 방문자가 전체 기록 삭제를 요청하면 방문자 소유 데이터는 정해진 순서로 제거하고 신고는 사용자 연결과 자유 입력을 제거한 운영 요약만 남긴다.

## 테이블별 제약

### supplier_orgs

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| 필수 | `name`, `kind`, `status`, 생성·수정 시각 |
| check | trim한 name 1~120자 |
| 삭제 | quest가 있으면 물리 삭제 금지 |

초기 내부 공급자 한 개는 seed로 만들되 고정 UUID를 제품 코드에 흩어 두지 않는다.

### visitors와 visitor_sessions

| 제약 | 계약 |
| --- | --- |
| visitors primary key | `visitors.id` |
| sessions primary key | `visitor_sessions.id` |
| token 유일성 | `token_hash_version`, `token_hash` 조합 unique |
| 외래키 | session의 visitor 삭제 시 session cascade |
| check | `expires_at > created_at` |
| index | `visitor_sessions(expires_at)` |

원문 토큰, 이메일, 실명과 기기 fingerprint는 저장하지 않는다. 토큰 해시 버전을 별도 열로 둬 알고리즘·pepper 전환 여부를 판단할 수 있게 한다. pepper는 DB에 저장하지 않는다.

세션 조회는 hash version과 hash를 함께 사용한다. 만료된 행은 존재하더라도 인증에 실패하며 비동기 정리 작업을 기다리지 않는다.

### admin_principals

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| unique | `(issuer, subject)` |
| 필수 | issuer, subject, role, status, 생성·수정 시각 |
| check | issuer·subject 빈 문자열 금지 |

이메일은 표시용 별도 필드로 둘 수 있지만 유일 권한 키로 사용하지 않는다. Auth.js 사용자·세션 테이블과 제품 권한 테이블을 분리한다.

### places

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| 필수 | `address_ko`, `verified_at` |
| latitude | null 또는 -90 이상 90 이하 |
| longitude | null 또는 -180 이상 180 이하 |
| coordinate pair | lat·lng는 둘 다 null이거나 둘 다 값이 있음 |
| check | trim한 address 1~300자 |

place 수정은 앞으로 만들 draft에만 반영한다. 공개 버전 단계는 `place_snapshot`을 보관한다.

### quests

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| 외래키 | `supplier_org_id`·`created_by` 필수, 모두 restrict delete |
| create idempotency | `create_request_id` UUID 필수, `(created_by, create_request_id)` unique |
| revision | 1 이상 정수, 모든 콘텐츠·상태 변경 때 증가 |
| published version | null 또는 같은 quest의 published version |
| pause reason | paused면 trim한 일본어 1~300자 필수, 나머지는 null |
| archived | archived면 종료 시각 필수 |
| index | `(status, updated_at desc, id)` |

`published_version_id`가 같은 quest를 가리키는지는 단순 외래키만으로 보장되지 않는다. `(quest_id, id)` 후보키와 복합 외래키 또는 공개 트랜잭션의 잠금·검증을 함께 사용한다.

### quest_versions

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| unique | `(quest_id, version_no)` |
| candidate key | `(quest_id, id)` |
| version | 1 이상 정수 |
| duration | 15 이상 240 이하 |
| tags | 허용 코드만, 중복 없음, 최대 5개 |
| cost | 둘 다 null이거나 0 이상, min ≤ max |
| published review | published면 reviewed_by·reviewed_at 필수 |
| verified | 공개 시 `verified_at` 필수 |
| demo | 공개 시 null 금지 |

quest마다 draft는 최대 하나다. PostgreSQL partial unique index를 사용한다.

```sql
create unique index quest_versions_one_draft_per_quest
  on quest_versions (quest_id)
  where state = 'draft';
```

공개된 행은 애플리케이션 권한만으로 보호하지 않는다. update·delete 경로를 repository에서 제공하지 않고, 가능하면 DB trigger 또는 별도 권한으로 내용 변경을 차단한다.

### quest_steps

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| unique | `(version_id, position)` |
| candidate key | `(version_id, id)` |
| position | 1 이상 5 이하 |
| body | trim한 일본어 1~3000자 |
| phrase pair | ko·ja 둘 다 null이거나 둘 다 값이 있음 |
| place snapshot | place가 필요한 단계면 주소·근거·확인일 포함 |

공개 검증은 단계 수가 3~5개이며 position이 1부터 끊김 없이 이어지는지 트랜잭션 안에서 검사한다. 이 규칙은 단일 행 check로 보장할 수 없다.

### runs

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| unique | `(visitor_id, quest_id)` |
| version ownership | `(quest_id, version_id)`가 해당 quest의 version을 가리킴 |
| completed state | completed면 `completed_at` 필수 |
| in progress state | in_progress면 `completed_at` null |
| time order | completed_at은 started_at 이상 |
| indexes | `(visitor_id, status, started_at desc, id)`, `(version_id)` |

동일 방문자의 반복 수행을 후속 지원할 때 기존 unique를 바로 제거하지 않는다. attempt 번호, 활성 attempt 규칙과 과거 API 의미를 먼저 설계한다.

### run_steps

| 제약 | 계약 |
| --- | --- |
| primary 또는 unique | `(run_id, step_id)` |
| step ownership | run이 고정한 version의 step만 허용 |
| 필수 | `completed_at` |
| index | `(run_id, completed_at)` |

step 소속 검증은 run의 version과 step의 version을 함께 비교한다. 애플리케이션이 전달한 position만 믿지 않는다.

### feedback

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| unique | `run_id` |
| joy score | 1 이상 5 이하 |
| comment | null 또는 최대 500자 |
| run state | completed run만 허용 |

완료 상태 검증은 feedback upsert 트랜잭션에서 run을 잠그고 확인한다.

### reports

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| active unique | `(visitor_id, client_request_id)` where visitor_id is not null |
| quest version | version이 해당 quest에 속함 |
| comment | null 또는 최대 500자 |
| status | 허용된 report 상태 |
| revision | 1 이상 정수, 운영 status·내부 메모 변경 때 증가 |
| internal note | null 또는 최대 2000자, 방문자 원문·식별자 복사 금지 |
| anonymization | anonymized_at이 있으면 visitor_id·client_request_id·comment는 null |
| index | `(status, created_at, id)` |

같은 멱등 키의 기존 행을 찾으면 quest, version, category, comment의 [canonical 값](INPUT_VALIDATION_v0.1.md)이 모두 같은지 비교한다. 다르면 `REQUEST_CONFLICT`다.

활성 신고는 visitor_id와 client_request_id가 필수다. 전체 기록 삭제나 만료 정리 뒤 운영상 신고 요약을 보존할 때는 `anonymized_at`을 기록하고 사용자 연결, 멱등 키와 자유 입력을 제거한다. 이 상태를 표현하기 위해 reports의 visitor_id와 client_request_id는 DB에서 nullable로 두되 check constraint로 활성·익명 상태를 구분한다.

### audit_logs

| 제약 | 계약 |
| --- | --- |
| primary key | `id` |
| admin | 활성 여부와 무관하게 기존 principal 참조 유지 |
| request | server가 확정한 request ID, 응답·허용 log와 연결 |
| action | 허용된 action 코드 |
| entity | `entity_type`과 `entity_id`, action prefix와 type 일치 |
| summaries | action별 제한된 JSON object, 토큰·자유 입력 원문 금지 |
| index | `(entity_type, entity_id, created_at desc)`, `(admin_id, created_at desc)`, `(request_id)` |

상태 변경과 감사 로그 insert는 같은 트랜잭션이다. 감사 로그 쓰기 실패 시 운영 변경도 rollback한다.

action catalog, summary allowlist, append-only 권한과 보존 검수는 [운영 감사 로그 계약](AUDIT_LOG_CONTRACT_v0.1.md)을 따른다.

### analytics_events

이벤트 의미, dedupe key, 허용 properties와 집계 원본은 [분석 이벤트와 지표 계약](ANALYTICS_EVENT_CONTRACT_v0.1.md)을 따른다.

| 제약 | 계약 |
| --- | --- |
| unique | `event_id` |
| semantic unique | 서버가 만든 `dedupe_key` |
| event name | 정의된 분석 이벤트만 허용 |
| environment | demo·test·production |
| properties | 이벤트별 허용 키만, 1KB 이하; 자유 입력·주소·토큰·원시 위치 금지 |
| indexes | `(environment, event_name, created_at)`, visitor·quest·run 참조 |

분석 이벤트 저장 실패로 사용자 run 트랜잭션을 rollback하지 않는다. 시작·완료 수의 최종 기준은 runs다.

## 핵심 트랜잭션

### 퀘스트 시작

1. quest 행을 잠그고 status가 published인지 확인한다.
2. published version이 유효하고 같은 quest에 속하는지 확인한다.
3. `(visitor_id, quest_id)`로 run insert를 시도한다.
4. unique 충돌이면 기존 run을 조회한다.
5. 신규면 201, 기존이면 200과 같은 ID를 반환한다.

중지 요청도 같은 quest 행을 잠가 시작과 중지의 순서를 하나로 결정한다.

### 단계 완료

1. 본인 visitor의 run에서 quest ID를 잠금 없이 후보 조회한다.
2. quest를 잠근 뒤 run을 잠그고 소유권·quest ID를 다시 확인한다.
3. run이 completed면 해당 step의 기존 결과 또는 순서 오류를 반환한다.
4. quest 상태, run의 고정 version, 요청 step 소속을 검사한다.
5. 미완료 선행 step이 있는지 position 기준으로 검사한다.
6. run_steps를 insert한다. 기존 동일 행이면 기존 completed_at을 사용한다.
7. 마지막 단계면 같은 트랜잭션에서 run을 completed로 바꾼다.

quest → run 잠금 순서로 pause·archive와 단계 완료의 선후를 결정한다. 완료 전환은 `status = 'in_progress'` 조건을 포함한 update로 한 번만 성공하게 한다. 동시 요청의 패자는 commit된 현재 상태를 다시 읽는다.

### draft 저장

1. quest를 `id`와 `expected_revision`으로 잠그거나 조건부 update한다.
2. revision 불일치면 아무 내용도 쓰지 않고 `VERSION_CONFLICT`를 반환한다.
3. 기존 draft 전체를 검증하고 canonical 값이 같으면 current result를 반환한다.
4. 값이 다르면 전체를 교체하거나 새 version의 draft를 만든다.
5. quest revision을 1 증가시킨다.
6. 제한된 before·after summary로 audit log를 쓴다.

### 공개

1. quest와 draft version을 잠근다.
2. expected revision과 허용 상태를 검사한다.
3. 단계 수·연속 position·일본어·비용·장소·근거·확인일·권리·demo 표시를 검사한다.
4. draft를 published로 확정하고 reviewed 정보를 기록한다.
5. quest의 published version, status, revision을 변경한다.
6. 감사 로그를 쓰고 commit한다.

### 전체 개인 기록 삭제

1. visitor를 잠그고 유효한 본인 세션인지 확인한다.
2. feedback과 run_steps를 삭제한다.
3. run 참조를 포함한 visitor analytics events를 삭제한다.
4. runs를 삭제한다.
5. reports는 visitor 연결·client request ID·자유 입력을 제거하고 운영 요약만 남기거나 정책에 따라 삭제한다.
6. visitor_sessions와 visitor를 삭제한다.
7. commit 성공 뒤 응답에서 쿠키를 만료한다.

중간 실패는 전체 rollback한다. 204를 보낸 뒤 비동기 정리를 완료하는 구조로 구현하지 않는다.

## 격리와 재시도

- 일반 조회는 기본 `read committed`를 사용한다.
- 시작·중지, 마지막 단계 완료, 공개처럼 경합하는 행은 명시적 행 잠금을 사용한다.
- 여러 행의 불변식을 직렬화해야 할 때만 `serializable`을 검토한다.
- deadlock·serialization failure는 서버 내부에서 짧은 횟수만 재시도한다.
- 재시도 한도를 넘으면 `SERVICE_UNAVAILABLE`과 `retryable: true`를 반환한다.
- 트랜잭션 안에서 지도·분석·외부 인증 같은 네트워크 호출을 하지 않는다.

잠금은 항상 quest, version, run처럼 정한 순서로 획득해 deadlock 가능성을 줄인다.

## 만료와 보존 정리

정리 작업은 중복 실행돼도 같은 결과가 되는 배치로 만든다.

| 대상 | 초기 정책 | 정리 기준 |
| --- | --- | --- |
| visitor session | 생성 후 30일 | expires_at이 현재 시각 이전이면 즉시 인증 거절 |
| 방문자 연결 데이터 | 만료 후 24시간 이내 | visitor 단위 삭제 트랜잭션 |
| backup | 7일 정책안 | 제공 요금제 확인 필요 |
| 오류 로그 | 7일 정책안 | 토큰·자유 입력 원문 금지 |
| audit log | 90일 정책안 | 만료 후 집계 필요 여부 결정 |

백업 복구 뒤 서비스 공개 전에 만료·삭제 정리를 먼저 실행한다. 삭제 전 backup에는 삭제 요청 근거가 없으므로 단순 만료 cleanup만으로 충분하지 않다. 독립 erasure ledger를 검증하지 않은 P0에서는 [보존·삭제·복구 계약](DATA_RETENTION_ERASURE_v0.1.md)에 따라 restored DB의 모든 visitor 연결 데이터를 purge한 뒤에만 승격을 검토한다. AC20은 복구 성공뿐 아니라 이 재노출 방지를 확인한다.

## migration 규칙

- migration 파일은 생성 순서와 checksum을 유지한다.
- 공유된 migration을 수정하지 않고 새 migration으로 변경한다.
- constraint와 index 이름은 오류 매핑·운영 진단에 사용할 수 있게 명시한다.
- destructive migration은 백업·복구·data backfill 계획 없이 실행하지 않는다.
- schema 변경과 API 계약 변경은 같은 기능 PR에서 검토하되 커밋은 되돌릴 수 있게 나눌 수 있다.
- production migration과 애플리케이션 배포의 호환 순서를 기록한다.

## 구현 전 검수 목록

- [ ] 모든 외래키의 delete 동작을 정했다.
- [ ] 복합 소유 관계를 단순 UUID 외래키만으로 신뢰하지 않는다.
- [ ] unique 충돌을 정상 멱등 결과와 실제 conflict로 구분한다.
- [ ] 공개 버전 update·delete 경로가 없다.
- [ ] 마지막 단계와 run 완료가 한 트랜잭션이다.
- [ ] 전체 삭제가 204 전에 commit된다.
- [ ] 만료 세션은 정리 작업 전에도 접근할 수 없다.
- [ ] 감사 로그 실패가 운영 변경을 rollback한다.
- [ ] 분석 실패가 사용자 완료를 rollback하지 않는다.
- [ ] 실제 PostgreSQL 동시성 테스트로 AC03, AC05, AC07~AC09, AC13을 검증한다.
