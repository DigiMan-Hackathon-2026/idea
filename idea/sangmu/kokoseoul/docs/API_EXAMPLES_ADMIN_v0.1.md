# 운영 API 요청과 응답 예시 v0.1

작성일: 2026-11-21 · 상태: 구현 계약 예시

내부 운영자가 퀘스트를 초안으로 만들고, 검수·공개·중지·재개·보관하며 정보 오류 신고를 처리하는 API 계약이다. [B2C 설계 스펙](B2C_SPEC_v0.1.md)의 권한·버전·감사 규칙을 실제 JSON으로 구체화한다.

예시 ID와 시각은 가상 값이다. 운영 API 기본 경로는 `/api/v1/admin`이며 모든 응답은 `Cache-Control: no-store`를 사용한다.

## 인증과 공통 헤더

운영 API는 Auth.js Google OIDC 로그인만으로 허용되지 않는다. Google issuer와 subject가 활성 `admin_principals`에 등록돼 있어야 한다.

```text
Cookie: digiman_admin=<server-session-token>
Origin: https://admin.example.test
Content-Type: application/json
```

변경 요청은 허용된 동일 출처 `Origin`을 검사한다. 방문자 쿠키, 만료된 운영 세션, 허용 목록에 없는 로그인은 운영 권한으로 인정하지 않는다.

운영 응답은 다음 공통 헤더를 포함한다.

```text
Cache-Control: no-store
Vary: Cookie
X-Request-Id: 01KAMEADMINEXAMPLE000000000
```

## 예시 식별자

| 대상 | 예시 UUID |
| --- | --- |
| 퀘스트 | `11111111-1111-4111-8111-111111111111` |
| draft 버전 | `22222222-2222-4222-8222-222222222222` |
| 공개 버전 | `33333333-3333-4333-8333-333333333333` |
| 장소 | `44444444-4444-4444-8444-444444444444` |
| 신고 | `55555555-5555-4555-8555-555555555555` |
| 퀘스트 생성 요청 | `66666666-6666-4666-8666-666666666666` |

## 퀘스트 목록

```http
GET /api/v1/admin/quests?status=draft&limit=20 HTTP/1.1
Host: admin.example.test
Accept: application/json
Cookie: digiman_admin=<server-session-token>
```

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "status": "draft",
      "revision": 1,
      "draftVersionId": "22222222-2222-4222-8222-222222222222",
      "publishedVersionId": null,
      "titleJa": "聖水で一人クラフト体験",
      "updatedAt": "2026-11-21T10:00:00Z",
      "reportCounts": {
        "new": 0,
        "inProgress": 0
      }
    }
  ],
  "nextCursor": null
}
```

`status`는 `draft`, `published`, `paused`, `archived` 중 하나다. status 필터를 생략하면 모든 상태를 반환한다.

## 초안 생성

```http
POST /api/v1/admin/quests HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>

