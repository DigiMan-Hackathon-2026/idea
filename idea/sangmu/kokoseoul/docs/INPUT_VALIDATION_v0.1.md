# 입력 검증·정규화 계약 v0.1

작성일: 2026-11-21 · 상태: 구현 전 검토 기준

이 문서는 B2C·운영 API가 JSON, query, UUID, 일본어·한국어 text, 숫자와 cursor를 어떤 순서로 검증·정규화하는지 정의한다. 목적은 같은 의미의 재요청을 같은 것으로 판단하고, 모호한 coercion·제어 문자·과도한 body가 DB와 화면에 도달하지 않게 하는 것이다.

## 검증 순서

모든 요청은 다음 순서를 사용한다.

1. method와 route 확인
2. 전체 request 크기 제한
3. mutation의 exact Origin 확인
4. Content-Type과 UTF-8 JSON parsing
5. object shape·unknown field 확인
6. scalar type·범위·문자 수 확인
7. Unicode·공백·optional 값 정규화
8. 인증·소유권·현재 상태 확인
9. idempotency·revision·transaction 실행

Origin과 body parsing의 상세 순서는 권한 존재 여부·허용 Origin 목록을 노출하지 않게 구현한다. 어느 단계에서도 raw body·header·parse error 원문을 log에 남기지 않는다.

## HTTP와 JSON

| 항목 | 계약 |
| --- | --- |
| JSON Content-Type | `application/json`, 선택적 `charset=utf-8`만 |
| Content-Encoding | P0는 없음 또는 `identity`만, 압축 body 거절 |
| encoding | 유효한 UTF-8 |
| top-level | endpoint schema가 요구한 object |
| unknown field | 400 `VALIDATION_ERROR` |
| missing과 null | schema에서 별도 정의, 자동 상호 변환 금지 |
| number | JSON number, finite, 정수 field는 소수·문자열 거절 |
| boolean | JSON boolean만, `0`, `1`, 문자열 coercion 금지 |
| empty body | body가 없는 GET만; mutation의 빈 object도 `{}` 필요 |
| trailing data | JSON 뒤 공백 외 byte가 있으면 거절 |

JSON parser가 duplicate object key의 마지막 값만 반환할 수 있으므로 idempotency hash를 raw JSON 문자열에서 만들지 않는다. parsing 뒤 strict schema를 통과한 정규 object에서 canonical representation을 만든다.

method가 지원되지 않으면 `Allow` header와 405를 반환한다. body를 받지 않는 GET·DELETE에 예상하지 않은 JSON field가 있으면 무시하지 않는다.

## body 크기

크기는 decompress 뒤 UTF-8 byte 기준이며 proxy·framework와 application 검사를 함께 둔다.

| endpoint 범위 | 최대 후보 | 이유 |
| --- | ---: | --- |
| visitor session·run 시작·step 완료·전체 삭제 | 2 KiB | empty 또는 작은 boolean object |
| feedback·report | 8 KiB | 500자 자유 입력과 envelope |
| admin 상태 변경·report 처리 | 16 KiB | reason·internal note·review flags |
| admin draft 전체 저장 | 128 KiB | 3~5단계·place snapshot·일본어 본문 |

최종 framework overhead를 측정해 이 값보다 낮출 수 있지만 문서 없이 높이지 않는다. P0는 제한 초과 body를 전부 log하거나 parse하지 않고 400 `VALIDATION_ERROR`와 고정 reason `BODY_TOO_LARGE`로 처리한다. 413으로 바꾸려면 API 공통 상태·화면·테스트를 함께 변경한다.

## Unicode 정규화

### 공통

- 유효한 Unicode scalar만 허용한다.
- NFC로 정규화한다.
- CRLF와 CR은 허용된 multiline field에서 LF로 통일한다.
- null byte, ASCII control, bidi override·isolate control을 거절한다.
- tab은 모든 text field에서 거절한다.
- emoji·variation selector·일본어 결합 문자를 임의로 제거하지 않는다.

P0의 일본어·한국어 UI에는 bidi 제어 문자가 필요하지 않다. RTL 언어 지원을 추가할 때는 전체 제어 문자를 허용하는 대신 안전한 렌더링 정책을 별도로 설계한다.

