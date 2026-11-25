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
| 음성 중계 | `services/voice-bridge/` | KAT 클라우드·Twilio 통화 음성 ↔ OpenAI GPT-Live, 끝나면 대화 기록을 앱에 보고 |

## 1. 시뮬레이터로 리허설하기 (계정 불필요)

```sh
pnpm install
pnpm dev                     # http://localhost:3000
open http://localhost:3000/dev/line-agent
```

- 기본 전화 모드는 `simulator`다. 실제로 전화하지 않고, 테스트 가게가 대본대로 답한다(`demo-shop-a`·`demo-shop-b`는 수락, `demo-shop-c`는 19시만 가능). 신촌 후보에서는 돈불이 B, 설레임이 C, 고기창고가 A다. 그래서 돈불의 대기가 길다고 알리면 설레임(19시 제안)에 먼저 걸고, 이어서 고기창고가 수락한다.
- 통화가 끝나면 화면 위 「通話ログ」에 한국어 대화 전문이 쌓이고, 「再生」을 누르면 브라우저 음성으로 읽어 준다. 행사장에서 실제 전화가 안 될 때의 대체 시연용이다.
- 앱이 재시작돼도 진행 중인 요청을 잃지 않으려면 `LINE_AGENT_STORE=postgres`를 켠다(아래 4절).
- 리허설 시각을 고정하려면 `.env.local`에 `LINE_AGENT_DEMO_NOW=2026-11-29T17:30:00+09:00`을 넣는다. 서버를 켠 순간부터 그 시각에서 시간이 흐른다.
- 대기 화면 캡처는 「待ち状況を送る」를 누른 뒤 「画像」으로 올린다. 서버에서 글자를 읽어(OCR, 한국어·일본어) 분·팀 수를 기록하고, 이미지는 저장하지 않는다. 처음 한 번 언어 데이터를 내려받는다.
- 시뮬레이터는 이 컴퓨터(localhost)에서만 열린다. 터널로 공개해도 밖에서는 404다. 다른 기기에서 써야 하면 `LINE_AGENT_SIMULATOR_TOKEN`(16자 이상)을 정하고 `/dev/line-agent?token=…`으로 연다. `kat`·`twilio` 모드에서는 시뮬레이터가 실제로 전화를 걸기 때문이다.
- 그룹 대화를 재현하려면 「グループ」를 켠다. Alice가 요청한 사람이고, Bob이 버튼을 누르면 권한이 없다고 나온다.

시연 대본(스펙 3분 시연과 같은 순서):

1. 「このお店、今日2人で行ける？20時までに弘大のライブ会場に着きたい」와 설레임의 네이버 지도 링크(`https://map.naver.com/p/entry/place/31737840`, 앱의 공유 링크 `naver.me/…`도 된다)를 보낸다. 시뮬레이터는 「例：お店のリンク」를 누르면 채워진다.
2. 「リンクから「ソルレイム…」だと分かりました」와 판정 카드가 온다. 영업시간(네이버 플레이스, 확인일)과 다음 일정까지의 시간은 ○, 지금의 빈자리·대기는 「お店にしか分かりません」으로 ？다. 그래서 「確認が必要です」.
3. 「AIに電話で確かめてもらう」 → 1:1에서 예약명 입력 → 승인 카드(1. 설레임, 2. 다른 가게)의 「この条件で電話を頼む」.
4. 설레임이 19시만 된다고 하면, 공연에 늦으므로 다시 묻지 않고 다음 가게에 전화한다. 다음 가게가 수락하면 확정 카드가 온다.
5. 「お店への行き方を見る」로 여기서울 안내를 연다.

가게가 오늘 안 되는 경우(영업 전·휴무·마감 초과)에는 판정 카드가 「今日は難しそうです」와 「近くの似たお店」를 보여 주고, 그 가게에는 전화하지 않는다. 링크 대신 가게 이름(「ソルレイムに今日2人で行ける？」)이나 1:1의 간판 사진도 된다. 인스타그램처럼 열 수 없는 링크는 이름·지도 링크·사진을 달라고 답한다. 가게를 정하지 않았으면 예전처럼 「新村で2人、サムギョプサル…」로 후보를 찾는다.

### AI 전화 콘솔 (시연 때 옆 화면)

