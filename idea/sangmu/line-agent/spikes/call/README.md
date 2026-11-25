# 통화 연결 검증 (11/26)

LINE 예약 비서 피벗안의 첫 관문입니다. AI가 한국어로 전화를 걸어 예약 대화를 할 수 있는지, 두 가지 연결 방식으로 확인합니다. 결과를 보고 둘 중 하나를 고르고, 둘 다 안 되면 피벗안을 접습니다.

| | A안: GPT-Live가 SIP로 직접 발신 | B안: Twilio 음성 스트림 ↔ GPT-Live 중계 |
| --- | --- | --- |
| 구조 | OpenAI가 SIP 트렁크로 바로 전화를 겁니다 | Twilio가 전화를 걸고, 통화 음성을 우리 서버(`bridge.mjs`)를 거쳐 GPT-Live와 주고받습니다 |
| 장점 | 서버가 필요 없고, 지연이 가장 짧을 것으로 예상 | 통화 중 이벤트를 우리 서버가 모두 봅니다(끼어들기, 지연 측정, 로그) |
| 확인 안 된 점 | OpenAI 문서가 Twilio를 발신용 트렁크로 명시하지 않음 | 중계 서버와 터널이 하나 더 필요 |
| 파일 | `call-sip.mjs` | `bridge.mjs`, `call-stream.mjs` |

두 방식 모두 통화 음성은 G.711 μ-law 8 kHz 그대로라 변환이 없습니다.

## 사람이 준비할 것

키와 비밀번호는 모두 저장소 루트의 `.env.local`에만 넣습니다. 채팅이나 커밋에 붙여 넣지 않습니다.

1. **OpenAI API 키**: GPT-Live를 쓸 수 있는 프로젝트의 키를 `OPENAI_API_KEY`에 넣습니다.
2. **Twilio 유료 계정**: 체험 계정은 통화 음성 스트림(`<Stream>`)을 막고, 가입한 나라 안으로만 전화를 겁니다. 그래서 업그레이드하고 소액을 충전해야 합니다(최소 금액은 콘솔에서 확인).
   - 음성 통화가 되는 번호를 하나 삽니다. 한국 일반번호는 사업자 서류가 필요해서 미국 번호를 씁니다.
   - 콘솔의 Voice 지역 권한(Geo permissions)에서 South Korea 발신을 켭니다.
   - 값: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`(산 번호, `+1…`)
3. **시험 전화를 받을 팀원 번호**: 동의한 사람 번호만 씁니다. `CALL_TO`에 `+8210…` 형식으로 넣습니다. 실제 가게에는 걸지 않습니다.
4. **B안 터널**: 로컬 중계 서버를 Twilio가 접속할 수 있게 엽니다.
   ```sh
   brew install cloudflared
   cloudflared tunnel --url http://localhost:8787
   ```
   출력된 주소에서 `https://`를 뺀 호스트를 `CALL_BRIDGE_PUBLIC_HOST`에 넣습니다.
5. **A안 SIP 트렁크**: Twilio Elastic SIP Trunking에서 트렁크를 만들고 Termination URI와 자격 증명 목록을 설정합니다. Secure Trunking(TLS 신호 + SRTP 음성)도 켭니다.
   - 값: `SIP_TRUNK_URL`(`sips:<이름>.pstn.twilio.com:5061`), `SIP_USERNAME`, `SIP_PASSWORD`, `SIP_CALLER_NUMBER`(트렁크에 연결한 번호)

선택 값: `OPENAI_LIVE_MODEL`(기본 `gpt-live-1`), `OPENAI_LIVE_VOICE`(기본 `marin`), `CALL_BRIDGE_PORT`(기본 8787).

## 실행

먼저 계정 없이 중계 로직만 확인합니다. 가짜 Twilio와 가짜 GPT-Live로 돌립니다.

```sh
node spikes/call/selftest.mjs
```

**B안**은 터미널 세 개를 씁니다.

```sh
# 1) 중계 서버
node --env-file-if-exists=.env.local spikes/call/bridge.mjs
# 2) 터널
cloudflared tunnel --url http://localhost:8787
# 3) 발신 (시나리오: dinner 또는 full)
node --env-file-if-exists=.env.local spikes/call/call-stream.mjs dinner
```

통화가 끝나면 1번 터미널에 대화 내용, 첫 음성까지 걸린 시간, 턴별 응답 지연, 끼어들기 횟수가 찍힙니다. 자세한 이벤트는 `spikes/call/logs/`에 남습니다. 이 폴더는 git에 올라가지 않습니다.

**A안**은 명령 하나입니다. Ctrl+C를 누르면 전화를 끊습니다.

```sh
node --env-file-if-exists=.env.local spikes/call/call-sip.mjs dinner
```

## 시나리오

`scenarios.mjs`에 있습니다. AI는 첫마디에 AI 예약 비서라고 밝힙니다.

- `dinner`: 오늘 저녁 7시, 3명, 예약자 사토. 6:30–7:30 사이 제안은 바로 수락하고, 그 밖의 시간은 "손님께 확인 후 다시 연락"이라고 답합니다.
- `full`: 오늘 저녁 8시, 2명. 예약이 안 되면 정중히 끊습니다.

가게 역할을 맡은 팀원은 매번 다르게 반응해 봅니다. 예를 들면 바로 수락, 시간 변경 제안, 말 끊기, 빠르게 말하기, 사투리, 전화번호 요구입니다.

## 기록표

통화마다 한 줄씩 채웁니다. 방식별로 3통 이상 겁니다.

| 방식 | 시나리오 | 연결됨 | 첫 음성까지(초) | 응답 지연 중앙값/최대(ms) | 한국어 자연스러움(1–5) | 예약 정보 정확 | 시간 변경 대응 | 끼어들기 처리 | 수신 화면 표시 | 통화 시간·요금 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | |

**결정 기준**: 응답 지연이 대화를 어색하게 만들지 않고, 예약 정보 네 가지(날짜·시간·인원·이름)를 틀리지 않는 쪽을 고릅니다. 수신 화면에 '국제전화'가 뜨는지도 꼭 적습니다. 실제 가게에 걸 수 있을지 판단하는 근거가 됩니다.
