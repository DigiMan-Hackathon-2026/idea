# DigiMan 기술 결정 v0.1

작성일: 2026-11-21 · 상태: 구현 착수용 작업 기준

이 문서는 [B2C 설계 스펙 v0.1](B2C_SPEC_v0.1.md)의 미결정 기술 항목을 구현 가능한 수준으로 좁힌다. 행사 규칙상 제품 코드 사전 작성 허용 여부가 아직 확인되지 않았으므로, 현재는 기술 선택과 환경 점검까지만 완료한다. 계정 생성·외부 서비스 프로비저닝·제품 코드 생성은 포함하지 않는다.

## 결정 요약

| 영역 | 작업 기준 | 이유 |
| --- | --- | --- |
| 애플리케이션 | Next.js App Router + TypeScript, Node.js 런타임 | 모바일 화면과 동일 출처 API를 한 저장소·한 배포 단위로 유지 |
| 스타일 | Tailwind CSS, 접근 가능한 기본 HTML 우선 | 짧은 행사 시간에 반응형 UI를 빠르게 만들고 컴포넌트 종속성 최소화 |
| 데이터베이스 | PostgreSQL | run 중복 방지, 버전 고정, 상태 변경을 유일 제약과 트랜잭션으로 보장 |
| DB 접근·마이그레이션 | Drizzle ORM + SQL 마이그레이션 이력 | 스키마와 제약을 TypeScript에서 가깝게 관리하면서 SQL 검토 가능 |
| 운영 DB 후보 | Neon Postgres | 관리형 Postgres, 브랜치·시점 복구 기능을 검수 환경과 복구 훈련에 활용 가능 |
| 배포 후보 | Vercel | Next.js 서버 렌더링과 서버 함수를 별도 서버 운영 없이 배포 |
| 운영자 인증 | Auth.js + Google OIDC + DB 세션 | 임시 비밀번호 없이 OIDC subject 허용 목록과 서버 폐기 가능한 세션 사용 |
| 방문자 인증 | 자체 익명 opaque 세션 쿠키 | 가입 없는 30일 브라우저 기록과 토큰 해시 저장 계약 유지 |
| 지도 | Google Maps 범용 URL + 한국어 주소 복사 | 앱·브라우저 공통 URL이며 API 키 없이 연결 가능; 실패 시 주소로 진행 |
| 테스트 | Vitest + 실제 PostgreSQL 통합 테스트 + Playwright | 도메인 트랜잭션과 모바일 브라우저 흐름을 서로 다른 층에서 검증 |
| 패키지 관리 | pnpm + lockfile | 팀 환경에서 의존성 결과 고정; 실제 착수 시 Corepack으로 버전 고정 |

이 선택은 팀 숙련도나 행사 제공 인프라가 다르면 바꿀 수 있다. 다만 PostgreSQL의 유일 제약·트랜잭션과 동일 출처 API라는 계약은 유지한다.

## 애플리케이션 경계

첫 버전은 모노레포나 별도 API 서버를 두지 않는다. 하나의 Next.js 애플리케이션 안에서 다음 경계를 지킨다.

```text
app/                 화면과 얇은 Route Handler
src/modules/content  퀘스트·버전·공개 상태
src/modules/session  방문자 세션·운영자 권한
src/modules/progress run·단계 완료·완료 카드
src/modules/feedback 피드백·신고
src/db               스키마·마이그레이션·DB 연결
```

