# 보존·cleanup background job 계약 v0.1

작성일: 2026-11-21 · 상태: scheduler 선택 전 구현 기준

이 문서는 여기서울 P0의 만료 visitor 정리와 비연결 analytics 보존 정리를 여러 server instance·재시도·복구 환경에서 안전하게 실행하는 기준이다. scheduler provider는 D09 뒤 선택하지만, 작업 의미와 DB 정합성은 provider에 의존하지 않는다.

## P0 job inventory

| job code | 대상 | cutoff·목표 | 핵심 결과 |
| --- | --- | --- | --- |
| `visitor_expiry_cleanup` | expired visitor와 연결 data | `expires_at <= DB now`, 만료 후 24시간 이내 | 개인 연결 삭제·report 익명화 |
| `anonymous_analytics_cleanup` | `visitor_id is null`인 비연결 detail event | `created_at < DB now - 30 days` | 오래된 event 물리 삭제 |
| `post_restore_privacy_cleanup` | restore DB 전체 | 공개 traffic 전 | 만료 정리 + D11 privacy-first purge 적용 |

visitor-linked analytics는 visitor cleanup transaction에서 제거한다. 이를 별도 analytics job이 나중에 처리한다고 가정하지 않는다. cursor는 stateless라 cleanup 대상이 아니고, limiter·log·backup lifecycle은 각 provider 정책과 별도 검수한다.

## 공통 원칙

- 인증은 cleanup 완료와 무관하게 expiry instant부터 실패한다.
- 같은 job·대상을 여러 번 처리해도 최종 상태가 같다.
- scheduler 중복 호출과 여러 worker가 같은 row를 이중 처리하지 않는다.
- 긴 transaction, 전체 table lock, offset scan과 무제한 loop를 사용하지 않는다.
- 삭제 대상 ID·내용을 log·metric·job response에 넣지 않는다.
- 환경·DB marker가 맞지 않으면 쓰기 전에 실패한다.
- job 성공이 backup 안의 과거 삭제를 해결한다고 주장하지 않는다.
- 공개 request와 같은 DB pool을 고갈시키지 않도록 동시성·시간 budget을 제한한다.

## 실행 경계

job handler는 공개 browser API가 아니다.

- scheduler 또는 승인된 운영 runner의 server-to-server identity만 허용한다.
- secret query parameter, 공용 password와 admin browser cookie를 사용하지 않는다.
- provider가 전달하는 signature·identity를 공식 방식으로 검증한다.
- 호출 identity와 credential은 환경별로 분리한다.
- production job을 preview URL·credential로 호출하지 않는다.
- job route가 public internet에 노출되면 인증 전 body를 parse하거나 DB에 연결하지 않는다.
- 실패 response와 log에 scheduler header·signature를 복제하지 않는다.

provider 선택 전에는 credential 이름을 만들지 않는다. D09 뒤 [설정·secret 운영 계약](CONFIGURATION_SECRETS_v0.1.md)의 inventory에 목적·소유자·rotation을 추가한다.

## environment guard

모든 invocation은 쓰기 전에 다음을 확인한다.

1. `APP_ENV`가 명시적 허용 값이다.
2. scheduler identity의 환경과 application 환경이 같다.
3. DB host·database·role·marker 중 두 신호 이상이 예상 환경과 같다.
4. runtime role은 필요한 delete·update만 가능하고 DDL·backup 권한이 없다.
5. restore mode면 일반 production traffic이 아직 닫혀 있다.

production host 문자열 하나로 판별하지 않는다. guard 실패는 row를 잠그거나 metric에 대상 수를 넣기 전에 종료한다.

## invocation budget

각 invocation은 설정·provider timeout보다 짧은 bounded budget을 가진다.

초기 검수 후보:

- visitor: 최대 100명 또는 30초 중 먼저 도달
- anonymous analytics: 최대 1,000 event 또는 30초 중 먼저 도달
- DB transaction: visitor 한 명 또는 analytics 한 chunk
- 동시 worker: 환경별 1부터 시작

숫자는 실제 DB·plan 측정 뒤 낮추거나 높일 수 있지만 무제한으로 바꾸지 않는다. budget 종료는 실패가 아니며 남은 row는 다음 invocation이 처리한다. scheduler가 겹쳐도 처리량을 위해 동시성을 자동 확장하지 않는다.

## DB clock·cutoff

- invocation 시작에 DB에서 `jobNow`를 한 번 읽는다.
- visitor cutoff는 `expires_at <= jobNow`다.
- 비연결 analytics cutoff는 `event_name = 'detail_viewed'`, `visitor_id is null`, `created_at < jobNow - interval '30 days'`의 교집합이다.
- application·scheduler·browser clock을 삭제 기준으로 사용하지 않는다.
- `jobNow`, cutoff와 duration은 UTC instant로 계산한다.
- DST·KST calendar date를 retention 연산에 사용하지 않는다.

