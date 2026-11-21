# 일본어 locale·표시 형식 계약 v0.1

작성일: 2026-11-21 · 상태: UI·content 구현 전 기준

이 문서는 여기서울 P0의 일본어 UI, 한국어 주소·요청 문구, KST 시각, KRW 비용과 숫자·날짜 표시를 정의한다. 번역은 runtime에 자동 생성하지 않으며, 의미가 없는 fallback으로 공개 화면을 채우지 않는다.

## locale 범위

| 영역 | 언어·locale | 비고 |
| --- | --- | --- |
| B2C UI | 일본어 `ja` | P0 단일 UI 언어 |
| quest title·body·step | 일본어 `ja` | 모어 화자 검수 대상 |
| 한국어 주소·phrase | 한국어 `ko` | 일본어 뜻을 인접 제공 |
| admin UI | 한국어 후보 | 내부 용어와 API code 분리 |
| DB enum·API field·error code | 영어 identifier | 사용자에게 그대로 노출 금지 |
| 시각 기준 | UTC 저장, Asia/Seoul 표시 | 사용자 화면에 한국 시간 명시 |
| 비용 | KRW, 일본어 locale formatting | unknown·free 구분 |

P0에 언어 선택기와 영어 fallback은 없다. 후속 locale을 추가할 때 field별 source, fallback, URL, cache, review와 analytics 영향을 별도 설계한다.

## document language

- B2C root HTML은 `lang="ja"`다.
- 한국어 주소·phrase·고유명 span은 `lang="ko"`다.
- admin root는 실제 UI 언어에 따라 `lang="ko"` 후보를 사용한다.
- emoji·숫자만 있는 label로 언어 의미를 대신하지 않는다.
- mixed-language string 하나에 `lang`을 뭉뚱그리지 않고 의미 단위 element로 나눈다.

screen reader가 한국어 phrase를 일본어 발음으로 읽지 않게 하고, phrase 바로 옆에 일본어 뜻과 용도를 제공한다.

## source와 review

| string 종류 | source | review |
| --- | --- | --- |
| navigation·button·form | code locale catalog 후보 | P0 일본어 문구 review |
| API error `messageJa` | server error catalog | code·screen 행동과 함께 review |
| quest content | versioned DB draft | version별 content review |
| pause reason | 운영 입력 | public 전 P0 review |
| 한국어 phrase | versioned content | 한국어 상황 + 일본어 뜻 pair review |
| 외부 provider 오류 | provider | 그대로 표시 금지, 내부 category 매핑 |

같은 의미의 문구를 component마다 복제하지 않는다. 그러나 문맥이 다른 button을 하나의 짧은 번역 key로 억지 재사용하지 않는다.

AI·자동 번역은 초안만 만들 수 있고 `reviewedAt`·`reviewedBy`를 자동 채우지 않는다. runtime request body나 사용자 comment를 외부 번역 API에 보내지 않는다.

## 번역 key

- 안정된 의미 기반 key를 사용하고 일본어 문장 자체를 key로 쓰지 않는다.
- key에는 화면 위치보다 행동·상태가 드러나야 한다.
- interpolation variable의 type·escape·허용 값이 catalog에 고정돼야 한다.
- raw HTML interpolation과 rich text translation은 P0에서 사용하지 않는다.
- 사용하지 않는 key와 누락 key를 build/test에서 검출한다.

예시 후보:

```text
quest.start
quest.continue
run.step.saving
run.state.confirming
error.rateLimited
data.delete.confirm
```

실제 key scheme은 F0 후 고정하되 API code와 1:1이라고 가정하지 않는다. 같은 code도 화면 문맥에 따라 다음 행동이 다를 수 있다.

## 누락·fallback

### B2C code string

일본어 key가 없으면 build·test를 실패시킨다. production에서 key 이름·영어 개발 문구·빈 button을 보여 주지 않는다.

### content

title·summary·step 등 public 필수 일본어가 없으면 publish를 400으로 거절한다. 이전 published version이 있으면 그대로 유지한다.

### error

알 수 없는 server code는 stack·provider 원문을 보여 주지 않고 검수된 일반 일본어 오류와 request ID를 제공한다. `retryable`만으로 행동을 추측하지 않는다.

### 한국어 pair

`phraseKo`와 `phraseJa`는 둘 다 null이거나 둘 다 값이다. 한쪽이 누락되면 draft 저장 또는 publish gate에서 거절하고 화면에서 자동 번역하지 않는다.

## Unicode·text

