# B2C 검수와 테스트 계획 v0.1

작성일: 2026-11-21 · 상태: 테스트 구현 전

이 계획은 B2C 스펙의 AC01~AC20을 어느 환경에서 어떤 데이터와 절차로 검수할지 정의한다. 단위 테스트 수나 coverage 비율보다 중복 요청, 동시성, 소유권, 버전 고정, 삭제·복구처럼 실패 비용이 큰 계약을 우선한다.

## 테스트 계층

| 계층 | 도구 후보 | 책임 | 사용하지 않는 용도 |
| --- | --- | --- | --- |
| 순수 도메인 | Vitest | 입력 검증, 정렬, 상태 전이 판단, 오류 매핑 | DB 동시성 증명 |
| PostgreSQL 통합 | Vitest + 실제 PostgreSQL | 제약, transaction, lock, 소유권, 삭제 | mock DB |
| HTTP 계약 | Next.js test server + 실제 PostgreSQL | cookie, Origin, status, JSON, cache header | 브라우저 접근성 |
| 브라우저 E2E | Playwright Chromium·WebKit | 사용자 흐름, 모바일, reload, 두 tab | DB 내부 제약 직접 확인 |
| 수동 실제 기기 | 일본어 iOS·Android | 지도 앱·주소 복사·키보드·화면 UI | 자동 회귀 대체 |
| 운영 훈련 | preview·복구 DB | backup restore, 만료 정리, 관측 | production 데이터 실험 |

SQLite와 in-memory repository는 PostgreSQL lock·partial index·constraint 동작을 대신하지 못하므로 AC03, AC05, AC07~AC09, AC13, AC16, AC20의 통과 근거로 사용하지 않는다.

## 환경 분리

| 환경 | 데이터 | 외부 연결 | 목적 |
| --- | --- | --- | --- |
| unit | 코드 내부 fixture | 없음 | 빠른 규칙 검증 |
| integration | 테스트별 격리 PostgreSQL | 없음 | DB·API 계약 |
| e2e | 전용 검수 DB seed | 지도 URL만, OIDC는 검수 tenant | 브라우저 흐름 |
| preview | 가상 demo와 검수 계정 | 실제 후보 서비스 | 모바일·배포 검수 |
| production | 검수 완료 콘텐츠 | 운영 설정 | 실제 사용자 |

테스트가 preview·production DB URL을 받으면 시작 전에 실패하게 한다. 환경 확인은 DB 이름, host allowlist, 별도 marker table 중 두 가지 이상으로 검증한다.

## 고정 테스트 데이터

UUID와 시각을 고정해 API fixture, DB seed, E2E가 같은 대상을 사용한다.

| fixture | 상태 | 목적 |
| --- | --- | --- |
| Q1 | published v1, 3단계, demo | 정상 세로 흐름 |
| Q2 | published v1 + draft v2 | 기존 공개본과 편집본 분리 |
| Q3 | paused, 기존 공개본 | 신규 시작·진행 차단 |
| Q4 | archived, 기존 완료 run | 과거 기록 읽기 |
| Q5 | draft only, 필수 누락 | 공개 검증·404 |
| V1 | 유효 방문자·세션 | 정상 개인 기록 |
| V2 | 다른 방문자 | 소유권 404 |
| V3 | 만료 세션 | 401·정리 |
| A1 | active editor | 운영 정상 흐름 |
| A2 | authenticated, principal 없음 | 403 |
| A3 | disabled principal | 403 |

seed helper는 production build에서 import할 수 없는 test 전용 경로에 둔다. 자유 입력은 가상 문구만 사용하고 실제 인터뷰 원문을 fixture에 복사하지 않는다.

## 시간 제어

- 단위·통합 테스트는 injectable clock 또는 transaction 기준 고정 시각을 사용한다.
- cookie Max-Age, expiresAt, cleanup cutoff를 같은 clock에서 계산한다.
- 타임존 표시는 Asia/Seoul로 별도 테스트하고 DB 값은 UTC인지 확인한다.
- 실제 30일을 기다리는 테스트를 만들지 않는다.

## 동시성 테스트 방식

동시성 검수는 `Promise.all`만 사용해 우연히 순차 실행되는 테스트로 끝내지 않는다.

1. 서로 다른 DB connection 두 개를 연다.
2. barrier를 사용해 둘 다 사전 조회를 끝낸 시점에 맞춘다.
3. 두 mutation을 동시에 진행한다.
4. 필요하면 한 transaction의 commit을 의도적으로 지연한다.
5. 두 HTTP 결과와 최종 DB 행 수·시각·상태를 함께 확인한다.
6. 같은 검사를 여러 번 반복해 flaky 여부를 확인한다.

테스트 timeout은 deadlock을 성공으로 오인하지 않게 짧은 진단 정보와 함께 설정한다.

## AC별 검수 계약

### AC01 쿠키 없는 탐색

