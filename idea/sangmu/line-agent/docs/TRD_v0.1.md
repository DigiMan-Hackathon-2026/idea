# 여기서울 기술 요구사항 TRD v0.1

작성일: 2026-11-23 · 상태: 팀 구현과 검증 기준 · 구현 기준: `d1f5a5f`

여기서울은 Next.js App Router 기반의 단일 웹 애플리케이션이다. 서버는 공개 콘텐츠·공간 검색·익명 진행 상태를 제공한다. 지하철 탐색 화면의 경로 계산, 표지판 판독, 오프라인 안내와 스탬프 획득 기록은 사용자의 브라우저에서 처리한다. [제품 요구사항](PRD_v0.1.md) · [모듈 경계 계약](MODULE_BOUNDARIES_v0.1.md)

## 저장소와 배포 기준

| 확인 대상 | 2026-11-23 확인 결과 |
| --- | --- |
| 원본 저장소 | 로컬 `main`과 GitHub `sangmu1126/digiman`의 `main`이 모두 `d1f5a5f04ce6a3e0d65905bb0fb03f7accc145b6`를 가리켰다. [원본 커밋](https://github.com/sangmu1126/digiman/commit/d1f5a5f04ce6a3e0d65905bb0fb03f7accc145b6) |
| 팀 저장소 | `DigiMan-Hackathon-2026/idea`의 `idea/sangmu/kokoseoul`에 `d1f5a5f`를 복사한 커밋 `dd6fe58`이 있다. 이 경로는 원본 Git 이력을 제외한 제출용 복사본이다. [팀 복사본 커밋](https://github.com/DigiMan-Hackathon-2026/idea/commit/dd6fe581705eabda35717c0f1870ce20265082f2) |
| 비공개 Preview | 인수인계에 배포 commit `c480a1d`와 테스트용 Neon DB의 PostGIS 확인이 남아 있다. 출구 기반 공간 검색은 성수역 3번과 신촌역 3번에서 각각 약 215m, 약 379m의 결과를 확인했다. 현재 GitHub commit의 배포 증거는 별도 확인이 필요하다. [확인된 Preview](https://yeogiseoul-platform-preview-ddqhmafbv-koko-seoul.vercel.app/) · [배포 검증 기록](HANDOFF.md#비공개-preview-배포-및-검증) |
| 배포 자동화 | `Quality` 성공 뒤 `Preview Deploy`가 배포를 시도하도록 구성했다. 최근 완료된 두 실행은 자격 증명 확인 뒤 실제 `deploy` job이 건너뛰어졌다. [GitHub Actions 실행](https://github.com/sangmu1126/digiman/actions/runs/45140114072) |

## 구성과 주요 흐름

| 영역 | 코드와 역할 |
| --- | --- |
| 화면 | Next.js 16.4.6 App Router, React 19.3, TypeScript 5.9, Tailwind CSS 4.3. `/quests`, `/quests/nearby`, `/quests/courses`, `/subway`, `/subway/sign-camera`, `/station-album`, `/my`에서 주요 흐름을 제공한다. 한국어·일본어 선택을 쿠키로 유지한다. |
| 데이터 | PostgreSQL 17, Drizzle ORM, PostGIS. 공개 버전과 진행을 분리하고 진행은 시작 당시 퀘스트 버전을 따른다. 변경된 퀘스트 내용은 새 버전으로 공개한다. |
| 출구 검색 | `GET /api/v1/quests/nearby`는 등록된 출구의 `originId` UUID로 조회한다. 기본 반경 800m·10건, 상한 2km·20건이며 PostGIS `ST_DWithin`과 `ST_Distance`로 직선거리를 구한다. 역 기준 목록은 공통 출구·시작점 파일로도 조회할 수 있다. |
| 지하철 | 로컬 노선 그래프에서 1~9호선의 다음 역과 환승을 계산한다. 사용자가 선택한 출발·도착역과 안내 표지에서 확인한 다음 역을 방향 대조에 사용한다. 역 내부 세부 정보는 출처와 데이터 범위 안에서 표시한다. |
| 지도와 이동 | NAVER 지도에 지도와 브라우저 현재 위치를 표시하고 필요하면 NAVER 앱에 길찾기를 넘긴다. TMAP 보행 경로 요청은 서버 경로를 거친다. 현재 위치 표시와 가까운 역 계산은 브라우저에서 처리한다. |
| 오프라인 | 서비스 워커는 정적 안내와 아이콘을 캐시한다. 사용자가 저장한 공개 퀘스트 텍스트, 선택 지하철 안내, 스탬프 기록은 기기 저장소를 쓴다. 서비스 워커의 캐시 범위는 정적 파일로 제한하고 진행·완료 기록은 서버가 제공한다. |
| 외부 환경 | 로컬·테스트는 Docker의 PostgreSQL/PostGIS, 검증된 Preview는 테스트 전용 Neon/Vercel을 사용한다. `/mobile-preview`는 앱을 같은 출처의 iframe에서 보여 주는 인터랙티브 프레임이다. |

[의존성 및 명령](../package.json) · [API 계약](API_CONTRACT_INDEX_v0.1.md) · [서비스 워커](../public/sw.js) · [지도·보행 계약](MAP_ADDRESS_HANDOFF_v0.1.md)

## 표지판 판독과 안전한 복구

1. `/subway/sign-camera`의 실시간 카메라와 사진 입력에서 프레임을 브라우저 안에서 읽는다. Tesseract.js 7.0의 WebAssembly worker와 한국어·영어 모델은 앱과 같은 출처에서 받는다. 카메라 영상·사진·인식 텍스트는 기기의 작업 메모리에서만 처리한다.
2. **환승 모드**는 화살표와 호선 표식을 묶고 노란 출구 영역을 제외한다. 필요하면 안내 칸 OCR로 호선을 다시 읽는다. 같은 호선 화살표가 여러 개면 행선지와 경로가 충분히 일치할 때만 하나를 강조한다.
3. **승차 방향 모드**는 현재 역번호와 역명을 먼저 대조하고, 스크린도어 표지 화살표가 가리키는 인접 역번호를 읽어 노선 그래프와 선택 경로의 다음 역에 대조한다. 현재 역의 역번호·역명에는 OCR 신뢰도 64 이상, 인접 역번호에는 76 이상을 요구한다. 실시간 영상에서 같은 결과를 두 번 읽은 뒤 표시한다. 저장 사진도 동일한 대조 로직을 사용한다. 다른 승강장, 다른 방향, 판독 보류는 별개의 결과다.
4. **남은 개선**은 실기기에서 받은 실제 영상 해상도와 단계별 실패 확인, 작은 역번호 영역의 선명한 프레임 선택이다. 을지로3가·불광역 원본을 브라우저 영상으로 넣은 검증과 이미지 파일 검증은 완료했다. 휴대폰으로 현장 표지나 모니터를 직접 촬영하는 조건의 성공률은 미측정이다.

[카메라 화면](../src/components/subway-sign-camera.tsx) · [승차 방향 판정](../src/modules/transit/station-sign.ts) · [OCR 처리](../src/modules/transit/sign-ocr.client.ts) · [브라우저 검수](../tests/e2e/subway-sign-camera.spec.ts)

## 데이터와 배포 운영

- 방문자 세션과 진행·피드백·신고는 서버가 소유권과 입력을 검증한다. 퀘스트 시작·단계·완료는 DB의 제약과 트랜잭션으로 중복과 순서를 제어한다. 테스트·데모 열람 범위는 환경에 따라 제한한다. [세션과 보존](VISITOR_SESSION_LIFECYCLE_v0.1.md) · [상태 머신](STATE_MACHINES_v0.1.md)
- 카메라 권한은 카메라 화면에만 같은 출처로 열고, 마이크는 사용하지 않는다. 프레임 허용은 개발·Preview의 정해진 진입점으로 제한한다. 위치는 사용자가 요청할 때 제공하며 브라우저 표시·가까운 역 계산에 사용한다. [HTTP 헤더](../next.config.ts) · [보안과 개인정보](SECURITY_PRIVACY_v0.1.md)
- Preview에는 테스트 전용 DB를 사용한다. 자동 배포에는 GitHub Actions 자격 증명이 필요하다. Preview 배포와 DB migration·콘텐츠 공개는 별도 작업이다. migration `0008`은 공간 검색 테이블과 인덱스를 만든다. [마이그레이션](../drizzle/0008_quest_nearby_search.sql) · [배포와 복구](OPERATIONS_RUNBOOK_v0.1.md)
- 실행 기준은 Node 24.19, pnpm 12.21이다. `pnpm verify`로 린트·타입·단위 테스트·빌드·문서를 검사한다. PostgreSQL 통합과 Playwright E2E, 의존성 감사가 GitHub Quality에 있다. [Quality 워크플로](../.github/workflows/quality.yml) · [QA 계획](TEST_PLAN_v0.1.md)

## 기능별 원본 커밋

| 기능 | 원본 Git 이력 |
| --- | --- |
| 한·일 전환, PWA, 지도와 도보 | `7ce2c9c`, `e890fb3`, `858cc23`, `aff70bd`, `5e273f5` |
| 퀘스트 진행·신고와 데모 환경 분리 | `c47c3e8`, `055f97f`, `3d9d003`, `bb1a7ec` |
| 역사 안내·도감·휴대폰 프레임·환승 | `6742366`, `1d4cc39`, `0576d53`, `0551487`, `b00c725` |
| 온디바이스 OCR·승차 방향·사진 복구 | `b4a0db4`, `7876522`, `c891e51`, `dccfb50`, `dea22e4`, `8277919`, `c480a1d` |
| 주변 검색·역 중심 탐색·노선 코스 | `24974ae`, `8917096`, `7ad0f81`, `cbbba26`, `d185e16` |
| 콘텐츠 버전·오프라인 저장·팀 사본 | `009191e`, `6a051f0`, `a128249`, `d1f5a5f` |