### field 종류

| 종류 | 외부 공백 | 줄바꿈 | 저장 |
| --- | --- | --- | --- |
| code·enum·UUID | 외부 공백 불허 | 불허 | canonical form |
| title·label·주소 | trim | 불허 | NFC·trim |
| summary·body·step | trim | field가 허용하면 LF | NFC·LF·trim |
| feedback·report comment | trim | LF 허용 | NFC·LF·trim, empty면 null |
| internalNote | trim | LF 허용 | NFC·LF·trim, empty면 null |
| 한국어 phrase | trim | 불허 | NFC·trim |

사용자 자유 입력을 escape된 HTML로 저장하지 않는다. plain text로 저장하고 React text rendering에서 escaping한다.

## 길이 계산

API의 “자” 제한은 Unicode code point 수를 기준으로 하고 UTF-8 byte 상한을 함께 둔다.

| field | code point 상한 | UTF-8 byte 상한 후보 |
| --- | ---: | ---: |
| feedback·report comment | 500 | 2,000 |
| pause reason | 300 | 1,200 |
| quest title | 120 | 480 |
| summary | 500 | 2,000 |
| body·step body | 3,000 | 12,000 |
| internalNote | 2,000 | 8,000 |
| address | 300 | 1,200 |

grapheme cluster는 화면 카운터의 사용자 친화적 표시로 사용할 수 있지만 서버 상한의 유일 기준으로 삼지 않는다. client와 server가 다른 길이를 보여 주면 server 기준과 남은 입력을 명확히 안내한다.

## UUID와 식별자

- path ID와 body ID는 hyphen이 있는 canonical UUID 형식을 사용한다.
- server가 생성하는 domain ID는 한 version으로 고정하고 migration 전에 기록한다.
- `clientRequestId`는 client가 생성한 UUID v4만 허용하고 canonical lowercase로 저장한다.
- UUID가 추측하기 어렵다는 사실은 소유권 검사를 대신하지 않는다.
- 잘못된 UUID는 대상 조회 전에 400, 올바른 UUID지만 타인 소유면 404다.
- client가 visitorId, adminId, supplierOrgId, status, timestamp를 보내면 unknown/server field 오류다.

대소문자를 정규화해도 idempotency key 원문을 log에 남기지 않는다.

## query parameter

| parameter | 규칙 |
| --- | --- |
| `area` | 허용 code 하나, lowercase canonical 값 |
| `tags` | percent decode 한 번, comma 구분, 1~5개, 중복 거절 또는 제거 정책 고정 |
| `durationMax` | 15~240 정수, 문자열 숫자 parsing 뒤 canonical decimal만 허용 |
| `status` | endpoint별 enum 하나 |
| `limit` | 기본 20, 1~50 canonical 정수 |
| `cursor` | versioned opaque token, 길이 상한 |

같은 query key 반복, 빈 값과 알 수 없는 query는 400이다. `+`, percent encoding과 Unicode normalization을 framework가 어떻게 처리하는지 통합 테스트한다. 한 번 decode한 값을 다시 decode하지 않는다.

tags 순서는 필터 의미에 영향이 없으므로 unique canonical code로 정렬해 filter fingerprint를 만든다. 응답의 사용자 선택 표시 순서가 필요하면 URL의 검증된 순서를 별도로 유지하되 cursor 검증에는 canonical 순서를 사용한다.

## cursor

cursor는 사용자가 구조를 의존하지 않는 versioned opaque token이다.

최소 payload:

- version
- route 종류
- canonical filter fingerprint
- 마지막 sort key와 UUID
- 발급 시각 또는 schema epoch가 필요하면 제한된 값

payload는 길이 상한이 있는 base64url 등 transport-safe 형식과 server 검증을 사용한다. 변조·다른 filter·다른 endpoint cursor는 400이다. cursor에 visitor ID, session, 자유 입력과 secret을 넣지 않는다.

서명 방식을 채택하면 전용 secret과 교체 version을 사용하고 Auth·session secret을 재사용하지 않는다. 단순 server-side cursor store를 선택하면 보존·cleanup·장애 fallback을 결정한다. 구현 선택 전까지 cursor는 외부 client가 해석하거나 조립할 수 있다고 약속하지 않는다.

