# 팀 실행·인수인계 계획 v0.1

작성일: 2026-11-21 · 상태: 팀 구성 확인 전 작업 기준

이 문서는 여기서울의 F0~F8을 여러 사람이 병렬로 구현할 때 계약·데이터·문구·검수 책임이 빠지지 않도록 역할과 통합 순서를 정의한다. 역할은 사람이 아니라 책임 묶음이다. 인원이 적으면 한 사람이 여러 묶음을 맡고, 많아도 한 책임의 최종 owner는 한 명으로 둔다.

제품 코드 작업은 지금 시작할 수 있다. [행사 규칙 확인서](EVENT_RULES_CHECKLIST.md)는 제출·공개 전 확인할 위험을 기록하며 구현을 막지 않는다.

## 운영 원칙

- 작업은 사용자 결과 하나와 검수 가능한 완료 조건으로 자른다.
- issue 하나에 실행 owner 한 명, reviewer 한 명을 둔다.
- 동시에 많은 branch를 열기보다 완료 가능한 세로 흐름을 우선한다.
- API·DB·화면 계약 변경은 소비자에게 알리지 않고 merge하지 않는다.
- 문서 상태와 실제 구현·검수 pass를 구분한다.
- 막힌 기능을 가짜 data path나 auth 우회로 “완료”처럼 연결하지 않는다.
- main에 merge된 작은 기능 단위마다 원격으로 push하고 clean 상태를 확인한다.

## 역할 묶음

| 역할 | 주 책임 | 필수 산출물 | 반드시 협의 |
| --- | --- | --- | --- |
| 제품·조사 | 타깃·문제·우선순위·인터뷰 합성 | 익명 사례, 결정 issue, 스펙 변경 | 콘텐츠·일본어·기능 owner |
| 콘텐츠·일본어 | quest 근거·권리·한국어/일본어 pair | 후보 register, 검수 코드·날짜 | 제품·frontend·admin |
| frontend·접근성 | B2C 상태·모바일·keyboard·screen reader | 화면, Playwright, 접근성 증거 | API owner·일본어 reviewer |
| API·도메인 | validation·상태 전이·오류·소유권 | route, domain test, API fixture | DB·frontend·보안 |
| DB·보안 | schema·transaction·session·권한·삭제 | migration, PostgreSQL test, 위협 통제 | API·운영·release |
| 운영·통합 | admin·배포·관측·복구·release | smoke, AC 증거, rollback·복구 기록 | 모든 역할 |

팀이 6명보다 적으면 `API·도메인 + DB·보안`, `제품·조사 + 콘텐츠·일본어`, `frontend·접근성 + 운영·통합` 순으로 묶을 수 있다. 그래도 migration 작성자와 destructive 변경 reviewer, 일본어 작성자와 최종 문맥 검수자는 가능한 경우 분리한다.

## 권한이 큰 작업의 두 사람 확인

다음은 owner 혼자 완료 처리하지 않는다.

- production migration·배포·rollback
- 운영 principal 추가·비활성화
- secret 생성·교체·접근 범위 변경
- 개인 기록 삭제·만료·backup 복구
- 실제 quest 공개·중지·재개·보관
- P0 일본어 문구와 한국어 요청 카드 공개
- 새 runtime dependency·외부 SDK·tracking 도입

두 번째 사람은 승인 버튼만 누르지 않고 대상 commit, 환경, 되돌림과 증거를 확인한다.

## kickoff 30분

| 시간 | 결정 | 결과 |
| ---: | --- | --- |
| 0~5분 | 행사 규칙과 현재 준비도 | 지금 열 수 있는 F단계 |
| 5~10분 | 한 문장 가설과 이번 시연 범위 | 포함·제외 합의 |
| 10~15분 | 역할 묶음과 reviewer | owner 표 |
| 15~20분 | 첫 세로 흐름과 fixture | Q1·V1·A1 사용 합의 |
| 20~25분 | merge·검수 명령·환경 | 공통 Definition of Done |
| 25~30분 | 외부 계정·콘텐츠·일본어 blocker | 담당·확인 시점 |

회의에서 새 기능을 넓히기보다 이미 문서화된 첫 세로 흐름과 차이를 결정한다. 합의되지 않은 예약·결제·업체 dashboard는 backlog로 남긴다.

## 시작 시 owner 표

