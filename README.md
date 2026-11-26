# idea

**한국어** | [日本語](README.ja.md)

DigiMan Hackathon 2026 주제를 고르기 위해 팀원들이 만든 아이디어 데모를 모아 두는 저장소입니다.
여기 있는 코드는 모두 **주제 선정용 데모**입니다. 화면과 흐름을 보여 주는 것이 목적이라 실제 기능은 일부만 동작하거나 가짜 데이터로 채워져 있습니다.

## 폴더 구조

```
line-agent/         이상무 · LINE 여행 비서 (식당 후보·AI 전화 예약)
idea/
├── doil/       최도일
│   ├── subway/          1. 지하철 안내 서비스
│   └── omiyage-seoul/   2. 오미야게 서울
├── sion/       한시온
├── sangmu/     이상무
│   └── kokoseoul/       1. 지하철 안내 서비스 (여기서울: 안내·퀘스트·스탬프)
├── jonghoon/   임종훈
│   └── handcarry/       3. 핸드캐리 중개
├── minyoung/   허민영
└── yeeun/      유예은
```

자기 폴더에 데모 코드나 기획서를 넣어 주세요. 비어 있는 폴더에는 git이 폴더를 유지하도록 `.gitkeep`만 들어 있습니다.

## 아이디어 목록

2026년 11월 22일 회의에서 나온 아이디어 목록입니다.

| # | 아이디어 | 제안 | 상태 |
|---|---|---|---|
| 1 | 지하철 안내 서비스 | 최도일, 한시온, 이상무 | 데모 3종 |
| 2 | 오미야게 서울 | 최도일 | 데모 있음 |
| 3 | 핸드캐리 중개 (엔저 활용) | 임종훈 | 기획서(PRD), 데모 있음 |
| 4 | 쿠스리 | 허민영 | 데모 있음 |
| 5 | 대신전해 | 허민영 | 데모 있음 |
| 6 | 말의 온도 | 허민영 | 데모 있음 |
| 7 | Tasuke (사람 연결) | 확인 필요 | 데모 있음 |
| 8 | 서울日和 | 유예은 | 기획서 있음 |

### 1. 지하철 안내 서비스 (방향 판단 + 스탬프/퀘스트 + 3D)

- **제안:** 최도일, 한시온, 이상무
- **내용:** 승강장 표지를 찍으면 "이 열차를 타도 되는지"를 일본어로 판정하고, 3D 지도에서 열차를 따라가며 역 도착 시 스탬프와 퀘스트를 모은다. API를 연결해 실제 상황 기준으로 안내한다.
- **근거:** 7호선 종착역 표기 사례(장암/석남 방면)
- **코드:** [`idea/doil/subway`](idea/doil/subway), [`idea/sangmu/kokoseoul`](idea/sangmu/kokoseoul) (여기서울 웹/모바일, 퀘스트 웹·모바일 데모의 코드)
- **데모:**
  - 지하철 앱: https://subway-seven-drab.vercel.app
  - 3D: https://subway-seven-drab.vercel.app/#ride
  - 퀘스트 웹: https://yeogiseoul-platform-preview-hjyvtena9-koko-seoul.vercel.app/quests
  - 퀘스트 모바일: https://yeogiseoul-platform-preview-j8m5otr50-koko-seoul.vercel.app/mobile-preview

`subway` 데모 참고 사항:
- 한 파일짜리 웹앱(PWA)이고, 일본어/한국어 전환이 됩니다.
- 안내판 인식은 기기 안에서 OCR로 처리합니다. 먼저 브라우저의 `TextDetector`(애플 기기에서는 Apple Vision)를 쓰고, 안 되면 Tesseract.js로 넘어갑니다.
- 카메라는 HTTPS 또는 localhost에서만 열립니다.
- 3D 화면은 Three.js로 그리며, Chrome의 그래픽 가속이 켜져 있어야 합니다.
- 노선 판정, 기록 통계, 컬렉션은 데모 데이터입니다.

### 2. 오미야게 서울

- **제안:** 최도일
- **내용:** 인원·예산·유통기한을 입력하면 나눠 줄 선물을 추천하고, 판매처와 한국어 구매 문구까지 안내한다.
- **코드:** [`idea/doil/omiyage-seoul`](idea/doil/omiyage-seoul) (기획과 기능 명세는 폴더 안 `README.md`, `PLAN.md`)
- **데모:** https://omiyage-seoul.vercel.app/seoul-color.html (파스텔 버전: https://omiyage-seoul.vercel.app)

### 3. 핸드캐리 중개 (엔저 활용)

- **제안:** 임종훈
- **내용:** 일본인 여행자가 일본 한정 상품을 가져와 한국 구매자에게 전달하고 원화로 정산받는다.
- **상태:** 기획서(PRD) 있음, 데모 있음
- **코드:** [`idea/jonghoon/handcarry`](idea/jonghoon/handcarry) (시연 화면과 설명은 [`idea/jonghoon/README.md`](idea/jonghoon/README.md))
- **데모:** https://handcarry-prototype.vercel.app/buyer
- **검토 필요:** 본인 인증, 구매 증빙, 안전한 전달 방식

### 4. 쿠스리

- **제안:** 허민영
- **내용:** 일본 상비약과 같은 성분의 한국 약을 찾아 준다.
- **상태:** 데모 있음 (글자 인식·약국 지도는 가짜 데모)
- **데모:** https://kusuri-digiman.netlify.app

### 5. 대신전해

- **제안:** 허민영
- **내용:** 말하기 어려운 취소·거절을 AI가 문자나 전화로 대신 전달한다.
- **상태:** 데모 있음 (실제 발송은 가짜 데모, 웹 데모에서는 AI 대신 준비된 예시 결과로 동작)
- **데모:** https://daesin-jeonhae-digiman.netlify.app

### 6. 말의 온도

- **제안:** 허민영
- **내용:** 연애 시뮬레이션으로 배우는 생활 한국어. 말하면 AI가 채점하고 연인 캐릭터가 고쳐 준다.
- **상태:** 데모 있음 (웹 데모에서는 AI 채점·대화·음성 기능이 꺼지고 화면 흐름만 동작)
- **데모:** https://malui-ondo-digiman.netlify.app
### 7. Tasuke (사람 연결)

- **제안:** 확인 필요 (데모는 한시온이 공유)
- **내용:** 위치 기반으로 "말이 안 통해요", "길을 잃었어요" 같은 도움 요청과 제공을 연결한다.
- **데모:** https://tasuke-two.vercel.app/
- **비고:** 1번에 "막힐 때 사람이 돕는 기능"으로 결합 가능

### 8. 서울日和

- **제안:** 유예은 (21일 기획안)
- **내용:** 일본인 중장년 여성을 위한 AI 맞춤 서울 여행 앱. 취향 기반 추천, 일본어 이동 안내, 메뉴판·안내문 촬영 번역과 문화 맥락 설명.
- **상태:** 기획서 있음

## 데모 실행

정적 파일이라 빌드 없이 열 수 있습니다. 카메라와 서비스 워커를 쓰려면 로컬 서버로 여세요.

```bash
cd idea/doil/subway
python3 -m http.server 8000
# http://localhost:8000
```
