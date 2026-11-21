# B2C API 요청과 응답 예시 v0.1

작성일: 2026-11-21 · 상태: 구현 계약 예시

이 문서는 [B2C 설계 스펙 v0.1](B2C_SPEC_v0.1.md)의 공개 탐색, 익명 세션, 진행, 완료, 개인 기록, 피드백과 신고 API를 실제 JSON 형태로 구체화한다. 필드 이름과 상태 코드는 화면 mock과 서버 테스트가 함께 사용하는 계약이다. 운영자 API 예시는 별도 문서에서 다룬다.

예시의 UUID와 시각은 가상 값이다. 실제 시각은 UTC ISO 8601로 반환하고 화면에서 Asia/Seoul 기준으로 표시한다.

## 공통 규칙

기본 경로는 `/api/v1`이고 요청·응답 본문은 JSON이다. JSON 요청은 `Content-Type: application/json`, JSON 응답은 `Content-Type: application/json; charset=utf-8`을 사용한다.

```text
X-Request-Id: 01KAMEXAMPLEREQUEST00000000
```

서버가 모든 응답에 요청 ID를 부여한다. 클라이언트가 허용된 형식의 ID를 보내더라도 서버는 충돌과 길이를 검사하며, 오류 화면에는 응답의 ID만 표시한다.

개인 기록 응답은 다음 헤더를 포함한다.

```text
Cache-Control: no-store
Vary: Cookie
```

목록과 상세도 유효한 세션에 따라 완료 퀘스트 제외와 `ownRunId`가 달라지므로 첫 버전에서는 공유 캐시를 사용하지 않는다.

예시에 없는 요청 필드는 무시하지 않고 `VALIDATION_ERROR`로 거절한다. ID, 서버 시각, 상태, 소유자와 완료 여부는 클라이언트 입력으로 받지 않는다.

## 예시 식별자

| 대상 | 예시 UUID |
| --- | --- |
| 퀘스트 | `11111111-1111-4111-8111-111111111111` |
| 공개 버전 | `22222222-2222-4222-8222-222222222222` |
| 1단계 | `33333333-3333-4333-8333-333333333333` |
| 2단계 | `44444444-4444-4444-8444-444444444444` |
| 3단계 | `55555555-5555-4555-8555-555555555555` |
| 진행 기록 | `66666666-6666-4666-8666-666666666666` |
| 신고 요청 | `77777777-7777-4777-8777-777777777777` |

## 공개 퀘스트 목록

