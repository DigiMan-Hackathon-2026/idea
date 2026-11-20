# F1 PostgreSQL 구현·검수 계획 v0.1

작성일: 2026-11-21 · 상태: 전체 domain schema·local/CI 역할·핵심 unique 동시성 실DB 검증 완료, 경합·실패 주입 진행 중

이 문서는 [데이터 정합성 계약](DATA_CONSTRAINTS_v0.1.md)을 첫 Drizzle schema와 SQL migration으로 옮길 때의 생성 순서, 계정 경계, 테스트 격리와 증거를 정의한다. F0가 통과하기 전에는 migration을 생성하거나 DB를 변경하지 않는다. 행사 규칙 미확인은 구현 차단 조건이 아니라 제출 전 위험이다.

## F1의 종료 결과

- 리뷰 가능한 Drizzle schema와 생성 이력이 고정된 SQL migration
- 모든 외래키·unique·check·partial index의 명시적 이름
- runtime·migration·test 연결 경계
- 실제 PostgreSQL에서 제약과 트랜잭션을 검증하는 통합 테스트
- seed가 아닌 정상 운영 절차로 demo 콘텐츠를 만드는 기반
- 빈 DB와 이미 적용된 DB 모두에서 재현한 migration 증거

F1은 화면, 실제 OIDC, production 데이터와 외부 지도 연결을 포함하지 않는다.

## 2026-11-21 base schema 실행 증거

- PostgreSQL `17.12` Alpine 3.24 공식 multi-arch image를 digest `sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32`로 고정했다.
- Drizzle ORM `0.45.4`, Drizzle Kit `0.31.11`, pg `8.23.1`을 exact version으로 고정했다.
- 첫 migration은 `supplier_orgs`, `admin_principals`, `visitors`, `visitor_sessions`, `places` 5개 table이다.
- 첫 migration SHA-256은 `ca0ec318b4e86b0dd847b150643970bdd4859aaf0aa7f2e82f04a1716ab8973e`다.
- 빈 `digiman_local` DB 적용과 같은 DB 재적용이 성공했다.
- `digiman:test` marker가 있는 `digiman_test_base`에서 32-byte hash, expiry, cascade, supplier state·trim, coordinate pair 4개 PostgreSQL 통합 테스트가 성공했다.
- GitHub Actions run `44818613781`은 같은 image digest로 `digiman_test_ci`를 만들고 네 migration·constraint test 20개와 Pixel 5·Desktop Chrome 흐름까지 `2m 19s`에 모두 통과했다.
- Drizzle이 custom `bytea` type을 `"bytea"`로 생성한 SQL은 검토 과정에서 PostgreSQL 내장 `bytea`로 교정했다.
- 두 번째 migration은 `quests`, `quest_versions`, `quest_steps` 3개 table이며 SHA-256은 `7db5f4cacb6f361ba09c26ef71ccfd14209d3aa9a9b29f81c2b1196515f269d8`이다.
- 세 번째 migration은 `runs`, `run_steps`, `feedback` 3개 table이며 SHA-256은 `68659b443bf1ea52d78ec8c0632922aa1df98f920f843b24465457ddf9a3e363`이다.
- 네 번째 migration은 `reports` table이며 SHA-256은 `196daf2133a0ba1e676e2a59dc2af79c3b2a805af631bf9b93c5c17ab30f31bf`이다.
- 다섯 번째 migration은 `audit_logs`, `analytics_events` 2개 table이며 SHA-256은 `c8bd029c3fe1ce70a832df7c6eb5d587d249d6b230ff92872d627794fa7558c5`다.
- 완전히 빈 marker DB에서 다섯 migration 적용·재적용과 PostgreSQL 통합 테스트 25개가 성공했다.
- quest당 draft 한 개, 3~5개 연속 step, 공개 version의 같은 quest 소속, 공개 version·step 불변성을 named constraint·trigger로 강제한다.
- run의 한 visitor·quest 유일성, 고정 version 소속, 순서대로 단계 완료, 모든 단계 뒤 완료 전환, 완료 후 불변성과 완료 run feedback만 허용하는 규칙을 named constraint·trigger로 강제한다.
- report의 활성 멱등 키 유일성, quest-version 소속, 운영 상태 전이·revision 증가, 익명화 뒤 사용자 재연결 금지를 named constraint·trigger로 강제한다.
- audit action별 summary exact key·active actor·entity 존재·update 금지와 analytics event별 property·run 소속·demo environment·update 금지를 named constraint·trigger로 강제한다.
- `digiman_runtime`, `digiman_retention`, `digiman_readonly`, `digiman_integration_test`는 password 없는 `NOLOGIN` capability role이다. marker DB에서 역할 구성 재적용과 `SET ROLE` 실제 DDL·audit 변경 거부를 포함한 PostgreSQL 통합 테스트 29개가 성공했다.
- 독립 PostgreSQL 연결 두 개로 같은 visitor·quest 시작, 같은 step, 같은 마지막 step을 동시에 요청했다. unique lock과 `ON CONFLICT` 뒤 run 1개·run_step 1개·완료 전환 1개로 수렴하는 통합 테스트를 포함해 총 32개가 성공했다.

