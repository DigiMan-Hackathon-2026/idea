# 클라이언트 요청·복구 계약 v0.1

작성일: 2026-11-21 · 상태: UI·API client 구현 전 기준

이 문서는 browser가 loading, 중복 클릭, offline, timeout, 응답 유실, 4xx·5xx에서 사용자 입력과 서버 상태를 어떻게 보존·재조회·재시도하는지 정의한다. 서버의 unique·transaction·revision이 최종 정합성 기준이며, button 비활성화나 client cache는 보조 수단이다.

## 원칙

- navigation 취소나 timeout은 server transaction 실패를 뜻하지 않는다.
- GET과 mutation의 재시도 정책을 분리한다.
- mutation 성공 여부가 불명확하면 가능한 경우 상태를 먼저 조회한다.
- 새로운 visitor session·idempotency key·revision으로 조용히 재시도하지 않는다.
- 입력을 보존하더라도 token·자유 입력을 URL·log·analytics·영구 storage에 저장하지 않는다.
- “재시도 가능”은 무한 자동 재시도를 뜻하지 않는다.
- 다른 tab·운영자의 최신 서버 상태를 client cache로 덮어쓰지 않는다.

## request 상태 머신

| 상태 | 의미 | 허용 행동 |
| --- | --- | --- |
| idle | 요청 없음, 현재 서버 상태 표시 | 사용자가 행동 시작 |
| submitting | 한 요청 전송 중 | 같은 의도의 중복 전송 차단 |
| confirming | 응답 유실 가능, 현재 서버 상태 확인 중 | read-only 조회만 |
| succeeded | 서버 결과 확인 | 화면·focus 갱신 |
| retryable | commit 안 됨 또는 조회 뒤 미완료 확인 | 사용자 명시 재시도 |
| terminal | 입력·권한·상태상 같은 요청 불가 | 수정·로그인·이동 안내 |

`submitting`에서 component unmount·tab close가 발생해도 abort signal만으로 server rollback을 가정하지 않는다. background queue나 service worker가 mutation을 나중에 자동 재생하지 않는다.

## request identity

### request ID

server가 응답마다 확정하는 진단용 값이다. client가 권한·멱등·resource identity로 사용하지 않는다. 오류 화면은 짧게 표시·복사할 수 있지만 analytics event와 URL에는 넣지 않는다.

### clientRequestId

사용자의 한 create 의도를 식별한다.

- report와 운영 quest 생성 요청 body에 포함한다.
- 실제 제출 의도가 생길 때 UUID를 한 번 만든다.
- 응답 유실·429 뒤 같은 body 재시도에는 같은 값을 사용한다.
- 같은 값으로 body가 바뀌면 409 `REQUEST_CONFLICT`이므로 자동으로 새 값을 만들지 않는다.
- 사용자가 충돌 내용을 확인하고 명시적으로 새 제출을 시작할 때만 새 값을 만든다.

report comment와 request body를 localStorage·URL에 보관하지 않는다. 열린 화면의 memory state에서만 같은 요청을 재시도한다. reload로 의도를 잃었으면 자동 전송하지 않고 사용자가 새 제출인지 결정한다.

### expectedRevision

운영자가 읽은 quest·report revision이다. 409 뒤 최신 revision으로 숫자만 바꾸어 같은 mutation을 자동 반복하지 않는다. 최신 내용과 현재 상태를 다시 보여 주고 사용자가 merge·폐기·새 시도를 선택한다.

## GET

GET은 side effect가 없다는 서버 계약 아래 제한적으로 자동 재시도할 수 있다.

| 실패 | 처리 |
| --- | --- |
| offline·network error | 조건·URL 유지, 연결 회복 뒤 사용자가 재시도 |
| timeout·503 | jitter가 있는 제한 backoff 후보, 최대 횟수 뒤 명시적 버튼 |
| 400 | query·cursor 문제를 수정, 같은 값 자동 반복 금지 |
| 401 | 개인 cache 제거, 세션 만료 화면 |
| 403 | 운영 데이터 제거, 권한 거절 화면 |
| 404 | 존재·권한을 추측하지 않고 찾을 수 없음 |
| 429 | Retry-After 전 반복 금지 |

