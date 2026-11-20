# 도메인 상태 머신 계약 v0.1

작성일: 2026-11-21 · 상태: 구현 전 검토 기준

이 문서는 quest·version·run·step·feedback·report·visitor session의 허용 상태와 전이를 한 곳에서 정의한다. 화면은 이 표를 복제해 추측하지 않고 API가 반환한 `canStart`, `canContinue`, `nextStepId`와 상태를 사용하며, 서버는 매 mutation에서 전이를 다시 검증한다.

entity·상태·파생 능력·삭제 동사의 의미는 [도메인 용어·명명 계약](DOMAIN_GLOSSARY_v0.1.md)을 따른다.

## 공통 원칙

- 상태는 DB에 저장된 현재 값과 같은 transaction의 제약을 기준으로 한다.
- 존재하지 않는 전이는 409로 거절하며 일부 side effect를 남기지 않는다.
- client는 status, completedAt, reviewedBy 같은 서버 결정 값을 직접 지정하지 않는다.
- 운영 전이는 expectedRevision을 검사하고 audit log와 같은 transaction에 저장한다.
- 공개 version, 완료 step, 완료 run은 과거 의미를 바꾸는 역전 전이가 없다.
- 응답 유실은 성공·실패를 추측하지 않고 현재 상태를 조회해 복구한다.

## quest 상태

```text
create ──► draft ── publish ──► published ── pause ──► paused
             │                     ▲   │                  │
             │                     │   └─ save draft      ├─ resume existing version
             │                     │                      └─ publish new draft
             │                     └───────────────────────┘
             │                     │                      │
             └──────── archive ────┴──────────────────────┘
                                   │
                                   ▼
                                archived
```

`archived`는 종료 상태다. 화살표가 없는 상태 변경은 허용하지 않는다.

| 현재 | action | 조건 | 다음 | 같은 transaction의 side effect | 실패 |
| --- | --- | --- | --- | --- | --- |
| 없음 | create | 활성 admin, 새 clientRequestId | draft | quest, v1 draft, audit | 400·401·403·409·503 |
| draft | save draft | expectedRevision 일치 | draft | draft 전체 저장, revision +1, audit | 400·409 |
| draft | publish | 공개 검수 통과 | published | version 확정, publishedVersion 설정, revision +1, audit | 400·409 |
| published | save draft | expectedRevision 일치 | published | 다음 version draft 생성·저장, revision +1, audit | 400·409 |
| published | publish | draft와 공개 검수 통과 | published | 새 version 확정·교체, revision +1, audit | 400·409 |
| published | pause | 공개 가능한 reasonJa | paused | reason 저장, revision +1, audit | 400·409 |
| paused | save draft | expectedRevision 일치 | paused | 다음 version draft 저장, revision +1, audit | 400·409 |
| paused | resume | publishedVersion 존재 | published | 기존 version 유지, reason 제거, revision +1, audit | 409 |
| paused | publish | draft와 공개 검수 통과 | published | 새 version 확정·교체, reason 제거, revision +1, audit | 400·409 |
| draft·published·paused | archive | expectedRevision 일치 | archived | 종료 시각, revision +1, audit | 409 |

published 상태에서 편집 draft가 존재해도 공개 목록과 신규 run은 현재 `publishedVersion`을 사용한다. draft 저장만으로 사용자 화면이 바뀌지 않는다.

current revision에서 canonical draft 내용이 완전히 같은 저장은 상태 전이가 아니며 current result를 반환하고 revision·audit를 늘리지 않는다.

paused에 미공개 draft가 있어도 `resume`은 기존 published version을 재개하며 draft를 삭제하지 않는다. 수정 내용을 공개하려면 `publish`를 사용한다. draft-only quest에는 publishedVersion이 없으므로 resume·pause를 허용하지 않는다.

archive는 draft도 함께 더 이상 수정할 수 없게 하지만, 과거 published version과 run은 읽기 위해 보존한다. 한 번도 공개되지 않은 archived quest는 공개 API에서 계속 404다.

## quest version 상태

```text
draft ── publish validation + transaction ──► published
```

| 상태 | 수정 | 삭제 | 사용자 공개 | run 고정 |
| --- | --- | --- | --- | --- |
| draft | 전체 저장 가능 | quest archive 전 정책에 따라 정리 가능 | 불가 | 불가 |
| published | 불가 | 불가 | quest 상태에 따라 공개 상세 또는 기록에서 사용 | 가능 |

