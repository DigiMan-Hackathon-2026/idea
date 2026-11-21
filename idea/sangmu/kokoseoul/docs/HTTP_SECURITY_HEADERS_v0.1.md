# HTTP 보안·캐시 header 계약 v0.1

작성일: 2026-11-21 · 상태: HTML private no-store와 기본 referrer·framing·MIME·권한 header 구현, CSP·HSTS 배포 검증 전

이 문서는 여기서울의 HTML·API·static asset·OIDC route에 적용할 CSP, cache, cookie, referrer, framing과 browser 권한 header를 정의한다. 실제 Next.js·Auth.js version과 배포 provider에서 response를 캡처해 검증하기 전 완료로 표시하지 않는다.

## 기본 원칙

- B2C와 admin API는 same-origin이며 wildcard CORS를 사용하지 않는다.
- 개인화 여부를 client가 아니라 server response header가 정확히 나타낸다.
- 외부 origin은 실제 사용하는 최소 domain만 환경별로 허용한다.
- CSP를 끄거나 넓은 `unsafe-*`를 추가해 framework 오류를 숨기지 않는다.
- OIDC callback·지도 link의 요구를 전체 site 정책 완화로 해결하지 않는다.
- header 값에 secret, 내부 host, 사용자 입력과 raw URL을 넣지 않는다.
- framework 식별용 `X-Powered-By`는 보내지 않는다.

## response 유형

| 유형 | 예 | cache | 핵심 Vary |
| --- | --- | --- | --- |
| B2C HTML | `/`, `/quests`, `/runs/:id`, `/my` | `private, no-store` | `Cookie` |
| admin HTML | `/admin/*` | `private, no-store` | `Cookie` |
| 공개 API | quest 목록·상세 | `private, no-store` | `Cookie` |
| visitor API | run·feedback·delete | `no-store` | `Cookie` |
| admin API | quest·report 운영 | `no-store` | `Cookie` |
| auth callback·session | `/api/auth/*` 후보 | `no-store` | provider·Auth.js 요구 검증 |
| build static asset | hash가 있는 JS·CSS·font | `public, max-age=31536000, immutable` | encoding |
| 공개 asset | 검수한 image·icon | versioned URL이면 장기 cache | encoding |

첫 버전의 공개 목록·상세는 유효 visitor cookie에 따라 완료 quest 제외와 ownRun이 달라질 수 있어 shared cache를 사용하지 않는다. static asset만 public cache한다.

error response도 개인·운영 정보가 있을 수 있으므로 `no-store`를 유지한다. 404·409를 CDN에 저장하지 않는다.

## 공통 header 후보

production HTTPS response에 다음을 검토한다.

```text
Content-Security-Policy: <environment-specific-policy>
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Request-Id: <validated-server-id>
```

`frame-ancestors 'none'`가 CSP의 최종 framing 기준이며 `X-Frame-Options: DENY`는 구형 방어 보조다. 둘이 모순되지 않게 한다.

HSTS는 production domain과 모든 대상 subdomain의 HTTPS를 검증한 뒤 켠다. 첫 배포에서 preload를 즉시 요청하지 않는다. local HTTP와 provider preview 전체 parent domain에는 무분별하게 적용하지 않는다.

### service worker

`/sw.js`는 같은 origin과 root scope에서만 등록한다. browser가 worker script 변경을 매번 확인하도록 다음 header를 고정한다.

```text
Content-Type: application/javascript; charset=utf-8
Cache-Control: no-cache, no-store, must-revalidate
Content-Security-Policy: default-src 'self'; script-src 'self'
```

worker는 offline fallback과 공개 설치 asset만 precache한다. `quests`, `runs`, `my`, API response와 locale·visitor별 HTML은 Cache Storage에 저장하지 않는다. navigation은 network-first이며 network 오류에서만 offline fallback을 반환한다.

## CSP 목표

