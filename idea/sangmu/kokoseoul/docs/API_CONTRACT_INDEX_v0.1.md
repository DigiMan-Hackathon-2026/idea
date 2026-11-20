# API 계약 인덱스 v0.1

작성일: 2026-11-21 · 상태: 구현 전 대조 기준

이 문서는 [B2C API 예시](API_EXAMPLES_B2C_v0.1.md)와 [운영 API 예시](API_EXAMPLES_ADMIN_v0.1.md)를 인증·캐시·동시성·재시도 관점에서 한 번에 대조하기 위한 인덱스다. JSON 필드와 실제 응답 예시는 원본 문서를 따르며, 이 표와 원본이 다르면 구현 전에 문서를 함께 수정한다.

## 공통 경계

| 구분 | 인증·소유권 | Origin | 응답 캐시 |
| --- | --- | --- | --- |
| 공개 조회 | 인증 없음, 유효 visitor cookie는 선택적으로 개인화 | 검사하지 않음 | `private, no-store`; `Vary: Cookie` |
| visitor 조회 | 유효한 `digiman_visitor`, 대상 visitor 일치 | GET은 검사하지 않음 | `no-store`; `Vary: Cookie` |
| visitor 변경 | 유효한 visitor session, visitor·run 소유권 서버 확인 | 허용된 동일 출처 필수 | `no-store`; `Vary: Cookie` |
| session 생성 | 인증 없음, 기존 유효 cookie는 재사용 | 허용된 동일 출처 필수 | `no-store`; `Vary: Cookie` |
| 운영 조회 | 유효한 OIDC server session + 활성 admin principal | GET은 검사하지 않음 | `no-store`; `Vary: Cookie` |
| 운영 변경 | 활성 admin principal, P0의 editor·admin은 같은 최소 권한 | 허용된 admin 동일 출처 필수 | `no-store`; `Vary: Cookie` |

P0에서 역할 차이를 실제로 사용하지 않으므로 `editor`와 `admin`에 서로 다른 허용 동작이 있는 것처럼 구현하지 않는다. 역할을 분리할 때 endpoint별 권한표와 거부 테스트를 먼저 추가한다.

OIDC identity, server session, active principal과 환경별 callback 경계는 [운영자 인증·인가 계약](ADMIN_AUTHORIZATION_v0.1.md)에 고정한다.

route 유형별 cache·CSP·cookie·CORS와 browser header는 [HTTP 보안·캐시 header 계약](HTTP_SECURITY_HEADERS_v0.1.md)을 따른다.

모든 응답에는 서버가 확정한 `X-Request-Id`가 있다. JSON 요청의 알 수 없는 필드, 서버 결정 필드와 잘못된 Content-Type은 400 `VALIDATION_ERROR`다. 인증 실패와 소유권 실패는 대상 존재 여부를 노출하지 않는다.

JSON·query·Unicode·UUID·body 크기·cursor와 idempotency canonical 비교는 [입력 검증·정규화 계약](INPUT_VALIDATION_v0.1.md)을 따른다.

## B2C endpoint