긴 invocation에서도 같은 cutoff를 사용해 처리 대상이 실행 중 움직이지 않게 한다. 다음 invocation은 새 DB clock을 읽는다.

## visitor_expiry_cleanup

worker의 한 iteration은 한 visitor transaction이다.

1. 다음 후보를 `(expires_at ASC, id ASC)`로 `FOR UPDATE SKIP LOCKED LIMIT 1` 조회한다.
2. 잠금 뒤 `expires_at <= jobNow`를 다시 확인한다.
3. 사용자 전체 삭제와 같은 순서로 feedback, run_steps, 연결 analytics와 runs를 삭제한다.
4. report는 삭제하거나 사용자 연결·clientRequestId·comment를 제거하고 `anonymized_at`을 기록하되 운영 상태·제한 note는 계약대로 유지한다.
5. visitor_sessions와 visitor를 차례로 삭제한다.
6. transaction을 commit하고 aggregate result counter만 증가시킨다.
7. invocation row/time budget까지 다음 후보를 반복한다.

후보가 없으면 성공 종료한다. `SKIP LOCKED`로 다른 worker가 처리 중인 row를 기다리지 않는다. 한 visitor 실패는 해당 transaction만 rollback하고 bounded category를 기록한다. 계속 실패하는 한 row가 뒤의 모든 row를 막지 않되, 24시간 SLO를 넘기면 alert·incident 후보로 올린다.

새 mutation과 경합하면 둘 다 visitor row를 같은 잠금 순서로 사용한다. cleanup이 잠금을 먼저 얻으면 이후 mutation은 session·visitor 없음으로 실패한다. mutation이 먼저 commit해도 cleanup이 expiry를 재검사하고 그 기록까지 제거한다.

## anonymous_analytics_cleanup

비연결 event는 visitor 소유권이 없으므로 stable keyset chunk로 삭제한다.

1. `(created_at ASC, event_id ASC)`와 cutoff로 최대 chunk ID를 선택한다.
2. 같은 statement 또는 bounded transaction에서 그 exact ID만 삭제한다.
3. 삭제 수만 aggregate metric으로 기록한다.
4. 다음 chunk는 마지막 offset이 아니라 남은 가장 오래된 row에서 시작한다.

offset pagination, 전체 ID 목록의 application memory 적재와 자유 event property 검사를 사용하지 않는다. 새 event는 cutoff보다 뒤이므로 현재 job에 끼어들지 않는다. 이미 삭제된 ID 재처리는 성공 no-op이다.

## post_restore_privacy_cleanup

restore DB는 원래 production과 다른 격리 environment·credential로 시작한다.

1. network·application public traffic을 닫는다.
2. schema version·DB marker·backup 시각을 확인한다.
3. D11의 독립 erasure ledger 유무를 판단한다.
4. ledger가 없으면 P0 기본값대로 모든 visitor 연결 data를 purge한다.
5. ledger가 있으면 승인된 deletion tombstone을 재적용하고 만료 cleanup을 완료한다.
6. anonymous analytics·log·provider retention을 다시 적용한다.
7. synthetic invariant query와 AC20 증거를 확인한 뒤에만 승격을 판단한다.

일반 `visitor_expiry_cleanup`만 실행해 삭제 요청을 복원할 수 있다고 보지 않는다. restore job은 평상시 scheduler가 자동 호출하지 않고 commander·reviewer가 exact restore DB에서 실행한다.

## retry·실패 격리

- invocation 전체 network timeout은 다음 schedule에서 재실행할 수 있다.
- 이미 commit된 visitor·chunk는 idempotent하게 건너뛴다.
- deadlock·serialization 오류는 같은 대상에서 bounded DB retry 후 다음 invocation으로 넘긴다.
- schema mismatch, environment guard, permission 거부는 자동 반복하지 않는다.
- DB pool 포화·lock wait가 공개 traffic을 해치면 job을 중단하고 concurrency·batch를 낮춘다.
- poison row의 원문이나 ID를 일반 log로 내보내지 않고 제한된 내부 category와 request/job run ID로 조사한다.

retry를 위해 별도 사용자 data queue를 만들지 않는다. provider delivery retry가 동일 invocation을 중복 호출해도 DB idempotency가 최종 방어다.

## overlap·배포

- old·new release가 겹칠 때 같은 schema와 job semantics를 지원해야 한다.
- job contract를 바꾸는 migration은 expand → code → observe → contract 순서를 따른다.
- destructive schema migration 전 old scheduler·worker가 더는 실행되지 않는지 확인한다.
- scheduler enable·disable은 application deploy와 별도 운영 상태로 기록한다.
- rollback release가 현재 schema에서 cleanup을 안전하게 실행할 수 없으면 job을 먼저 pause하고 overdue 영향을 측정한다.
- job을 pause해도 expired session 인증을 다시 허용하지 않는다.

