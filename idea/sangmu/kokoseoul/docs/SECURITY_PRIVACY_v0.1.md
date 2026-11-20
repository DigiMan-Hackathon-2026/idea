# 보안과 개인정보 위협 모델 v0.1

작성일: 2026-11-21 · 상태: 구현 전 검토 기준

DigiMan P0는 실명 계정과 결제를 다루지 않지만 익명 진행 기록, 자유 입력, 운영자 권한과 공개 콘텐츠를 처리한다. 이 문서는 현재 범위의 자산·신뢰 경계·주요 위협과 필수 통제를 정의한다. 예약·결제·업체 계정이 추가되면 별도 위협 모델을 작성한다.

## 보호 대상

| 자산 | 실패 영향 |
| --- | --- |
| 방문자 session token | 타인이 진행·완료·피드백·삭제 권한 획득 |
| 운영자 session과 OIDC identity | 콘텐츠 변조·중지·신고 원문 노출 |
| run·feedback·report | 개인 행동 기록 노출 또는 변조 |
| 공개 quest version | 잘못된 주소·행동 안내로 사용자 피해 |
| audit log | 운영 변경 추적 불가 또는 허위 기록 |
| DB·OIDC·배포 secret | 전체 서비스·데이터 접근 가능 |
| backup | 삭제·만료 데이터 재노출 |

## 신뢰 경계

```text
사용자 브라우저
  ├─ 공개 화면 ───────┐
  ├─ 방문자 cookie ──┼─ 동일 출처 Next.js 서버 ─ PostgreSQL
  └─ 운영자 cookie ──┘          │
                                ├─ Google OIDC
                                ├─ Google Maps URL
                                └─ 오류·성능 모니터링
```

브라우저 입력, cookie, URL parameter, 외부 OIDC claim과 운영자가 입력한 콘텐츠도 검증 전에는 신뢰하지 않는다. 지도 URL은 서버가 허용한 형식으로 생성하며 사용자가 넣은 URL을 서버가 대신 가져오지 않는다.

## 수집 최소화

P0에서 수집하지 않는다.

- 실명, 이메일, 전화번호, 생년월일
- 여권·외국인등록번호
- 원시 GPS와 지속 위치
- 기기 fingerprint와 광고 식별자
- 결제 정보
- 사용자 사진·영상·음성

운영자 OIDC 계정의 이메일·표시 이름은 인증 UI에 필요할 수 있으나 권한 키는 issuer와 subject다. 방문자 행동 기록은 브라우저 전용 익명 visitor ID에 연결하고 30일 정책안을 적용한다.

## 방문자 세션

### 필수 통제