초기 production 목표:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'nonce-<per-response-nonce>';
style-src 'self' 'nonce-<per-response-nonce>';
img-src 'self' data:;
font-src 'self';
connect-src 'self' <approved-monitoring-or-auth-origins>;
frame-src <approved-oidc-origins-if-required>;
manifest-src 'self';
worker-src 'self';
upgrade-insecure-requests;
```

실제 한 줄 header에는 줄바꿈과 placeholder를 넣지 않는다. 사용하지 않는 directive의 외부 origin은 제거한다.

### nonce

- cryptographically random per response
- response body의 허용 script·style에만 동일 nonce 전달
- log·analytics·client storage에 기록 금지
- shared cache 대상 HTML에 nonce response를 저장하지 않음
- nonce를 query·cookie에서 받지 않음

Next.js가 framework script에 nonce를 전달하는 실제 방법과 static optimization 영향은 채택 version에서 확인한다. nonce 때문에 동적 렌더링이 필요한 route를 문서화한다.

### 금지·보류

- production `script-src 'unsafe-eval'`
- 검토 없는 `script-src 'unsafe-inline'`
- `default-src *`, `connect-src *`, broad `https:`
- data: script·font
- 임의 운영자 입력 URL을 CSP source로 추가
- CSP 오류를 해결하기 위한 전체 policy 비활성화

style nonce가 framework와 호환되지 않으면 정확한 style hash·외부 stylesheet·제한된 대안을 비교하고 예외 이유와 영향 route를 기록한다.

## 외부 연결별 정책

### Google Maps URL

지도는 anchor로 외부 앱·browser를 여는 방식이며 `connect-src`, `script-src`, `frame-src`에 Google Maps를 추가할 이유가 없다. 새 창이면 `rel="noopener noreferrer"`를 사용하고 같은 화면에 한국어 주소 fallback을 둔다.

### Naver Web Dynamic Map

`/quests`에서 사용자가 지도 보기를 선택한 경우에만 `https://oapi.map.naver.com` SDK를 로드한다. 실제 CSP를 도입할 때 network trace와 Naver 공식 host 목록을 근거로 script·image·connect source를 좁게 추가하며 wildcard `https:`를 허용하지 않는다. SDK·tile은 service worker cache 대상이 아니다.

### Google OIDC

Auth.js의 redirect·callback이 요구하는 domain과 method를 실제 network trace·공식 설정에서 확인한다.

- browser redirect만이면 전체 page CSP에 provider script를 허용하지 않는다.
- popup을 사용하면 COOP 정책과 opener 요구를 auth route에서만 검토한다.
- callback response는 no-store이며 code·state가 referrer로 나가지 않게 한다.
- provider origin을 wildcard나 전체 Google domain으로 넓히지 않는다.
- state·PKCE·Auth.js CSRF control을 CSP로 대체하지 않는다.

### monitoring

client monitoring을 도입하기 전 전송 payload·region·보존을 검토한다. 승인된 ingest origin만 `connect-src`에 추가하고 request body·cookie·URL query 자동 수집을 끈다. server-only monitoring이면 browser CSP를 넓히지 않는다.

### font·image

가능하면 self-host한다. 외부 font·image CDN을 추가하면 사용권리, referrer, IP 전송, cache와 장애 fallback을 검토한다. 임시 hotlink를 CSP allowlist에 넣지 않는다.

## browser isolation header

| header | 초기 판단 | 확인할 것 |
| --- | --- | --- |
| `Cross-Origin-Opener-Policy` | `same-origin` 후보 | OIDC popup이면 route별 `same-origin-allow-popups` 필요 여부 |
| `Cross-Origin-Resource-Policy` | same-origin asset 후보 | 외부 embedding 요구 없음 확인 |
| `Cross-Origin-Embedder-Policy` | P0 보류 | 외부 resource·OIDC 호환, 필요 기능 없음 |