| 메서드와 경로 | 권한 | 성공 | 중복·동시성 계약 | 주요 실패 | 연결 AC |
| --- | --- | --- | --- | --- | --- |
| `GET /quests` | 공개, visitor 선택 | 200 목록 | cursor는 필터와 결합, 완료 quest 제외는 서버 판단 | 400 필터·cursor, 429, 503 | AC01, AC02, AC19 |
| `GET /quests/:questId` | 공개, visitor 선택 | 200 상세 | 현재 공개본과 ownRun을 한 응답에서 판단 | 404 미공개·없음, 429, 503 | AC01, AC06~AC08, AC14, AC19 |
| `POST /visitor-sessions` | 인증 없음 | 201 신규, 200 기존 | 기존 cookie는 같은 session, 만료 연장 없음 | 400, 403 Origin, 429, 503 | AC01, AC16 |
| `POST /quests/:questId/runs` | visitor | 201 신규, 200 기존 | DB `(visitor_id, quest_id)` unique, 두 탭 모두 같은 run | 401, 403 Origin, 404, 409 `QUEST_UNAVAILABLE`, 503 | AC03, AC07, AC08 |
| `GET /runs/:runId` | 소유 visitor | 200 고정 버전 run | version snapshot을 사용, 상태 추측 없음 | 401, 404, 503 | AC06~AC08, AC10 |
| `PUT /runs/:runId/steps/:stepId` | 소유 visitor | 200 최신 run | `(run_id, step_id)` unique, 재전송은 저장 상태 반환, 마지막 완료 잠금 | 401, 403 Origin, 404, 409 `STEP_ORDER_CONFLICT`·`QUEST_UNAVAILABLE`, 503 | AC04, AC05, AC08~AC10 |
| `GET /runs/:runId/completion` | 소유 visitor | 200 완료 카드 | `runs.completed_at`이 기준 | 401, 404, 409 `RUN_NOT_COMPLETED`, 503 | AC06, AC09, AC10 |
| `GET /me/runs` | visitor | 200 목록 | cursor pagination, 본인 run만 | 400 cursor, 401, 503 | AC06, AC10, AC16 |
| `PUT /runs/:runId/feedback` | 소유 visitor | 200 create·update | run당 1행 upsert, 같은 본문 재전송 결과 동일 | 400, 401, 403 Origin, 404, 409 `RUN_NOT_COMPLETED`, 503 | AC11, AC12 |
| `POST /quests/:questId/reports` | visitor | 201 신규, 200 기존 | `(visitor_id, clientRequestId)` unique, 같은 key·다른 본문은 충돌 | 400, 401, 403 Origin, 404, 409 `REQUEST_CONFLICT`, 429, 503 | AC16 |
| `DELETE /me/data` | visitor | 204 | 단일 트랜잭션, 성공 뒤 cookie 만료; 응답 유실 시 재로그인 없이 상태 확인 불가 | 401, 403 Origin, 503 | AC16, AC20 |

`POST /visitor-sessions`의 첫 응답이 cookie 전달 전에 유실되면 재요청에서 새 visitor가 생길 수 있다. 앞선 visitor에는 사용자 데이터가 없고 만료 정리 대상이므로 P0에서 이를 병합하지 않는다. 세션 생성 뒤 run 생성 전까지 개인 상태를 추가하지 않는다.

## 운영 endpoint

| 메서드와 경로 | 성공 | 충돌·재시도 계약 | 주요 실패 | 연결 AC |
| --- | --- | --- | --- | --- |
| `GET /admin/quests` | 200 목록 | cursor pagination | 400, 401, 403 `ADMIN_FORBIDDEN`, 503 | AC15 |
| `POST /admin/quests` | 201 신규, 200 기존 | `(admin_id, clientRequestId)` unique; 응답 유실 뒤 같은 key 재전송 | 400, 401, 403 Origin·권한, 409 `REQUEST_CONFLICT`, 503 | AC13, AC15 |
| `GET /admin/quests/:questId` | 200 상세 | 최신 revision 반환 | 401, 403, 404, 503 | AC13, AC15 |
| `PUT /admin/quests/:questId/draft` | 200 저장 | quest row lock + expectedRevision; 자동 재시도 금지 | 400, 401, 403, 404, 409 `VERSION_CONFLICT`, 503 | AC13, AC15 |
| `POST /admin/quests/:questId/publish` | 200 공개 | 필수 검수 재확인 + expectedRevision + 같은 트랜잭션 audit | 400, 401, 403, 404, 409, 503 | AC13~AC15 |
| `POST /admin/quests/:questId/pause` | 200 중지 | expectedRevision, 이유와 audit 원자 저장 | 400, 401, 403, 404, 409, 503 | AC08, AC13, AC15 |
| `POST /admin/quests/:questId/resume` | 200 재개 | expectedRevision, 기존 published version 유지 | 400, 401, 403, 404, 409, 503 | AC07, AC13, AC15 |
| `POST /admin/quests/:questId/archive` | 200 보관 | expectedRevision, 종료 상태에서 이후 변경 거절 | 400, 401, 403, 404, 409, 503 | AC13, AC15 |
| `GET /admin/reports` | 200 목록 | visitor·session ID를 응답하지 않음 | 400, 401, 403, 503 | AC15, AC16 |
| `PATCH /admin/reports/:reportId` | 200 처리 | report row lock + expectedRevision + 같은 트랜잭션 audit | 400, 401, 403, 404, 409 `VERSION_CONFLICT`, 503 | AC13의 동시 수정 원칙, AC15 |