{
  "clientRequestId": "66666666-6666-4666-8666-666666666666"
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/admin/quests/11111111-1111-4111-8111-111111111111
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "draft",
  "revision": 1,
  "draft": {
    "id": "22222222-2222-4222-8222-222222222222",
    "versionNo": 1,
    "state": "draft"
  },
  "published": null,
  "createdAt": "2026-11-21T10:00:00Z",
  "updatedAt": "2026-11-21T10:00:00Z"
}
```

내부 공급자 ID와 작성 운영자 ID는 서버가 결정한다. 클라이언트가 `supplierOrgId`, `status`, `reviewedBy`를 보내면 입력 오류다.

같은 운영자가 같은 `clientRequestId`로 다시 요청하면 200과 기존 quest를 반환한다. 응답 유실 뒤 새 UUID로 자동 재시도하지 않는다. 다른 운영자는 같은 UUID를 사용할 수 있지만 클라이언트는 충돌 가능성을 피하도록 매 생성 행동마다 새 UUID를 만든다.

## 운영 상세 조회

```http
GET /api/v1/admin/quests/11111111-1111-4111-8111-111111111111 HTTP/1.1
Host: admin.example.test
Accept: application/json
Cookie: digiman_admin=<server-session-token>
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "draft",
  "revision": 1,
  "pauseReasonJa": null,
  "draft": {
    "id": "22222222-2222-4222-8222-222222222222",
    "versionNo": 1,
    "state": "draft",
    "titleJa": "",
    "summaryJa": "",
    "bodyJa": "",
    "areaCode": "",
    "tags": [],
    "durationMinutes": null,
    "cost": {
      "status": "unknown",
      "currency": "KRW",
      "min": null,
      "max": null
    },
    "solo": {
      "status": "unknown",
      "evidence": ""
    },
    "verifiedAt": null,
    "isDemo": null,
    "steps": [],
    "review": {
      "reviewedBy": null,
      "reviewedAt": null
    }
  },
  "published": null,
  "updatedAt": "2026-11-21T10:00:00Z"
}
```

## 초안 전체 저장

초안 저장은 부분 갱신이 아니라 현재 편집본 전체를 보낸다. 화면은 조회한 `revision`을 `expectedRevision`으로 전달한다.

```http
PUT /api/v1/admin/quests/11111111-1111-4111-8111-111111111111/draft HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>
```

```json
{
  "expectedRevision": 1,
  "titleJa": "聖水で一人クラフト体験",
  "summaryJa": "韓国語カードを使いながら、三つの行動を体験します。",
  "bodyJa": "これは審査用の仮想デモです。実際の訪問案内ではありません。",
  "areaCode": "seongsu",
  "tags": ["craft"],
  "durationMinutes": 60,
  "cost": {
    "status": "known",
    "currency": "KRW",
    "min": 10000,
    "max": 15000
  },
  "solo": {
    "status": "confirmed",
    "evidence": "운영자가 데모 조건을 확인함"
  },
  "verifiedAt": "2026-11-20T07:00:00Z",
  "isDemo": true,
  "steps": [
    {
      "position": 1,
      "bodyJa": "最初の案内を確認しましょう。",
      "phraseKo": null,
      "phraseJa": null,
      "place": null
    },
    {
      "position": 2,
      "bodyJa": "韓国語カードを見せてみましょう。",
      "phraseKo": "혼자 체험할 수 있나요?",
      "phraseJa": "一人で体験できますか。",
      "place": {
        "id": "44444444-4444-4444-8444-444444444444",
        "addressKo": "서울특별시 성동구 예시로 1",
        "lat": 37.5445,
        "lng": 127.0561,
        "sourceRef": "operator-demo-check",
        "verifiedAt": "2026-11-20T07:00:00Z"
      }
    },
    {
      "position": 3,
      "bodyJa": "最後の行動を確認しましょう。",
      "phraseKo": null,
      "phraseJa": null,
      "place": null
    }
  ]
}
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "draft",
  "revision": 2,
  "draftVersionId": "22222222-2222-4222-8222-222222222222",
  "updatedAt": "2026-11-21T10:10:00Z"
}
```

서버는 단계 ID와 place snapshot을 생성한다. 공개된 버전을 수정할 때는 기존 버전을 바꾸지 않고 다음 version 번호의 draft를 만든다.

## 공개

공개 요청은 운영자가 일본어와 사실 정보를 확인했다는 체크를 명시한다. 체크 값만 믿지 않고 서버가 필수 필드를 다시 검사한다.

```http
POST /api/v1/admin/quests/11111111-1111-4111-8111-111111111111/publish HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>
```

```json
{
  "expectedRevision": 2,
  "review": {
    "japaneseChecked": true,
    "factsChecked": true,
    "mapLinksChecked": true,
    "rightsChecked": true,
    "demoLabelChecked": true
  }
}
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "published",
  "revision": 3,
  "publishedVersionId": "22222222-2222-4222-8222-222222222222",
  "publishedAt": "2026-11-21T10:20:00Z",
  "reviewedAt": "2026-11-21T10:20:00Z"
}
```

공개 시 draft 버전의 state가 `published`로 확정되고 이후 내용은 불변이다. 다음 편집은 새 draft 버전을 만든다.

필수 항목이 빠지면 공개하지 않고 누락 항목을 반환한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "messageJa": "公開に必要な情報を確認してください。",
    "requestId": "01KAMEPUBLISHVALIDATION0000",
    "retryable": false,
    "details": {
      "fields": [
        {
          "path": "steps[1].place.verifiedAt",
          "reason": "REQUIRED_FOR_PUBLICATION"
        },
        {
          "path": "review.rightsChecked",
          "reason": "MUST_BE_CONFIRMED"
        }
      ]
    }
  }
}
```

## 중지와 재개

```http
POST /api/v1/admin/quests/11111111-1111-4111-8111-111111111111/pause HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>

{
  "expectedRevision": 3,
  "reasonJa": "利用条件を再確認しています。"
}
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "paused",
  "revision": 4,
  "pauseReasonJa": "利用条件を再確認しています。",
  "publishedVersionId": "22222222-2222-4222-8222-222222222222",
  "updatedAt": "2026-11-21T10:30:00Z"
}
```

중지 사유는 사용자에게 공개 가능한 일본어여야 한다. 중지해도 기존 공개 버전과 완료 기록을 삭제하지 않는다.

내용 변경 없이 같은 공개본을 재개한다.

```http
POST /api/v1/admin/quests/11111111-1111-4111-8111-111111111111/resume HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>

{
  "expectedRevision": 4
}
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "published",
  "revision": 5,
  "pauseReasonJa": null,
  "publishedVersionId": "22222222-2222-4222-8222-222222222222",
  "updatedAt": "2026-11-21T10:40:00Z"
}
```

## 보관

```http
POST /api/v1/admin/quests/11111111-1111-4111-8111-111111111111/archive HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>

{
  "expectedRevision": 5
}
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "archived",
  "revision": 6,
  "archivedAt": "2026-11-21T10:50:00Z"
}
```

archived는 종료 상태다. 초안 저장, 공개, 중지, 재개를 허용하지 않는다. 같은 내용을 다시 제공하려면 새 퀘스트를 만든다.

## revision 충돌