목록 조건·cursor는 재시도에서 유지한다. 새 필터를 선택하면 이전 request를 취소할 수 있지만 늦게 온 이전 응답이 새 조건 결과를 덮어쓰지 않게 request generation을 비교한다.

stale 개인·운영 응답은 offline fallback으로 표시하지 않는다. P0는 private run·admin page를 service worker cache에 저장하지 않는다.

## visitor session 생성

`POST /visitor-sessions`는 기존 유효 cookie면 200, 신규면 201이다.

- 시작·신고 의도가 생기기 전 자동 생성하지 않는다.
- 요청 중 button을 비활성화한다.
- 응답 전에 연결이 끊기면 cookie 수신 여부를 확인한다.
- cookie가 있으면 개인 endpoint를 조회해 유효성을 확인한다.
- cookie가 없으면 앞선 빈 visitor가 생겼을 수 있으나 개인 데이터는 없으므로 제한된 새 요청을 허용한다.
- session 생성 실패를 이유로 client가 임의 token을 만들거나 cookie를 직접 조립하지 않는다.

새 session을 만드는 재시도는 run·report mutation의 상태 확인을 대신하지 않는다.

## run 시작

`POST /quests/:questId/runs`는 `(visitor, quest)` unique다.

1. submitting 동안 같은 시작 버튼·다른 surface의 시작 행동을 잠근다.
2. 성공하면 반환된 run path로 이동한다.
3. 응답이 불명확하면 quest 상세 또는 내 기록을 다시 조회한다.
4. own run이 있으면 그 run으로 이동한다.
5. 없고 quest가 시작 가능할 때만 사용자가 재시도한다.
6. 409 `QUEST_UNAVAILABLE`이면 중지 상태를 표시하고 시작을 반복하지 않는다.

중복 요청이 server에 도달해도 같은 run 하나를 반환해야 하며, client 잠금 통과만으로 AC03을 충족했다고 보지 않는다.

## step 완료

1. 현재 `nextStepId`에만 완료 행동을 제공한다.
2. submitting 동안 버튼과 keyboard shortcut의 재전송을 막고 현재 안내를 유지한다.
3. 200이면 server의 `updatedStep`, `nextStepId`, `status`를 적용한다.
4. timeout·연결 종료면 confirming 화면에서 `GET /runs/:runId`를 실행한다.
5. 해당 step이 완료됐으면 다음 단계 또는 completion으로 이동한다.
6. 미완료이고 `canContinue`면 같은 step을 사용자가 재시도할 수 있다.
7. 409 순서·중지 오류면 다시 조회한 현재 서버 상태로 이동한다.

이전 완료 시각을 client clock으로 생성하지 않는다. 두 tab 중 늦게 온 응답이 completed run을 in_progress로 되돌리지 않게 최신 server state를 기준으로 한다.

## completion 조회와 feedback

completion GET이 409 `RUN_NOT_COMPLETED`이면 stamp를 client에서 추측 생성하지 않고 run으로 돌아간다.

feedback PUT은 run당 한 행을 upsert한다.

- form 입력은 화면 memory state에서 유지한다.
- 저장 중 중복 submit을 막는다.
- 응답 유실이면 completion GET의 `feedback`으로 현재 저장값을 확인한다.
- 저장값이 요청과 같으면 succeeded로 처리한다.
- 다르거나 null이면 사용자에게 현재 값과 입력을 보여 주고 재시도 여부를 묻는다.
- 새 입력으로 저장할 때 마지막 server 값을 무시한 자동 background PUT을 하지 않는다.

comment를 query, localStorage, analytics와 error log에 넣지 않는다. navigation 시 미저장 입력 손실 경고를 제공할 수 있지만 browser unload network 요청으로 저장하지 않는다.

## report