- 입력 normalization은 [입력 검증 계약](INPUT_VALIDATION_v0.1.md)의 NFC를 따른다.
- display에서 사용자가 의도한 일본어·한국어 문자를 ASCII로 transliteration하지 않는다.
- control·bidi override·null을 거절한다.
- line ending은 LF로 canonicalize한다.
- trim은 field 계약대로 하되 일본어 문장 내부 공백을 임의 제거하지 않는다.
- Unicode length는 code unit이 아니라 채택 schema의 code point·grapheme 정책을 test한다.

검색·idempotency canonical 값과 화면 표시를 혼동하지 않는다. normalization 전 원문을 별도 log·audit에 보존하지 않는다.

## 일본어 typography

- 문장 부호 `。`, `、`와 일본어 괄호를 문맥에 맞게 일관되게 쓴다.
- 영문 product·API 용어를 사용자 문구에 불필요하게 노출하지 않는다.
- 가타카나·한자·히라가나 선택은 모어 화자 review glossary를 따른다.
- 작은 화면에서 일본어를 임의 character 수로 잘라 핵심 조건을 숨기지 않는다.
- title truncation이 필요하면 full accessible name·상세 화면을 제공한다.
- line-height와 font fallback에서 일본어·한국어 glyph가 잘리지 않는지 확인한다.

한글 주소와 phrase에 letter-spacing을 과도하게 적용하지 않는다. font를 self-host하면 Japanese·Korean subset과 license를 검수한다.

## 날짜·시각

DB timestamp는 UTC instant다. 사용자에게 행동 영향을 주는 시각은 Asia/Seoul로 변환하고 `韓国時間` 또는 동등한 문맥을 제공한다.

| 값 | 표시 후보 | 주의 |
| --- | --- | --- |
| content 확인일 | `2026年11月21日確認` | KST calendar date, 실시간 보장 아님 |
| session 만료 | `2026年12月21日 18:00（韓国時間）` | 정확한 expiresAt, 사용으로 연장 안 됨 |
| run 시작·완료 | `2026年11月21日 18:30` | 화면 문맥에서 KST 설명 |
| 운영 audit·release | ISO instant + KST evidence | 내부 정렬은 instant |

browser locale·device timezone이 일본이나 다른 지역이어도 session 만료 의미가 바뀌지 않게 KST를 명시한다. 상대 시각 “3日前”만 보여 주지 않고 중요한 expiry·검수일은 절대 날짜를 제공한다.

DST가 없는 현재 KST 특성을 hard-code한 offset 문자열만 저장하지 않고 IANA timezone `Asia/Seoul`을 사용한다. DB에 formatted string을 저장하지 않는다.

## 비용

cost 상태와 min·max를 먼저 해석한 뒤 일본어로 표시한다.

| 상태 | 값 | 표시 의미 |
| --- | --- | --- |
| unknown | null | `料金未確認` 후보, 0원 금지 |
| known | min=max=0 | 무료가 실제 확인된 경우만 `無料` |
| known | min=max>0 | `₩10,000` 후보 |
| known | min<max | `₩10,000〜₩15,000` 후보 |
| known | min null·max 값 | schema에서 허용 여부 먼저 결정, 자동 “이하” 금지 |

`Intl.NumberFormat` 등 검증된 formatter에 `ja-JP`·`KRW`를 명시하고 fractional digit 0을 검수한다. currency symbol만으로 통화가 모호하면 인접 문맥에 `韓国ウォン`을 표시한다.

- unknown을 무료·0원으로 표시하지 않는다.
- 필수 구매·1인 최소 주문·세금·deposit 조건은 숫자와 별도 text로 표시한다.
- 쉼표·전각 숫자를 수동 조합하지 않는다.
- API는 display string이 아니라 minor-unit 정책이 정해진 numeric 값을 반환한다.
- 실제 비용 변경 report가 있으면 quest pause·재검증한다.

## 소요 시간·수량

- `durationMinutes`는 양수 정수이며 60분을 자동으로 “1시간 정확히”라고 보장하지 않는다.
- 표시 후보는 `約60分`, 범위가 없으면 “약” 의미를 content 기준과 맞춘다.
- step position은 `1 / 3`처럼 읽을 수 있는 text와 heading을 제공한다.
- 참여자 수·인터뷰 수는 작은 표본을 비율로 과장하지 않고 건수를 함께 표시한다.
- 숫자 interpolation은 string concatenation보다 formatter·문장 전체 review를 사용한다.

## 주소·고유명

- 한국어 주소 원문은 `lang="ko"`로 표시하고 복사 값과 동일하다.
- 일본어 보조 설명이 있어도 한국어 주소를 번역해 대체하지 않는다.
- 장소명의 공식 한국어·검수된 일본어 표기를 분리할 수 있다.
- 로마자 표기를 임의 생성하지 않는다.
- 지도 query와 화면 주소가 같은 place snapshot에서 나온다.
- line wrap 뒤 건물 번호·층·출구가 잘리지 않는지 360px에서 확인한다.