- token은 CSPRNG로 최소 32바이트 생성한다.
- 원문은 `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookie에만 둔다.
- DB에는 version과 keyed hash만 저장하고 pepper는 secret store에 둔다.
- token을 URL, response body, analytics, error message에 넣지 않는다.
- session fixation을 막기 위해 클라이언트가 보낸 token 값을 신규 session ID로 채택하지 않는다.
- 생성 후 30일을 고정하고 일반 사용으로 만료를 연장하지 않는다.
- 만료 여부는 요청마다 검사해 cleanup 지연과 무관하게 접근을 차단한다.
- 전체 삭제가 commit된 뒤 cookie를 만료한다.

cookie 탈취에 대비한 기기 복구·강제 로그아웃은 P0에 없으므로 민감정보를 수집하지 않고 보존 기간을 제한한다. 이 제한을 사용자 안내에 명시한다.

## 운영자 인증과 권한

- Auth.js가 검증한 Google OIDC callback만 사용한다.
- production callback URL과 secret을 preview·local과 공유하지 않는다.
- 로그인 성공 후 issuer·subject가 active `admin_principals`에 있는지 매 운영 요청에서 확인한다.
- 이메일 domain만으로 운영 권한을 부여하지 않는다.
- 운영 cookie와 방문자 cookie의 이름·저장·검증 함수를 분리한다.
- 운영 session은 DB에서 폐기 가능해야 하며 disabled principal은 즉시 거절한다.
- 권한 없는 운영 대상 조회는 내부 데이터와 존재 여부를 노출하지 않는다.
- 공개 환경에 우회 로그인, 공용 비밀번호, secret query parameter를 두지 않는다.

초기 `editor`와 `admin` 역할 차이가 없다면 하나의 최소 역할로 시작한다. 사용하지 않는 넓은 역할을 미리 만들지 않는다.

## 변경 요청 보호

SameSite cookie만으로 CSRF 방어를 끝내지 않는다.

- POST·PUT·PATCH·DELETE는 허용된 정확한 Origin을 검사한다.
- content type을 `application/json`으로 제한한다.
- GET은 상태를 변경하지 않는다.
- 운영 로그인 endpoint는 Auth.js의 state·PKCE·CSRF 통제를 유지한다.
- CORS wildcard와 credential 조합을 사용하지 않는다.
- reverse proxy 환경에서 신뢰할 host·proto header 범위를 설정한다.

Origin 없음이 정상인 자동화·모바일 client는 P0에 없으므로 mutation에서 Origin 누락을 허용하지 않는다. 테스트 도구도 명시적 Origin을 보낸다.

## 소유권과 객체 접근

- run·completion·feedback은 session에서 찾은 visitor ID로 조회한다.
- URL의 run ID만으로 소유권을 판단하지 않는다.
- quest ID와 version ID의 소속 관계를 서버와 DB가 확인한다.
- 타인의 객체와 없는 객체는 같은 404 shape를 사용한다.
- 운영 supplier ID, visitor ID, 상태, 완료 시각은 client 입력으로 받지 않는다.
- 공개 응답 serializer와 운영 응답 serializer를 분리한다.

ID가 UUID라 추측하기 어렵다는 사실은 권한 검사를 대신하지 않는다.

## 입력과 출력

### 입력

- JSON body 크기 제한을 endpoint별로 적용한다.
- unknown field를 거절한다.
- 문자열 길이, trim 후 빈 값, enum, UUID, 숫자 범위를 검사한다.
- Unicode normalization 필요 여부를 멱등 비교 전에 정한다.
- tags, 단계 수, cursor와 page size 상한을 둔다.
- SQL은 Drizzle parameter binding을 사용하고 raw SQL에 사용자 문자열을 결합하지 않는다.

### 출력

- React 기본 escaping을 유지하고 임의 HTML 렌더링을 사용하지 않는다.
- markdown·rich text는 P0에 넣지 않는다.
- 일본어·한국어 콘텐츠도 운영자 입력이므로 code로 실행하지 않는다.
- 오류 응답에 stack, SQL, constraint 이름, 내부 파일 경로를 넣지 않는다.
- 운영 메모·reviewer·token hash를 공개 serializer에 포함하지 않는다.

Content Security Policy는 실제 외부 이미지·font·analytics 목록을 정한 뒤 최소 allowlist로 구성한다. `unsafe-inline`을 편의상 넓게 허용하지 않는다.

## 외부 URL과 SSRF

- 지도 URL은 `https://www.google.com/maps/`의 정해진 action과 parameter로 서버가 조립한다.
- `api=1`과 URL encoding을 검증한다.
- 운영자가 등록한 임의 URL을 서버가 fetch·preview하지 않는다.
- 외부 링크는 HTTPS allowlist를 적용한다.
- 새 창 링크에는 opener 제어를 적용한다.
- redirect endpoint를 만들 경우 외부 destination을 그대로 받지 않는다.

이미지는 검수된 정적 asset 또는 정해진 storage origin만 사용한다. SVG 업로드와 사용자 업로드는 P0에서 제외한다.

## 멱등성과 경쟁 상태

- UI button 비활성화는 보조 통제다.
- 중복 시작·단계·feedback·report는 DB unique와 transaction으로 보장한다.
- 같은 report key의 다른 body는 `REQUEST_CONFLICT`다.
- expected revision 없는 운영 mutation은 거절한다.
- 시작·중지, 마지막 완료, 공개 상태 전이는 잠금 순서를 고정한다.
- serialization·deadlock 재시도는 제한하고 무한 재시도하지 않는다.

세부 DB 통제는 [PostgreSQL 데이터 정합성 계약](DATA_CONSTRAINTS_v0.1.md)을 따른다.

## 속도 제한과 남용

초기 정책안:

| endpoint 범위 | 제한 |
| --- | --- |
| visitor session 생성 | IP당 10회/분 |
| 방문자 mutation | session당 60회/분 |
| report | session당 5회/시간 |
| 운영 로그인 | Auth provider·애플리케이션 제한 |

IP는 보안 로그에 최소 기간만 보관하고 분석 profile에 결합하지 않는다. 공유 Wi-Fi에서 정상 사용자를 막는지 시연 환경에서 확인한다. 제한 응답은 429와 `Retry-After`를 제공하며 내부 threshold를 노출하지 않는다.

report 자유 입력은 HTML로 렌더링하지 않고 운영 화면에서도 text로 표시한다. 반복 신고, 과도한 입력과 자동 요청을 모니터링하되 방문자 fingerprint를 새로 수집하지 않는다.

## 로그와 모니터링

구조화 필드 allowlist, metric label, canary와 보존 검수는 [로그·지표·오류 관측 계약](OBSERVABILITY_CONTRACT_v0.1.md)을 따른다.