- 같은 report intent의 `clientRequestId`와 정규화 전 사용자 입력을 화면 memory에 둔다.
- 201과 기존 결과 200은 같은 접수 성공 화면이다.
- timeout·503에서 server 상태를 직접 조회할 visitor report endpoint가 없으므로 같은 key·같은 body만 재전송한다.
- 409 `REQUEST_CONFLICT`이면 입력을 유지하고 자동 제출을 멈춘다.
- 429이면 같은 key·body를 보존하고 Retry-After 뒤 명시적으로 재시도한다.
- reload·tab close 뒤 comment와 key를 복구하려고 persistent storage에 저장하지 않는다.

접수 성공을 운영 해결·신고자 알림으로 표현하지 않는다.

## 전체 삭제

`DELETE /me/data`는 성공 시 session 자체가 사라져 일반 상태 조회가 불가능하다.

1. 확인 dialog에서 범위와 되돌릴 수 없음을 읽는다.
2. submitting 동안 dialog 닫기·중복 삭제·새 mutation을 막는다.
3. 204를 받으면 client 개인 cache·memory를 지우고 cookie 만료 응답을 적용한다.
4. 응답이 유실되면 개인 기록 GET을 한 번 시도한다.
5. 401이면 삭제 완료 또는 session 무효 중 하나로 안내하고 local 개인 상태·cookie를 제거한다.
6. 5xx 또는 유효 session과 기록이 남아 있으면 삭제됐다고 말하지 않고 재시도 행동을 제공한다.

401만으로 “모든 데이터가 삭제 완료됐다”고 확정 문구를 보여 주지 않는다. 확인을 위해 새 visitor session을 만들지 않는다.

## 운영 create·edit·상태 변경

### quest 생성

같은 `clientRequestId`·body를 재사용할 수 있다. 응답 유실 뒤 같은 key로 재요청해 200 기존 quest를 받는다. 새 UUID를 만들어 중복 draft를 생성하지 않는다.

### draft 저장

- form을 연 revision을 보존한다.
- 응답 유실이면 quest 상세를 재조회한다.
- revision과 field가 요청 결과와 일치하면 성공으로 표시한다.
- 다르면 최신 server 내용과 local draft를 분리해 보여 준다.
- 최신 revision으로 바꿔 자동 덮어쓰지 않는다.

### publish·pause·resume·archive

- 같은 상태 변경을 network error만으로 자동 반복하지 않는다.
- 상세 재조회에서 이미 목표 상태면 성공 결과로 보여 준다.
- 목표 상태가 아니면 최신 revision·검수 상태를 다시 확인한다.
- pause가 report PATCH와 별도 요청이면 pause 성공을 report 실패 때문에 되돌리지 않는다.

### report triage

PATCH 응답 유실 뒤 report 최신 revision·status를 재조회한다. 이미 목표 상태·note면 성공, 다른 운영자 변경이면 충돌로 보여 주고 자동 덮어쓰지 않는다.

## 오류 code 처리

| code | 입력 | 서버 상태 확인 | 자동 재시도 |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | 유지, field 연결 | 불필요 | 금지 |
| `SESSION_REQUIRED` | 개인 입력 제거 또는 별도 경고 | session 없음 | 금지 |
| `ORIGIN_FORBIDDEN` | 현재 화면 입력 유지 | canonical origin 재진입 | 금지 |
| `ADMIN_FORBIDDEN` | 운영 입력·data 제거 | principal 재인증 후보 | 금지 |
| `NOT_FOUND` | 대상 입력 제거 | 존재 추측 금지 | 금지 |
| `QUEST_UNAVAILABLE` | 비개인 form 후보 유지 | quest·run 재조회 | 금지 |
| `STEP_ORDER_CONFLICT` | 없음 | run 재조회 | 금지 |
| `RUN_NOT_COMPLETED` | feedback 입력 유지 가능 | run 재조회 | 금지 |
| `VERSION_CONFLICT` | local draft 분리 유지 | 최신 resource 조회 | 금지 |
| `REQUEST_CONFLICT` | 입력·기존 key 유지 | 사용자 결정 | 금지 |
| `RATE_LIMITED` | 입력·identity 유지 | 필요 시 mutation별 조회 | 시각 전 금지 |
| `SERVICE_UNAVAILABLE` | 화면 memory에 유지 | mutation별 조회 우선 | GET만 제한 후보 |