이는 F1 전체 완료가 아니다. 배포 provider의 login-role mapping, publish·pause와 시작 경합, audit 실패 rollback 주입은 남아 있다.

가상 seed의 ID·clock·profile·production 차단과 expected count는 [테스트 fixture·seed 계약](TEST_FIXTURES_v0.1.md)을 따른다.

## 연결 역할

| 역할 | 허용 | 금지 |
| --- | --- | --- |
| migration | schema create·alter, index, migration table | 애플리케이션 요청 처리 |
| runtime | 필요한 table의 select·insert·update·delete | DDL, role 생성, migration table 수정 |
| integration test | 임시 DB 또는 schema 전체 제어 | preview·production host 연결 |
| read-only diagnostics | 제한된 select와 설명 계획 | 사용자 원문 export, mutation |

Neon을 채택하면 pooled runtime URL과 direct migration URL의 용도를 분리한다. URL 문자열을 로그에 출력하지 않고 host·database·role의 허용 여부만 제한된 형태로 표시한다.

local·CI에서는 `scripts/db/configure_roles.sql`을 migration 뒤 owner로 실행한다. 이 파일은 로그인이나 password를 만들지 않으며, 실제 배포에서는 provider가 만든 login에 필요한 capability role만 grant한다. runtime은 schema create와 audit update·delete를 할 수 없고, retention은 `visitor_sessions`, `analytics_events`, `audit_logs`의 제한된 select·delete만 가진다.

## migration 전 안전 검사

DB 명령은 다음을 모두 만족하지 않으면 시작 전에 실패한다.

1. `APP_ENV`가 `local` 또는 `test`
2. DB host가 local allowlist 또는 승인된 test host
3. database 이름이 production·preview 이름과 다름
4. test 작업은 marker table 또는 database comment가 test임을 확인
5. migration role과 runtime role이 다름

host만 검사하지 않는다. 같은 관리형 host에 여러 환경이 있을 수 있으므로 host·database·marker 중 두 가지 이상을 사용한다. URL의 password와 query parameter는 오류에 포함하지 않는다.

## 첫 schema 생성 순서

순환 참조를 피하고 실패 위치를 명확히 하기 위해 다음 순서를 사용한다.

1. 상태 타입 또는 check constraint용 공통 정의
2. `supplier_orgs`, `admin_principals`, `visitors`, `places`
3. `visitor_sessions`
4. `quests`를 `published_version_id=null`로 생성
5. `quest_versions`, `quest_steps`
6. `(quest_id, id)` 후보키와 `quests.published_version_id` 복합 외래키 추가
7. `runs`, `run_steps`, `feedback`
8. `reports`
9. `audit_logs`
10. `analytics_events`
11. partial unique·조회 index·추가 check constraint
12. 초기 내부 `supplier_org` 한 건

`quests`와 `quest_versions` 사이의 순환을 단순 UUID 외래키 하나로 약화하지 않는다. 공개 version은 `(quest_id, published_version_id)`가 같은 quest의 `(quest_id, id)`를 참조하게 한다.

`quests.first_published_at`은 최초 공개 transaction에서만 설정하고 이후 version 공개·중지·재개로 바꾸지 않는다. 목록 index와 정렬 tuple은 [pagination·cursor 계약](PAGINATION_CURSOR_v0.1.md)에 맞춰 migration·repository 통합 테스트에서 함께 검수한다.

## 명시적으로 이름 붙일 제약

이름은 API 오류로 그대로 노출하지 않지만 repository에서 PostgreSQL 오류를 안정적으로 분류하고 운영 진단에 사용한다.

| 의미 | 권장 이름 |
| --- | --- |
| 운영 principal identity | `admin_principals_issuer_subject_uq` |
| 운영자별 quest 생성 요청 | `quests_created_by_request_uq` |
| quest version 번호 | `quest_versions_quest_version_uq` |
| quest당 draft 하나 | `quest_versions_one_draft_uq` |
| version 단계 위치 | `quest_steps_version_position_uq` |
| 방문자별 quest run | `runs_visitor_quest_uq` |
| run 단계 완료 | `run_steps_run_step_uq` |
| run feedback 하나 | `feedback_run_uq` |
| 활성 신고 요청 | `reports_visitor_request_active_uq` |
| 분석 의미 중복 | `analytics_events_dedupe_key_uq` |