### 기록 가능

- request ID, route template, status, latency
- DB connection·timeout·lock wait 범주
- quest·run ID 같은 서버 객체 ID를 필요한 범위에서 제한적으로 기록
- 오류 code와 environment
- 운영 action과 제한된 before·after summary

### 기록 금지

- cookie와 Authorization header
- session 원문·hash·OIDC token
- feedback·report·운영 메모 원문
- 전체 한국어 주소와 원시 좌표
- 이름·이메일·연락처
- DB connection string과 secret

로그 formatter 단계에서 header·body를 allowlist 방식으로 선택한다. exception 객체 전체 serialization로 query parameter나 driver config가 노출되지 않게 한다.

## secret과 공급망

- 실제 `.env`는 Git에 커밋하지 않는다.
- local·preview·production secret을 분리한다.
- 최소 권한 DB credential을 사용하고 migration 권한과 runtime 권한 분리를 검토한다.
- lockfile을 커밋하고 의존성 변경을 별도 검토한다.
- install script가 필요한 package는 출처와 필요성을 확인한다.
- CI log와 preview 설정 화면에 secret 값을 출력하지 않는다.
- secret 유출 시 교체 순서와 영향받는 session을 기록한다.

AI가 만든 코드·번역·콘텐츠는 신뢰된 입력이 아니며 같은 review·test를 거친다. 비밀값과 실제 사용자 원문을 AI prompt에 넣지 않는다.

## backup과 삭제

전체 삭제 transaction, cleanup과 삭제 전 backup의 privacy-first 승격 규칙은 [방문자 데이터 보존·삭제·복구 계약](DATA_RETENTION_ERASURE_v0.1.md)을 따른다.

- backup은 운영 DB와 같은 접근 권한으로 공개하지 않는다.
- 복구는 별도 검수 DB에서 수행한다.
- 전체 삭제·만료 대상이 backup에 남을 수 있음을 보존 안내와 정책에 반영한다.
- 복구 후 만료·삭제 cleanup을 실행하고 서비스 연결 전에 재노출 여부를 확인한다.
- 독립 erasure ledger가 없으면 restored DB의 모든 visitor 연결 데이터를 제거한 뒤에만 production 승격을 검토한다.
- backup 보존 7일은 제공자·요금제에서 확인되기 전 확정 사실로 표시하지 않는다.

report를 운영 요약으로 남길 때 visitor ID, client request ID, 자유 입력을 제거하고 `anonymized_at`을 기록한다.

## 주요 위협과 검수

| 위협 | 통제 | 검수 |
| --- | --- | --- |
| 방문자 token 탈취 | secure HttpOnly cookie, 짧은 보존, 로그 금지 | cookie·log 검사 |
| CSRF mutation | exact Origin, JSON, SameSite | 다른 Origin 403 |
| 타인 run 접근 | visitor 소유권, 동일 404 | AC10 |
| 중복 완료 | unique·lock·transaction | AC03, AC05, AC09 |
| 운영 권한 상승 | OIDC issuer·subject allowlist | AC15 |
| 오래된 편집 덮어쓰기 | expected revision | AC13 |
| 잘못된 콘텐츠 공개 | 필수 검수·감사 log | AC14 |
| XSS | text output, no raw HTML | 악성 문자열 fixture |
| SSRF·open redirect | URL 생성·allowlist, server fetch 없음 | 변조 URL 거절 |
| 삭제 데이터 복구 | restore 후 cleanup | AC16, AC20 |
| 민감정보 로그 | allowlist logging·redaction | log capture test |

## 출시 전 보안 게이트

- [ ] cookie 속성을 preview HTTPS에서 확인했다.
- [ ] visitor와 admin cookie가 상호 인증되지 않는다.
- [ ] 다른 Origin mutation이 모두 거절된다.
- [ ] 타인 ID 접근이 같은 404를 반환한다.
- [ ] 운영 principal 비활성화가 즉시 반영된다.
- [ ] public serializer에 운영·session 필드가 없다.
- [ ] 자유 입력과 token이 log·monitoring에 없다.
- [ ] 외부 URL allowlist와 주소 fallback을 확인했다.
- [ ] rate limit가 공유 Wi-Fi 시연을 과도하게 막지 않는다.
- [ ] 전체 삭제와 backup 복구 뒤 재노출을 검수했다.
- [ ] dependency·secret scan 결과와 미해결 항목을 기록했다.

보안 검수 미달을 “해커톤이라 괜찮다”고 숨기지 않는다. P0 권한·소유권·삭제 통제가 실패하면 공개 운영을 보류한다.
