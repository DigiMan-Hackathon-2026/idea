# LINE 여행 비서 실행 안내

작성일: 2026-11-25 · 상태: 시연 준비용 · 대상: 팀원

이 저장소에서 LINE 비서를 돌리는 방법이다. 외부 계정 없이 브라우저 시뮬레이터로 전체 흐름을 리허설할 수 있고, 계정이 준비되면 같은 코드로 실제 LINE과 실제 전화를 켠다. 스펙은 [LINE 여행 비서 스펙](LINE_AGENT_SPEC.md), 범위와 진행 상황은 [구현 계획](LINE_AGENT_BUILD_PLAN.md)에 있다.

## 구성

| 부분 | 위치 | 하는 일 |
| --- | --- | --- |
| 에이전트 | `src/modules/line-agent/` | 요청 해석, 후보·착석 마감 계산, 승인 카드, 순차 발신, 통화 결과 판정 |
| LINE 웹훅 | `POST /api/v1/integrations/line/webhook` | 서명 검증 후 이벤트 처리 |
| 시뮬레이터 | `/dev/line-agent` | LINE 없이 1:1·그룹 대화를 재현. 운영 환경에서는 꺼짐 |
| 가는 길·예약 카드 | `/go`, `/go/card` | 여기서울 지하철 안내와 네이버 지도로 연결, 가게에 보여 줄 한국어 카드 |
| 음성 중계 | `services/voice-bridge/` | Twilio 통화 음성 ↔ OpenAI GPT-Live, 끝나면 대화 기록을 앱에 보고 |

## 1. 시뮬레이터로 리허설하기 (계정 불필요)

```sh
pnpm install
pnpm dev                     # http://localhost:3000
open http://localhost:3000/dev/line-agent
```

- 기본 전화 모드는 `simulator`다. 실제로 전화하지 않고, 테스트 가게가 대본대로 답한다(B·A는 수락, C는 19시만 가능).
- 리허설 시각을 고정하려면 `.env.local`에 `LINE_AGENT_DEMO_NOW=2026-11-29T17:30:00+09:00`을 넣는다. 서버를 켠 순간부터 그 시각에서 시간이 흐른다.
- 대기 화면 캡처는 「待ち状況を送る」를 누른 뒤 「画像」으로 올린다. 서버에서 글자를 읽어(OCR, 한국어·일본어) 분·팀 수를 기록하고, 이미지는 저장하지 않는다. 처음 한 번 언어 데이터를 내려받는다.
- 그룹 대화를 재현하려면 「グループ」를 켠다. Alice가 요청한 사람이고, Bob이 버튼을 누르면 권한이 없다고 나온다.

시연 대본(스펙 3분 시연과 같은 순서):

1. 「新村で2人、サムギョプサルが食べたいです。20時までに弘大のライブ会場に着きたいです。」
2. 첫 카드의 「待ち状況を送る」 → 「90分待ち」 → 「着いてから並ぶ」. 첫 가게가 마감을 넘긴다고 나온다.
3. 「電話で聞いてもらう」 → 1:1에서 예약명 입력 → 승인 카드의 「この条件で電話を頼む」.
4. 첫 가게가 19시만 된다고 하면, 다시 묻지 않고 다음 가게에 전화한다. 다음 가게가 수락하면 확정 카드가 온다.
5. 「お店への行き方を見る」로 여기서울 안내를 연다.

## 2. 실제 LINE에 연결하기

필요한 것: LINE 공식 계정과 Messaging API 채널, 공개 HTTPS 주소.

1. LINE Developers에서 Messaging API 채널을 만들고 채널 시크릿과 채널 액세스 토큰(장기)을 발급한다.
2. LINE Official Account Manager에서 자동 응답·인사 메시지를 끄고, 그룹·여러 명 대화 참여를 허용한다.
3. 공개 주소를 연다: `cloudflared tunnel --url http://localhost:3000`. 나온 주소를 `APP_ORIGIN`에 넣는다(링크가 이 주소로 만들어진다).
4. `.env.local`에 `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_AGENT_KEY_SECRET`, `LINE_AGENT_LINK_SECRET`을 넣고 서버를 다시 켠다. 값은 채팅이나 git에 붙여 넣지 않는다.
5. 채널의 웹훅 URL을 `https://<공개 주소>/api/v1/integrations/line/webhook`으로 정하고 「Use webhook」을 켠 뒤 「Verify」를 누른다.