```markdown
# 팀 owner YYYY-MM-DD

| 책임 | owner | reviewer | 현재 issue | 다음 handoff | blocker |
| --- | --- | --- | --- | --- | --- |
| 제품·조사 |  |  |  |  |  |
| 콘텐츠·일본어 |  |  |  |  |  |
| frontend·접근성 |  |  |  |  |  |
| API·도메인 |  |  |  |  |  |
| DB·보안 |  |  |  |  |  |
| 운영·통합 |  |  |  |  |  |
```

실명 공개가 불필요한 외부 문서에는 팀 역할 또는 내부 코드만 사용한다. 계정·연락처·secret 소유 정보를 repository 문서에 적지 않는다.

## 구현 병렬화

```text
규칙 gate
   │
   ▼
F0 공통 환경
   │
   ▼
F1 DB·공통 API
   ├───────────────┐
   ▼               ▼
F2 공개 탐색     F3 익명 session
   │               │
   └──────┬────────┘
          ▼
       F4 진행·완료
          ├───────────────┐
          ▼               ▼
       F5 기록·삭제     F6 feedback·report
          │               │
          └──────┬────────┘
                 ▼
           F7 운영·콘텐츠
                 │
                 ▼
           F8 통합·배포
```

F7 인증 기반은 F1 뒤 병렬 준비할 수 있지만 공개·중지·report 처리의 최종 통합은 F2·F4·F6 상태가 있어야 완료된다. 화면 owner는 API 예시 fixture로 진행할 수 있으나 fake repository를 main의 runtime 경로로 남기지 않는다.

## 계약별 source owner

| 계약 | 변경 제안 owner | 필수 reviewer | consumer |
| --- | --- | --- | --- |
| B2C 범위·AC | 제품·조사 | 운영·통합 | 전체 |
| API field·status·error | API·도메인 | frontend·DB | 화면·test |
| schema·transaction | DB·보안 | API·운영 | migration·test |
| 화면 상태·focus | frontend·접근성 | 제품·일본어 | E2E·demo |
| quest 사실·권리 | 콘텐츠·일본어 | 제품·운영 | admin·공개 화면 |
| 로그·지표·보존 | 운영·통합 | DB·보안 | incident·release |

source owner는 모든 코드를 직접 쓰는 사람이 아니라 계약 변경을 모아 일관성을 확인하는 사람이다.

## issue 시작 조건

작업자는 issue에 다음이 없으면 구현을 시작하지 않는다.

- 사용자가 얻게 되는 결과
- 포함·제외 범위
- 사용자 근거 또는 설계 결정
- 영향받는 endpoint·화면·table·문서
- 정상·오류·권한·중복 완료 조건
- 관련 AC 또는 새 검수 시나리오
- 행사 규칙과 외부 계정 권한
- reviewer와 예상 handoff

사용자 조사와 결정은 각각 repository의 issue form을 사용한다. 개인정보·secret은 issue에 넣지 않는다.

## branch와 commit

| 항목 | 기준 |
| --- | --- |
| branch | `feature/<짧은-결과>`, `docs/<결정>`, `fix/<오류>` |
| commit | 한 기능·검사·문서 정합 단위, 동작 결과를 명령형으로 표현 |
| push | 검증된 commit마다 원격 backup·review 가능 상태 유지 |
| merge | 관련 검사와 reviewer 확인 뒤 main |
| history | 행사 전·행사 중 작업 시각과 출처 이력 유지 |

format 전체 변경, dependency 대량 갱신, 기능 구현을 한 commit에 섞지 않는다. shared migration이나 공개 API example을 rebase 과정에서 임의 수정하지 않는다.

## 작업 중 handoff

handoff는 “거의 완료”가 아니라 다음 사람이 재현할 수 있는 상태를 전달한다.

```markdown
## 기능 handoff

- issue·branch·commit:
- 사용자 결과:
- 완료된 범위:
- 아직 안 된 범위:
- 변경한 계약:
- migration·환경 변수:
- 실행 명령과 결과:
- 관련 AC 결과:
- 실패 fixture·request ID:
- 알려진 위험:
- 다음 사람이 먼저 할 한 단계:
```

local only 파일·uncommitted 변경·개인 계정 설정에 의존하면 handoff 완료가 아니다. secret 값은 전달하지 않고 승인된 secret manager 위치와 필요한 key 이름만 공유한다.

## frontend ↔ API handoff

API owner가 제공:

- endpoint·method·auth·Origin·cache
- success와 모든 화면 분기 오류 fixture
- idempotency·revision·응답 유실 복구 방법
- nullable·긴 text·demo·paused fixture

frontend owner가 제공:

- 각 상태가 나타나는 route와 주요 행동
- loading·empty·error·disabled·response-loss 동작
- 360px·keyboard·screen reader 결과
- API에서 부족하거나 모호한 field를 contract 변경으로 제안