```http
GET /api/v1/quests?area=seongsu&tags=craft%2Cfood&durationMax=120&limit=20 HTTP/1.1
Host: example.test
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: private, no-store
X-Request-Id: 01KAMELIST0000000000000000
```

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "titleJa": "ひとりで楽しむ聖水クラフト散歩",
      "summaryJa": "注文に使える韓国語カードを見ながら、三つの小さな体験を進めます。",
      "areaCode": "seongsu",
      "tags": ["craft", "food"],
      "durationMinutes": 90,
      "cost": {
        "status": "known",
        "currency": "KRW",
        "min": 12000,
        "max": 18000
      },
      "solo": {
        "status": "confirmed",
        "labelJa": "一人で利用できることを確認済み",
        "verifiedAt": "2026-11-20T07:00:00Z"
      },
      "isDemo": true,
      "matchReasons": [
        {
          "code": "AREA_MATCH",
          "labelJa": "選んだエリアにあります"
        },
        {
          "code": "TAG_MATCH",
          "labelJa": "クラフトとグルメの条件に合います"
        },
        {
          "code": "DURATION_MATCH",
          "labelJa": "120分以内で体験できます"
        }
      ]
    }
  ],
  "nextCursor": null
}
```

`cost.status`는 `known` 또는 `unknown`이다. `unknown`이면 `min`과 `max`는 `null`이며 화면에 비용 미확인으로 표시한다. `matchReasons`는 실제 필터·정렬 근거만 포함하고 자유 생성 문장을 사용하지 않는다.

결과가 없을 때도 200과 빈 배열을 반환한다.

```json
{
  "items": [],
  "nextCursor": null
}
```

## 공개 퀘스트 상세

```http
GET /api/v1/quests/11111111-1111-4111-8111-111111111111 HTTP/1.1
Host: example.test
Accept: application/json
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "versionId": "22222222-2222-4222-8222-222222222222",
  "titleJa": "ひとりで楽しむ聖水クラフト散歩",
  "titleKo": "혼자 즐기는 성수 크래프트 산책",
  "summaryJa": "注文に使える韓国語カードを見ながら、三つの小さな体験を進めます。",
  "summaryKo": "주문할 때 쓸 수 있는 한국어 카드를 보며 세 가지 작은 체험을 진행합니다.",
  "bodyJa": "これは屋内デモ用の仮想クエストです。実際の訪問体験ではありません。",
  "bodyKo": "실내 데모용 가상 퀘스트입니다. 실제 방문 체험이 아닙니다.",
  "areaCode": "seongsu",
  "tags": ["craft", "food"],
  "durationMinutes": 90,
  "cost": {
    "status": "known",
    "currency": "KRW",
    "min": 12000,
    "max": 18000
  },
  "solo": {
    "status": "confirmed",
    "evidenceJa": "運営者が一人で利用できる条件を確認しました。",
    "verifiedAt": "2026-11-20T07:00:00Z"
  },
  "isDemo": true,
  "stepOverview": [
    {
      "position": 1,
      "summaryJa": "最初の場所と利用条件を確認する",
      "summaryKo": "첫 장소와 이용 조건 확인하기"
    },
    {
      "position": 2,
      "summaryJa": "韓国語カードを見せて注文する",
      "summaryKo": "한국어 카드를 보여 주고 주문하기"
    },
    {
      "position": 3,
      "summaryJa": "最後の行動を確認して記録する",
      "summaryKo": "마지막 행동을 확인하고 기록하기"
    }
  ],
  "availability": "available",
  "unavailableReasonJa": null,
  "canStart": true,
  "ownRunId": null
}
```

`stepOverview`의 `summaryJa`·`summaryKo`는 각 단계의 `title_ja`·`title_ko`다. 정보 신고 화면은 이 응답의 `versionId`를 신고 대상 version으로 사용한다.

유효한 본인 run이 있으면 `ownRunId`를 반환한다. 진행 중이면 `canStart`는 false이고 화면은 이어하기를 표시한다. 완료된 run이면 상세에서 완료 기록 보기를 제공한다.

중지된 기존 공개본의 직접 링크 예시는 다음과 같다.

```json
{
  "availability": "paused",
  "unavailableReasonJa": "利用条件を再確認しています。",
  "canStart": false,
  "ownRunId": "66666666-6666-4666-8666-666666666666"
}
```

위 조각은 달라지는 필드만 나타낸다. 실제 응답에는 상세의 나머지 필드도 포함한다.

## 앱 내 도보 경로

클라이언트는 임의 좌표나 TMAP key를 보내지 않고 검수된 퀘스트 ID만 보낸다.

```http
POST /api/v1/routes/walking HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test

{"questId":"11111111-1111-4111-8111-111111111111"}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
X-Request-Id: 01KAMEWALKINGROUTE00000000
```

```json
{
  "route": {
    "distanceMeters": 313,
    "durationSeconds": 240,
    "path": [
      { "latitude": 37.54418, "longitude": 127.05632 },
      { "latitude": 37.5435, "longitude": 127.055 },
      { "latitude": 37.54292, "longitude": 127.05445 }
    ]
  },
  "source": "TMAP",
  "fetchedAt": "2026-11-21T09:00:00.000Z"
}
```

서버는 provider 응답 좌표를 서울 경계 안으로 검증하고 5분만 메모리 cache한다. browser와 service worker는 경로를 저장하지 않는다. key 누락·timeout·provider 오류·비정상 좌표는 내부 상세 없이 503 `SERVICE_UNAVAILABLE`로 반환한다.

## 익명 방문자 세션

세션은 시작 또는 신고 버튼을 누르고 기록 안내에 동의한 뒤 호출한다.

```http
POST /api/v1/visitor-sessions HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test