COOP·CORP·COEP를 이름만 보고 일괄 적용하지 않는다. auth callback과 외부 link가 끊기지 않는지 Chromium·WebKit에서 확인한다. 보류는 browser 기본 보호만으로 충분하다는 뜻이 아니라 현재 기능에 필요한 조합을 먼저 검증한다는 뜻이다.

## Permissions Policy

P0는 camera와 microphone을 사용하지 않으므로 비활성화한다. geolocation은 시작 화면에서 사용자가 현재 위치를 직접 선택했을 때만 같은 origin에 허용한다.

```text
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

fullscreen, clipboard-write 등 추가 directive는 browser 지원과 기능을 확인한 뒤 정한다. 주소 복사는 user gesture의 Clipboard API를 우선하고 policy를 넓히지 않아도 되는 fallback을 제공한다.

좌표는 browser 안에서 가까운 지원 지역을 판정한 직후 버리고 URL·저장소·서버 요청에 넣지 않는다. 거절·timeout·미지원이면 지역 직접 선택과 미정 fallback을 제공한다.

## Referrer Policy

기본 route는 `no-referrer`를 사용해 외부 지도·OIDC 이동에 현재 path·query가 전달되지 않게 한다. Naver Web Dynamic Map의 등록 도메인 인증이 필요한 `/quests`만 `origin`을 사용한다. 이 예외는 scheme·host·port까지만 전달하며 path·query·현재 위치 좌표는 전달하지 않는다. analytics 편의를 위해 `unsafe-url`로 낮추지 않는다.

OIDC가 referrer를 필요로 한다고 가정하지 않고 state·redirect URI 계약을 사용한다. provider 호환 문제가 있으면 auth route만 정확한 대안을 검토하고 개인정보 영향을 기록한다.

## cookie header

### visitor

생성·재사용·삭제·rotation과 host scope는 [visitor session 수명주기 계약](VISITOR_SESSION_LIFECYCLE_v0.1.md)을 따른다.

```text
Set-Cookie: digiman_visitor=<opaque>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=<fixed>
```

### admin

Auth.js 채택 version의 server session cookie 이름을 visitor와 분리하고 `HttpOnly`, `Secure`, 적절한 SameSite와 scope를 확인한다. 가능하면 admin cookie Path를 필요한 범위로 좁히되 auth callback·API 호환성을 검증한다.

- Domain attribute를 불필요하게 설정하지 않는다.
- production cookie를 preview subdomain과 공유하지 않는다.
- 삭제 응답은 같은 Path·Domain 조건으로 만료한다.
- cookie 원문·Set-Cookie를 log·error monitoring에 기록하지 않는다.
- local HTTP 예외가 production 설정으로 올라가지 않게 환경 검증한다.

## CORS와 Origin

P0 API는 browser same-origin 전용이다.

- credential과 `Access-Control-Allow-Origin: *` 조합 금지
- 다른 origin의 일반 API 사용을 허용하지 않음
- POST·PUT·PATCH·DELETE exact Origin 확인
- Origin 누락도 거절
- 필요 없는 broad preflight handler를 두지 않음
- provider webhook·native client가 생기면 별도 인증·route 계약 추가

same-origin이라는 이유로 mutation의 Origin 검사를 생략하지 않는다.

## API별 필수 header

| 응답 | 필수 |
| --- | --- |
| 모든 JSON | 정확한 Content-Type, X-Request-Id, nosniff |
| 공개 개인화 GET | private no-store, Vary Cookie |
| visitor GET·mutation | no-store, Vary Cookie |
| admin GET·mutation | no-store, Vary Cookie |
| 201 create | 필요하면 same-origin Location, no-store |
| 204 delete | body 없음, cookie 만료, no-store |
| 429 | no-store, Retry-After, 공통 오류 shape |
| 503 | no-store, retryable 공통 오류 shape |

`Vary: Origin`은 cross-origin 응답을 실제 허용할 때만 필요성을 검토한다. 무분별한 Vary는 cache cardinality를 늘리지만 no-store를 cache 가능으로 바꾸지는 않는다.

## HTML과 asset

- dynamic HTML은 개인화되지 않은 것처럼 보여도 no-store를 우선한다.
- hashed build asset은 immutable이며 source map 공개 여부를 별도 결정한다.
- source map에 source·path·secret이 없는지 확인하고 production 공개를 기본으로 가정하지 않는다.
- user upload가 없는 P0에서 `blob:`·외부 asset source를 미리 허용하지 않는다.
- SVG를 도입하면 inline script·foreignObject와 외부 reference를 검토한다.

## CSP 배포 순서

1. local test에서 목표 policy를 enforce한다.
2. preview에서 필요한 framework·Auth.js source를 수집한다.
3. violation이 실제 기능 요구인지 injection·잘못된 inline인지 분류한다.
4. directive별 최소 예외와 이유를 문서화한다.
5. Chromium·WebKit의 탐색·시작·완료·admin 로그인 검수
6. production enforce 후 오류율·로그에 사용자 URL이 없는지 확인

remote CSP report endpoint는 P0에 필수 아님이다. 도입하면 report body의 document URI·blocked URI가 사용자 path·query를 포함할 수 있으므로 수집·보존·redaction을 먼저 설계한다.

## 검수 matrix

- [ ] HTTP·HTTPS, local·preview·production의 HSTS 차이
- [ ] 모든 HTML·API·error·204·429·503 header snapshot
- [ ] cookie 속성, 삭제 시 동일 scope 만료
- [ ] 다른 Origin mutation 거절과 wildcard CORS 없음
- [ ] CSP 아래 Next.js hydration·navigation·error boundary
- [ ] Auth redirect·callback·logout, disabled principal
- [ ] Google Maps 외부 link와 opener 없음
- [ ] monitoring off·on의 connect-src 최소 차이
- [ ] 360px Clipboard API와 fallback
- [ ] iframe embedding 거절
- [ ] MIME mismatch와 inline script injection fixture 거절
- [ ] referrer에 quest·run path·query 없음
- [ ] production response에 내부 host·nonce log·source map 노출 없음

## 증거 양식

```markdown
# HTTP header 검수 YYYY-MM-DD