published version을 고치는 API와 repository method를 제공하지 않는다. 사실 오류는 quest를 pause하고 다음 draft를 새 version으로 공개한다. 기존 run은 시작한 version의 snapshot을 유지한다.

## 사용자에게 보이는 quest 가용성

| quest 상태 | publishedVersion | 목록 | 직접 상세 | 신규 시작 | 기존 run 읽기 | 미완료 step 변경 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| draft | 없음 | 숨김 | 404 | 불가 | 해당 없음 | 해당 없음 |
| published | 있음 | 표시 | 표시 | 가능 | 가능 | 가능 |
| paused | 있음 | 숨김 | 중지 사유와 표시 | 불가 | 가능 | 불가 |
| archived | 있음 | 숨김 | 종료 안내와 표시 | 불가 | 가능 | 불가 |
| archived | 없음 | 숨김 | 404 | 불가 | 해당 없음 | 해당 없음 |

`canStart`와 `canContinue`는 이 표 외에 visitor의 기존 run·session 만료·version 소유권을 함께 검사한 서버 결과다.

## run과 step 상태

```text
run:  in_progress ── last required step commit ──► completed
step: absent      ── ordered completion commit ──► completed row
```

run과 run_step에는 undo·restart·reopen 전이가 없다. 동일 visitor가 같은 quest를 다시 시작해도 기존 run을 반환한다.

| mutation | 선행 조건 | 성공 결과 | 반복 요청 | 충돌 |
| --- | --- | --- | --- | --- |
| run 시작 | 유효 session, quest published | 고정 version의 in_progress run | 같은 run 200 | quest unavailable 409 |
| step 완료 | 본인 run, quest published, 다음 step | run_step 생성 | 같은 completedAt 200 | 순서·중지 409 |
| 마지막 step 완료 | 위 조건 + 마지막 step | run_step과 run completed | 같은 완료 상태 200 | 순서·중지 409 |

두 탭의 동시 요청은 unique 제약과 run row lock으로 직렬화한다. 마지막 step transaction은 `run_steps` insert와 `runs.status`, `completed_at` 갱신을 함께 commit한다.

completed run은 quest가 paused·archived가 돼도 기록과 완료 카드를 읽을 수 있다. completed run에 새 step을 추가하거나 completedAt을 바꾸지 않는다.

## feedback 상태

feedback은 별도 status 대신 존재 여부와 run당 한 행으로 표현한다.

```text
absent ── completed run의 PUT ──► present ── PUT ──► present(updated)
```

- in_progress run에는 409 `RUN_NOT_COMPLETED`
- present 상태의 PUT은 같은 행을 갱신하며 새 행을 만들지 않음
- 유효성 오류나 DB 실패는 기존 값을 보존
- visitor 전체 삭제 때 run과 함께 삭제
- feedback 존재 여부가 run 완료를 바꾸지 않음

동시 feedback PUT은 마지막 commit 값이 남을 수 있다. P0는 한 visitor browser의 자기 feedback만 허용하며 별도 revision을 제공하지 않는다. 운영 덮어쓰기나 공동 편집 요구가 생기면 revision을 추가한다.

## report 상태

```text
new ───────────────► resolved
 │                     ▲
 └─► in_progress ──────┘
          ▲             │
          └── reopen ───┘
```

허용 전이는 `new → in_progress`, `new → resolved`, `in_progress → resolved`, `resolved → in_progress`다. `in_progress → new`, `resolved → new`, 같은 상태로의 빈 PATCH는 허용하지 않는다.

| action | 필수 | side effect |
| --- | --- | --- |
| triage | expectedRevision, 새 status 또는 변경된 internalNote | revision +1, updatedAt, audit |
| resolve | expectedRevision, resolved status | revision +1, updatedAt, audit |
| reopen | expectedRevision, in_progress status | revision +1, updatedAt, audit |

status와 internalNote 중 적어도 하나가 달라야 한다. internalNote는 visitor 원문·식별자를 복사하지 않고 최대 길이를 지킨다. 두 운영자가 같은 revision을 변경하면 하나만 성공하고 나머지는 409 `VERSION_CONFLICT`다.

visitor 삭제·만료로 report를 익명화해도 운영 status와 제한된 internalNote는 유지할 수 있다. visitorId, clientRequestId, comment는 제거하고 anonymizedAt을 기록한다. 익명화는 처리 상태의 역전이 아니다.