`/dev/line-agent/console`을 열면 AI가 가게에 거는 전화가 실시간으로 보인다. 시뮬레이터와 같이 이 컴퓨터에서만 열린다(다른 기기는 `?token=…`).

- 위쪽: LINE·전화망·음성 AI·저장소 연결 상태, 고정된 시연 시각.
- 가운데: 손님이 승인한 조건(인원·시간대·다음 일정)과 가게별 통화 카드. 실제 통화는 음성 중계가 0.3초마다 보내는 대화가 그대로 쌓이고, 말이 끝난 줄에는 일본어 자막이 붙는다(`OPENAI_API_KEY`, 모델은 `OPENAI_TRANSLATE_MODEL`, 기본 `gpt-4.1-mini`).
- 아래: 통화 결과(예약 성립, 범위 밖 시간 제안 후 다음 가게, 거절, 응답 없음).
- 시뮬레이터 통화는 대화가 한 번에 오므로, 화면에서 한 줄씩 1.6초 간격으로 다시 보여 준다.
- 화면 기록은 서버 메모리에만 있고 최근 20통화만 남는다. 결과의 근거는 계속 저장소의 요청 기록이다.

## 2. 실제 LINE에 연결하기

필요한 것: LINE 공식 계정과 Messaging API 채널, 공개 HTTPS 주소.

1. LINE Developers에서 Messaging API 채널을 만들고 채널 시크릿과 채널 액세스 토큰(장기)을 발급한다.
2. LINE Official Account Manager에서 자동 응답·인사 메시지를 끄고, 그룹·여러 명 대화 참여를 허용한다.
3. 공개 주소를 연다. 시연에는 아래 '고정 공개 주소'를 쓴다. 잠깐 시험할 때는 `cloudflared tunnel --url http://localhost:3000`도 되지만, 주소가 매번 바뀌고 몇 시간 만에 끊기기도 한다. 나온 주소를 `APP_ORIGIN`에 넣는다(링크가 이 주소로 만들어진다).
4. `.env.local`에 `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_AGENT_KEY_SECRET`, `LINE_AGENT_LINK_SECRET`을 넣고 서버를 다시 켠다. 값은 채팅이나 git에 붙여 넣지 않는다.
5. 채널의 웹훅 URL을 `https://<공개 주소>/api/v1/integrations/line/webhook`으로 정하고 「Use webhook」을 켠 뒤 「Verify」를 누른다.

그룹에서는 「ココソウル」을 붙여 부르거나 비서를 멘션해야 반응한다.

카드 위 역 이미지는 `public/line-agent/hero/<역코드>.png`이고, 역을 추가하면 `node scripts/line/render-hero-images.mjs`로 다시 만든다. LINE은 HTTPS 이미지만 읽으므로 `APP_ORIGIN`이 HTTPS일 때만 붙는다.

대화창 아래 고정 메뉴(使い方 · ごはんを探す · やめる)는 `pnpm line:richmenu`로 한 번 만든다. 이미지만 미리 보려면 `node scripts/line/setup-rich-menu.mjs --dry-run menu.png`.

### 고정 공개 주소 (Tailscale Funnel)

도메인 없이 무료로 고정 주소 `https://<맥 이름>.<tailnet>.ts.net`을 쓴다. 앱과 음성 중계를 주소 하나로 연다.

1. Tailscale 앱에 로그인한다. 처음 Funnel을 켤 때 나오는 링크에서 Funnel을 허용한다.
2. 경로를 나눠 연다(맥에서는 `/Applications/Tailscale.app/Contents/MacOS/Tailscale`이 `tailscale` 명령이다).
   - `tailscale funnel --bg http://127.0.0.1:3120` (앱)
   - `tailscale funnel --bg --set-path /kat http://127.0.0.1:8787/kat` (KAT 음성 중계)
   - 확인: `tailscale funnel status`