- commit·release:
- 환경·domain:
- Next.js·Auth.js version:
- browser:

| route·status | cache | CSP | cookie | referrer | permissions | 결과 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | pass / fail |

- CSP 예외와 이유:
- OIDC trace 결과:
- 외부 origin inventory:
- 알려진 제한:
```

실제 cookie, nonce, authorization code와 내부 callback query를 증거에 복사하지 않는다.

## release gate

- [ ] production HTTPS와 HSTS scope를 확인했다.
- [ ] CSP에 wildcard·불필요한 unsafe directive가 없다.
- [ ] OIDC·지도·monitoring 예외가 route·origin별 최소 범위다.
- [ ] 개인·admin·error 응답이 no-store이며 Cookie를 올바르게 Vary한다.
- [ ] visitor·admin cookie가 분리되고 삭제 scope가 일치한다.
- [ ] mutation exact Origin과 same-origin CORS 정책을 검수했다.
- [ ] camera·microphone이 비활성이고 geolocation은 명시적 선택 뒤 same-origin에서만 동작하며 지역 선택 fallback이 있다.
- [ ] referrer에 개인 path·query가 나가지 않는다.
- [ ] `/sw.js`가 no-store·same-origin CSP를 가지며 개인 HTML·API를 cache하지 않는다.
- [ ] offline fallback과 worker update가 진행 기록을 삭제하거나 예고 없이 새로고침하지 않는다.
- [ ] header snapshot을 Chromium·WebKit·provider edge에서 확인했다.

연결 검수: AC01, AC05, AC10, AC15~AC19