업체 상호의 번역·표기는 사실·권리 검수 대상이며 자동 번역하지 않는다.

## 한국어 요청 카드

구조 예:

```text
日本語の意味: 一人で体験できますか。
見せる韓国語: 혼자 체험할 수 있나요?
```

- 두 언어의 label을 눈에 보이게 제공한다.
- 한국어 text만 크게 보여도 일본어 의미를 숨기지 않는다.
- copy 대상과 직원에게 보여 줄 대상이 무엇인지 명확히 한다.
- 존댓말·상황·가격·무료·재고 약속을 함께 review한다.
- screen reader language switch와 focus order를 검수한다.

건강·알레르기·법률·안전을 보증하는 phrase는 일반 자동 카드로 만들지 않는다.

## 오류·상태 문구

오류는 원인 category와 다음 행동을 함께 전달한다.

- saving·confirming·success를 같은 문구로 쓰지 않는다.
- session 만료와 삭제 완료를 혼동하지 않는다.
- paused·archived·not found를 하나의 “이용 불가”로 합치지 않는다.
- 429는 server 대기 시각을 표시하되 매초 live region 낭독하지 않는다.
- 503은 mutation 성공을 추측하지 않고 상태 확인·명시적 재시도를 안내한다.
- request ID는 진단 reference이며 사용자 잘못처럼 표현하지 않는다.

API `messageJa`와 화면 문구가 다를 수 있지만 허용 행동·손실 의미는 같아야 한다.

## layout·접근성

- 360px에서 일본어·한국어·KRW·날짜가 가로 scroll을 만들지 않는다.
- text zoom 200%에서 button label·error·expiry가 잘리지 않는다.
- 줄바꿈이 phrase·주소 copy target을 바꾸지 않는다.
- color·emoji만으로 unknown·demo·paused를 구분하지 않는다.
- dynamic 상태는 필요한 범위의 `aria-live`와 일본어 문장으로 알린다.
- `lang` 전환을 실제 Japanese screen reader에서 확인한다.

translation key와 API code를 accessible name으로 노출하지 않는다.

## test matrix

- [ ] 모든 B2C locale key가 일본어 값을 가짐
- [ ] unused·duplicate 의미 key review
- [ ] unknown key가 production build에서 실패하거나 안전한 일반 오류로 제한됨
- [ ] `ja` root와 `ko` 주소·phrase language snapshot
- [ ] NFC·combining mark·emoji·전각/반각 경계
- [ ] KST 날짜가 UTC day boundary 전후에 정확함
- [ ] device timezone Japan·UTC·KST에서 expiry absolute 의미 동일
- [ ] KRW 0·known single·range·unknown 표시
- [ ] 비용 unknown이 free로 보이지 않음
- [ ] 360px·200% zoom·font fallback
- [ ] phraseKo·phraseJa 한쪽 누락 publish 거절
- [ ] Japanese content 누락 publish 거절, 이전 공개본 유지
- [ ] server error code와 화면 행동 매핑
- [ ] screenshot·log·analytics에 translation source·사용자 원문 없음

## 증거 양식

```markdown
# locale·표시 검수 YYYY-MM-DD HH:mm KST

- commit·copy source section:
- reviewer code·검수일:
- locale key coverage:
- ja/ko lang attribute:
- KST boundary·device timezone:
- KRW·unknown·free·range:
- 주소·phrase pair:
- 360px·200%·font fallback:
- screen reader·focus·live region:
- 누락·unknown fallback:
- 알려진 용어·표시 제한:
```

참여자 원문·연락처·운영자 identity·실제 secret·비공개 source를 증거에 넣지 않는다.

## 구현 gate

- [ ] P0 B2C의 locale source와 누락 실패 방식이 하나로 고정됐다.
- [ ] 모든 content·error·pause 일본어가 source section과 review 상태를 가진다.
- [ ] UTC 저장·Asia/Seoul 표시와 expiry 문구를 검수했다.
- [ ] KRW unknown·free·single·range가 구분된다.
- [ ] 한국어 주소·phrase에 `lang="ko"`와 일본어 뜻이 있다.
- [ ] runtime 자동 번역·외부 전송이 없다.
- [ ] AC01·AC02·AC06·AC08·AC16~AC19에서 실제 기기 문맥을 확인했다.

연결 검수: AC01, AC02, AC06, AC08, AC16, AC17, AC18, AC19