3. `.env.local`에 `APP_ORIGIN=https://<주소>`, `VOICE_BRIDGE_PUBLIC_HOST=<주소>`(https:// 없이)를 넣는다. 앱은 `-p 3120`으로 켠다.
4. LINE 웹훅 URL을 `https://<주소>/api/v1/integrations/line/webhook`으로 한 번만 바꾸면 된다.

맥이 켜져 있고 Tailscale이 연결돼 있어야 한다. 끄려면 `tailscale funnel --https=443 off`. 주소에는 맥 이름이 들어가므로 시연 전에 맥 이름을 정해 두면 좋다.

## 3. 실제 전화 켜기

전화망은 둘 중 하나를 고른다. 한국 가게에 거는 시연이면 KAT 클라우드를 권한다.

| | KAT 클라우드 (`kat`) | Twilio (`twilio`) |
| --- | --- | --- |
| 받는 쪽 화면 | 070 국내 번호 | 해외 번호('국제전화'로 뜰 수 있음) |
| 계정 | 개인 요금제 월 1만 원(발신 70분 포함), 7일 체험 | 유료 계정 + 번호 + 한국 발신 허용 |
| 제약 | API는 한국 IP에서만 받는다. 국내 번호만, 동시 발신 1통, 하루 100통(기본) | 체험 계정은 음성 스트림 불가 |

공통으로 필요한 것: OpenAI API 키(GPT-Live), 시험 전화를 받기로 동의한 팀원 번호, 음성 중계.

### KAT 클라우드 (katcloud.kr, 한국에이아이통신)

1. katcloud.kr에 가입하면 070 번호가 나온다. 콘솔에서 API 키를 만든다. 웹훅 서명 비밀값(`whsec_…`)도 받아 두면 좋다.
2. `.env.local`에 다음을 넣는다.
   - `LINE_AGENT_CALLS=kat`
   - `KAT_API_KEY`(`zpa.…`), `KAT_FROM`(가입 때 받은 070 번호)
   - 선택: `KAT_WEBHOOK_SECRET`(넣으면 앱과 중계가 KAT 서명을 확인한다), `KAT_GROUP_ID`(비우면 처음 걸 때 조회한다)
   - `LINE_AGENT_PHONE_ALLOWLIST`, `VOICE_BRIDGE_SECRET`, `OPENAI_API_KEY`, `VOICE_BRIDGE_APP_URL`은 아래 Twilio와 같다.
3. 음성 중계와 중계용 공개 주소는 아래 3·4번과 같다. KAT는 가게가 받은 뒤 `wss://<VOICE_BRIDGE_PUBLIC_HOST>/kat`로 접속한다.
4. 앱은 한국 IP에서 돌아야 한다(해외 IP는 `403 GL011`). 로컬 맥은 문제없다. Vercel에 올리면 함수 지역을 서울(icn1)로 둔다.

AI가 통화 첫마디에서 AI 비서라고 밝힌다. KAT의 통화 시작 안내 방송(`AI_AND_RECORDING`)은 기본으로 꺼져 있고, 켜면 가게가 받은 뒤 최대 25초 동안 안내가 먼저 나온다.

### Twilio

1. Twilio 콘솔에서 Voice 지역 권한(Geo permissions)의 South Korea 발신을 켠다. 체험 계정은 음성 스트림을 막으므로 유료로 바꾼다.
2. `.env.local`에 다음을 넣는다.
   - `LINE_AGENT_CALLS=twilio`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
   - `LINE_AGENT_PHONE_ALLOWLIST={"demo-shop-a":"+8210…","demo-shop-b":"+8210…","demo-shop-c":"+8210…"}` (동의한 번호만)
   - `VOICE_BRIDGE_SECRET`(16자 이상), `OPENAI_API_KEY`, `VOICE_BRIDGE_APP_URL=http://localhost:3000`
3. 음성 중계를 켠다: `pnpm voice:bridge` (포트 8787).
4. 중계용 공개 주소: 고정 공개 주소를 쓰면 `/kat` 경로로 이미 열려 있다. 아니면 `cloudflared tunnel --url http://localhost:8787`로 하나 더 열고, 주소에서 `https://`를 뺀 호스트를 `VOICE_BRIDGE_PUBLIC_HOST`에 넣은 뒤 앱 서버를 다시 켠다.

`APP_ORIGIN`은 앱의 공개 주소여야 한다. 전화망이 통화 결과 상태(안 받음·통화 중·종료)를 이 주소로 알려 준다. 음성 중계는 같은 컴퓨터의 앱에 `VOICE_BRIDGE_APP_URL=http://localhost:3000`으로 붙는다.

시뮬레이터에서도 `kat`·`twilio` 모드면 실제로 전화가 간다. LINE 채널 없이 전화부터 시험할 수 있다. Twilio는 수신 화면에 '국제전화'가 뜨는지 꼭 확인한다.

### 시연 통화에서 가게 역할 대본

실제 통화 시연은 `demo-shop-c`(설레임, 첫 통화)와 `demo-shop-a`(고기창고, 두 번째 통화)를 허용 목록에 넣는다. 한 팀원이 두 역할을 다 맡아도 된다(같은 번호). KAT는 동시에 한 통화만 걸리므로 두 통화는 차례로 온다.

- 첫 통화: 받으면 "네, 설레임입니다." → AI가 첫마디에 시간대와 인원을 말하며 예약되는지 묻는다 → "그 시간은 꽉 찼고요, 일곱 시는 돼요." → AI가 다시 연락하겠다고 하면 "네." 하고 기다린다(AI가 끊는다).
- 두 번째 통화: "네, 고기창고입니다." → "6시 반에 두 분 가능해요." → AI가 "예약 확인: 오늘 저녁 6시 반, 2명, …"라고 복창하면 "네, 맞아요." → AI가 "감사합니다." 하고 끊는다.
- 시간은 시와 분을 또렷하게 말한다("여섯 시 반"). AI가 끝나기 전에 끼어들지 않는다.
- 통화 선별(스팸 차단 비서) 기능이 켜져 있으면 끈다.

## 4. 상태를 DB에 저장하기 (선택)

기본 저장소는 메모리라서 서버를 다시 켜면 진행 중인 요청이 사라진다. 시연 중 재시작에 대비하려면 PostgreSQL을 쓴다.

1. 마이그레이션 `drizzle/0009_line_agent.sql`을 적용하고 `scripts/db/configure_roles.sql`로 권한을 다시 준다.
2. `.env.local`에 `LINE_AGENT_STORE=postgres`를 넣는다. 런타임 역할(`DATABASE_URL`)로 접속한다.
3. 만료된 요청·이벤트·예약명은 한 시간마다 지운다(만료 후 24시간).

로컬 컨테이너에 PostGIS가 없으면 기존 마이그레이션 0008이 적용되지 않는다. 이 경우 `0009_line_agent.sql`만 직접 적용해도 비서 저장소는 동작한다. 이때 `configure_roles.sql`은 없는 테이블 때문에 멈추므로, `DATABASE_URL`의 역할에 `public` 스키마 사용 권한과 `line_agent_*` 네 테이블의 읽기·쓰기 권한만 따로 준다. CI는 PostGIS 이미지로 전체 마이그레이션을 돈다.

## 안전 규칙

- 허용 목록에 있는 번호에만 전화한다. 모델이나 사용자가 번호를 정할 수 없다.
- AI는 첫마디에 AI 비서라고 밝힌다. 승인 범위 밖의 시간, 예약금, 결제 정보 요구에는 확정하지 않고 LINE으로 다시 묻는다.
- 예약을 요청한 뒤 결과가 불분명하면 다음 가게에 전화하지 않는다.
- 실제 매장에는 동의 없이 걸지 않는다. 후보 목록의 신촌 가게는 실제 가게지만 `testCall`이라 전화는 동의한 팀원 번호(`LINE_AGENT_PHONE_ALLOWLIST`)로만 가고, 카드에 테스트 통화라고 표시된다.
- 키와 전화번호는 `.env.local`에만 둔다. CI의 `secrets` 작업이 Gitleaks로 git 전체 이력을 검사하고, 걸리면 값은 가린 채 규칙·파일·줄·커밋만 보여 준다(`.gitleaks.toml`). 로컬에서 미리 보려면 `docker run --rm -v "$PWD":/repo:ro ghcr.io/gitleaks/gitleaks:v8.30.1 git --redact=100 /repo`.
- CI가 쓰는 GitHub Actions는 커밋 SHA로 고정하고, 체크아웃 토큰은 남기지 않는다(`persist-credentials: false`).

## 확인

```sh
pnpm test                     # 단위 테스트 (src/modules/line-agent 포함)
pnpm voice:selftest           # 음성 중계 오프라인 시험
node spikes/call/selftest.mjs # 통화 검증 스파이크 오프라인 시험
```
