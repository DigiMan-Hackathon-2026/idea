# 테스트 fixture·seed 계약 v0.1

작성일: 2026-11-21 · 상태: schema·test helper 구현 전 기준

이 문서는 unit·PostgreSQL integration·HTTP·E2E·부하 검수에서 같은 Q1~Q5, V1~V3, A1~A3 의미를 사용하기 위한 deterministic fixture 계약이다. 모든 이름·주소·문구는 가상이며 실제 업체·인터뷰·운영 identity·secret을 seed에 넣지 않는다.

## 원칙

- fixture는 테스트 계약이지 production demo content source가 아니다.
- ID·시각·상태·행 수를 고정해 실패 원인을 비교한다.
- test마다 transaction rollback 또는 격리 schema/DB로 초기 상태를 복원한다.
- concurrency test는 서로 다른 실제 DB connection을 사용한다.
- production build·runtime에서 seed helper를 import하거나 실행할 수 없게 한다.
- 자유 입력 canary는 명백한 가상 문자열이며 log·audit·analytics 누출 검수 뒤 폐기한다.
- 현재 날짜·local timezone·랜덤 순서에 test 결과를 의존시키지 않는다.

## 기준 시각

| 이름 | UTC | KST 표시 용도 |
| --- | --- | --- |
| `T0` | `2026-11-21T09:00:00Z` | session·quest 기준 |
| `T1` | `2026-11-21T09:10:00Z` | run 시작 |
| `T2` | `2026-11-21T09:20:00Z` | step 완료 |
| `T3` | `2026-11-21T09:30:00Z` | run 완료 |
| `T_EXPIRED` | `2026-11-20T09:00:00Z` | 기준 clock 전에 만료 |

unit·integration은 injected clock을 사용한다. DB default 시각을 검수하는 test만 transaction `now()`를 별도로 고정하거나 범위를 assertion한다. 실제 30일을 기다리지 않는다.

## ID namespace

문서 예시와 fixture builder가 같은 ID를 사용하되 production에서 이 prefix·값을 특별 취급하지 않는다.

| fixture | ID |
| --- | --- |
| supplier `S1` | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| admin `A1` | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2` |
| admin `A2` | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3` |
| admin `A3` | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4` |
| visitor `V1` | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1` |
| visitor `V2` | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2` |
| visitor `V3` | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3` |
| quest `Q1`~`Q5` | `11111111-1111-4111-8111-111111111111`~`...115` |
| version `Q1V1`~ | quest 마지막 두 자리와 version 구분 가능한 고정 UUID |
| run `R1`~ | `66666666-6666-4666-8666-666666666661`부터 |

구현 때 모든 UUID를 이 문서에 길게 복제하기보다 typed fixture builder에서 export하고 API example과 drift test를 둔다. ID 값의 패턴에 business logic을 두지 않는다.

## 공통 가상 content

- supplier 이름: `여기서울 Test Supplier`
- 장소: `テスト体験場所 A`, `테스트로 1`
- area: `test-area-a`, `test-area-b`
- tags: `test-craft`, `test-food`
- 한국어 phrase: `테스트 안내를 보여 주세요.`
- 일본어 뜻: `テスト案内を見せてください。`
- source: `test-fixture-source`, 외부 URL 없음
- asset: text-only, 실제 image 없음

`서울특별시 성동구 예시로 1`처럼 실제 주소로 오해할 수 있는 문자열 대신 분명한 test namespace를 사용한다. Google Maps 실제 장소 검색을 자동 fixture에서 열지 않는다.

## quest fixture

### Q1 정상 demo

| field | 값 |
| --- | --- |
| status | published |
| version | v1 published |
| isDemo | true |
| steps | 3, position 1~3 |
| cost | known KRW 1000~2000 가상 값 |
| solo | confirmed by test fixture |
| verifiedAt | T0 |
| 목적 | 정상 탐색·시작·진행·완료 |

모든 step은 실제 장소 방문 없이 test UI에서 확인 가능한 가상 행동이다. 완료가 실제 방문 인증이라는 문구는 없다.

### Q2 공개본과 draft

| field | 값 |
| --- | --- |
| status | published |
| published | v1, 3 steps |
| draft | v2, 제목·step 한 곳 변경, 미공개 |
| revision | 2 후보, builder에서 고정 |
| 목적 | 공개본/draft 분리, v1 run 뒤 v2 publish |

Q2 v1로 시작한 run은 v2 공개 뒤에도 v1 step·place snapshot을 유지한다.

### Q3 paused

| field | 값 |
| --- | --- |
| status | paused |
| published | v1 |
| reasonJa | 명백한 test pause 문구 |
| 목적 | 목록 제외·상세 중지·신규 시작·step 차단 |