{}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
Set-Cookie: digiman_visitor=<opaque-token>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax
X-Request-Id: 01KAMESESSION0000000000000
```

```json
{
  "expiresAt": "2026-12-21T09:00:00Z",
  "noticeJa": "進行記録はこのブラウザに保存され、他の端末とは共有されません。"
}
```

유효한 쿠키로 다시 호출하면 새 방문자를 만들지 않고 200을 반환한다. 기존 `expiresAt`도 연장하지 않고 새 `Set-Cookie`를 보내지 않는다. 응답 본문이나 로그에 원문 토큰을 넣지 않는다. 생성·lookup·rotation·만료 상세는 [visitor session 수명주기 계약](VISITOR_SESSION_LIFECYCLE_v0.1.md)을 따른다.

## 퀘스트 시작

```http
POST /api/v1/quests/11111111-1111-4111-8111-111111111111/runs HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test
Cookie: digiman_visitor=<opaque-token>

{}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/runs/66666666-6666-4666-8666-666666666666
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "questId": "11111111-1111-4111-8111-111111111111",
  "questVersionId": "22222222-2222-4222-8222-222222222222",
  "status": "in_progress",
  "startedAt": "2026-11-21T09:02:00Z",
  "completedAt": null,
  "canContinue": true,
  "unavailableReasonJa": null,
  "nextStepId": "33333333-3333-4333-8333-333333333333",
  "completionPath": null
}
```

같은 방문자가 같은 퀘스트를 다시 시작하면 새 행을 만들지 않고 200과 같은 run을 반환한다. 두 탭의 동시 요청도 같은 ID를 받아야 한다.

## 진행 조회

```http
GET /api/v1/runs/66666666-6666-4666-8666-666666666666 HTTP/1.1
Host: example.test
Accept: application/json
Cookie: digiman_visitor=<opaque-token>
```

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "questId": "11111111-1111-4111-8111-111111111111",
  "questVersionId": "22222222-2222-4222-8222-222222222222",
  "titleJa": "ひとりで楽しむ聖水クラフト散歩",
  "isDemo": true,
  "status": "in_progress",
  "startedAt": "2026-11-21T09:02:00Z",
  "completedAt": null,
  "canContinue": true,
  "unavailableReasonJa": null,
  "nextStepId": "33333333-3333-4333-8333-333333333333",
  "steps": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "position": 1,
      "bodyJa": "住所を確認して、最初の場所へ向かいましょう。",
      "phrase": {
        "ko": "혼자 체험할 수 있나요?",
        "ja": "一人で体験できますか。"
      },
      "place": {
        "nameJa": "デモ体験場所",
        "addressKo": "서울특별시 성동구 예시로 1",
        "verifiedAt": "2026-11-20T07:00:00Z",
        "map": {
          "provider": "google",
          "href": "https://www.google.com/maps/search/?api=1&query=..."
        }
      },
      "completedAt": null
    },
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "position": 2,
      "bodyJa": "韓国語カードを見せて、注文してみましょう。",
      "phrase": {
        "ko": "이걸 하나 주세요.",
        "ja": "これを一つください。"
      },
      "place": null,
      "completedAt": null
    },
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "position": 3,
      "bodyJa": "最後の行動を確認して、クエストを完了しましょう。",
      "phrase": null,
      "place": null,
      "completedAt": null
    }
  ]
}
```

`place`는 run이 고정한 버전의 snapshot이다. 장소 원본 수정으로 기존 run 응답이 조용히 바뀌지 않는다. 지도 URL은 서버가 검증한 허용 도메인만 반환한다.

## 단계 완료

```http
PUT /api/v1/runs/66666666-6666-4666-8666-666666666666/steps/33333333-3333-4333-8333-333333333333 HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test
Cookie: digiman_visitor=<opaque-token>

{
  "completed": true
}
```

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "status": "in_progress",
  "completedAt": null,
  "canContinue": true,
  "unavailableReasonJa": null,
  "nextStepId": "44444444-4444-4444-8444-444444444444",
  "updatedStep": {
    "id": "33333333-3333-4333-8333-333333333333",
    "completedAt": "2026-11-21T09:10:00Z"
  },
  "completionPath": null
}
```

같은 단계를 다시 완료하면 200과 같은 `completedAt`을 반환한다. 응답이 유실된 클라이언트는 `GET /runs/:runId`로 현재 상태를 확인한 뒤 다음 행동을 결정한다.

선행 단계를 건너뛰면 다음과 같이 반환한다.

```http
HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