## visitor session 수명

각 전이의 token·cookie·DB transaction·pepper rotation과 경합 처리는 [익명 방문자 session 수명주기 계약](VISITOR_SESSION_LIFECYCLE_v0.1.md)을 따른다.

```text
absent ── explicit start/report intent ──► active
active ── expiresAt 도달 ────────────────► expired ── cleanup ──► removed
active ── DELETE /me/data commit ─────────► removed
```

| 상태 | 인증 | 개인 기록 읽기·변경 | cookie 처리 |
| --- | --- | --- | --- |
| absent | 실패 | 불가 | 없음 |
| active | 성공 | 본인 범위에서 가능 | 고정 expiresAt, 자동 연장 없음 |
| expired | 즉시 실패 | 불가 | 오류 응답에서 만료 가능, cleanup을 기다리지 않음 |
| removed | 실패 | 불가 | 삭제 204 뒤 만료 |

expired는 DB enum이 아니라 `expires_at <= now`에서 파생할 수 있다. cleanup 전에도 active로 되돌리지 않는다. 다른 기기·cookie 삭제 후 session 복구나 병합은 P0에 없다.

## 운영 principal 상태

| 상태 | OIDC 로그인 | 운영 API | 과거 audit·createdBy 참조 |
| --- | --- | --- | --- |
| active | 가능 | 허용 role 범위 | 유지 |
| disabled | 인증 제공자가 로그인시켜도 권한 거부 | 403 `ADMIN_FORBIDDEN` | 유지 |

principal을 disabled로 바꾸면 기존 운영 session도 다음 요청에서 거절한다. 과거 참조를 지우기 위해 principal을 물리 삭제하지 않는다.

## 오류와 HTTP 결과

| 실패 | code | HTTP | DB 변화 |
| --- | --- | ---: | --- |
| session 없음·만료 | `SESSION_REQUIRED` | 401 | 없음 |
| Origin 누락·불일치 | `ORIGIN_FORBIDDEN` | 403 | 없음 |
| 운영 principal 없음·disabled | `ADMIN_FORBIDDEN` | 403 | 없음 |
| 타인 소유 또는 숨겨야 하는 대상 | `NOT_FOUND` | 404 | 없음 |
| quest 상태가 action 불허 | `QUEST_UNAVAILABLE` | 409 | 없음 |
| 선행 step 미완료 | `STEP_ORDER_CONFLICT` | 409 | 없음 |
| run 미완료 | `RUN_NOT_COMPLETED` | 409 | 없음 |
| stale 운영 revision | `VERSION_CONFLICT` | 409 | 없음 |
| 같은 idempotency key·다른 요청 | `REQUEST_CONFLICT` | 409 | 없음 |

입력 형식이나 공개 필수값 누락은 400 `VALIDATION_ERROR`다. transaction retry 한도를 넘으면 전체 rollback 뒤 503 `SERVICE_UNAVAILABLE`이다.

## 잠금 순서

동시에 여러 엔터티가 필요한 mutation은 가능한 경우 다음 순서로 잠근다.

```text
quest → quest_version → visitor → run → report
```

모든 action이 전체 순서를 쓰는 것은 아니지만 역순으로 잠근 뒤 앞 엔터티를 추가로 잠그지 않는다. visitor 삭제와 run mutation처럼 경합하는 경로는 구체적인 잠금 순서를 통합 테스트로 고정한다.

## 상태 전이 테스트

- [ ] 표의 모든 허용 전이가 성공한다.
- [ ] 화살표가 없는 전이가 409와 DB 무변경으로 끝난다.
- [ ] expectedRevision 실패가 content·status·audit 모두 보존한다.
- [ ] published version과 completed run·step을 역전하거나 수정할 수 없다.
- [ ] pause·archive가 신규 시작과 미완료 step을 차단하고 기존 기록 읽기는 유지한다.
- [ ] 동시 마지막 step이 completedAt 하나만 만든다.
- [ ] report resolved 재개는 in_progress만 허용하고 audit를 남긴다.
- [ ] expired session은 cleanup 전에도 인증되지 않는다.
- [ ] disabled principal의 기존 session이 즉시 운영 권한을 잃는다.
- [ ] 응답 유실 뒤 조회가 commit 결과를 정확히 복구한다.

연결 검수: AC03~AC16, AC20