- 계층: HTTP + Playwright
- 준비: cookie가 없는 새 context, Q1 공개
- 실행: `/` → 조건 선택 → 목록 → 상세
- 확인: visitor·session·run 행 수 변화 없음, 일본어 정보와 시작 행동 표시
- 증거: E2E trace와 DB count assertion

### AC02 결과 없음

- 계층: 도메인 + HTTP + Playwright
- 준비: 결과가 없는 area·tag 조합
- 확인: 200 빈 items, 조건 유지, 조건 변경 버튼, 자동 fallback 없음

### AC03 동시 시작

- 계층: PostgreSQL 통합 + HTTP
- 실행: 같은 V1·Q1으로 barrier 뒤 POST 두 개
- 확인: 둘 다 같은 run ID, 신규 응답은 하나만 201, DB run 하나

### AC04 단계 순서

- 계층: PostgreSQL 통합 + HTTP
- 실행: Q1 1단계 전 2단계 완료
- 확인: 409 `STEP_ORDER_CONFLICT`, run_steps 0개

### AC05 응답 유실과 재시도

- 계층: HTTP fault injection + Playwright
- 실행: 서버 commit 뒤 응답을 client에 전달하기 전에 연결 종료
- 확인: 재조회에서 단계 완료, 같은 PUT은 기존 completedAt, 행 하나

commit 전 연결 종료 사례도 별도로 실행해 미완료 상태와 안전한 재시도를 확인한다.

### AC06 새로고침과 재접속

- 계층: Playwright
- 실행: 1단계 완료 → reload → context 유지 상태로 새 page
- 확인: 같은 run과 다음 단계, 새 visitor 생성 없음

### AC07 진행 중 새 버전 공개

- 계층: PostgreSQL 통합 + API
- 준비: V1은 Q2 v1 run 진행 중
- 실행: draft v2 공개 뒤 다른 visitor가 Q2 시작
- 확인: V1 run은 v1 단계, 신규 run은 v2 단계

### AC08 진행 중 중지

- 계층: PostgreSQL 통합 + Playwright
- 실행: run 진행 중 운영자가 Q1 pause
- 확인: run 조회 가능, 미완료 PUT은 `QUEST_UNAVAILABLE`, 신규 시작 차단, 일본어 reason 표시

### AC09 마지막 단계 동시 완료

- 계층: PostgreSQL 동시성 통합
- 실행: 마지막 step PUT 두 개를 barrier로 동시 실행
- 확인: run_step 하나, completedAt 하나, run completed 한 번, 완료 집계 하나

### AC10 다른 방문자의 run

- 계층: HTTP
- 실행: V2가 V1 run GET·PUT·completion·feedback 요청
- 확인: 모두 404 `NOT_FOUND`, 응답 크기·형식으로 존재 여부 노출 없음

### AC11 미완료 피드백

- 계층: PostgreSQL 통합 + HTTP
- 확인: 409 `RUN_NOT_COMPLETED`, feedback 행 없음

### AC12 피드백 반복 저장

- 계층: PostgreSQL 통합 + HTTP
- 실행: 완료 run에 저장 후 다른 점수로 PUT
- 확인: feedback 한 행, 최신 값, 범위 밖 점수는 400과 기존 값 유지

### AC13 운영 revision 충돌

- 계층: PostgreSQL 동시성 통합 + 운영 UI
- 실행: 두 운영자가 revision 2 조회, A1 저장 성공 뒤 다른 저장
- 확인: 첫 저장 revision 3, 두 번째 409 `VERSION_CONFLICT`, 최신 내용 보존

### AC14 공개 검증

- 계층: 도메인 + PostgreSQL 통합 + HTTP
- 준비: 필수 일본어·확인일·권리 확인이 각각 빠진 draft
- 확인: 400 field details, quest draft 유지, publishedVersion 변경 없음, 잘못된 감사 로그 없음

### AC15 방문자 세션으로 운영 API

- 계층: HTTP
- 실행: visitor cookie만, OIDC 로그인만, disabled principal 각각 요청
- 확인: 401 또는 403 `ADMIN_FORBIDDEN`, 운영 본문·신고·개인 기록 노출 없음

### AC16 전체 삭제와 만료

- 계층: PostgreSQL 통합 + HTTP
- 준비: run·step·feedback·report·analytics가 있는 V1, 만료된 V3
- 확인: 204 뒤 V1 접근 불가, run 계열 삭제, report 익명화, cookie 만료
- 만료 확인: V3는 cleanup 전에도 401, cleanup 뒤 연결 데이터 제거

### AC17 지도와 위치 권한 없음

- 계층: Playwright + 실제 기기
- 실행: geolocation deny, Google Maps 앱 없음 또는 link 실패
- 확인: 한국어 주소 표시·복사, 수동 선택 가능, 단계 완료 가능

### AC18 360px와 키보드