```json
{
  "error": {
    "code": "STEP_ORDER_CONFLICT",
    "messageJa": "前のステップを完了してから進んでください。",
    "requestId": "01KAMESTEPORDER0000000000",
    "retryable": false,
    "details": {
      "expectedStepId": "33333333-3333-4333-8333-333333333333"
    }
  }
}
```

마지막 단계를 완료하면 같은 트랜잭션에서 run도 완료한다.

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "status": "completed",
  "completedAt": "2026-11-21T09:30:00Z",
  "canContinue": false,
  "unavailableReasonJa": null,
  "nextStepId": null,
  "updatedStep": {
    "id": "55555555-5555-4555-8555-555555555555",
    "completedAt": "2026-11-21T09:30:00Z"
  },
  "completionPath": "/runs/66666666-6666-4666-8666-666666666666/completion"
}
```

## 완료 카드

```http
GET /api/v1/runs/66666666-6666-4666-8666-666666666666/completion HTTP/1.1
Host: example.test
Accept: application/json
Cookie: digiman_visitor=<opaque-token>
```

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "questId": "11111111-1111-4111-8111-111111111111",
  "questVersionId": "22222222-2222-4222-8222-222222222222",
  "titleJa": "ひとりで楽しむ聖水クラフト散歩",
  "isDemo": true,
  "status": "completed",
  "startedAt": "2026-11-21T09:02:00Z",
  "completedAt": "2026-11-21T09:30:00Z",
  "canContinue": false,
  "unavailableReasonJa": null,
  "nextStepId": null,
  "steps": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "position": 1,
      "bodyJa": "場所と利用条件を確認します。",
      "phrase": null,
      "place": null,
      "completedAt": "2026-11-21T09:10:00Z"
    }
  ]
}
```

미완료 run이면 409 `RUN_NOT_COMPLETED`, 타인의 run이거나 없는 ID면 모두 404 `NOT_FOUND`다.

## 나의 기록

```http
GET /api/v1/me/runs?status=in_progress&limit=20 HTTP/1.1
Host: example.test
Accept: application/json
Cookie: digiman_visitor=<opaque-token>
```

```json
{
  "items": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "questId": "11111111-1111-4111-8111-111111111111",
      "titleJa": "ひとりで楽しむ聖水クラフト散歩",
      "status": "in_progress",
      "startedAt": "2026-11-21T09:02:00Z",
      "completedAt": null,
      "nextStepPosition": 2,
      "completedStepCount": 1,
      "totalStepCount": 3,
      "isDemo": true
    }
  ],
  "nextCursor": null,
  "visitorExpiresAt": "2026-12-21T09:00:00Z"
}
```

`status`는 생략하거나 `in_progress`, `completed` 중 하나다. 만료된 세션은 빈 목록이 아니라 401 `SESSION_REQUIRED`를 반환한다.

## 피드백 저장

```http
PUT /api/v1/runs/66666666-6666-4666-8666-666666666666/feedback HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test
Cookie: digiman_visitor=<opaque-token>

{
  "joyScore": 4,
  "feltNewExperience": true,
  "visitExperience": "repeat_2_4",
  "comment": "次にすることが分かりやすかったです。"
}
```

```json
{
  "runId": "66666666-6666-4666-8666-666666666666",
  "joyScore": 4,
  "feltNewExperience": true,
  "visitExperience": "repeat_2_4",
  "comment": "次にすることが分かりやすかったです。",
  "updatedAt": "2026-11-21T09:32:00Z"
}
```

처음 저장과 갱신 모두 200을 사용한다. 서버는 run당 하나의 feedback을 upsert한다. `visitExperience`는 `first`, `repeat_2_4`, `repeat_5_plus`, `resident` 또는 null이다. `joyScore`가 1~5가 아니거나 `comment`가 500자를 넘으면 400이다.

## 정보 오류 신고

