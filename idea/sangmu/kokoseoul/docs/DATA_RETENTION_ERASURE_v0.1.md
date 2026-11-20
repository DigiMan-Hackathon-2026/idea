# 방문자 데이터 보존·삭제·복구 계약 v0.1

작성일: 2026-11-21 · 상태: 구현 전 privacy 기준

이 문서는 익명 visitor session, run, feedback, report와 analytics의 30일 보존, 사용자 전체 삭제, 만료 cleanup과 backup 복구 시 재노출 방지를 정의한다. P0에는 계정 동기화나 외부 삭제 원장이 없으므로, 삭제 전 backup을 production으로 승격할 때 개인 진행 기록을 보존한다고 약속하지 않는다.

token·cookie·HMAC lookup, 고정 expiry 계산과 pepper rotation은 [익명 방문자 session 수명주기 계약](VISITOR_SESSION_LIFECYCLE_v0.1.md)을 따른다.

## 핵심 정책

- visitor session과 연결 기록의 보존 기준은 생성 시점부터 30일이며 일반 사용으로 연장하지 않는다.
- 만료 시점부터 인증을 즉시 거절하고 cleanup 완료를 기다리지 않는다.
- 사용자의 전체 삭제는 204 응답 전에 한 transaction으로 완료한다.
- report를 운영상 남기면 visitor 연결·멱등 키·자유 입력을 제거한 요약만 유지한다.
- application log에는 사용자 원문·token·visitor·run ID를 기본 저장하지 않는다.
- backup은 개별 행을 즉시 지울 수 없으므로 최대 보존과 복구 후 정리 규칙을 사용자 안내에 포함한다.
- 삭제 전 backup인지 판별·재적용할 독립 erasure ledger가 없으면, 복구 DB의 모든 visitor 연결 데이터를 제거한 뒤에만 production 승격을 검토한다.

## 데이터 inventory

| 대상 | visitor 연결 | 기준 시각 | active 보존 | 사용자 삭제 | 만료 cleanup |
| --- | --- | --- | --- | --- | --- |
| `visitors` | 원본 | createdAt·expiresAt | 30일 고정 | 삭제 | 삭제 |
| `visitor_sessions` | 직접 FK | expiresAt | 30일 고정 | 삭제 | 삭제 |
| `runs` | 직접 FK | startedAt | visitor와 동일 | 삭제 | 삭제 |
| `run_steps` | run 경유 | completedAt | visitor와 동일 | 삭제 | 삭제 |
| `feedback` | run 경유 | updatedAt | visitor와 동일 | 삭제 | 삭제 |
| 활성 `reports` | 직접 FK | createdAt | visitor와 동일 | 익명화 또는 삭제 | 익명화 또는 삭제 |
| visitor `analytics_events` | 직접 FK | createdAt | visitor와 동일 | 삭제 | 삭제 |
| 비연결 `detail_viewed` | visitorId null | createdAt | 최대 30일 | 연결 없음 | 30일 뒤 삭제 |
| `audit_logs` | visitor 연결 금지 | createdAt | 90일 정책안 | 대상 아님 | 별도 정책 |
| application log | visitor·run ID 금지 | timestamp | 7일 정책안 | 대상 식별 불가 | 기간 만료 |
| backup | snapshot에 포함 가능 | backup 시각 | 최대 7일 정책안 | in-place 삭제 불가 | lifecycle + 복구 정리 |

30일은 사용자 데이터 전체를 무조건 30일 유지한다는 뜻이 아니라 최대 active 기간이다. 사용자가 먼저 삭제하면 즉시 active DB에서 제거한다.

## 사용자에게 알릴 내용

시작 전 일본어 안내는 최소 다음 의미를 포함한다.

- 이 browser에만 진행 기록이 연결됨
- 생성 후 30일의 실제 expiresAt
- 일반 사용으로 기간이 늘어나지 않음
- 다른 기기·cookie 삭제 뒤 복구할 수 없음
- 기록 화면에서 전체 삭제 가능
- 장애 backup에는 제한된 기간 잔존할 수 있으나 복구 시 다시 공개하지 않도록 정리함

backup 문구는 보존 기간과 provider를 실제 확정한 뒤 모어 화자·개인정보 검토를 거친다. “완전 삭제”처럼 backup까지 즉시 물리 삭제한다고 오해할 표현을 쓰지 않는다.

## 전체 삭제 transaction

`DELETE /api/v1/me/data`는 유효한 visitor session과 exact Origin을 요구한다.

1. session token으로 visitor를 찾고 visitor row를 잠근다.
2. expiresAt과 소유권을 다시 확인한다.
3. feedback을 run 기준으로 삭제한다.
4. run_steps를 run 기준으로 삭제한다.
5. run 참조를 포함한 visitor 연결 analytics event를 삭제한다.
6. runs를 삭제한다.
7. reports를 삭제하거나 아래 익명화 규칙을 적용한다.
8. visitor_sessions를 삭제한다.
9. visitors를 삭제한다.
10. commit 성공 뒤 204와 cookie 만료를 반환한다.

