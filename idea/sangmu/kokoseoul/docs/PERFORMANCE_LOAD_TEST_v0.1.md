# 성능·부하 검수 계약 v0.1

작성일: 2026-11-21 · 상태: 구현·검수 환경 준비 전 기준

이 문서는 DigiMan P0의 “20명 동시 이용·5분”을 재현 가능한 workload로 바꾸고, 지연·오류뿐 아니라 DB 정합성·속도 제한·개인정보를 함께 검수하는 기준이다. 숫자는 공개 SLA가 아니라 합의된 preview 환경의 초기 release gate다.

## 검수 목적

- 일본에서 접속한 재방문 혼행객의 공개 탐색과 진행 mutation이 작은 동시 부하에서 안정적인지 확인한다.
- serverless cold start, application region, DB region과 connection pool 병목을 분리한다.
- 빠른 응답을 위해 소유권·중복 방지·transaction·audit를 우회하지 않았는지 확인한다.
- 공유 Wi-Fi의 정상 사용자들이 IP limit 때문에 차단되지 않는지 확인한다.
- 실제 사용자 데이터·token·자유 입력을 load fixture와 결과에 넣지 않는다.

## 비목표

- 20 virtual user 결과로 대규모 traffic 수용량을 주장하지 않는다.
- 로컬 결과를 production 성능으로 표현하지 않는다.
- 외부 Google Maps 앱·페이지 로딩 시간을 DigiMan server latency에 포함하지 않는다.
- 평균값 하나로 cold start·tail latency·오류를 숨기지 않는다.
- 한계까지 부하를 올리는 stress test를 production에서 실행하지 않는다.

## 환경 고정

실행 전 다음 값을 기록한다.

| 항목 | 기록 내용 |
| --- | --- |
| commit·release | 정확한 SHA와 배포 식별자 |
| application | provider, region, instance·concurrency 설정 |
| database | provider, region, plan, pool mode·최대 connection |
| limiter | provider, region, limit version, 공유 IP key 방식 |
| schema·seed | migration version, fixture version |
| client | 부하 발생 region, 도구·version, connection 재사용 |
| cache | API shared cache 우회·application 내부 cache 상태, warm-up 여부 |
| observability | server duration과 client duration의 수집 위치 |

preview와 production DB가 같은지 host·database·marker 중 두 가지 이상으로 검사한다. production endpoint나 실제 운영 DB이면 destructive·write load test를 즉시 중단한다.

## fixture

- 검수 완료된 demo quest 3개: 3 step, 서로 다른 area·tag 조합
- 20개의 독립 visitor session과 run
- 모든 이름·주소·문구는 명백한 가상 데이터
- 하나의 shared network key를 재현할 수 있는 test-only edge 설정
- 결과 비교를 위한 시작 전 table count와 정합성 query

session cookie와 run ID는 실행 중 process memory의 해당 virtual user에만 둔다. console, report, trace, metric label에 값을 출력하지 않는다. fixture 삭제는 검수 환경에서만 실행하며 운영 content·audit와 분리한다.

## 측정 구간

한 실행은 다음 네 구간으로 나눈다.

1. **cold probe**: 최소 요청으로 scale-to-zero 뒤 첫 응답을 별도 측정
2. **warm-up 2분**: 결과 집계에서 제외하고 connection·cache를 안정화
3. **steady 5분**: 20 virtual user를 동시에 유지해 release gate 측정
4. **recovery 2분**: 부하 중지 뒤 pool·오류·queue가 기준선으로 돌아오는지 확인

cold probe와 warm steady 결과를 합쳐 하나의 percentile로 만들지 않는다. 같은 조건을 최소 3회 실행하고 각 회차와 합계 표본 수를 함께 남긴다.

## virtual user 모델

“20명 동시”는 초당 20요청이 아니다. 각 virtual user는 실제 화면 행동 사이 think time을 둔 closed model을 사용한다.