```http
POST /api/v1/quests/11111111-1111-4111-8111-111111111111/reports HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test
Cookie: digiman_visitor=<opaque-token>

{
  "versionId": "22222222-2222-4222-8222-222222222222",
  "category": "information",
  "comment": "表示されている住所を確認できませんでした。",
  "clientRequestId": "77777777-7777-4777-8777-777777777777"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

```json
{
  "id": "88888888-8888-4888-8888-888888888888",
  "questId": "11111111-1111-4111-8111-111111111111",
  "versionId": "22222222-2222-4222-8222-222222222222",
  "category": "information",
  "status": "new",
  "createdAt": "2026-11-21T09:35:00Z"
}
```

같은 방문자가 같은 `clientRequestId`와 같은 본문을 다시 보내면 200과 기존 신고를 반환한다. 같은 ID에 다른 category, comment, quest 또는 version을 보내면 409를 반환한다.

```json
{
  "error": {
    "code": "REQUEST_CONFLICT",
    "messageJa": "同じ送信IDで異なる内容を受け付けることはできません。",
    "requestId": "01KAMEREPORTCONFLICT000000",
    "retryable": false,
    "details": {}
  }
}
```

`REQUEST_CONFLICT`는 같은 멱등 키에 다른 요청 내용을 보낸 경우에만 사용한다. 운영 콘텐츠의 오래된 revision에는 `VERSION_CONFLICT`를 사용한다.

## 전체 개인 기록 삭제

```http
DELETE /api/v1/me/data HTTP/1.1
Host: example.test
Content-Type: application/json
Origin: https://example.test
Cookie: digiman_visitor=<opaque-token>

{}
```

```http
HTTP/1.1 204 No Content
Cache-Control: no-store
Set-Cookie: digiman_visitor=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax
```

204 응답에는 본문을 넣지 않는다. 삭제 트랜잭션이 실패하면 쿠키를 먼저 만료시키지 않고 재시도 가능한 503을 반환한다.

## 공통 오류 예시

### 세션 없음 또는 만료

```json
{
  "error": {
    "code": "SESSION_REQUIRED",
    "messageJa": "進行記録の有効期限が切れているか、このブラウザに記録がありません。",
    "requestId": "01KAMESESSIONREQUIRED00000",
    "retryable": false,
    "details": {}
  }
}
```

### 이용할 수 없는 퀘스트

```json
{
  "error": {
    "code": "QUEST_UNAVAILABLE",
    "messageJa": "このクエストは現在ご利用いただけません。",
    "requestId": "01KAMEUNAVAILABLE000000000",
    "retryable": false,
    "details": {
      "availability": "paused"
    }
  }
}
```

### 입력 오류

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "messageJa": "入力内容を確認してください。",
    "requestId": "01KAMEVALIDATION0000000000",
    "retryable": false,
    "details": {
      "fields": [
        {
          "path": "joyScore",
          "reason": "OUT_OF_RANGE"
        }
      ]
    }
  }
}
```

`details`는 공개 가능한 필드·상태만 포함한다. DB 제약 이름, SQL, stack, 토큰, 내부 운영 메모와 타인의 식별자는 포함하지 않는다.

### 일시 장애

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 2
Content-Type: application/json; charset=utf-8
```

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "messageJa": "一時的に処理できません。少し待ってからもう一度お試しください。",
    "requestId": "01KAMESERVICE0000000000000",
    "retryable": true,
    "details": {}
  }
}
```

화면은 `retryable`만 보고 무한 재시도하지 않는다. 변경 요청은 서버 상태를 다시 조회한 뒤 사용자가 재시도하게 한다.

## mock 사용 규칙

- 화면 mock은 이 문서의 필드 이름, null 가능성, 상태 코드를 그대로 사용한다.
- mock 전용 필드를 실제 계약처럼 추가하지 않는다.
- `available`, `paused`, `archived`, `in_progress`, `completed` 상태를 각각 fixture로 둔다.
- 오류 fixture에는 400, 401, 404, 409, 429, 503을 포함한다.
- 날짜와 UUID를 고정해 화면 snapshot과 E2E seed 결과를 재현 가능하게 한다.
- 실제 API 연결 시 mock과 실서버를 런타임 환경 변수로 전환하지 않는다. 테스트에서만 HTTP 경계를 대체한다.

필드나 code가 바뀌면 B2C 스펙, 이 예시, 화면 fixture와 서버 계약 테스트를 같은 기능 커밋에서 갱신한다.