constraint 이름을 client의 `details`에 반환하지 않는다. 매핑되지 않은 DB 오류는 500 `INTERNAL_ERROR`로 기록하되 SQL과 값을 숨기고, 계약에 필요한 오류 변환을 테스트로 추가한다. dependency·transaction retry 소진의 503과 구분은 [오류 catalog](API_ERROR_CATALOG_v0.1.md)를 따른다.

## 타입 선택 검토

첫 migration 생성 전에 다음을 SQL diff에서 결정하고 기록한다.

- 상태 값을 PostgreSQL enum 또는 text + check 중 무엇으로 고정할지
- `tags`를 배열로 둘지 관계 table로 둘지
- `place_snapshot`, audit summary, analytics properties의 JSON schema 검증 위치
- UUID 생성이 애플리케이션인지 DB default인지
- 문자열 길이를 `varchar(n)`와 check 중 어디서 보장할지

어느 선택을 하든 API의 허용 값, unknown field 거절, 공개 version 불변성과 삭제 순서는 바뀌지 않는다. DB에서 보장하지 못하는 다중 행 규칙은 같은 트랜잭션과 실제 통합 테스트로 보완한다고 명시한다.

2026-11-21 quest content migration에서는 상태를 기존 base schema와 일관된 `varchar + named check`로, 현재 제품 관심사 `craft`·`food`를 중복 없는 최대 5개 `text[]`로, `place_snapshot`을 object 형태만 허용하는 `jsonb`로 선택했다. UUID는 호출자가 만들고 DB default를 두지 않는다. 공개 전환의 3~5개 연속 step처럼 행 하나의 check로 표현할 수 없는 규칙과 공개 후 불변성은 named trigger로 강제한다.

## seed 경계

### migration에 허용

- `internal` supplier organization 한 건
- 해당 행을 찾는 안정된 code 또는 한 곳에 정의한 UUID

### migration에 금지

- 운영자 Google subject·email
- demo·실제 quest, place, run, feedback, report
- 실제 주소·업체 정보·인터뷰 원문
- preview·production secret

운영 principal 등록은 감사 가능한 별도 관리 절차를 사용한다. demo quest도 운영 API의 draft → 검수 → publish 흐름을 거쳐 공개 검증 자체를 시연한다.

test fixture는 production bundle에서 import할 수 없는 `tests` 전용 경로에 두고 [테스트 계획](TEST_PLAN_v0.1.md)의 Q1~Q5, V1~V3, A1~A3 식별자를 공유한다.

## 통합 테스트 격리

| 원칙 | 구현 기준 |
| --- | --- |
| 실제 엔진 | 지원 대상과 같은 PostgreSQL major |
| worker 격리 | worker별 임시 database 우선, 불가능하면 고유 schema |
| migration | 빈 격리 대상에 실제 migration 적용 |
| 정리 | 성공·실패 모두 대상 이름을 검증한 뒤 폐기 |
| 시각 | 고정 clock과 DB 시각의 차이를 명시적으로 검사 |
| connection | 동시성 테스트는 서로 다른 실제 connection 사용 |

transaction rollback만으로 fixture를 격리하지 않는다. 두 connection과 commit 경계를 검증하는 테스트는 상위 transaction에 갇히면 실제 잠금 동작을 재현하지 못한다.

임시 대상 이름은 고정 prefix와 무작위 suffix를 사용한다. 정리 명령은 해당 prefix, 현재 test marker와 연결 대상이 모두 맞을 때만 실행한다.

## 우선 구현할 제약 테스트

### 행 단위

- UUID·필수 시각·trim 후 빈 문자열
- cost min·max와 위도·경도 범위
- 단계 position 1~5와 phrase ko·ja pair
- completed 상태와 completed_at 조합
- report 활성·익명화 상태 조합
- analytics properties 크기와 event/environment 허용 값

### 관계

- published version이 다른 quest를 참조하지 못함
- run의 version과 step version이 다르면 완료 불가
- report version이 해당 quest에 속하지 않으면 저장 불가
- 공개 version·기존 run을 깨뜨리는 물리 삭제 거절
- 비활성 admin principal도 과거 audit·created_by 참조 유지

### unique와 partial unique

- 같은 운영자·clientRequestId quest 생성 하나
- quest당 draft 하나, 과거 published version 여러 개
- visitor·quest run 하나
- run·step 하나, run feedback 하나
- 활성 visitor report key 하나, 익명화 후 key null 허용
- analytics dedupe key 하나

## 동시성 시나리오