V1의 Q3 in-progress run을 optional scenario overlay로 추가할 수 있다. base seed에 둘지 test helper로 만들지 한 방식으로 고정한다.

### Q4 archived

| field | 값 |
| --- | --- |
| status | archived |
| published | v1 |
| V1 run | completed at T3 |
| 목적 | 과거 기록·completion 읽기, 신규 mutation 차단 |

### Q5 draft only invalid

| field | 값 |
| --- | --- |
| status | draft |
| version | v1 draft |
| 누락 | title 또는 place verifiedAt 등 public 필수 field |
| 목적 | public 404·publish 400·audit 무변경 |

각 public validation 누락 test는 Q5 하나를 여러 방식으로 mutate한 뒤 rollback한다. 누락 종류별 영구 fixture를 과도하게 늘리지 않는다.

## visitor·session fixture

| fixture | 상태 | cookie·token | 목적 |
| --- | --- | --- | --- |
| V1 | active, expires after fixed clock | 명백한 test raw token을 helper가 hash | 정상 소유자 |
| V2 | active | V1과 다른 token | 타인 소유권 404 |
| V3 | expired at `T_EXPIRED` | DB row 존재 가능 | cleanup 전 401·정리 |

raw test token은 source에 명백한 fixture 상수로 둘 수 있지만 production과 같은 prefix·길이를 흉내 내지 않고 log canary와 구분한다. token hash는 production pepper가 아니라 test-only key로 생성한다.

session fixture의 expiresAt은 일반 GET·mutation으로 연장되지 않는다.

## admin fixture

| fixture | identity·principal | 결과 |
| --- | --- | --- |
| A1 | 검수 issuer·subject + active 최소 role | 운영 정상 |
| A2 | Auth session은 있으나 principal 없음 | 403 `ADMIN_FORBIDDEN` |
| A3 | principal disabled | 기존 session도 403 |

실제 Google email·subject·profile을 쓰지 않는다. integration에서는 OIDC callback 자체를 mock identity로 대체할 수 있지만 HTTP auth guard와 principal lookup은 실제 DB를 거친다. preview OIDC 검수는 별도 test tenant와 identity를 repository 밖에서 사용한다.

## run fixture

| fixture | visitor | quest/version | 상태 | step rows | 목적 |
| --- | --- | --- | --- | ---: | --- |
| R1 | V1 | Q1 v1 | in_progress | 1 | 다음 단계·reload |
| R2 | V1 | Q4 v1 | completed T3 | 3 | completion·feedback |
| R3 | V2 | Q1 v1 | in_progress | 0 | V1 소유권 404 |
| R4 | V1 | Q3 v1 | in_progress | 1 | paused 진행 차단 overlay |

`(visitor, quest)` unique 때문에 같은 base seed에서 V1·Q1 run이 이미 있으면 AC03 신규 시작 test가 불가능하다. 따라서 seed profile을 나눈다.

## seed profile

| profile | 포함 | 용도 |
| --- | --- | --- |
| `catalog` | S1, A1~A3, Q1~Q5, V1~V3, no Q1 run | 탐색·동시 시작 |
| `progress` | catalog + R1·R2·R3 | 단계·완료·소유권 |
| `paused` | progress + R4 | 중지·기존 run |
| `privacy` | progress + feedback·report·events | 전체 삭제·만료 |
| `admin` | catalog + report·audit variants | revision·공개·triage |

profile은 이전 profile을 실제 코드 상속으로 구현할 수 있지만 table count와 included entities를 명시한다. test가 필요한 상태를 setup에서 추가하고 teardown에서 rollback한다.

## privacy profile

V1에 다음을 연결한다.

- completed R2와 feedback 1행
- active report 1행, 500자 이하 test comment canary
- visitor 연결 analytics events
- active visitor session

삭제 transaction 전후 expected count를 assertion한다.

| 대상 | 전 | 전체 삭제 뒤 |
| --- | ---: | ---: |
| V1 visitor | 1 | 0 |
| V1 sessions | 1 | 0 |
| V1 runs·steps·feedback | profile 고정 수 | 0 |
| V1-linked analytics | profile 고정 수 | 0 |
| active report | 1 | 0 또는 익명 1 |
| 익명 report visitor·key·comment | 값 있음 | 모두 null |

report 보존·삭제 선택을 test parameter로 둘 수 있지만 production policy와 같은 default 하나를 정한다.

## canary

실제 secret·개인정보처럼 보이지 않는 test-only 문자열을 사용한다.