- 계층: Playwright + 수동
- viewport: 360×800, 390×844, 430×932
- 확인: 가로 스크롤 없음, focus 순서, visible label, dialog focus, 44px touch target

자동 axe 계열 검사는 보조 수단이며 키보드·screen reader 수동 검수를 대체하지 않는다.

구체적인 화면별 검사와 증거 형식은 [모바일 접근성 구현·검수](ACCESSIBILITY_VERIFICATION_v0.1.md)를 따른다.

### AC19 demo와 실제 콘텐츠

- 계층: HTTP + Playwright
- 확인: 카드·상세·진행·완료에 demo 식별, analytics environment 분리
- 실제 콘텐츠 fixture에는 demo 문구가 없고 권리·확인일이 필수

### AC20 백업 복구

- 계층: 운영 훈련
- 실행: 백업을 production이 아닌 별도 검수 DB로 복구
- 확인: schema version, 공개 읽기, 기존 run 읽기, 테스트 진행 mutation
- 후속: 만료·삭제 cleanup 실행, 삭제 사용자 재노출 없음
- 증거: 복구 시작·완료 시각, 사용한 backup 시점, RPO·RTO 결과, 삭제 검수 결과

## API 계약 검수

각 endpoint는 최소 다음을 확인한다.

- 허용 method와 405
- Content-Type과 JSON parsing
- unknown field 거절
- UUID·cursor·limit·문자 수·enum 범위
- Origin 검사와 cookie 속성
- 개인 응답 `Cache-Control: no-store`, `Vary: Cookie`
- 400, 401, 403 `ORIGIN_FORBIDDEN`·`ADMIN_FORBIDDEN`, 404, 409, 429, 503 오류 shape
- request ID가 응답과 server log에서 연결됨
- SQL·stack·constraint 이름·token이 응답에 없음

[B2C API 예시](API_EXAMPLES_B2C_v0.1.md)와 [운영 API 예시](API_EXAMPLES_ADMIN_v0.1.md)의 JSON block을 fixture source로 직접 복사하기보다 schema와 builder에서 생성해 drift를 테스트한다.

## 일본어 검수

일본어 모어 화자에게 다음을 별도 확인받는다.

- 서비스 가치와 각 버튼의 행동이 자연스러운지
- 중지·세션 만료·삭제처럼 손실이 있는 상태가 오해되지 않는지
- 한국어 요청 카드의 일본어 뜻이 실제 한국어와 일치하는지
- demo가 실제 방문·출석 인증처럼 보이지 않는지
- 경어 수준과 용어가 화면 전체에서 일관적인지

검수 결과는 문구, 검수자 코드, 날짜, 변경 이유만 저장하고 개인 연락처는 커밋하지 않는다.

## 성능과 부하

초기 목표는 합의한 검수 환경에서 공개 목록·상세 p95 1초 이내, 20명 동시 이용 5분이다.

부하 시나리오:

1. 공개 목록 50%, 상세 25%, run 조회 15%, 단계 완료 10%
2. 같은 run 중복 mutation과 서로 다른 run mutation 분리
3. 외부 지도 로딩 제외
4. 오류율, p50·p95·max, DB connection, lock wait, timeout 기록

로컬 고성능 환경 결과를 production 보장으로 표현하지 않는다. cold start와 DB 지역 지연을 preview에서 별도로 확인한다.

## 테스트 증거 형식

release 검수마다 다음을 기록한다.

```markdown
# 검수 실행 YYYY-MM-DD

- commit:
- 환경:
- DB schema version:
- 실행자:
- 시작·종료 시각:

| AC | 자동 / 수동 | 결과 | 증거 링크 | 알려진 제한 |
| --- | --- | --- | --- | --- |
| AC01 |  | pass / fail / blocked |  |  |

## 실패와 후속 조치

- 실패 내용:
- 재현 방법:
- 영향 범위:
- 수정 commit:
```

`blocked`와 `not run`을 pass로 계산하지 않는다. flaky test는 재실행 통과만으로 닫지 않고 원인과 격리 여부를 기록한다.

## CI 단계

제품 코드 착수 뒤 다음 순서로 구성한다.

1. lockfile 고정 설치
2. format·lint·typecheck
3. 순수 도메인 테스트
4. PostgreSQL service 시작과 migration
5. DB·HTTP 통합 테스트
6. production build
7. 핵심 Playwright Chromium

WebKit, 실제 기기, 부하, 복구 훈련은 merge마다 모두 실행하지 않아도 되지만 release 완료 근거에는 포함한다.

## 완료 판정

첫 버전은 AC01~AC20이 모두 pass이거나, 미달 항목이 사용자에게 미치는 영향과 제한을 명시해 출시 여부를 다시 결정한 상태여야 한다. P0의 권한·정합성·삭제 검사가 fail 또는 미실행이면 “완료”로 표시하지 않는다.
