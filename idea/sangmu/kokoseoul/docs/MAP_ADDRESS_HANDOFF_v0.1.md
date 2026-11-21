# 지도 URL·한국어 주소 전달 계약 v0.1

작성일: 2026-11-21 · 상태: 실제 장소·기기 검수 전 기준

이 문서는 여기서울이 탐색 화면에서는 Naver Web Dynamic Map으로 후보 위치를 비교하고, 상세 화면에서는 NAVER 지도 앱의 대중교통·도보 길찾기와 검수된 장소 정보를 연결하며, 어느 연결이 실패해도 목록과 한국어 주소로 복구하는 계약이다. 시작 화면의 선택적 현재 위치 판정과 지도 기능은 분리하며, 지도는 보조 수단이고 quest 진행·완료의 권한 또는 증거가 아니다.

공식 형식 기준: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [Naver Maps JavaScript API v3](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html), [NAVER 지도 앱 URL Scheme](https://guide.ncloud-docs.com/docs/maps-url-scheme) · 확인일: 2026-11-21

## 탐색 지도

- `/quests`는 Naver Client ID가 설정된 환경에서 지도로 시작하고, key가 없는 환경에서는 목록을 기본으로 렌더링한다.
- map locale은 현재 UI와 같은 일본어 또는 한국어로 제한한다.
- marker에는 검수된 place 좌표만 사용하고 사용자 GPS 좌표는 사용하지 않는다.
- 공개 후보 좌표는 서울 서비스 경계 안이어야 하며 지도 중심도 `maxBounds`로 서울 안에 제한한다.
- key 누락·인증 실패·network 실패에는 빈 지도나 가짜 pin을 표시하지 않고 목록 복귀를 제공한다.
- SDK script·tile·응답은 service worker와 application storage에 저장하지 않는다.
- 지도 인증을 위한 referrer는 `/quests`의 origin까지만 허용하며 path와 query는 보내지 않는다.
- 외부 지도 이동과 한국어 주소 fallback은 탐색 지도 상태와 독립적이다.

## P0 장소 열기

- action은 `search`만 사용한다.
- base는 `https://www.google.com/maps/search/`다.
- `api=1`과 non-empty `query`를 필수로 한다.
- 검증된 Google Place ID가 있을 때만 `query_place_id`를 함께 사용한다.
- 주소·장소명·좌표는 content snapshot에서 server가 선택한다.
- Google 장소 검색 URL에는 출발지·현재 위치·navigation·Street View parameter를 넣지 않는다.
- Google Maps app 설치와 위치 권한을 요구하지 않는다.

장소 검색은 주소 확인용 보조 경로로 유지한다. 이동 안내는 아래 NAVER 지도 앱 길찾기 계약을 별도로 따른다.

## NAVER 대중교통·도보 길찾기

- 대중교통은 공식 `/route/public`, 역에서 장소까지 도보는 `/route/walk` URL Scheme만 사용한다.
- `appname`에는 현재 페이지 전체 URL 대신 서비스 origin만 넣어 quest·run·query를 외부로 보내지 않는다.
- 대중교통 URL은 출발 좌표·출발지명을 생략한다. 공식 계약에 따라 NAVER 지도 앱이 사용자가 앱에 허용한 현재 위치를 사용한다.
- 여기서울은 이 행동을 위해 현재 위치를 새로 요청하거나 읽거나 서버로 보내지 않는다.
- 목적지는 검수된 역·출구 좌표와 이름이며, 도보 출발점은 같은 역·출구 snapshot이다.
- Android mobile web은 공식 Intent URL, iOS mobile web은 `nmap://`와 App Store fallback을 사용한다.
- 앱 미설치·외부 이동 실패·위치 미허용은 quest 실패가 아니다. 역·출구·주소·앱 내부 도보 안내는 그대로 유지한다.
- 실시간 출발역·환승·운행 정보는 NAVER 지도 결과이며 여기서울이 보장하거나 캐시하지 않는다.

Google 공식 문서상 Maps URL은 공통 URL로 앱·browser를 열 수 있고 API key가 필요 없지만, `api=1`이 없으면 action parameter가 무시될 수 있다. URL은 표준 encoding을 적용하고 2,048자 제한보다 충분히 작게 유지한다.

## URL shape

허용 예시:

```text
https://www.google.com/maps/search/?api=1&query=<encoded-place-or-address>
```

Place ID를 검증한 경우:

```text
https://www.google.com/maps/search/?api=1&query=<encoded-place-or-address>&query_place_id=<encoded-place-id>
```

고정 요소:

| 구성 | 값·규칙 |
| --- | --- |
| scheme | `https` only |
| host | exact `www.google.com` |
| path | exact `/maps/search/` |
| `api` | exact `1` |
| `query` | server가 검수한 장소명+한국어 주소 또는 좌표 |
| `query_place_id` | optional, 검수된 ID만 |
| fragment | 없음 |
| user data | 없음 |

short link, 임의 `maps.app.goo.gl`, 운영자가 붙여 넣은 전체 URL, custom scheme, `javascript:`, protocol-relative URL을 저장·redirect하지 않는다.

## query 선택

우선순위는 특정 장소를 정확히 여는 것과 사용자에게 확인 가능한 주소를 유지하는 것이다.

1. 검증된 Place ID가 snapshot에 있으면 `query=<장소명 또는 주소>`와 `query_place_id`를 함께 사용한다.
2. Place ID가 없고 검증된 좌표가 있으면 `query=<lat,lng>` 후보를 사용하되 화면에는 한국어 주소·장소명을 별도 표시한다.
3. 좌표도 없으면 `query=<장소명 + 한국어 주소>`를 사용한다.
4. 결과가 여러 장소이거나 다른 pin이면 public gate를 실패시키고 주소만 fallback으로 둔다.

Place ID가 오래됐거나 장소가 이전했을 수 있으므로 영구 identity로 맹신하지 않는다. 장소명·주소·좌표·Place ID가 서로 다른 장소를 가리키면 어느 하나를 편의상 선택하지 않고 content를 pause·재검증한다.

## URL 생성

- 문자열 결합으로 query를 직접 escape하지 않고 표준 `URL`·`URLSearchParams`를 사용한다.
- query는 trim·NFC 뒤 content field 길이 상한을 적용한다.
- query에 `&`, `#`, `?`, line break, control character가 있어도 새 parameter·fragment가 되지 않게 encoding한다.
- 허용 parameter만 새 URL에 복사한다.
- 최종 URL을 다시 parse해 scheme·host·path·parameter allowlist를 확인한다.
- 최종 길이가 상한을 넘으면 400 공개 검증 실패이며 값을 자른 URL을 만들지 않는다.

사용자가 입력한 URL을 server가 fetch·preview·resolve하지 않는다. 지도 URL 생성은 network call이 아니며 SSRF 경계를 만들지 않는다.

## 전송하지 않는 값

- visitor·session·run·step·report ID
- request ID·idempotency key
- 출발 위치·현재 GPS·숙소·이동 이력
- 검색어·인터뷰 원문·feedback·comment
- UTM·campaign·user identifier
- Google API key·client secret

P0는 지도 클릭 attribution을 위해 UTM parameter를 추가하지 않는다. 외부 전송을 늘려 얻을 제품 판단이 정의되지 않았고 `map_opened` 분석 이벤트도 현재 allowlist에 없다.

## content snapshot

각 place snapshot은 최소 다음 의미를 가진다.

| field | 공개 조건 |
| --- | --- |
| 장소명 | 일본어 display와 한국어 고유명 확인 |
| `addressKo` | 실제 도로명·지번 중 사용자가 현장에서 확인 가능한 값 |
| lat·lng | optional, 검증 범위와 precision 기록 |
| Place ID | optional, Google 결과와 현장 대상 일치 확인 |
| sourceRef | 공개 가능 URL 또는 제한된 확인 방법 reference |
| verifiedAt | 공개 전 실제 확인일 |

`lng` 철자는 schema에서 하나로 고정한다. 좌표는 장소 위치이며 사용자 위치가 아니다. 불필요하게 출입구보다 정밀한 내부 좌표나 비공개 장소를 저장하지 않는다.

published version의 place snapshot은 기존 run을 위해 불변이다. 장소가 이전·폐업하면 published row를 고치지 않고 quest를 pause하고 새 version을 검수한다.

## 화면

진행·상세 화면은 지도 link와 독립적으로 다음을 제공한다.

- 장소명
- 선택 가능한 한국어 주소 text
- `lang="ko"`가 적용된 주소·한국어 고유명
- `地図を開く` 행동
- `住所をコピー` 행동
- copy 실패 시 수동 선택 안내
- 정보 확인일과 변경 가능성 안내

지도 link가 보이면 주소 text를 숨기지 않는다. 주소 복사가 성공해도 지도 앱이 정확한 장소를 열었다고 간주하지 않는다.

## 외부 이동

- user gesture에서 anchor를 연다.
- 새 tab/window이면 `rel="noopener noreferrer"`를 사용한다.
- 외부 링크는 `rel="noreferrer"`로 현재 run path가 전달되지 않게 한다. 탐색 route의 Naver SDK 인증에는 `Referrer-Policy: origin`만 허용한다.
- Google origin을 CSP `connect-src`, `script-src`, `frame-src`에 추가하지 않는다.
- 외부 서비스로 이동함을 accessible name 또는 인접 문맥에서 알린다.
- browser back으로 돌아왔을 때 run state와 focus가 예측 가능해야 한다.

Maps URL을 iframe·webview에 embed하거나 server가 proxy하지 않는다.

## 사용자 위치와 지도 기능의 분리

여기서울은 시작 화면에서 사용자가 `現在地から探す`를 직접 고르거나 탐색 지도에서 `地図で現在地を表示`를 누른 경우에만 geolocation API를 호출한다. 시작 화면의 값은 지원 지역 선택에만 쓰고, 탐색 지도의 값은 파란 현재 위치 점과 정확도 범위를 browser 안에서 갱신하는 데만 쓴다. 어느 경우에도 지도 URL이나 길찾기 origin으로 사용하지 않는다.

- 사용자의 명시적 선택이나 지도 위치 버튼 클릭 전에는 permission prompt 없음
- 좌표와 current location을 여기서울 query·저장소·서버 요청·지도 origin으로 전송하지 않음. NAVER 지도 SDK에는 좌표를 요청으로 보내지 않고 이미 browser에 생성된 지도 위 client overlay로만 그림
- 지도 위치 추적은 해당 화면을 떠날 때 중단하며 실내 층·개찰구·승강장 판정에는 사용하지 않음
- 서울 밖 좌표, 권한 거절, timeout·기기 미지원은 위치 없이 목록과 지도를 계속 쓰는 복구 문구를 같은 화면에 제공
- `Permissions-Policy: geolocation=(self)`로 같은 origin만 허용
- 위치 거절·지원 없음과 관계없이 주소·지도 search link 사용 가능
- 사용자가 Google Maps에서 별도로 허용한 위치는 외부 서비스 동작이며 여기서울이 수집하지 않음

후속 길찾기는 좌표를 넘기지 않고 NAVER 지도 앱이 자체 현재 위치 권한을 요청하도록 origin을 생략한다. 여기서울의 지도 현재 위치 표시는 외부 길찾기와 분리한다.

## 주소 복사

1. user gesture에서 Clipboard API 후보를 사용한다.
2. 성공 메시지는 주소가 clipboard에 복사됐다는 사실만 말한다.
3. permission·browser 오류면 주소 text를 선택 가능한 상태로 유지한다.
4. fallback을 위해 hidden input에 중복 개인정보를 만들지 않는다.
5. copy event에 주소 원문을 analytics·log로 보내지 않는다.
6. clipboard 내용을 다시 읽어 검증하지 않는다.

screen reader에는 성공을 한 번만 알리고 반복 toast를 낭독하지 않는다. copy button은 icon만 사용하지 않고 일본어 accessible name을 둔다.

## 지도 실패

다음은 step 완료·run 실패가 아니다.

- Google Maps app 미설치
- 새 tab 차단 또는 browser 이동 실패
- 네트워크 offline
- Google 결과 없음·여러 결과
- Google 서비스 오류
- 위치 권한 거절

화면은 현재 단계·주소·한국어 phrase를 유지하고 주소 복사·수동 확인을 제공한다. 지도 open 실패를 이유로 step을 자동 완료하거나 새 visitor session을 만들지 않는다.

## 장소 불일치

검수 또는 report에서 다른 장소를 가리키면:

1. 안전·이용 영향에 따라 quest를 먼저 pause한다.
2. 현재 published snapshot과 지도 결과를 독립적으로 확인한다.
3. address·coordinate·Place ID·장소 이전 여부를 비교한다.
4. 새 draft snapshot과 URL을 실제 기기에서 검수한다.
5. 새 version을 publish하거나 기존 정보가 맞으면 resume한다.

사용자 report comment를 그대로 Google query나 외부 검색에 넣지 않는다.

## 실제 기기 matrix

| 환경 | 확인 |
| --- | --- |
| iPhone Safari, Google Maps app 있음 | app/browser 전환, 정확한 대상, back 복귀 |
| iPhone Safari, app 없음 | web fallback, 주소 유지 |
| Android Chrome, app 있음 | 정확한 search action, back 복귀 |
| Android Chrome, app 없음·기본 미지정 | chooser/web fallback |
| 위치 권한 거절 | 지역 직접 선택·미정 fallback, 지도 주소 기능 유지 |
| 일본어 OS·browser | button·외부 이동·오류 문구 자연스러움 |
| 360px viewport | 주소 wrap·copy·map 행동 가림 없음 |
| screen reader | ko language 전환·외부 link·copy result |

Google 결과는 locale·계정·앱 version에 따라 달라질 수 있어 한 기기 성공을 전체 보장으로 표현하지 않는다. public 전 최소 iOS·Android 한 대씩 대상 pin과 주소를 확인한다.

## 자동 검수

- [ ] base scheme·host·path exact allowlist
- [ ] `api=1`·query 필수, unknown parameter 거절
- [ ] Place ID 있을 때도 query 존재
- [ ] 공백·한글·일본어·`&?#%+` encoding
- [ ] control character·overlong query 공개 거절
- [ ] `javascript:`·custom scheme·short link 입력 거절
- [ ] visitor·run·request ID canary가 URL에 없음
- [ ] no-referrer·noopener·noreferrer와 CSP snapshot
- [ ] geolocation은 현재 위치 직접 선택 뒤에만 호출되고 거절 fallback이 동작함
- [ ] 사용자 좌표가 URL·storage·서버 요청·지도 URL에 없음
- [ ] map 실패 뒤 주소·step state 유지
- [ ] published place snapshot 수정 경로 없음

## 증거 양식

```markdown
# 지도·주소 검수 YYYY-MM-DD HH:mm KST

- commit·quest version·content 확인일:
- place source·검수자 code:
- URL shape·encoding·length:
- 장소명·주소·좌표·Place ID 일치:
- iOS app 있음 / 없음:
- Android app 있음 / 없음:
- 위치 권한 거절:
- 주소 copy·수동 fallback:
- 360px·keyboard·screen reader:
- referrer·CSP·URL canary:
- 알려진 외부 결과 차이·다음 확인일:
```

실제 사용자 위치·계정·run URL·비공개 업체 답변·화면 전체 history를 증거에 넣지 않는다.

## 공개 gate

- [ ] 각 실제 place의 source·verifiedAt·다음 확인일이 있다.
- [ ] 한국어 주소와 지도 결과가 같은 장소를 가리킨다.
- [ ] Google URL은 server allowlist builder만 생성한다.
- [ ] 지도 없이도 주소 복사·수동 선택·step 진행이 가능하다.
- [ ] iOS·Android에서 앱 있음·없음 fallback을 검수했다.
- [ ] 사용자 위치·여기서울 identifier·UTM을 보내지 않는다.
- [ ] 지도 오류가 완료 증거나 사용자 실패로 집계되지 않는다.
- [ ] 장소 변경 report의 pause·새 version 절차가 준비됐다.

연결 검수: AC05, AC07, AC08, AC17, AC18, AC19