quest 상태 변경 요청은 네트워크 오류만으로 자동 반복하지 않는다. 먼저 `GET /admin/quests/:questId`로 revision과 목표 상태를 확인한다. 이미 목표 상태면 성공으로 표시하고, 아니면 운영자가 최신 내용을 확인한 뒤 다시 실행한다.

quest 생성의 `clientRequestId`는 UI가 생성 행동마다 만드는 UUID다. 같은 운영자와 같은 key의 요청 hash가 다르면 409 `REQUEST_CONFLICT`다. 현재 생성 본문에는 key 외의 사용자 필드가 없지만, 이후 생성 필드가 추가돼도 이 규칙을 유지한다.

## 오류 코드 소유

| code | HTTP | 사용 경계 |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | 형식·범위·알 수 없는 필드·공개 필수값 |
| `SESSION_REQUIRED` | 401 | visitor 또는 admin session 없음·만료 |
| `ORIGIN_FORBIDDEN` | 403 | mutation의 Origin 누락·불일치 |
| `ADMIN_FORBIDDEN` | 403 | 활성 principal 없음·역할 거부 |
| `NOT_FOUND` | 404 | 없음·미공개·다른 visitor 소유 |
| `QUEST_UNAVAILABLE` | 409 | 중지·보관·시작 또는 미완료 진행 차단 |
| `STEP_ORDER_CONFLICT` | 409 | 선행 단계 미완료 |
| `RUN_NOT_COMPLETED` | 409 | 완료 카드·feedback 선행 상태 미충족 |
| `VERSION_CONFLICT` | 409 | quest 또는 report expectedRevision 불일치 |
| `REQUEST_CONFLICT` | 409 | 같은 clientRequestId에 다른 정규화 요청 |
| `RATE_LIMITED` | 429 | 제한과 안전한 retry 시각 제공 |
| `SERVICE_UNAVAILABLE` | 503 | 제한된 서버 재시도 뒤 일시 장애 |

Origin 실패는 visitor·admin 모두 `ORIGIN_FORBIDDEN`으로 매핑하고 허용 Origin 목록을 details에 넣지 않는다. 인증을 먼저 자세히 판별해 공격자에게 principal 존재 여부를 알려 주지 않으며 화면은 재시도를 반복하지 않는다.

429 header·화면 복구, bucket key와 limiter 장애는 [속도 제한·남용 대응 계약](RATE_LIMIT_ABUSE_v0.1.md)을 따른다.

## 클라이언트 재시도 규칙

| 상황 | 허용 행동 |
| --- | --- |
| GET timeout·503 | 지수 backoff로 제한 재시도, 같은 cursor 유지 |
| run·step 응답 유실 | 같은 run을 GET으로 조회한 뒤 필요할 때만 같은 요청 재전송 |
| report 응답 유실 | 같은 clientRequestId와 같은 본문 재전송 |
| feedback 응답 유실 | run GET 또는 완료 화면에서 저장 상태 확인 뒤 같은 본문 PUT |
| quest 생성 응답 유실 | 같은 clientRequestId 재전송 |
| quest·report 운영 변경 응답 유실 | 최신 상세 조회, revision·상태 확인, 자동 재전송 금지 |
| 400·401·403·404·409 | 사용자 또는 상태 변경 없이 자동 재시도 금지 |
| 429 | 서버가 제공한 재시도 시각 전 반복 금지 |

## 구현 전 대조 검사

- [ ] 모든 endpoint가 표의 인증 middleware와 일치한다.
- [ ] 모든 변경 endpoint가 Origin을 거부하는 통합 테스트가 있다.
- [ ] visitor·admin cookie 이름과 검증 경로가 섞이지 않는다.
- [ ] 개인·운영 응답에 `no-store`, cookie별 응답에 `Vary: Cookie`가 있다.
- [ ] quest 생성·report 생성의 clientRequestId 충돌을 구분한다.
- [ ] quest·report expectedRevision 충돌이 기존 내용을 보존한다.
- [ ] run·step unique 제약 오류가 500이나 중복 행으로 끝나지 않는다.
- [ ] 404가 다른 visitor 또는 미공개 대상의 존재를 누설하지 않는다.
- [ ] 503 뒤 mutation 상태 조회 경로가 화면에 연결돼 있다.
- [ ] API 예시의 모든 JSON block이 parser를 통과한다.