## canonical idempotency 비교

### report 생성

같은 `(visitorId, clientRequestId)`의 기존 row를 찾으면 다음 canonical object를 비교한다.

```json
{
  "questId": "canonical-lowercase-uuid",
  "versionId": "canonical-lowercase-uuid",
  "category": "allowed-enum",
  "comment": "NFC-LF-trimmed-text-or-null"
}
```

key 순서는 canonical serialization에서 고정한다. omitted comment와 null·trim 후 empty는 모두 null로 정규화한다. 하나라도 다르면 409 `REQUEST_CONFLICT`이며 새 ID로 자동 재전송하지 않는다.

### admin quest 생성

같은 `(adminId, clientRequestId)`에 대해 validated normalized create body를 비교한다. 현재 body는 key 외의 field가 없지만 이후 field가 추가돼도 raw JSON byte 비교를 사용하지 않는다.

### step·run

run과 step은 client key가 아니라 DB의 semantic unique key를 사용한다. 같은 step의 `completed: true` 재전송은 기존 completedAt을 반환한다. false·null·추가 field는 400이다.

## 숫자·금액·시각

- duration, cost, position, score는 정수만 허용한다.
- `NaN`, infinity, 지수 표기와 숫자 문자열을 받아 자동 변환하지 않는다.
- KRW는 P0에서 정수이며 음수 금지, min ≤ max다.
- min·max는 둘 다 값이거나 둘 다 null이다.
- server timestamp는 client 입력으로 받지 않고 DB UTC 시각을 사용한다.
- 화면의 Asia/Seoul·일본어 표시는 serialization 뒤 presentation 책임이다.

client가 보낸 local 시각을 run 완료·보존·idempotency 기준으로 사용하지 않는다.

## URL과 외부 링크 입력

P0 운영 입력은 임의 지도 URL을 받지 않고 검수한 place data에서 server가 Google Maps URL을 조립한다.

- HTTPS와 정확한 host·path action allowlist
- `api=1` 필수
- query는 표준 encoder 한 번
- `javascript:`, protocol-relative URL, userinfo, fragment 거절
- server가 destination을 fetch하지 않음
- 주소·좌표 검증 실패 시 link 생성 거절, 주소 text는 검수 상태에 따라 처리

asset URL을 추가할 때도 scheme·host·path·content type과 권리 register를 함께 검증한다.

## 오류 details

400 response의 details는 공개 가능한 field path와 고정 reason만 포함한다.

```json
{
  "fields": [
    {
      "path": "comment",
      "reason": "TOO_LONG"
    }
  ]
}
```

입력 원문, 정규화 전 값, regex, schema 내부 이름, SQL·constraint와 stack을 반환하지 않는다. password·token field가 후속 추가돼도 “값이 잘못됨”을 echo하지 않는다.

## 검수 matrix

- [ ] wrong·missing Content-Type, malformed UTF-8·JSON, trailing data
- [ ] unknown field와 server 결정 field
- [ ] null·missing·empty·whitespace-only 차이
- [ ] NFC/NFD 일본어·한국어가 canonical 비교에서 같음
- [ ] CRLF·LF comment가 같은 idempotency request로 판단됨
- [ ] bidi·null·control char가 거절됨
- [ ] emoji·결합 문자가 손상되지 않음
- [ ] code point·UTF-8 byte 경계 바로 아래·위
- [ ] UUID 대소문자·version·형식과 타인 소유 404 구분
- [ ] repeated·unknown query, double encoding, tags 중복·최대값
- [ ] 다른 filter·endpoint·변조 cursor 거절
- [ ] body size 경계와 proxy·application 결과 일치
- [ ] report same key same canonical body 200, 다른 body 409
- [ ] 오류·log에 원문 canary가 없음

## 변경 규칙

정규화 방식은 저장 값과 idempotency 의미를 바꿀 수 있다. 구현 후 NFC·trim·empty 정책을 바꾸면 기존 row 비교, unique key, migration과 client retry 호환성을 검토한다. 단순 validator refactor로 처리하지 않는다.

연결 검수: AC02~AC05, AC10~AC16
