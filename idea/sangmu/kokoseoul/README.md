# 여기서울 · ココソウル Hackathon

서울에 있는 일본인이 새로운 로컬 경험을 발견하고 실행하도록 돕는 서비스의 개인 작업 저장소입니다.

B2C 반응형 웹과 설치 가능한 PWA를 먼저 구현하고, 사용자와 공급자의 요구가 확인되면 B2B 운영 기능을 추가합니다. 웹과 홈 화면 설치 앱은 같은 코드와 배포 버전을 사용합니다.

## 설계 문서

- [현재 구현 준비도](docs/READINESS_STATUS.md)
- [열린 결정과 우선순위](docs/DECISION_QUEUE.md)
- [B2C 설계 스펙 v0.1](docs/B2C_SPEC_v0.1.md)
- [도메인 용어·명명 계약 v0.1](docs/DOMAIN_GLOSSARY_v0.1.md)
- [B2C API 요청과 응답 예시 v0.1](docs/API_EXAMPLES_B2C_v0.1.md)
- [운영 API 요청과 응답 예시 v0.1](docs/API_EXAMPLES_ADMIN_v0.1.md)
- [API 인증·캐시·재시도 계약 인덱스 v0.1](docs/API_CONTRACT_INDEX_v0.1.md)
- [API 오류·request ID catalog v0.1](docs/API_ERROR_CATALOG_v0.1.md)
- [목록 pagination·cursor 계약 v0.1](docs/PAGINATION_CURSOR_v0.1.md)
- [입력 검증·정규화 계약 v0.1](docs/INPUT_VALIDATION_v0.1.md)
- [속도 제한·남용 대응 계약 v0.1](docs/RATE_LIMIT_ABUSE_v0.1.md)
- [HTTP 보안·캐시 header 계약 v0.1](docs/HTTP_SECURITY_HEADERS_v0.1.md)
- [기술 결정 v0.1](docs/TECH_DECISIONS_v0.1.md)
- [애플리케이션 module·import 경계 계약 v0.1](docs/MODULE_BOUNDARIES_v0.1.md)
- [외부 서비스 평가와 선택 조건 v0.1](docs/EXTERNAL_SERVICES_EVALUATION_v0.1.md)
- [PostgreSQL 데이터 정합성 계약 v0.1](docs/DATA_CONSTRAINTS_v0.1.md)
- [도메인 상태 머신 계약 v0.1](docs/STATE_MACHINES_v0.1.md)
- [분석 이벤트와 지표 계약 v0.1](docs/ANALYTICS_EVENT_CONTRACT_v0.1.md)
- [B2C 구현 계획 v0.1](docs/IMPLEMENTATION_PLAN_v0.1.md)
- [F0 개발 환경 착수 계획 v0.1](docs/F0_BOOTSTRAP_PLAN_v0.1.md)
- [환경 설정·secret 운영 계약 v0.1](docs/CONFIGURATION_SECRETS_v0.1.md)
- [F1 PostgreSQL 구현·검수 계획 v0.1](docs/F1_DATABASE_PLAN_v0.1.md)
- [PostgreSQL migration·backfill 배포 계약 v0.1](docs/DATABASE_MIGRATION_RELEASE_v0.1.md)
- [의존성·에셋·AI 출처 관리 v0.1](docs/DEPENDENCY_ATTRIBUTION_v0.1.md)
- [팀 실행·인수인계 계획 v0.1](docs/TEAM_EXECUTION_v0.1.md)
- [여기서울 UX 원칙 v0.1](docs/UX_PRINCIPLES_v0.1.md)
- [여기서울 서울색 UI 체계 v0.1](docs/SEOUL_COLOR_SYSTEM_v0.1.md)
- [B2C 화면 상태와 일본어 문구 계약 v0.1](docs/SCREEN_STATES_v0.1.md)
- [클라이언트 요청·복구 계약 v0.1](docs/CLIENT_RECOVERY_v0.1.md)
- [일본어 문구 검수 절차 v0.1](docs/JAPANESE_COPY_REVIEW_v0.1.md)
- [일본어 locale·표시 형식 계약 v0.1](docs/LOCALIZATION_FORMATTING_v0.1.md)
- [모바일 접근성 구현·검수 v0.1](docs/ACCESSIBILITY_VERIFICATION_v0.1.md)
- [지도 URL·한국어 주소 전달 계약 v0.1](docs/MAP_ADDRESS_HANDOFF_v0.1.md)
- [지하철 현장 판단·복구 가설 v0.1](docs/SUBWAY_FIELD_GUIDE_v0.1.md)
- [B2C 검수와 테스트 계획 v0.1](docs/TEST_PLAN_v0.1.md)
- [테스트 fixture·seed 계약 v0.1](docs/TEST_FIXTURES_v0.1.md)
- [성능·부하 검수 계약 v0.1](docs/PERFORMANCE_LOAD_TEST_v0.1.md)
- [보안과 개인정보 위협 모델 v0.1](docs/SECURITY_PRIVACY_v0.1.md)
- [운영자 인증·인가 계약 v0.1](docs/ADMIN_AUTHORIZATION_v0.1.md)
- [익명 방문자 session 수명주기 계약 v0.1](docs/VISITOR_SESSION_LIFECYCLE_v0.1.md)
- [방문자 데이터 보존·삭제·복구 계약 v0.1](docs/DATA_RETENTION_ERASURE_v0.1.md)
- [보존·cleanup background job 계약 v0.1](docs/BACKGROUND_JOBS_v0.1.md)
- [로그·지표·오류 관측 계약 v0.1](docs/OBSERVABILITY_CONTRACT_v0.1.md)
- [운영 감사 로그 계약 v0.1](docs/AUDIT_LOG_CONTRACT_v0.1.md)
- [배포와 복구 운영 런북 v0.1](docs/OPERATIONS_RUNBOOK_v0.1.md)
- [장애 대응 런북 v0.1](docs/INCIDENT_RESPONSE_v0.1.md)
- [2분 제품 시연 런북 v0.1](docs/DEMO_RUNBOOK_v0.1.md)
- [출시 준비 판정 v0.1](docs/RELEASE_READINESS_v0.1.md)
- [해커톤 사전 개발 범위 확인서](docs/EVENT_RULES_CHECKLIST.md)
- [일본인 사용자 검증 계획 v0.1](docs/USER_RESEARCH_v0.1.md)
- [퀘스트 콘텐츠 사실과 권리 검수 v0.1](docs/CONTENT_VERIFICATION_v0.1.md)
- [콘텐츠 편집·공개 계약 v0.1](docs/CONTENT_AUTHORING_v0.1.md)
- [정보 오류 신고 처리 런북 v0.1](docs/REPORT_TRIAGE_v0.1.md)
- [맥북 Codex 인수인계](docs/HANDOFF.md)

