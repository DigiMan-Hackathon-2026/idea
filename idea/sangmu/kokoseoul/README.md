# DigiMan Hackathon

서울에 있는 일본인이 새로운 로컬 경험을 발견하고 실행하도록 돕는 서비스의 개인 작업 저장소입니다.

B2C 모바일 웹을 먼저 구현하고, 사용자와 공급자의 요구가 확인되면 B2B 운영 기능을 추가합니다. 현재는 설계 문서와 저장소 기본 설정을 준비한 단계입니다.

## 설계 문서

- [현재 구현 준비도](docs/READINESS_STATUS.md)
- [B2C 설계 스펙 v0.1](docs/B2C_SPEC_v0.1.md)
- [B2C API 요청과 응답 예시 v0.1](docs/API_EXAMPLES_B2C_v0.1.md)
- [운영 API 요청과 응답 예시 v0.1](docs/API_EXAMPLES_ADMIN_v0.1.md)
- [API 인증·캐시·재시도 계약 인덱스 v0.1](docs/API_CONTRACT_INDEX_v0.1.md)
- [기술 결정 v0.1](docs/TECH_DECISIONS_v0.1.md)
- [외부 서비스 평가와 선택 조건 v0.1](docs/EXTERNAL_SERVICES_EVALUATION_v0.1.md)
- [PostgreSQL 데이터 정합성 계약 v0.1](docs/DATA_CONSTRAINTS_v0.1.md)
- [도메인 상태 머신 계약 v0.1](docs/STATE_MACHINES_v0.1.md)
- [분석 이벤트와 지표 계약 v0.1](docs/ANALYTICS_EVENT_CONTRACT_v0.1.md)
- [B2C 구현 계획 v0.1](docs/IMPLEMENTATION_PLAN_v0.1.md)
- [F0 개발 환경 착수 계획 v0.1](docs/F0_BOOTSTRAP_PLAN_v0.1.md)
- [F1 PostgreSQL 구현·검수 계획 v0.1](docs/F1_DATABASE_PLAN_v0.1.md)
- [의존성·에셋·AI 출처 관리 v0.1](docs/DEPENDENCY_ATTRIBUTION_v0.1.md)
- [B2C 화면 상태와 일본어 문구 계약 v0.1](docs/SCREEN_STATES_v0.1.md)
- [일본어 문구 검수 절차 v0.1](docs/JAPANESE_COPY_REVIEW_v0.1.md)
- [모바일 접근성 구현·검수 v0.1](docs/ACCESSIBILITY_VERIFICATION_v0.1.md)
- [B2C 검수와 테스트 계획 v0.1](docs/TEST_PLAN_v0.1.md)
- [보안과 개인정보 위협 모델 v0.1](docs/SECURITY_PRIVACY_v0.1.md)
- [로그·지표·오류 관측 계약 v0.1](docs/OBSERVABILITY_CONTRACT_v0.1.md)
- [배포와 복구 운영 런북 v0.1](docs/OPERATIONS_RUNBOOK_v0.1.md)
- [2분 제품 시연 런북 v0.1](docs/DEMO_RUNBOOK_v0.1.md)
- [해커톤 사전 개발 범위 확인서](docs/EVENT_RULES_CHECKLIST.md)
- [일본인 사용자 검증 계획 v0.1](docs/USER_RESEARCH_v0.1.md)
- [퀘스트 콘텐츠 사실과 권리 검수 v0.1](docs/CONTENT_VERIFICATION_v0.1.md)
- [맥북 Codex 인수인계](docs/HANDOFF.md)

스펙에는 사용자 흐름, 화면, 데이터 모델, API 계약, 콘텐츠 운영, B2B 확장 지점과 20개 검수 시나리오가 포함되어 있습니다. 개발 계약의 기준은 이 저장소의 문서입니다.

## 사용자 조사

- [조사 작업공간과 기록 규칙](research/README.md)
- [일본인 사용자 인터뷰 모집 문안](research/RECRUITMENT_MESSAGES.md)
- [사용자 인터뷰 세션 진행 가이드](research/INTERVIEW_SESSION_GUIDE.md)
- [인터뷰용 가상 안내 예시와 사용 규칙](research/stimuli/README.md)
- [인터뷰 기록 양식](research/interviews/TEMPLATE.md)
- [조사 합성 양식](research/synthesis/TEMPLATE.md)
- [퀘스트 후보 양식](research/quest-candidates/TEMPLATE.md)

익명화한 텍스트 기록만 커밋하며 연락처, 녹음, 영상과 원본 사진은 저장소에 넣지 않습니다.

## 첫 구현 범위

1. 일본어로 퀘스트 탐색과 상세 안내 확인
2. 익명 브라우저 세션으로 시작과 이어하기
3. 단계별 수행과 완료 기록
4. 피드백과 정보 오류 신고
5. 내부 운영자의 콘텐츠 검수·공개·일시 중지

예약·결제·정산·업체 대시보드는 후속 범위입니다. 구현 작업 기준은 Next.js·TypeScript·PostgreSQL로 정했고, 호스팅 후보와 첫 지역은 실제 검증 전입니다.

## 작업 방식

- `main`: 확인된 문서와 동작하는 변경의 기준
- `docs/*`: 설계·사용자 검증·의사결정 문서
- `feature/*`: 기능별 구현
- 기능 issue는 사용자 근거·영향 계약·AC·완료 조건을 포함
- PR은 실행한 검사, migration·보안·일본어·rollback 영향을 기록
- 변경 이유와 영향을 문서 또는 PR에 남기고, 이후 팀 저장소로 옮길 때 이력을 유지합니다.

실제 제품 코드 작성 시점은 행사에서 허용한 사전 개발 범위에 맞춥니다. 현재 공유된 안내의 사전 준비 항목은 아이디어 도출, 기술 조사, 개발 환경 준비입니다.

## 문서 검증

외부 패키지 없이 내부 링크, API JSON 예시와 AC01~AC20 문서 매핑을 검사합니다.

```bash
python3 scripts/verify_docs.py
```
