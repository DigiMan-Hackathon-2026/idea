# 이상무 · 여기서울 (ココソウル)

**한국어** | [日本語](README.ja.md)

서울에서 이동하는 일본인이 **역에서 방향을 확인하고, 내린 뒤 가까운 로컬 경험을 직접 시작**하도록 돕는 모바일 웹·PWA입니다.
화면은 일본어가 기본이고 한국어로 바꿀 수 있습니다. 현장에서 보여 줄 한국어 문장도 함께 나옵니다.

아이디어 목록의 **1. 지하철 안내 서비스**에 해당합니다. 팀에서는 안내·퀘스트·스탬프로 나눠 맡았고, 이상무는 **퀘스트**를 맡았습니다. 이 폴더의 코드에는 세 기능이 모두 들어 있습니다.

## 폴더

| 경로 | 내용 |
|---|---|
| [`kokoseoul/`](kokoseoul) | 앱 전체 코드입니다. 이상무의 개인 저장소(비공개) `main`을 git 기록 없이 복사했습니다. |
| [`kokoseoul/docs/PRD_v0.1.md`](kokoseoul/docs/PRD_v0.1.md) | 제품 요구사항: 대상, 사용자 흐름, 시연 검수 기준 |
| [`kokoseoul/docs/TRD_v0.1.md`](kokoseoul/docs/TRD_v0.1.md) | 기술 요구사항: 구성, 표지판 판독, 데이터·배포 |
| [`kokoseoul/docs/HANDOFF.md`](kokoseoul/docs/HANDOFF.md) | 현재 구현 상태와 인수인계 |

## 데모

비공개 Preview 배포입니다. 열리지 않으면 이상무에게 접근 권한을 요청해 주세요.

- 퀘스트 웹: https://yeogiseoul-platform-preview-hjyvtena9-koko-seoul.vercel.app/quests
- 퀘스트 모바일(휴대폰 프레임): https://yeogiseoul-platform-preview-j8m5otr50-koko-seoul.vercel.app/mobile-preview

## 기능

### 퀘스트 (이상무 담당)

| 화면 | 할 수 있는 것 |
|---|---|
| `/quests` | 목적·시간·지역으로 퀘스트 찾기. 오프라인용으로 저장한 퀘스트가 맨 위에 모입니다. |
| `/quests/nearby` | 역 출구나 현재 위치로 찾은 가까운 역에서 시작하는 퀘스트 |
| `/quests/courses` | 지하철 노선으로 이어지는 코스 6개 |
| `/quests/<퀘스트>` | 출발 출구와 노선, 출구에서의 직선거리, 정기 휴무, 단계별 설명, 보여 주는 한국어 카드, 공식 정보 확인일 |

- 상세의 "여기까지 가는 길 찾기"를 누르면 퀘스트 역이 도착역으로 채워진 채 지하철 안내가 열립니다. 갈아타는 역에서는 출발역 기준으로 환승이 가장 적은 승강장을 고릅니다.
- 오늘(서울 시간)이 정기 휴무일이면 빨갛게 알려 줍니다. 공휴일과 임시 휴무는 알 수 없어서 공식 안내를 확인하라고 안내합니다.
- "오프라인용으로 저장하기"를 누르면 출구·단계·한국어 카드·주소가 기기에 저장됩니다. 전파가 없을 때 같은 주소를 열면 그 내용이 보입니다. 진행 기록이나 위치는 저장하지 않습니다.
- 카테고리는 식도락, 관광·문화 체험, 뷰티, 쇼핑, 휴식·산책, 일상 속 새로운 경험의 6가지입니다. 소스에 등록된 장소형 퀘스트는 30개입니다. 이 중 출구 좌표가 연결된 장소가 29개, 출구가 24개입니다.
- 퀘스트 내용은 공식 출처와 확인일을 기준으로 씁니다. 공개 전 검수 절차는 [`CONTENT_VERIFICATION_v0.1.md`](kokoseoul/docs/CONTENT_VERIFICATION_v0.1.md)와 [`quest-drafts/PUBLISHING.md`](kokoseoul/research/desk/quest-drafts/PUBLISHING.md)에 있습니다.

### 지하철 안내 · 스탬프

- `/subway`: 1~9호선의 경로, 환승, 다음 정차역, 역무원에게 보여 줄 한국어 문장, 역 내부 안내. 마지막으로 고른 이동 정보는 오프라인에서도 보입니다.
- `/subway/sign-camera`: 승강장 표지를 카메라나 사진으로 읽어 탈 방향이 맞는지 판정합니다. OCR은 기기 안에서만 처리합니다.
- `/station-album`: 역 이름 이야기를 읽고, 그 역에서 위치 확인을 통과하면 스탬프를 받습니다.
- `/my`: 가입 없이 진행한 퀘스트 기록을 보거나 지웁니다.

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 + PostGIS · Drizzle ORM · Tesseract.js(기기 내 OCR) · NAVER 지도 · TMAP 보행 경로 · Vitest · Playwright

## 로컬에서 실행하기

Node 24.19와 pnpm 12.21을 씁니다.

```sh
cd idea/sangmu/kokoseoul
pnpm install --frozen-lockfile
cp .env.example .env.local   # 필요한 값만 채웁니다. 키는 커밋하지 않습니다.
pnpm dev                     # http://localhost:3000
```

- 퀘스트 진행 기록과 주변 검색 API에는 PostgreSQL/PostGIS가 필요합니다. 로컬 DB는 [`compose.yaml`](kokoseoul/compose.yaml)로 띄웁니다. 환경 변수는 [`.env.example`](kokoseoul/.env.example)과 [`CONFIGURATION_SECRETS_v0.1.md`](kokoseoul/docs/CONFIGURATION_SECRETS_v0.1.md)를 참고해 주세요.
- 검사: `pnpm verify`(lint·타입·단위 테스트·빌드·문서), `pnpm test:e2e`(Playwright)

## 퀘스트 코드 위치

| 경로 | 내용 |
|---|---|
| `src/app/quests/` | 퀘스트 목록, 역에서 찾기, 코스, 상세 |
| `src/components/visit-guide-page.tsx`, `quest-access-card.tsx` | 상세 화면과 "지하철로 가기" 카드 |
| `src/components/save-quest-offline.tsx`, `saved-quests.tsx` | 오프라인 저장 버튼, 저장한 퀘스트 목록 |
| `src/modules/content/` | 퀘스트 데이터, 출구 연결, 코스, 정기 휴무, 오프라인 저장 형식 |
| `public/quest-offline.html`, `public/sw.js` | 전파가 없을 때 보이는 퀘스트 화면과 서비스 워커 |
| `research/desk/quest-drafts/` | 퀘스트 초안과 현장 확인 목록 |

## 이 폴더 갱신

`kokoseoul/`은 원본 저장소에서 `pnpm idea:sync --push`로 덮어씁니다. 직접 고치면 다음 갱신 때 사라지니, 수정할 것이 있으면 이상무에게 알려 주세요. 이 README는 `kokoseoul/` 밖에 있어서 갱신해도 그대로 남습니다.

현재 복사본 기준 커밋: `91f8c9f` (2026-11-23)