error의 `retryable: true`만 보고 mutation을 자동 반복하지 않는다. method, operation identity와 상태 조회 가능성을 함께 판단한다.

## Retry-After와 backoff

- 429는 response header와 JSON seconds가 일치해야 한다.
- 대기 timer는 server 값보다 일찍 활성화하지 않는다.
- countdown을 매초 screen reader에 낭독하지 않는다.
- 503 GET 후보는 짧은 최대 횟수, exponential backoff와 jitter를 사용한다.
- browser online event만으로 queued mutation을 자동 제출하지 않는다.
- tab이 background로 갔다 돌아오면 남은 시간을 server·monotonic 기준으로 다시 계산한다.

정확한 GET retry 횟수·timeout은 실제 네트워크와 배포 환경 측정 후 고정한다.

## focus·접근성

- submitting 시작 시 focus를 강제로 spinner로 옮기지 않는다.
- 성공 뒤 새 heading 또는 다음 primary action으로 예측 가능하게 이동한다.
- validation은 summary와 첫 field error를 연결한다.
- confirming은 한 번 상태를 알리고 polling마다 반복 낭독하지 않는다.
- terminal 오류는 이유와 가능한 다음 행동을 함께 제공한다.
- 재시도 button label은 “다시”가 아니라 무엇을 다시 하는지 문맥상 명확해야 한다.

## 관측

client와 server에서 다음 aggregate만 본다.

- route template·method·status·errorCode
- timeout·network·abort category
- retry·confirmation 조회 수
- request duration과 release·environment

request ID, run·visitor UUID, URL query, body, comment, cookie를 analytics event나 metric label에 넣지 않는다. abort가 많다는 사실만으로 server transaction 실패율로 해석하지 않는다.

## 검수 matrix

- [ ] double click·Enter 반복이 mutation 하나의 의도로 처리됨
- [ ] commit 전 연결 종료: 미변경 조회 뒤 안전한 재시도
- [ ] commit 후 응답 유실: 조회로 성공 확인, 중복 없음
- [ ] run 시작 두 tab: 같은 run으로 수렴
- [ ] 마지막 step 두 tab: completedAt·event 하나
- [ ] feedback 응답 유실: completion feedback과 입력 비교
- [ ] report 503·429: 같은 key·body, 새 session 없음
- [ ] report conflict: 자동 새 key 제출 없음
- [ ] delete 204 유실: 401에서 확정 과장 없이 local 상태 제거
- [ ] draft revision conflict: 최신 내용 자동 덮어쓰기 없음
- [ ] pause 성공·report PATCH 실패: quest pause 유지
- [ ] offline→online: queued mutation 자동 재생 없음
- [ ] 늦게 온 이전 GET이 새 필터·완료 상태를 덮어쓰지 않음
- [ ] retry UI keyboard·screen reader·360px 검수
- [ ] 자유 입력·token이 storage·log·URL·trace에 없음

## 증거 양식

```markdown
# client 복구 검수 YYYY-MM-DD HH:mm KST

- commit·browser·viewport:
- endpoint·operation:
- commit 전 / commit 후 fault:
- request state 전이:
- confirmation 조회 결과:
- idempotency key·revision 처리:
- 최종 HTTP·DB 행·event 수:
- 입력·focus·screen reader 상태:
- storage·log·URL canary:
- 알려진 제한:
```

실제 body·cookie·UUID·comment는 증거에 넣지 않는다.

## 구현 gate

- [ ] 모든 mutation이 공통 state enum과 operation별 복구 정책을 사용한다.
- [ ] GET retry와 mutation confirmation 로직이 분리돼 있다.
- [ ] idempotency key·expectedRevision lifecycle이 test에 고정됐다.
- [ ] service worker·cache가 개인·운영 response와 mutation을 보관하지 않는다.
- [ ] 12개 공통 error code의 화면·focus·자동 재시도 여부가 검수됐다.
- [ ] AC03·AC05·AC09·AC12·AC13·AC16 fault injection을 통과했다.

연결 검수: AC03~AC06, AC08~AC13, AC16, AC18