어느 단계든 실패하면 전부 rollback하고 204를 보내지 않는다. 비동기 queue에 넣었다는 이유로 삭제 완료를 응답하지 않는다.

### report 익명화

운영상 주소 오류의 처리 이력만 남길 가치가 있으면 같은 transaction에서 다음을 적용한다.

- `visitor_id = null`
- `client_request_id = null`
- `comment = null`
- `anonymized_at = DB now`
- category·quest·version·status·revision·개인정보 없는 internalNote만 유지

internalNote에 comment를 복사하거나 개인 식별 내용을 쓰지 않는다. 이 원칙을 지키지 못한 report는 요약 보존 대신 삭제한다.

## 응답 유실과 반복 삭제

삭제 commit 뒤 204가 유실되면 cookie가 browser에서 남을 수 있지만 DB session은 없어 다음 요청이 401이다. 서버는 없는 visitor를 성공한 삭제처럼 공개 조회로 확인하는 endpoint를 만들지 않는다.

UI는 다음처럼 처리한다.

1. 204를 받으면 cookie 만료와 시작 화면 이동
2. 응답이 불명확하면 개인 기록 조회
3. 401이면 삭제됐거나 session이 유효하지 않음을 안내하고 cookie 만료
4. 5xx면 삭제됐다고 단정하지 않고 request ID와 재시도 제공

삭제를 다시 누르기 위해 새 visitor session을 만들지 않는다.

## 만료와 cleanup

인증은 `expires_at <= DB now`이면 cleanup 전에도 401이다. cleanup은 중복 실행돼도 같은 결과가 되도록 visitor 단위 transaction을 재사용한다.

scheduler identity, DB clock, one-visitor transaction, worker overlap·budget과 restore 전용 실행은 [background job 계약](BACKGROUND_JOBS_v0.1.md)을 따른다.

| 단계 | 기준 |
| --- | --- |
| 후보 선택 | expiresAt이 현재 시각 이전, 작은 batch |
| 잠금 | visitor별 lock, 다른 cleanup worker와 중복 방지 |
| 삭제·익명화 | 사용자 전체 삭제와 같은 순서 |
| 실패 | 해당 visitor rollback, 다음 대상과 구분해 재시도 |
| 완료 지연 | expiresAt 후 24시간 안의 정책 목표를 metric으로 확인 |

긴 transaction과 전체 table lock을 피한다. worker 수를 늘리기 전에 DB pool·lock wait와 공유 Wi-Fi traffic 영향을 본다.

## backup의 삭제 한계

암호화된 snapshot 안의 한 visitor 행만 안전하게 제거할 수 없을 수 있다. 따라서 다음 통제를 함께 사용한다.

- backup 최대 보존 기간을 확정하고 자동 lifecycle 적용
- production DB와 다른 접근 권한
- 별도 검수 DB로만 복구
- public network·production domain에 바로 연결 금지
- 복구 직후 schema 확인보다 먼저 승격 금지 flag 유지
- 만료·삭제 재적용 뒤에만 제한된 검수
- 사용한 복구 DB·credential 폐기

“backup이 있으므로 삭제 데이터도 안전하게 복원한다”는 문장은 사용하지 않는다. 삭제 데이터는 복원 대상이 아니다.

## 삭제 전 backup 복구 위험

예를 들어 visitor가 11월 20일 삭제했고 11월 19일 backup을 11월 21일 복구하면, restored DB에는 삭제 요청 자체가 없다. 단순히 `expires_at` cleanup만 실행하면 30일이 지나지 않은 기록이 남는다.

이를 막는 선택은 둘뿐이다.

### A. 독립 erasure ledger를 검증해 재적용

backup과 장애 domain이 다른 append-only ledger에 삭제 대상의 안정된 식별자·삭제 시각을 두고, restore promotion 전에 모두 replay한다. ledger 자체의 접근·보존·무결성·개인정보와 deletion transaction의 전달 보장을 별도로 설계해야 한다.

P0는 이 인프라를 구현했다고 가정하지 않는다.

### B. privacy-first visitor purge

독립 ledger가 없거나 완전성을 증명할 수 없으면 restored DB에서 다음을 전부 제거한다.

- 모든 visitor_sessions
- 모든 runs·run_steps·feedback
- 모든 visitor 연결 analytics events
- 모든 visitors
- 모든 활성 reports의 visitor 연결·clientRequestId·comment

public quest version·place snapshot·운영 audit는 보존할 수 있다. 이 방식은 삭제 재노출을 막지만 복구 시점에 삭제하지 않았던 사용자의 진행 기록도 잃는다.