다른 운영자가 먼저 저장해 현재 revision이 3인데 클라이언트가 2를 보내면 변경하지 않고 409를 반환한다.

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "messageJa": "内容が更新されています。最新の内容を読み込み直してください。",
    "requestId": "01KAMEVERSIONCONFLICT00000",
    "retryable": false,
    "details": {
      "currentRevision": 3
    }
  }
}
```

화면은 최신 내용을 자동으로 덮어쓰거나 두 본문을 임의 병합하지 않는다. 다시 불러온 뒤 운영자가 변경 내용을 확인하게 한다.

## 신고 목록

```http
GET /api/v1/admin/reports?status=new&limit=20 HTTP/1.1
Host: admin.example.test
Accept: application/json
Cookie: digiman_admin=<server-session-token>
```

```json
{
  "items": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "questId": "11111111-1111-4111-8111-111111111111",
      "versionId": "22222222-2222-4222-8222-222222222222",
      "questTitleJa": "聖水で一人クラフト体験",
      "category": "information",
      "comment": "表示されている住所を確認できませんでした。",
      "status": "new",
      "revision": 1,
      "createdAt": "2026-11-21T09:35:00Z",
      "updatedAt": "2026-11-21T09:35:00Z"
    }
  ],
  "nextCursor": null
}
```

신고 응답에는 visitor ID, 세션 ID, 토큰과 다른 개인 기록을 포함하지 않는다.

## 신고 처리

```http
PATCH /api/v1/admin/reports/55555555-5555-4555-8555-555555555555 HTTP/1.1
Host: admin.example.test
Content-Type: application/json
Origin: https://admin.example.test
Cookie: digiman_admin=<server-session-token>

{
  "expectedRevision": 1,
  "status": "in_progress",
  "internalNote": "주소와 지도 대상을 다시 확인한다."
}
```

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "status": "in_progress",
  "revision": 2,
  "internalNote": "주소와 지도 대상을 다시 확인한다.",
  "updatedAt": "2026-11-21T11:00:00Z"
}
```

신고 상태는 `new`, `in_progress`, `resolved`다. 허용 전이는 new에서 in_progress·resolved, in_progress에서 resolved, resolved에서 재확인용 in_progress다. new로 되돌리거나 같은 상태·같은 메모의 빈 PATCH는 허용하지 않는다. 내부 메모는 사용자 API와 공개 퀘스트 응답에 포함하지 않는다. 상태·메모 변경은 expectedRevision을 검사하고 감사 로그와 같은 트랜잭션에서 저장한다. 다른 운영자가 먼저 처리했으면 409 `VERSION_CONFLICT`와 현재 revision을 반환하며 자동 덮어쓰지 않는다.

위험도 분류, quest 우선 pause와 사실 확인·새 version·resume 절차는 [정보 오류 신고 처리 런북](REPORT_TRIAGE_v0.1.md)을 따른다.

## 권한 오류

운영 세션이 없으면 401, 로그인했지만 활성 운영 principal이 없으면 403을 반환한다. 운영 대상의 존재 여부가 권한 없는 사용자에게 드러나지 않게 한다.

```json
{
  "error": {
    "code": "ADMIN_FORBIDDEN",
    "messageJa": "この操作を行う権限がありません。",
    "requestId": "01KAMEADMINFORBIDDEN000000",
    "retryable": false,
    "details": {}
  }
}
```

운영 화면 기본 언어는 한국어이지만 API 오류의 공통 형태를 유지한다. 구현 시 운영 화면의 한국어 오류 매핑을 별도로 두며 서버 내부 정보를 응답에 넣지 않는다.

## 감사 로그

초안 저장, 공개, 중지, 재개, 보관, 신고 상태 변경은 다음 정보를 서버에서 기록한다.

```json
{
  "adminId": "99999999-9999-4999-8999-999999999999",
  "action": "quest.paused",
  "entityId": "11111111-1111-4111-8111-111111111111",
  "beforeSummary": {
    "status": "published",
    "revision": 3
  },
  "afterSummary": {
    "status": "paused",
    "revision": 4
  },
  "createdAt": "2026-11-21T10:30:00Z"
}
```

감사 로그 예시는 내부 저장 형태이며 공개 API 응답이 아니다. 세션 토큰, 자유 입력 원문 전체와 민감정보를 before·after summary에 복제하지 않는다.

## 화면 mock과 계약 테스트

- draft, published, paused, archived fixture를 각각 둔다.
- draft가 없는 공개본, 공개본과 다음 draft가 함께 있는 상태를 포함한다.
- 401, 403, 404, revision 409, 공개 검증 400을 포함한다.
- 변경 응답을 잃었을 때 같은 요청을 무조건 반복하지 않고 상세를 다시 조회한다.
- 운영 화면은 응답의 revision을 다음 변경 요청에 사용한다.
- 테스트는 상태 변경과 감사 로그가 같은 트랜잭션인지 확인한다.

필드나 상태를 바꾸면 B2C 스펙, 이 예시, 운영 화면 fixture와 서버 계약 테스트를 같은 기능 커밋에서 갱신한다.