각 검사는 두 connection이 사전 조회를 끝낸 뒤 barrier를 해제하며 HTTP 결과와 최종 DB 상태를 함께 확인한다.

| 시나리오 | 기대 결과 |
| --- | --- |
| 같은 admin의 quest 생성 2회 | 201 하나·200 하나, quest·draft 하나 |
| run 시작과 quest pause | 잠금 순서로 전후가 결정, 중간 상태 없음 |
| 같은 visitor·quest 시작 2회 | 같은 run ID, run 하나 |
| 같은 step 완료 2회 | 같은 completed_at, run_step 하나 |
| 마지막 step 완료 2회 | completed_at 하나, 완료 전환 하나 |
| draft revision 2로 저장 2회 | 하나 성공, 하나 `VERSION_CONFLICT` |
| report revision 1로 처리 2회 | 하나 성공, 하나 `VERSION_CONFLICT` |
| 사용자 삭제와 step 완료 | 전체 삭제 또는 완료 중 한 직렬 결과, 고아 행 없음 |
| 분석 insert 실패와 run 완료 | run 완료 commit 유지, 이벤트만 실패 |

deadlock timeout이나 test timeout을 성공으로 처리하지 않는다. PostgreSQL error code, 잠금 대기 구간과 두 transaction의 종료 상태를 민감정보 없이 진단에 남긴다.

## transaction 경계 검사

- run 생성과 고정 version 선택
- 마지막 run_step과 run completed 전환
- draft·publish·pause·resume·archive와 audit log
- report 처리 revision과 audit log
- visitor 전체 삭제와 report 익명화

각 경계에 의도적인 실패 지점을 넣어 전부 rollback되는지 확인한다. analytics insert만 도메인 commit 뒤 best-effort이므로 반대 방향을 검증한다.

## migration 검수

생성 도구의 SQL을 그대로 승인하지 않고 다음을 diff에서 본다.

- table·column·constraint·index 이름
- nullable과 server default
- 외래키 delete/update 동작
- partial index의 WHERE 조건
- index가 중복되거나 write 비용만 늘리지 않는지
- timezone이 있는 timestamp인지
- migration transaction 가능 여부
- 기존 application version과의 호환성

이미 공유한 migration은 수정하지 않는다. checksum이 달라졌다면 새 migration으로 수정하고 원인을 기록한다.

## 변경과 rollback

실제 데이터가 있는 환경의 expand·backfill·read switch·contract, lock·timeout과 production 실행 gate는 [migration·backfill 배포 계약](DATABASE_MIGRATION_RELEASE_v0.1.md)을 따른다.

초기 빈 DB migration도 rollback SQL만 믿지 않고 재생성으로 검증한다. 데이터가 생긴 뒤에는 다음 순서를 사용한다.

1. nullable column·새 table·호환 index 추가
2. 두 version이 읽을 수 있는 application 배포
3. 제한된 batch backfill과 결과 검증
4. 새 write 경로 전환
5. 이전 column·constraint 제거는 별도 release

destructive migration은 backup 시점, 복구 연습, 예상 lock과 application rollback 호환성을 기록하기 전 실행하지 않는다. `DROP`을 긴급 rollback 수단으로 사용하지 않는다.

## 실행 증거 양식

```markdown
# F1 DB 검수 YYYY-MM-DD HH:mm KST

- commit:
- PostgreSQL version:
- migration checksum:
- 실행 DB 종류: local / ephemeral CI
- runtime role:
- migration role:
- 빈 DB 적용 결과:
- 재적용 결과:
- 제약 테스트:
- 동시성 반복 횟수와 결과:
- 실패 주입 결과:
- schema diff:
- 알려진 제한:
```

connection string, password, 실제 사용자 데이터와 전체 SQL error object는 증거에 넣지 않는다.

## F1 종료 판정

- [ ] 빈 DB에 migration이 한 번에 적용된다.
- [ ] 적용된 DB에 다시 실행해 변경 없음 또는 안전한 no-op임을 확인한다.
- [ ] runtime role로 DDL이 거절된다.
- [ ] 모든 외래키 delete 동작과 핵심 constraint 이름을 검토했다.
- [ ] 행·관계·unique 계약이 실제 PostgreSQL에서 통과한다.
- [ ] 동시성 시나리오가 반복 실행에서도 안정적이다.
- [ ] transaction 실패 주입이 부분 저장을 남기지 않는다.
- [ ] test guard가 preview·production 연결을 거절한다.
- [ ] seed에 운영자·실제 콘텐츠·secret이 없다.
- [ ] migration·테스트 결과와 알려진 제한을 기록했다.

F1 통과는 사용자 기능 완료를 뜻하지 않는다. API·화면·AC 실행은 이후 기능 단위에서 별도로 검수한다.