그룹에서는 「ココソウル」을 붙여 부르거나 비서를 멘션해야 반응한다.

대화창 아래 고정 메뉴(使い方 · ごはんを探す · やめる)는 `pnpm line:richmenu`로 한 번 만든다. 이미지만 미리 보려면 `node scripts/line/setup-rich-menu.mjs --dry-run menu.png`.

## 3. 실제 전화 켜기

필요한 것: OpenAI API 키(GPT-Live), Twilio 유료 계정과 번호, 시험 전화를 받기로 동의한 팀원 번호.

1. Twilio 콘솔에서 Voice 지역 권한(Geo permissions)의 South Korea 발신을 켠다. 체험 계정은 음성 스트림을 막으므로 유료로 바꾼다.
2. `.env.local`에 다음을 넣는다.
   - `LINE_AGENT_CALLS=twilio`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
   - `LINE_AGENT_PHONE_ALLOWLIST={"demo-shop-a":"+8210…","demo-shop-b":"+8210…","demo-shop-c":"+8210…"}` (동의한 번호만)
   - `VOICE_BRIDGE_SECRET`(16자 이상), `OPENAI_API_KEY`
3. 음성 중계를 켠다: `pnpm voice:bridge` (포트 8787).
4. 중계용 공개 주소를 하나 더 연다: `cloudflared tunnel --url http://localhost:8787`. 주소에서 `https://`를 뺀 호스트를 `VOICE_BRIDGE_PUBLIC_HOST`에 넣고 앱 서버를 다시 켠다.

시뮬레이터에서도 `twilio` 모드면 실제로 전화가 간다. LINE 채널 없이 전화부터 시험할 수 있다. 수신 화면에 '국제전화'가 뜨는지 꼭 확인한다.

## 4. 상태를 DB에 저장하기 (선택)

기본 저장소는 메모리라서 서버를 다시 켜면 진행 중인 요청이 사라진다. 시연 중 재시작에 대비하려면 PostgreSQL을 쓴다.

1. 마이그레이션 `drizzle/0009_line_agent.sql`을 적용하고 `scripts/db/configure_roles.sql`로 권한을 다시 준다.
2. `.env.local`에 `LINE_AGENT_STORE=postgres`를 넣는다. 런타임 역할(`DATABASE_URL`)로 접속한다.
3. 만료된 요청·이벤트·예약명은 한 시간마다 지운다(만료 후 24시간).

로컬 컨테이너에 PostGIS가 없으면 기존 마이그레이션 0008이 적용되지 않는다. 이 경우 `0009_line_agent.sql`만 직접 적용해도 비서 저장소는 동작한다. CI는 PostGIS 이미지로 전체 마이그레이션을 돈다.

## 안전 규칙

- 허용 목록에 있는 번호에만 전화한다. 모델이나 사용자가 번호를 정할 수 없다.
- AI는 첫마디에 AI 비서라고 밝힌다. 승인 범위 밖의 시간, 예약금, 결제 정보 요구에는 확정하지 않고 LINE으로 다시 묻는다.
- 예약을 요청한 뒤 결과가 불분명하면 다음 가게에 전화하지 않는다.
- 실제 매장에는 동의 없이 걸지 않는다. 후보 목록의 가게는 모두 테스트 가게이며 카드에 테스트라고 표시된다.

## 확인

```sh
pnpm test                     # 단위 테스트 (src/modules/line-agent 포함)
pnpm voice:selftest           # 음성 중계 오프라인 시험
node spikes/call/selftest.mjs # 통화 검증 스파이크 오프라인 시험
```