| 행동 | 전체 요청 비중 후보 | think time | cache 기대 |
| --- | ---: | ---: | --- |
| 목록 GET | 30% | 2~5초 | `private, no-store`, CDN shared cache 금지 |
| 상세 GET | 25% | 3~8초 | `private, no-store`, CDN shared cache 금지 |
| run GET | 15% | 2~5초 | `no-store` |
| session·run 시작 | 10% | 여정당 1회 | mutation, 중복 검수 분리 |
| step PUT | 15% | 5~12초 | mutation, 순서 유지 |
| completion·feedback | 5% | 여정당 1회 | 완료 run만 |

비중은 request count 기준이며 실제 실행 결과의 관찰 비중을 기록한다. 무작위 선택이 순서가 잘못된 step이나 미완료 feedback을 만들지 않게 virtual user별 state machine을 사용한다.

## 시나리오

### L0 단일 사용자 기준선

- public 목록·상세와 전체 run 여정을 한 번 실행한다.
- client DNS·TLS·TTFB·전체 시간과 server duration을 분리한다.
- request·DB query 수의 예상 범위를 기록한다.

### L1 공개 읽기 20명

- cookie 없는 20명이 목록·상세를 5분간 탐색한다.
- visitor·session·run 행이 생성되지 않는지 확인한다.
- cold·warm 비중과 p50·p95·p99·max를 기록한다.
- 모든 응답이 `private, no-store`·`Vary: Cookie`이고 CDN shared cache hit·Age가 없는지 확인한다.

### L2 혼합 여정 20명

- 각 virtual user가 독립 session으로 시작·진행·완료한다.
- 목록 30%, 상세 25%, run 조회 15%, 시작 10%, step 15%, 완료·feedback 5% 후보를 따른다.
- 시작·완료 뒤 최종 행 수와 상태를 fixture 기대값과 대조한다.

### L3 공유 Wi-Fi

- 20명의 독립 visitor가 같은 privacy-safe IP key에서 5분간 L2를 실행한다.
- 정상 흐름의 429 수와 session·report 보조 bucket 영향을 확인한다.
- IP limit을 끄거나 숨은 allowlist를 사용하지 않는다.

### L4 중복·동시 mutation

steady workload와 별도로 다음을 barrier로 반복한다.

- 같은 visitor·quest run 시작 두 요청
- 같은 next step PUT 두 요청
- 마지막 step PUT 두 요청
- report 같은 clientRequestId·같은 body 두 요청

응답 코드, 기존 resource 반환과 최종 행 수를 확인한다. 이는 throughput 측정보다 DB 정합성 검수이며, 일반 random load에 섞여 우연히 한 번 발생한 결과로 대체하지 않는다.

### L5 장애와 회복

검수 환경에서만 다음 하나씩 주입한다.

- DB connection 획득 지연
- analytics event insert 실패
- limiter timeout
- monitoring sink 실패

사용자 transaction, audit, 503·retry 의미가 각 계약대로 다른지 확인하고 fault 제거 뒤 recovery 구간을 측정한다.

## 측정값

### client

- 실행·성공·실패·429·503 요청 수
- route·method별 p50·p95·p99·max 전체 시간
- connect·TLS·TTFB 가능 시 분리
- virtual user iteration과 실제 요청 비중

### server·database

- route template별 server duration
- 5xx와 domain error code 집계
- DB pool active·idle·wait, acquire duration, timeout
- query·transaction duration과 lock wait category
- serverless instance·cold start·concurrency 후보 신호
- limiter timeout·429 집계

### 정합성

- visitor마다 run 하나
- run마다 step별 완료 행 하나
- 완료 run마다 completedAt 하나
- feedback 한 행과 기대 최종 값
- audit 대상 운영 mutation과 audit 수 일치
- public-only L1 뒤 visitor 연결 행 변화 없음

metric label에는 request ID·UUID·IP·raw path·query·cookie를 쓰지 않는다. 실패 표본 조사도 allowlist log와 제한된 request ID만 사용한다.

## 초기 판정 기준

정확한 수치는 실제 배포 후보를 측정한 뒤 D09 결정에서 확정한다. 그 전 release 후보 기준은 다음과 같다.