P0의 production 승격 기본값은 B다. 사용자 진행 복구를 보장하려면 D11 결정에서 A의 독립성과 원자성 또는 동등한 제공자 기능을 검증해야 한다.

## 복구 환경 단계

1. production과 연결되지 않은 network·credential로 복구한다.
2. backup 시각·schema version·checksum을 기록한다.
3. production traffic 연결을 막는 promotion flag를 확인한다.
4. 공개 콘텐츠와 알려진 비삭제 test run을 읽어 backup 무결성을 검사한다.
5. 만료 cleanup을 실행한다.
6. 독립 erasure ledger가 검증됐으면 replay하고 누락 검사를 한다.
7. ledger가 없으면 privacy-first visitor purge를 실행한다.
8. visitor·session·run·feedback·연결 event 0건과 report 익명화를 확인한다.
9. 공개 API와 운영 콘텐츠만 smoke test한다.
10. 승격 여부, 개인 진행 손실과 사용자 공지 필요성을 두 사람이 review한다.

AC20 검수에서 restore 전 known run을 읽는 단계와 production 승격 전 visitor purge 뒤 0건 확인을 구분한다. 검수 DB에서 읽었다는 이유로 삭제 대상이 사용자에게 재노출된 것은 아니다.

## 외부 시스템 삭제

| 시스템 | P0 데이터 원칙 | 삭제 영향 |
| --- | --- | --- |
| monitoring | visitor·run ID·원문 금지 | 7일 기간 만료, 개별 연결 없음 |
| analytics SaaS | P0 미도입 | 도입 전 deletion API·보존 검토 |
| Vercel logs | header·body 자동 수집 비활성 검토 | provider 보존 설정 확인 |
| backup provider | 암호화·7일 lifecycle 후보 | 개별 삭제 불가, 복구 정리 |
| Google Maps | URL link만, server user data 전송 없음 | 사용자가 외부 앱을 여는 동작 별도 |

새 processor를 도입하면 전달 필드, region, 보존, access, 삭제 API와 실패 처리를 inventory와 위협 모델에 추가한다.

## 로그와 증거

삭제 operation log에는 request ID, route, status, duration과 안전한 결과 category만 둔다. visitor ID, 삭제 행의 UUID·수, comment와 token을 기록하지 않는다. aggregate cleanup count는 metric으로 가능하지만 label에 대상 ID를 넣지 않는다.

```markdown
# 삭제·cleanup 검수 YYYY-MM-DD

- commit·schema:
- 환경:
- test fixture:
- 전체 삭제 transaction 결과:
- 실패 주입 rollback:
- 만료 전/후 인증:
- report 익명화:
- log canary:
- backup 시각:
- erasure ledger: 없음 / 검증됨
- restore promotion 처리: ledger replay / visitor purge
- purge 뒤 visitor 연결 table count:
- reviewer 역할:
- 알려진 데이터 손실·제한:
```

실제 사용자 ID·row·backup 경로·credential은 증거에 넣지 않는다.

## 검수 시나리오

- [ ] run·step·feedback·report·event가 있는 visitor 전체 삭제가 원자적이다.
- [ ] 각 삭제 단계 실패 주입이 부분 삭제를 남기지 않는다.
- [ ] 204 이후 cookie와 기존 run ID로 접근할 수 없다.
- [ ] expired session은 cleanup 전에도 401이다.
- [ ] cleanup 재실행이 오류나 추가 side effect 없이 끝난다.
- [ ] report 익명화 후 visitor·key·comment가 null이다.
- [ ] 자유 입력 canary가 log·analytics·internalNote에 남지 않는다.
- [ ] 삭제 전 backup을 복구한 test에서 단순 만료 cleanup만으로 부족함을 재현한다.
- [ ] ledger가 없을 때 visitor purge 뒤 연결 데이터가 0건이다.
- [ ] public quest와 audit 무결성은 visitor purge 뒤 유지된다.
- [ ] backup lifecycle과 credential 폐기를 확인한다.

## 정책 확정 전 공개 gate

- [ ] 실제 30일·24시간·backup 최대 기간을 사용자 문구와 provider 설정에서 일치시켰다.
- [ ] 전체 삭제와 만료 cleanup을 실제 PostgreSQL에서 검수했다.
- [ ] 독립 erasure ledger 유무와 restore promotion 정책을 D11에 결정했다.
- [ ] ledger가 없으면 visitor 진행 기록 복구를 약속하지 않는다.
- [ ] privacy-first purge와 사용자 공지 책임자를 정했다.
- [ ] AC16·AC20 증거에 복구 전 읽기와 승격 전 purge를 구분했다.

정책이나 provider 기능이 바뀌면 사용자 안내, B2C 스펙, 데이터 계약, 운영 런북과 복구 테스트를 같은 기능 단위에서 갱신한다.