| 위치 | canary 목적 |
| --- | --- |
| visitor cookie | header·log·trace 누출 검사 |
| feedback comment | body·analytics·audit 누출 검사 |
| report comment | 운영 render·log·audit 누출 검사 |
| internal note | public serializer·audit 누출 검사 |
| query | raw URL·metric label 누출 검사 |

canary 값은 repository에 정의할 수 있지만 production 데이터에 사용하지 않는다. test output도 성공 시 값을 print하지 않고 “not found” 결과만 남긴다.

## concurrency setup

barrier test는 base seed를 공유하되 각 transaction이 다른 connection을 사용한다.

### AC03 start

- catalog profile의 V1·Q1, run 없음
- 두 request가 quest 사전 조회 뒤 barrier
- 최종 V1·Q1 run 1개, 둘 다 같은 ID

### AC09 last step

- Q1 run에 step 1·2만 완료
- 두 connection이 같은 last step PUT
- run_step 1개 추가, completedAt 하나, semantic event 하나

### AC13 revision

- Q2 current revision을 두 client가 읽음
- A1의 두 session 또는 A1·별도 active test principal 후보
- 첫 저장 revision +1·audit 1, 둘째 409·추가 audit 없음

deadlock·timeout을 성공으로 처리하지 않고 두 transaction의 결과와 최종 count를 함께 assertion한다.

## HTTP·browser setup

- cookie 없는 context는 seed token을 자동 주입하지 않는다.
- V1·V2 context는 서로 다른 cookie jar를 사용한다.
- admin context에 visitor cookie를 섞는 negative test를 별도로 둔다.
- test URL과 DB marker를 시작 전에 확인한다.
- browser trace·screenshot에 token·report comment가 보이지 않게 fixture를 제한한다.
- WebKit·Chromium이 같은 seed profile과 expected state를 사용한다.

test가 실패해 trace를 보관할 때 접근·보존 기간을 정하고 실제 identity·secret은 사용하지 않는다.

## 부하 fixture

20 virtual user는 V1을 공유하지 않는다. 실행마다 독립 visitor·session·run을 test namespace에서 생성하고 duration 종료 뒤 검수 환경에서 cleanup한다.

- 공유 IP key 시나리오에서도 visitor identity는 20개
- ID·token·comment를 load report에 출력하지 않음
- demo quest 하나를 읽어도 각 run은 독립
- 시작 전/후 table count와 중복 invariant 확인
- production endpoint·DB marker면 즉시 중단

고정 UUID를 병렬 virtual user가 재사용해 artificial conflict를 만들지 않는다.

## seed 실행 경계

- command 이름에 환경이 드러나야 한다.
- production `APP_ENV` 또는 production marker에서 hard fail한다.
- runtime application role이 아니라 test/migration 전용 최소 role을 쓴다.
- seed는 idempotent라고 가정하지 않고 빈 격리 DB 또는 transaction에서 실행한다.
- production deployment step과 자동 연결하지 않는다.
- demo content 공개는 seed가 아니라 정상 admin draft→publish 흐름을 사용한다.

## drift 방지

fixture builder가 구현되면 다음을 자동 확인한다.

- Q1~Q5·V1~V3·A1~A3가 모두 존재하고 중복 ID 없음
- profile별 table count snapshot
- API example의 대표 ID·상태와 fixture 의미 일치
- 3~5 step·position·version FK·status check 통과
- test string이 actual content·production event로 분류되지 않음
- template·source·rights가 demo/test로 명확함

JSON 문서 예시를 seed source로 parse해 DB에 넣지 않는다. shared typed builder와 serializer contract로 drift를 검수한다.

## 증거 양식

```markdown
# fixture 검수 YYYY-MM-DD HH:mm KST

- commit·schema·fixed clock:
- seed profile:
- DB marker·environment guard:
- entity·table count:
- constraint·FK 결과:
- cookie·principal context 분리:
- concurrency connection·barrier:
- privacy before/after count:
- canary log·audit·analytics 검사:
- teardown·cleanup:
- 알려진 drift·제한:
```

raw token·cookie·comment·OIDC identity·DB URL과 row dump를 증거에 넣지 않는다.

## 구현 gate

- [ ] fixture ID·clock·profile이 typed builder 한 곳에 있다.
- [ ] production build에서 seed helper를 import할 수 없다.
- [ ] production marker·host에서 seed command가 시작 전에 실패한다.
- [ ] profile별 initial·expected table count가 test에 있다.
- [ ] concurrency가 다른 actual connection과 barrier를 사용한다.
- [ ] privacy profile이 삭제·익명화·log canary를 검수한다.
- [ ] 실제 업체·사용자·운영자·secret이 fixture와 artifact에 없다.
- [ ] API example·screen mock·DB seed의 상태 의미가 일치한다.

연결 검수: AC01~AC20
