# DigiMan 구현 준비도

최종 갱신: 2026-11-21 · 기준 branch: `main`

이 문서는 계획된 것과 실제 완료된 것을 구분하는 현재 상태판이다. 상세 계약의 원본은 각 링크 문서이며, 상태가 바뀌면 근거 commit·실행 결과와 함께 이 표를 갱신한다.

외부 답변·사용자 근거·기술 선택의 의존 순서와 미확정 기본 행동은 [결정 큐](DECISION_QUEUE.md)에서 관리한다.

## 상태 의미

| 상태 | 의미 |
| --- | --- |
| 완료 | 산출물과 검증 증거가 저장소에 있음 |
| 준비됨 | 실행 방법·양식은 있으나 실제 실행 전 |
| 진행 가능 | 외부 결정 없이 다음 작업을 수행할 수 있음 |
| 대기 | 사용자·팀·주최 측 또는 외부 계정 결정 필요 |
| 보류 | 규칙 또는 선행 조건 때문에 시작하지 않음 |

## 현재 준비도

| 영역 | 상태 | 근거 | 다음 완료 조건 |
| --- | --- | --- | --- |
| B2C 제품 범위 | 완료 | [B2C 스펙](B2C_SPEC_v0.1.md) | 사용자 조사 결과에 따른 변경 반영 |
| 기술 작업 기준 | 완료 | [기술 결정](TECH_DECISIONS_v0.1.md), [F0 착수 계획](F0_BOOTSTRAP_PLAN_v0.1.md) | 팀 동의와 실제 package version 고정 |
| 구현 순서 | 완료 | [구현 계획](IMPLEMENTATION_PLAN_v0.1.md) | 행사 규칙 확인 뒤 F0 착수 |
| 미결정 관리 | 준비됨 | [결정 큐](DECISION_QUEUE.md) | D01~D13 근거가 생길 때 결정·보류 기록 |
| B2C API 예시 | 완료 | [B2C API](API_EXAMPLES_B2C_v0.1.md), [계약 인덱스](API_CONTRACT_INDEX_v0.1.md), JSON parser 통과 | 구현 계약 테스트와 연결 |
| 운영 API 예시 | 완료 | [운영 API](API_EXAMPLES_ADMIN_v0.1.md), [계약 인덱스](API_CONTRACT_INDEX_v0.1.md), JSON parser 통과 | 구현 계약 테스트와 연결 |
| DB 정합성 설계 | 완료 | [데이터 계약](DATA_CONSTRAINTS_v0.1.md), [F1 검수 계획](F1_DATABASE_PLAN_v0.1.md) | 실제 migration·PostgreSQL 동시성 테스트 |
| 화면 상태·문구 | 준비됨 | [화면 계약](SCREEN_STATES_v0.1.md), [일본어 검수 절차](JAPANESE_COPY_REVIEW_v0.1.md), [접근성 검수](ACCESSIBILITY_VERIFICATION_v0.1.md) | 일본어 모어 화자 검수와 UI 관찰 |
| client 오류 복구 | 준비됨 | [요청·복구 계약](CLIENT_RECOVERY_v0.1.md) | fault injection과 browser state 검수 |
| 보안·개인정보 | 준비됨 | [위협 모델](SECURITY_PRIVACY_v0.1.md), [보존·삭제·복구 계약](DATA_RETENTION_ERASURE_v0.1.md) | 구현 통제와 출시 전 gate 실행 |
| 테스트 계획 | 준비됨 | [테스트 계획](TEST_PLAN_v0.1.md) | 구현 후 AC01~AC20 실제 pass 증거 |
| 성능·부하 검수 | 준비됨 | [성능·부하 계약](PERFORMANCE_LOAD_TEST_v0.1.md) | 배포 후보에서 L0~L5 실행과 기준 확정 |
| 배포·복구 | 준비됨 | [운영 런북](OPERATIONS_RUNBOOK_v0.1.md) | 서비스 확정 후 명령·계정·복구 훈련 |
| 장애 대응 | 준비됨 | [장애 대응 런북](INCIDENT_RESPONSE_v0.1.md) | 역할·연락 경로 확정과 P0·P1 tabletop 훈련 |
| 로그·관측성 | 준비됨 | [관측 계약](OBSERVABILITY_CONTRACT_v0.1.md) | provider 설정과 canary·alert 검수 |
| 제품 시연 | 준비됨 | [2분 시연 런북](DEMO_RUNBOOK_v0.1.md) | 구현 뒤 실제 기기 100초 리허설과 기록 |
| 출시 판정 | 준비됨 | [출시 준비 gate](RELEASE_READINESS_v0.1.md) | 고정 commit·환경에서 모든 필수 증거와 승인 기록 |
| 문서·조사 자동 검증 | 완료 | `python3 scripts/verify_docs.py`, `python3 scripts/verify_research.py` | CI 연결은 행사 규칙 확인 후 결정 |
| 행사 사전 개발 범위 | 대기 | [규칙 확인서](EVENT_RULES_CHECKLIST.md) | 주최 측 공식 답변 기록 |
| 사용자 인터뷰 | 진행 가능 | [조사 계획](USER_RESEARCH_v0.1.md), [작업공간](../research/README.md) | 익명 기록 3~5개와 조사 합성 |
| 첫 타깃 | 대기 | 재방문 일본인 혼행객은 가설 | 인터뷰 사례로 유지·수정·폐기 결정 |
| 첫 지역 | 대기 | 후보 미선정 | 사례·현장 검증 기준을 통과한 지역 1곳 |
| 첫 퀘스트 | 대기 | 후보 미작성 | 검수 가능한 후보 1개와 예비 2개 |
| 일본어 검수자 | 대기 | 미배정 | 화면·콘텐츠 검수자 코드와 일정 |
| 콘텐츠 사실·권리 검수 | 준비됨 | [콘텐츠 검수 계약](CONTENT_VERIFICATION_v0.1.md) | 첫 후보의 출처·권리 register 작성 |
| 정보 오류 신고 운영 | 준비됨 | [신고 처리 런북](REPORT_TRIAGE_v0.1.md) | 운영 UI 구현과 pause·부분 실패 훈련 |
| Neon·Vercel | 준비됨 | [외부 서비스 평가](EXTERNAL_SERVICES_EVALUATION_v0.1.md) | 계정·plan 승인, Singapore 배치와 지연 측정 |
| Google OIDC | 대기 | 구현 기준만 결정 | 환경별 client·callback·허용 principal 준비 |
| 운영자 인증·인가 | 준비됨 | [운영 인증 계약](ADMIN_AUTHORIZATION_v0.1.md) | D10 결정과 검수 tenant에서 AC13~AC15 실행 |
| 지도 연결 | 준비됨 | Google Maps URL·주소 복사 작업 기준 | 일본어 iOS·Android 서울 경로 실제 검수 |
| 제품 코드 F0~F8 | 보류 | 행사 전 코드 허용 범위 미확인 | 규칙 gate 해제 후 기능별 착수 |
| AC01~AC20 실행 | 보류 | 테스트 계획만 존재 | 제품 구현과 검수 환경 필요 |