서로의 임시 타입을 복사해 별도 진실로 만들지 않는다.

## 콘텐츠 ↔ 구현 handoff

콘텐츠 owner는 실제 quest마다 다음을 전달한다.

- 연결된 익명 사용자 사건
- source·확인일·혼자 이용 근거·가격·주소
- 3~5단계와 한국어/일본어 pair
- asset license·demo 여부
- 일본어 review 상태와 blocked 문구

구현 owner는 누락 값을 빈 문자열·0원·임의 default로 채우지 않는다. 공개 validation이 어떤 field를 거절했는지 콘텐츠 owner에게 반환한다.

## review 순서

1. owner가 self-review와 관련 검사를 실행한다.
2. 계약 변경을 consumer에게 먼저 알린다.
3. reviewer가 사용자 결과와 failure path를 확인한다.
4. DB·보안 영향이 있으면 해당 reviewer가 transaction·권한·로그를 본다.
5. UI 문구가 있으면 일본어·접근성 상태를 확인한다.
6. merge 뒤 main에서 핵심 smoke와 `python3 scripts/verify_all.py`를 다시 실행한다.
7. 준비도와 issue 상태를 실제 증거에 맞게 갱신한다.

PR line 수보다 변경 책임 수를 본다. 책임이 두 개면 나눌 수 있는지 먼저 검토한다.

## 통합 checkpoint

| checkpoint | 반드시 pass | 아직 pass가 아니면 |
| --- | --- | --- |
| F0 | clean install·lint·typecheck·test·build | F1 시작 보류 |
| F1 | migration·핵심 제약·test DB guard | stateful 기능 merge 보류 |
| F2+F3 | 쿠키 없는 탐색·명시적 session | F4 UI 연결 보류 |
| F4 | AC03~AC10 동시성·소유권·중지 | 시연 완료 흐름으로 표시 금지 |
| F5+F6 | 삭제·만료·feedback·report | 사용자 기록 공개 보류 |
| F7 | admin 권한·revision·공개 검수·audit | 실제 콘텐츠 공개 보류 |
| F8 | AC·모바일·일본어·복구·demo | release 완료 표시 금지 |

checkpoint는 모든 branch가 끝나길 기다리는 회의가 아니라 main의 재현 가능한 상태를 확인하는 시점이다.

## blocker 처리

| blocker | 진행 가능한 대체 작업 | 금지 |
| --- | --- | --- |
| 행사 규칙 미확인 | 제품 구현과 공식 문의 병행 | 위험 은폐·허용 확정으로 표현 |
| 사용자 인터뷰 지연 | 가상 demo 구조·검수 준비 | demo 반응을 실제 수요로 주장 |
| 일본어 reviewer 미배정 | draft 표시·inventory | 실제 공개 완료 처리 |
| OIDC 계정 미준비 | 권한 interface·test fixture, 규칙 허용 시 | 공용 비밀번호·우회 로그인 |
| DB 서비스 미확정 | local PostgreSQL 계약 test 계획 | SQLite로 동시성 통과 주장 |
| 실제 콘텐츠 미확정 | 명시적 demo quest | 미확인 업체를 실제 콘텐츠로 표시 |

blocker를 숨기기 위한 임시 경로는 이후 제거 비용뿐 아니라 심사·사용자 신뢰를 해친다.

## 짧은 sync 형식

각 역할은 다음 네 줄만 공유한다.

```text
완료: main에서 재현 가능한 결과
다음: 다음 checkpoint까지 한 결과
변경: 소비자가 알아야 할 계약 변화
막힘: 필요한 결정·권한·외부 답변과 시점
```

진행률 퍼센트 대신 commit·검사·사용자 결과를 말한다.

## 종료·인수인계

- [ ] main과 origin이 동기화되고 worktree가 깨끗하다.
- [ ] 열린 branch·PR·issue의 owner와 다음 행동이 있다.
- [ ] 실제 실행한 검사와 미실행 이유가 있다.
- [ ] migration·환경 변수·외부 계정 변경이 기록됐다.
- [ ] secret·연락처·녹음·production log가 저장소에 없다.
- [ ] demo·test·production 결과가 구분됐다.
- [ ] 준비도 표가 계획이 아닌 실제 증거를 반영한다.
- [ ] 다음 사람이 첫 15분 안에 실행할 명령과 파일을 찾을 수 있다.

팀 구성이 달라지면 사람 수에 맞춰 역할을 합치되, 권한·데이터·일본어·release의 review 책임 자체를 제거하지 않는다.