스펙에는 사용자 흐름, 화면, 데이터 모델, API 계약, 콘텐츠 운영, B2B 확장 지점과 20개 검수 시나리오가 포함되어 있습니다. 개발 계약의 기준은 이 저장소의 문서입니다.

## 사용자 조사

- [조사 작업공간과 기록 규칙](research/README.md)
- [일본인 사용자 인터뷰 모집 문안](research/RECRUITMENT_MESSAGES.md)
- [사용자 인터뷰 세션 진행 가이드](research/INTERVIEW_SESSION_GUIDE.md)
- [인터뷰 사건·관찰 evidence coding 가이드](research/EVIDENCE_CODING_GUIDE.md)
- [인터뷰용 가상 안내 예시와 사용 규칙](research/stimuli/README.md)
- [인터뷰 기록 양식](research/interviews/TEMPLATE.md)
- [조사 합성 양식](research/synthesis/TEMPLATE.md)
- [첫 지역·퀘스트 후보 선택 가이드](research/CANDIDATE_SELECTION_GUIDE.md)
- [지역 후보 양식](research/region-candidates/TEMPLATE.md)
- [퀘스트 후보 양식](research/quest-candidates/TEMPLATE.md)

익명화한 텍스트 기록만 커밋하며 연락처, 녹음, 영상과 원본 사진은 저장소에 넣지 않습니다.

## 첫 구현 범위

1. 일본어로 퀘스트 탐색과 상세 안내 확인
2. 익명 브라우저 세션으로 시작과 이어하기
3. 단계별 수행과 완료 기록
4. 피드백과 정보 오류 신고
5. 내부 운영자의 콘텐츠 검수·공개·일시 중지
6. 모바일 홈 화면 설치와 개인정보를 캐시하지 않는 오프라인 복구 화면

예약·결제·정산·업체 대시보드는 후속 범위입니다. 구현 작업 기준은 Next.js·TypeScript·PostgreSQL로 정했고, 호스팅 후보와 첫 지역은 실제 검증 전입니다.

## 작업 방식