## dry run·수동 실행

dry run은 row 내용을 읽거나 ID 목록을 내보내지 않고 cutoff별 aggregate count·oldest age·query plan만 제공한다. count가 느리면 bounded sample·planner estimate를 실제 삭제 수처럼 표시하지 않는다.

production 수동 실행은 다음을 기록한다.

- exact environment·release·schema version
- job code, cutoff, row/time budget
- 요청자·reviewer 역할과 이유
- 시작·종료 시각, aggregate 결과 category
- 중단·재개·incident reference

사람 이름, 대상 UUID, comment, token과 credential을 증거에 넣지 않는다. 수동 실행이 scheduler의 다음 중복 호출을 견뎌야 한다.

## 관측

metric 후보:

- invocation count·duration·result category
- processed·anonymized·deleted aggregate count
- oldest eligible age와 cutoff lag
- DB transaction retry·lock wait·pool wait
- budget exhausted boolean, remaining estimate 후보
- guard·auth·schema mismatch count

label은 environment, job code, bounded result category만 사용한다. visitor·event·report ID, request body, SQL, IP와 scheduler identity를 label로 쓰지 않는다.

cleanup cutoff lag가 24시간에 접근하거나 연속 invocation 실패, guard mismatch, 처리량보다 유입이 큰 backlog는 alert 후보다. 한 번의 empty success는 alert가 아니다.

## scheduler cadence

production 초기 후보는 visitor cleanup을 최소 매시간, anonymous analytics cleanup을 하루 한 번 실행하는 것이다. provider 최소 간격·비용·timeout을 D09에서 확인한 뒤 확정한다.

- 실제 cadence가 24시간 SLO를 만족하는지 worst-case 지연을 계산한다.
- preview는 자동 cleanup을 켜더라도 production scheduler·DB와 분리한다.
- test는 injected scheduler와 DB clock을 사용한다.
- local은 명시적 command만 허용하고 production credential을 요구하지 않는다.
- missed schedule을 보상하려고 unbounded catch-up worker를 늘리지 않는다.

## test matrix

- [ ] expiry 직전 제외, 같은 instant·직후 포함
- [ ] 동일 visitor job 재실행 no-op
- [ ] 두 worker가 `SKIP LOCKED`로 같은 visitor를 중복 처리하지 않음
- [ ] cleanup·step/feedback/report mutation 경합 뒤 expired data 없음
- [ ] 한 visitor 실패는 rollback되고 다음 대상은 처리 가능
- [ ] poison row·deadlock·serialization bounded retry
- [ ] 100명·30초 budget 종료와 다음 invocation resume
- [ ] anonymous event 30일 boundary·stable chunk·재실행
- [ ] job 실행 중 새 event가 잘못 삭제되지 않음
- [ ] environment·DB marker·scheduler identity 불일치 시 쓰기 0
- [ ] preview·production scheduler·credential·DB 분리
- [ ] duplicate provider delivery와 old/new release overlap
- [ ] pool 포화·lock wait에서 job 중단, public request 영향 측정
- [ ] restore 격리 DB에서 ledger 없음 visitor 전량 purge
- [ ] restore cleanup 전 public traffic 차단
- [ ] log·metric·evidence에 대상 ID·내용·credential 없음
- [ ] oldest eligible age가 24시간 SLO와 alert에 연결됨

## 증거 양식

```markdown
# background job 검수 YYYY-MM-DD HH:mm KST

- commit·release·schema·environment marker:
- job code·scheduler identity category:
- DB jobNow·cutoff·row/time budget:
- worker overlap·lock strategy:
- processed result aggregate:
- retry·poison row·budget resume:
- pool·lock·public traffic 영향:
- oldest eligible age·24h SLO:
- restore mode·traffic gate·D11 policy:
- log·metric redaction:
- 알려진 제한:
```

실제 대상 ID·행 내용·credential·scheduler signature와 내부 DB reference를 기록하지 않는다.

## 구현 gate

- [ ] provider scheduler identity·환경별 credential·cadence가 D09에 기록됐다.
- [ ] DB clock, stable order, one-visitor transaction과 analytics chunk가 구현됐다.
- [ ] overlap·duplicate delivery·retry가 idempotent하다.
- [ ] row/time/DB pool budget과 중단 기준이 있다.
- [ ] 만료 후 24시간 SLO·oldest age·alert가 실제 metric에 연결됐다.
- [ ] restore job은 격리와 D11 purge·ledger 정책을 강제한다.
- [ ] 모든 log·metric·evidence가 사용자 식별자와 원문을 제외한다.

연결 검수: AC16, AC20