## 현재 사실

- 제품 코드는 없다.
- 외부 서비스 계정과 secret은 저장소에 없다.
- API JSON 예시 35개는 JSON parser를 통과한다.
- B2C 스펙과 테스트 계획에 AC01~AC20이 모두 존재한다.
- 위 항목은 구현·테스트 통과를 뜻하지 않는다.
- `main`은 기능 단위 문서·검증 변경을 원격 저장소와 동기화한다.

## 바로 실행할 수 있는 작업

### 사용자·팀이 필요한 작업

1. [행사 규칙 질문](EVENT_RULES_CHECKLIST.md)을 주최 측에 보낸다.
2. 일본어 사용자 3~5명을 모집해 인터뷰 일정을 잡는다.
3. 팀의 Next.js·TypeScript·PostgreSQL 경험과 역할을 확인한다.
4. 일본어 문구와 첫 콘텐츠를 검수할 사람을 정한다.

### 저장소에서 계속 가능한 작업

1. 제공받은 공식 규칙 답변을 근거와 함께 반영한다.
2. 익명화한 인터뷰 기록을 `research/interviews`에 추가한다.
3. 조사 합성으로 타깃·지역·퀘스트 결정을 갱신한다.
4. 외부 서비스의 비용·지역·복구 조건을 공식 문서로 비교한다.
5. 허용 범위가 확인되면 F0부터 구현한다.

## 첫 구현 착수 조건

다음 조건을 모두 충족하기 전에는 제품 코드가 준비됐다고 표시하지 않는다.

- [ ] 행사 규칙이 제품 코드 또는 해당 작업 단위를 허용한다.
- [ ] Node·pnpm과 package version을 lockfile로 고정한다.
- [ ] 개발 PostgreSQL과 production 분리 방법을 확인한다.
- [ ] 팀이 기술 작업 기준과 기능 분담에 동의한다.
- [ ] 첫 퀘스트가 실제 또는 명시적인 demo로 구분돼 있다.

사용자 인터뷰 완료는 F0 환경 구성의 기술적 필수 조건은 아니지만, F2 이후 실제 콘텐츠와 화면 우선순위의 선행 조건이다.

## 상태 갱신 규칙

- 계획 문서 작성만으로 실행 항목을 완료로 바꾸지 않는다.
- 테스트는 commit, 환경, 결과와 증거가 있어야 pass로 기록한다.
- 외부 서비스는 후보 조사와 실제 계정·설정을 구분한다.
- 사용자 사례는 참여자 수와 반대 사례를 함께 기록한다.
- 차단이 풀리면 관련 문서와 이 상태판을 같은 기능 커밋에서 갱신한다.