Route Handler는 요청 파싱, 인증 컨텍스트 구성, 응답 매핑만 담당한다. 상태 전이와 트랜잭션은 도메인 모듈에 둬 화면이나 HTTP 구현과 분리한다. Next.js App Router와 Route Handler는 같은 애플리케이션 안에서 화면과 HTTP 메서드를 제공한다. 참고: [Next.js App Router](https://nextjs.org/docs/app), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware)

서버 동작은 기본적으로 Node.js 런타임을 사용한다. DB 드라이버와 Auth.js adapter 호환성을 확인하기 전 Edge 런타임을 사용하지 않는다.

## 데이터 정합성 구현 원칙

애플리케이션의 사전 조회만으로 동시 요청을 막지 않는다. 아래 규칙은 DB 제약과 트랜잭션을 최종 기준으로 삼는다.

- `runs(visitor_id, quest_id)` 유일 제약으로 중복 시작을 막는다.
- `run_steps(run_id, step_id)` 유일 제약으로 단계 중복 기록을 막는다.
- `feedback(run_id)`와 `reports(visitor_id, client_request_id)` 유일 제약을 둔다.
- 퀘스트 시작은 현재 공개 상태 확인, 버전 고정, run 생성을 한 트랜잭션에서 처리한다.
- 마지막 단계 완료는 run step 기록과 run 완료 전환을 한 트랜잭션에서 처리한다.
- 운영 편집은 `expectedRevision` 조건부 갱신으로 충돌을 검출한다.
- 필요한 경합 경로는 PostgreSQL 행 잠금이나 serializable 재시도를 사용하고 재시도 횟수를 제한한다.

Drizzle은 PostgreSQL 트랜잭션 격리 수준과 유일 인덱스를 선언할 수 있다. 참고: [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)

운영 DB를 Neon으로 확정하기 전 다음을 무료/선택 요금제의 실제 보존 범위와 함께 확인한다.

1. 운영·검수 환경 분리 방법
2. 연결 풀과 함수 지역의 지연
3. 7일 백업 보존 충족 여부
4. 별도 검수 DB로 복구하는 AC20 절차

Neon의 시점 복구 기능은 복구 후보가 될 수 있지만, 요금제별 제공 범위를 확인하지 않고 7일 보존을 달성했다고 간주하지 않는다. 참고: [Neon point-in-time restore](https://neon.com/blog/announcing-point-in-time-restore)

## 세션과 운영자 인증

방문자와 운영자 쿠키는 이름, 저장 테이블, 검증 함수를 분리한다.

### 익명 방문자

- 사용자가 시작 또는 신고를 명시적으로 누른 뒤에만 세션을 만든다.
- 원문 토큰은 32바이트 이상의 암호학적 난수로 만들고 쿠키에만 둔다.
- 서버에는 버전이 포함된 단방향 해시만 저장한다.
- 쿠키는 `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`를 사용한다.
- 세션은 생성 시점부터 30일이며 자동 연장하지 않는다.

### 내부 운영자

- Google OIDC 로그인은 Auth.js를 사용한다.
- 운영 환경은 DB 세션 전략을 사용해 서버에서 세션을 폐기할 수 있게 한다.
- 로그인 성공만으로 운영 권한을 주지 않는다. 검증한 Google issuer와 `sub`가 활성 `admin_principals`에 있을 때만 `/admin`과 `/api/v1/admin`을 허용한다.
- 이메일 주소는 표시 정보일 뿐 권한 식별자로 사용하지 않는다.
- Auth.js 테이블과 제품의 `admin_principals`를 분리하고 매 요청에서 활성 상태를 확인한다.

Auth.js는 Google을 포함한 OAuth/OIDC 제공자와 DB 세션을 지원하며, DB 세션 쿠키에는 세션을 찾는 토큰만 둔다. 참고: [Auth.js OAuth providers](https://authjs.dev/getting-started/authentication/oauth), [session strategies](https://authjs.dev/concepts/session-strategies)

구현 시작 전에 Auth.js의 실제 설치 버전과 adapter 호환성을 lockfile 기준으로 확인한다. 호환 문제가 있으면 인증 라이브러리를 바꿀 수 있지만 Google OIDC, subject 허용 목록, 서버 세션이라는 계약은 유지한다.

## 지도 연결

첫 구현은 지도 SDK나 위치 권한을 사용하지 않는다.

- 검색 링크: `https://www.google.com/maps/search/?api=1&query=...`
- 길찾기 링크: `https://www.google.com/maps/dir/?api=1&destination=...`
- 목적지는 운영자가 검수한 장소명, 한국어 주소, 좌표를 URL 인코딩해 만든다.
- 같은 화면에 한국어 주소 복사 버튼을 둔다.
- `api=1` 누락, 인코딩 오류, 다른 장소 선택을 자동 검수 대상으로 둔다.
- 일본어 iOS Safari와 Android Chrome에서 링크·주소 복사를 실제 확인한다.
- 서울 내 경로 품질이 부족하면 Naver Map 링크를 보조 선택지로 추가하되, 진행의 필수 조건으로 만들지 않는다.

Google Maps URL은 앱 설치 여부와 관계없이 공통 형식으로 앱 또는 브라우저를 열 수 있고 API 키가 필요 없다. 참고: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)

## 테스트와 검수 배치

| 테스트 층 | 담당 계약 | 연결 AC |
| --- | --- | --- |
| 도메인 단위 | 입력 검증, 추천 정렬, 상태 전이 판단 | AC02, AC04, AC11, AC14 |
| PostgreSQL 통합 | 유일 제약, 트랜잭션, 잠금, 소유권, 버전 고정 | AC03~AC16 |
| API 통합 | 쿠키, 상태 코드, 오류 형식, 캐시 헤더 | AC01, AC05, AC10, AC15, AC16 |
| Playwright | 모바일 탐색·시작·이어하기·완료, 중지, 주소 복사 | AC01, AC02, AC06, AC08, AC17~AC19 |
| 운영 훈련 | 백업 복구 후 만료·삭제 정리 | AC20 |

Vitest는 빠른 TypeScript 단위·통합 테스트에 사용하고, DB 테스트는 mock 대신 격리된 PostgreSQL 스키마나 데이터베이스를 사용한다. Playwright는 Chromium과 WebKit 모바일 프로젝트를 최소 검수 대상으로 둔다. 참고: [Vitest guide](https://vitest.dev/guide/), [Playwright](https://playwright.dev/docs/intro)

## 환경과 비밀값

환경은 `local`, `preview`, `production`으로 나눈다. 제품 이벤트에는 `demo`, `test`, `production` 값을 별도로 기록해 시연 데이터를 실제 성과와 분리한다.

저장소에는 `.env.example`만 두며 실제 값은 커밋하지 않는다. 예상 비밀값은 다음과 같다.

```text
DATABASE_URL
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
APP_ORIGIN
SESSION_TOKEN_PEPPER
```

`SESSION_TOKEN_PEPPER` 교체 정책을 정하기 전에는 방문자 토큰 해시 방식을 구현 완료로 보지 않는다. preview는 운영 DB와 운영 OIDC callback을 공유하지 않는다.

## 구현 착수 게이트

제품 코드를 생성하기 전에 다음을 확인한다.

- [ ] 주최 측에 행사 전 제품 코드 작성 허용 범위를 확인했다.
- [ ] 팀원이 Next.js·TypeScript·PostgreSQL 작업 기준에 동의했다.
- [ ] Node.js와 pnpm 버전을 고정하고 깨끗한 설치를 확인했다.
- [ ] local PostgreSQL 또는 별도 개발 DB 연결 방법을 정했다.
- [ ] Neon과 Vercel의 계정·요금제·지역·복구 범위를 확인했다.
- [ ] Google OIDC 앱의 local·preview·production callback을 분리했다.
- [ ] 실제 일본어 사용자 기기에서 지도 링크 후보를 확인했다.
- [ ] 첫 지역과 퀘스트 1개의 검수 가능한 콘텐츠를 확보했다.

현재 맥북에서는 Node.js 24, Corepack, Docker, Git, GitHub CLI가 확인됐고 pnpm은 아직 활성화되지 않았다. 이는 로컬 도구 확인 결과일 뿐 팀 전체 환경이나 배포 호환성 검증 결과가 아니다.

## 보류한 선택

- 별도 NestJS/Express API: 첫 세로 흐름에는 배포와 계약 동기화 비용이 더 크다.
- Supabase 전체 스택: PostgreSQL 후보로는 가능하지만 Auth·DB·정책을 한 번에 채택할 필요가 없다.
- 지도 SDK: 위치 권한과 API 키 없이도 핵심 흐름을 검증할 수 있어 P0에서 제외한다.
- 마이크로서비스와 모노레포: 6명 해커톤의 초기 기능 규모에 비해 운영 부담이 크다.
- 클라이언트 전용 저장: 스펙의 중복 요청·소유권·버전 고정 계약을 충족하지 못한다.

## 변경 규칙

스택을 바꿀 때는 선택 이유, 영향받는 API·AC, 데이터 이행 방법을 이 문서와 B2C 스펙의 변경 기록에 함께 남긴다. 계정이나 외부 서비스가 실제 생성되기 전까지 Neon·Vercel은 후보이며, PostgreSQL과 동일 출처 모듈형 서버가 현재 구현 계약이다.