| 항목 | 초기 gate |
| --- | --- |
| 공개 목록·상세 warm p95 | 1초 이내 후보 |
| 유효한 mutation | 5xx·503 0, 계약된 409·429 별도 |
| 정합성 | 중복·부분 commit·소유권 노출 0 |
| shared IP | 정상 L2 여정의 429 0 |
| DB pool | acquire timeout 0, 지속 증가 없음 |
| recovery | fault 제거 뒤 queue·pool이 관찰 구간 내 기준선 복귀 |
| 개인정보 | output·log·trace·metric에 token·ID·자유 입력 0 |

max 한 건만으로 무조건 실패시키거나 무시하지 않는다. cold start, network outlier, server duration과 연관해 설명하고 사용자 영향이 있으면 개선 또는 명시적 수용 결정을 남긴다.

## 결과 해석

- client p95가 높고 server p95가 낮으면 client region·TLS·edge 경로를 조사한다.
- server와 DB acquire가 함께 높으면 connection pool·region·query를 조사한다.
- DB는 낮고 cold request만 높으면 serverless startup과 bundle을 본다.
- 429가 shared IP에서만 발생하면 IP 보조 limit과 session churn 방어 균형을 재검토한다.
- latency가 낮아도 409·503·중복 행이 증가하면 성능 통과가 아니다.
- hash static asset의 CDN hit가 빨라도 개인 `no-store` 목록·상세 route 결과를 대신하지 않는다.

한 번의 양호한 결과로 SLA를 만들지 않는다. provider plan·region·pool·schema가 바뀌면 기준선을 다시 측정한다.

## 안전한 실행

- production에 write 부하를 보내지 않는다.
- 실제 장소·사용자·운영자·인터뷰 데이터로 seed하지 않는다.
- test runner의 HTTP debug log와 cookie jar 출력은 비활성화한다.
- 실패 body에 내부 stack·SQL·token이 없는지 canary로 검사한다.
- 무제한 request loop를 금지하고 duration·virtual user·request 상한을 둔다.
- 시작 전 중단 담당자와 즉시 중단 조건을 정한다.

즉시 중단 조건:

- production DB·endpoint 연결 발견
- 예상 밖 실제 사용자 데이터 반환
- pool 고갈이 다른 검수 또는 production에 영향
- 정합성 손상·권한 우회·token 출력
- 설정한 request·비용 상한 초과 가능성

## 증거 양식

```markdown
# 성능·부하 검수 YYYY-MM-DD HH:mm KST

- commit·release·schema:
- application·DB·limiter region·plan:
- 부하 발생 region·도구 version:
- fixture·virtual user·duration:
- cold / warm-up / steady / recovery 구간:
- route별 요청 수·오류·p50·p95·p99·max:
- client / server duration 차이:
- DB pool·lock·timeout:
- 409·429·503 해석:
- 시작 전/후 정합성 검수:
- canary·민감정보 출력 검사:
- 중단 여부·비용:
- 결론: 통과 / 조건부 / 실패
- 알려진 제한·후속 owner:
```

raw HTTP trace, cookie jar, DB dump와 provider credential은 증거에 첨부하지 않는다.

## release gate

- [ ] 검수 환경과 production 분리를 두 신호 이상으로 확인했다.
- [ ] L0~L3을 같은 release·schema에서 최소 3회 실행했다.
- [ ] L4 barrier 검수에서 중복·부분 commit이 없다.
- [ ] cold와 warm percentile을 분리했다.
- [ ] client·server·DB 시간을 같은 시간 구간으로 비교했다.
- [ ] 목록·상세가 CDN shared cache에 저장되지 않고 Cookie별 상태가 섞이지 않았다.
- [ ] shared IP 정상 사용자가 429로 막히지 않았다.
- [ ] fault 제거 뒤 pool·queue가 회복됐다.
- [ ] token·식별자·자유 입력이 결과·log·metric에 없다.
- [ ] 결과와 환경·표본·제한을 함께 기록했다.
- [ ] 목표 미달을 production 규모 보장처럼 표현하지 않는다.

연결 검수: AC01, AC03~AC06, AC09, AC12, AC16, AC19