- `main`: 확인된 문서와 동작하는 변경의 기준
- `docs/*`: 설계·사용자 검증·의사결정 문서
- `feature/*`: 기능별 구현
- 기능 issue는 사용자 근거·영향 계약·AC·완료 조건을 포함
- PR은 실행한 검사, migration·보안·일본어·rollback 영향을 기록
- 변경 이유와 영향을 문서 또는 PR에 남기고, 이후 팀 저장소로 옮길 때 이력을 유지합니다.

제품 구현은 사용자 지시에 따라 진행합니다. 행사 전 제품 코드 허용 범위는 아직 공식 확인되지 않았으므로 제출·공개 전에는 주최 측 답변을 별도로 기록합니다.

## 문서 검증

외부 패키지 없이 내부 링크, API JSON 예시와 AC01~AC20 문서 매핑을 검사합니다.

```bash
python3 scripts/verify_all.py
```

개별 실패를 진단할 때는 같은 검사를 나눠 실행할 수 있습니다.

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/verify_docs.py
python3 scripts/verify_research.py
python3 scripts/verify_scope_gate.py
```

## 로컬 웹 개발

Node.js 24.19.0과 Corepack을 사용합니다.

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`.env.local`의 `APP_ENV`는 `local`로 설정합니다. 전체 로컬 품질 검사는 다음 명령으로 실행합니다.

```bash
pnpm verify
```

네트워크가 가능한 환경에서 moderate 이상 알려진 패키지 취약점도 확인합니다.

```bash
pnpm audit:dependencies
```

## 로컬 PostgreSQL

PostgreSQL 17.12 이미지를 digest로 고정했습니다. `.env.local` 또는 현재 shell에 `LOCAL_POSTGRES_PASSWORD`, `APP_ENV`, `DATABASE_DIRECT_URL`, `TEST_DATABASE_URL`을 실제 값으로 설정하고 비밀값은 커밋하지 않습니다.

```bash
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:seed:demo
pnpm test:integration
```

DB 도구는 `local`·`test`, local host와 `digiman_local`·`digiman_test_*` 이름만 허용합니다. 통합 테스트 DB에는 `digiman:test` database comment marker가 있어야 합니다.
데모 콘텐츠는 migration에 포함하지 않으며 위 명령으로 local·test DB에만 명시적으로 넣습니다. preview·production 환경이나 허용 목록 밖의 DB에서는 seed가 시작 전에 실패합니다.

디지망 해커톤을 로컬에서 리허설하려면 DB 설정 후 `pnpm db:seed:hackathon`을 실행하고 `/quests?area=sinchon&purpose=discovery`를 엽니다. 본선 종료 시각인 2026년 11월 29일 20시(한국 시간)부터 탐색과 새 진행을 닫고 완료 기록은 계속 볼 수 있습니다.

명동교자 퀘스트는 DB 설정 후 `pnpm db:seed:myeongdong-kyoja`로 로컬에 넣고 `/quests?area=myeongdong&purpose=food`에서 시작합니다.

사유의 방 퀘스트는 `pnpm db:seed:museum-room`으로 로컬에 넣고 `/quests?area=yongsan&purpose=culture`에서 시작합니다.

올리브영N 성수 쇼핑 퀘스트는 `pnpm db:seed:oliveyoung-shopping`으로 로컬에 넣고 `/quests?area=seongsu&purpose=shopping`에서 시작합니다.

올리브영N 성수 피부 컨설팅 퀘스트는 `pnpm db:seed:oliveyoung-skin`으로 로컬에 넣고 `/quests?area=seongsu&purpose=beauty`에서 시작합니다.

이로토모 교류회 퀘스트는 `pnpm db:seed:irotomo`로 로컬에 넣고 `/quests?area=yeouido&purpose=discovery`에서 시작합니다.

소무관 성수본점 국밥 퀘스트는 `pnpm db:seed:somugwan`으로 로컬에 넣고 `/quests?area=seongsu&purpose=food`에서 시작합니다.

창덕궁 일본어 해설 퀘스트는 `pnpm db:seed:changdeokgung`으로 로컬에 넣고 `/quests?area=jongno&purpose=culture`에서 시작합니다.

광화문 교보문고 책 찾기 퀘스트는 `pnpm db:seed:kyobo`로 로컬에 넣고 `/quests?area=jongno&purpose=shopping`에서 시작합니다.

명동 무드컬렉트 퍼스널컬러 퀘스트는 `pnpm db:seed:moodcollect`로 로컬에 넣고 `/quests?area=myeongdong&purpose=beauty`에서 시작합니다.
