# 출시 준비 판정 v0.1

작성일: 2026-11-21 · 상태: 제품 구현 전 release gate

이 문서는 DigiMan의 특정 commit을 internal preview, demo release 또는 실제 콘텐츠 public release 중 어디까지 허용할지 판정하는 단일 체크포인트다. 개별 테스트 방법은 각 계약에 있고, 이 문서는 증거의 완전성·차단 조건·승인 결과를 모은다.

## release 유형

| 유형 | 허용 범위 | 실제 사용자 데이터 | 실제 장소 주장 |
| --- | --- | --- | --- |
| internal preview | 팀 내부 기능 검수 | 금지, 가상 fixture만 | 금지 |
| demo release | 심사·인터뷰용 표시된 demo | 금지, demo·test event만 | 방문 가능·성과로 주장 금지 |
| public release | 검수 완료 사용자 접근 | 정책 범위 내 익명 진행 | register를 통과한 콘텐츠만 |

낮은 유형의 통과는 높은 유형을 자동 승인하지 않는다. demo를 public처럼 보이게 하거나 public 실패를 “preview”라고 이름만 바꿔 우회하지 않는다.

## 상태 정의

| 상태 | 의미 | release 판정 |
| --- | --- | --- |
| `pass` | 고정된 commit·환경에서 기대 결과와 증거 확인 | 해당 gate 충족 |
| `fail` | 기대 결과 위반 또는 안전하지 않은 결과 | 차단 여부에 따라 release 금지 |
| `blocked` | 외부 결정·계정·검수자 등 선행조건 없음 | pass가 아니며 범위 축소 필요 |
| `not_run` | 실행 가능한데 아직 실행하지 않음 | pass가 아님 |
| `not_applicable` | 해당 release 유형에 적용되지 않음 | 이유·reviewer 필요 |

재실행 통과만으로 flaky를 pass로 바꾸지 않는다. 원인·격리·회귀 검수까지 연결한다.

## 증거 최소 단위

각 결과는 다음을 가져야 한다.

- 대상 commit·release·schema version
- 환경과 provider region·plan의 비식별 요약
- 실행 일시·timezone과 실행자·reviewer 역할
- 명령·시나리오·fixture version
- 기대값과 실제 결과
- 실패·blocked·not_run의 사용자 영향과 owner
- 민감정보 없는 artifact 경로 또는 CI run

“확인함”, 화면 캡처 한 장, 최신 branch의 이름, 다른 commit의 통과 결과만으로 pass 처리하지 않는다.

## 절대 차단 gate

아래 하나라도 fail·blocked·not_run이면 public release를 금지한다.

| gate | 핵심 증거 | 연결 계약 |
| --- | --- | --- |
| 행사 허용 범위 | D01 공식 답변과 source | [행사 규칙 확인서](EVENT_RULES_CHECKLIST.md) |
| 운영 권한 | 비허용 principal 403, visitor 인증 분리 | AC15, [보안 계약](SECURITY_PRIVACY_v0.1.md) |
| 소유권 은닉 | 다른 visitor의 run·feedback 모두 404 | AC10 |
| transaction 정합성 | 중복 시작·step·완료, audit 원자성 | AC03~AC05, AC09, AC13 |
| 전체 삭제·만료 | 원자 삭제, cleanup, report 익명화 | AC16, [삭제·복구 계약](DATA_RETENTION_ERASURE_v0.1.md) |
| backup 승격 privacy | ledger replay 또는 visitor purge | AC20 |
| secret·개인정보 누출 | response·log·metric·artifact canary 0 | [관측 계약](OBSERVABILITY_CONTRACT_v0.1.md) |
| 콘텐츠 안전·권리 | 실제 quest register와 reviewer | AC19, [콘텐츠 검수](CONTENT_VERIFICATION_v0.1.md) |
| 일본어 손실 문구 | 중지·만료·삭제·오류 P0 검수 | [일본어 검수](JAPANESE_COPY_REVIEW_v0.1.md) |

internal preview와 demo release도 권한·소유권·정합성·secret 누출을 “비공개라서” 우회하지 않는다. 실제 데이터가 없으면 삭제·backup 일부를 가상 fixture로 검수하고 한계를 표시한다.

## 0. 기준선 고정

- [ ] release 유형과 대상 사용자를 명시했다.
- [ ] commit SHA·tag 후보·schema version을 고정했다.
- [ ] preview·production DB 분리를 두 신호 이상으로 확인했다.
- [ ] dependency lockfile과 license·attribution 결과를 기록했다.
- [ ] 이후 코드·schema·config 변경 시 어떤 gate를 재실행할지 정했다.
- [ ] 알려진 제한을 빈칸이 아니라 명시적으로 기록했다.

검수 중 대상 commit이 바뀌면 영향받은 증거는 이전 release의 기록으로 남기고 새 commit에서 다시 실행한다.

## 1. 결정·사람·외부 조건

| 항목 | preview | demo | public | 증거 |
| --- | --- | --- | --- | --- |
| D01 행사 허용 | 허용 범위 내 | 필수 | 필수 | 공식 source·시각 |
| D02 일본어 검수자 | 초안 표시 가능 | P0 화면 필수 | 전체 공개 문구 필수 | reviewer code·section |
| D06 실제 quest | 가상 가능 | demo 표시 가능 | register 통과 필수 | content register |
| D08 역할 | 한 사람이 겸임 가능 | owner 필요 | owner+대체 담당자 필요 | 역할표 |
| D09 서비스·region | local 가능 | preview 설정 필요 | 실제 plan·region 필요 | 설정·측정 |
| D11 복구 | 가상 훈련 | 제한 명시 | 실제 정책·훈련 필수 | AC20 증거 |
| D12 monitoring | local capture | 최소 release 신호 | alert·보존·수신자 필수 | provider 설정 |
| D13 공개 유형 | preview | demo 명시 | public 결정 | 결정 기록 |

`waiting`·`blocked` 결정은 암묵적 yes가 아니다. 가능한 낮은 유형으로만 범위를 줄인다.

## 2. 자동 검수

- [ ] exact lockfile install
- [ ] format·lint
- [ ] TypeScript typecheck
- [ ] 순수 domain unit test
- [ ] 실제 PostgreSQL migration from zero
- [ ] 실제 PostgreSQL integration·constraint·concurrency test
- [ ] HTTP 계약·Origin·cookie·cache·security header test
- [ ] production build
- [ ] Chromium 핵심 E2E
- [ ] dependency·license·secret scan의 허용 결과
- [ ] docs verifier와 API example JSON parser

명령 exit code 0뿐 아니라 실행된 test 수와 skip·quarantine 목록을 기록한다. test가 0개인 성공이나 service가 없어 자동 skip된 결과는 pass가 아니다.

## 3. AC01~AC20

| AC | 핵심 결과 | 필수 증거 계층 | 상태 |
| --- | --- | --- | --- |
| AC01 | cookie 없는 탐색, DB 개인 행 변화 없음 | HTTP + browser + DB count |  |
| AC02 | 빈 결과와 조건 유지 | domain + HTTP + browser |  |
| AC03 | 동시 시작 run 하나 | PostgreSQL barrier + HTTP |  |
| AC04 | 단계 순서 위반 무변경 | PostgreSQL + HTTP |  |
| AC05 | 응답 유실 뒤 상태 조회·멱등 | fault injection + browser |  |
| AC06 | reload·재접속 같은 run | browser |  |
| AC07 | 기존 run version 고정 | PostgreSQL + API |  |
| AC08 | pause 뒤 신규·진행 차단, 읽기 유지 | PostgreSQL + browser |  |
| AC09 | 동시 마지막 step 완료 하나 | PostgreSQL barrier |  |
| AC10 | 다른 visitor 대상 404 | HTTP |  |
| AC11 | 미완료 feedback 없음 | PostgreSQL + HTTP |  |
| AC12 | feedback upsert·범위 | PostgreSQL + HTTP |  |
| AC13 | 운영 revision 충돌 보존 | PostgreSQL barrier + UI |  |
| AC14 | 불완전 draft 공개 실패 | domain + PostgreSQL + HTTP |  |
| AC15 | admin principal 권한 분리 | HTTP + OIDC 검수 tenant |  |
| AC16 | 전체 삭제·만료·익명화 | PostgreSQL + HTTP |  |
| AC17 | 위치 권한 없이 지도 fallback | 실제 iOS·Android |  |
| AC18 | 360px·키보드·screen reader | browser + 실제 기기 |  |
| AC19 | demo와 실제 콘텐츠 구분 | HTTP + browser + register |  |
| AC20 | restore·cleanup·privacy promotion | 격리 복구 DB 훈련 |  |

상세 준비·실행·assertion은 [B2C 검수와 테스트 계획](TEST_PLAN_v0.1.md)을 따른다.

## 4. 모바일·접근성·일본어

- [ ] 360×800, 390×844, 430×932에서 가로 scroll·가림 없음
- [ ] Chromium과 WebKit에서 핵심 여정 통과
- [ ] 일본어 iOS·Android 실제 기기에서 주소 복사·지도 fallback 확인
- [ ] 키보드만으로 dialog·form·오류 복구 가능
- [ ] heading·label·focus·live region·touch target 검수
- [ ] 200% 확대와 motion 감소 설정 검수
- [ ] P0 source section을 모어 화자가 실제 화면 문맥에서 검수
- [ ] 검수 뒤 바뀐 string이 재검수 대상에 포함

자동 accessibility scan만으로 이 gate를 pass 처리하지 않는다.

## 5. 보안·개인정보

- [ ] 모든 mutation exact Origin과 권한·소유권 검사
- [ ] strict JSON shape·크기·NFC·line ending 검증
- [ ] CSP, HSTS, Referrer, Permissions, cache header route별 일치
- [ ] cookie Secure·HttpOnly·SameSite·Path·Max-Age 일치
- [ ] response에 SQL·stack·constraint·provider 원문 없음
- [ ] log·metric·trace에 header·body·token·UUID·자유 입력 canary 없음
- [ ] rate limiter key가 신뢰한 edge에서 생성되고 shared Wi-Fi 검수 통과
- [ ] visitor 전체 삭제와 만료 cleanup 실패 주입 rollback
- [ ] 실제 processor·region·보존·access·deletion inventory 갱신
- [ ] secret 교체와 session 폐기 tabletop 실행

권한·소유권·삭제·secret gate는 “알려진 제한”으로 public release를 허용할 수 없다.

## 6. 콘텐츠·분석

- [ ] 실제 quest마다 주소·가격·시간·혼자 이용·요청 문구 근거와 확인일
- [ ] image·font·icon·dependency 권리와 attribution 경로
- [ ] demo fixture가 모든 surface와 event에서 demo로 분리
- [ ] published version 불변, draft·pause·resume·archive 상태 검수
- [ ] report triage와 위험 quest 우선 pause 훈련
- [ ] analytics event allowlist·환경·중복·보존 검수
- [ ] 사용하지 않는 placeholder 실제 장소·사용자 인용 제거

실제 콘텐츠 하나라도 근거가 없으면 demo release로 낮추거나 해당 quest를 제외한다.

## 7. 성능·관측·운영

- [ ] cold probe와 warm L0~L3을 같은 release에서 3회 실행
- [ ] 20 virtual user·5분의 route별 표본·p50·p95·p99·max 기록
- [ ] shared IP 정상 사용자의 429 없음
- [ ] L4 동시 mutation 정합성 유지
- [ ] DB pool acquire timeout·지속 queue 없음
- [ ] L5 fault 제거 뒤 회복 확인
- [ ] request ID가 response와 allowlist log에서 연결
- [ ] preview·demo·test 신호가 production alert·성과와 분리
- [ ] P0·P1 incident 역할·상태 안내·종료 훈련

초기 p95 후보 미달은 원인·사용자 영향·release 유형에 따라 명시적으로 판정하되 정합성·개인정보 실패와 교환하지 않는다.

## 8. 배포·rollback·복구

- [ ] backup 또는 복구 기준 시점과 예상 RPO 확인
- [ ] expand → code switch → contract 호환 순서 확인
- [ ] preview smoke test와 production read-only smoke test 분리
- [ ] application rollback이 현재 schema와 호환
- [ ] destructive migration의 별도 복구 계획
- [ ] secret·환경 변수 owner와 교체 경로
- [ ] backup을 production 아닌 DB에 restore
- [ ] ledger replay 또는 privacy-first visitor purge 뒤 승격 검수
- [ ] 임시 DB·credential·test record 폐기

복구 DB에서 기존 run이 읽혔다는 사실만으로 AC20이나 개인정보 gate를 pass 처리하지 않는다.

## 9. 시연

- [ ] 100초 안의 핵심 흐름을 실제 기기에서 리허설
- [ ] demo·실제 content와 live·recording 구분을 말로 설명
- [ ] 장애 fallback이 production 데이터 직접 수정에 의존하지 않음
- [ ] 사전 녹화는 commit·환경·시각을 기록하고 녹화임을 표시
- [ ] 인터뷰 수·가설·미검증 내용을 과장하지 않음
- [ ] 알려진 제한과 다음 검증을 질문 답변에 준비

## 변경별 재실행 범위

| 변경 | 최소 재실행 |
| --- | --- |
| 문구·layout | 영향 화면 E2E, 접근성, 일본어 section |
| API validation·error | HTTP 계약, 보안 canary, 영향 AC |
| run transaction·schema | migration, DB 통합·동시성, AC03~AC12·AC16 |
| admin auth·content | AC08, AC13~AC15·AC19, audit |
| cookie·session | AC01, AC03, AC06, AC10, AC15~AC16, headers |
| dependency·runtime | 전체 자동 검수, license, build, 성능 기준선 |
| provider region·plan·pool | 성능·복구·관측·비용 결정 |
| content version | register, 일본어, 권리, AC07~AC08·AC19 |

영향이 불명확하면 넓은 gate를 재실행한다. “코드가 조금 바뀌었다”는 이유로 생략하지 않는다.

## 판정 기록

```markdown
# Release candidate YYYY-MM-DD-NN

- 유형: internal preview / demo release / public release
- commit·release·schema:
- 환경·region·plan:
- 검수 시작·종료 시각(KST):
- release owner / security·privacy reviewer / content·Japanese reviewer:
- D01·D02·D06·D09·D11~D13 상태:
- 자동 검수·skip:
- AC01~AC20 pass / fail / blocked / not_run / not_applicable:
- 접근성·실제 기기:
- 보안·개인정보 canary:
- 콘텐츠 register:
- 성능·부하:
- backup restore·삭제 재적용:
- 알려진 제한·사용자 영향:
- 임시 조치·owner·만료일:
- 최종 판정: 승인 / 유형 축소 / 보류
- 판정자·reviewer 역할:
```

## 최종 판정 규칙

### 승인

대상 유형의 필수 gate가 모두 pass이고, 증거가 같은 commit·schema·환경을 가리키며, 남은 제한이 절대 차단 gate가 아니다.

### 유형 축소

public 조건이 blocked지만 가상 데이터·demo 표시·접근 통제로 안전한 demo나 internal preview 범위를 명확히 만들 수 있다. 축소한 범위와 금지 주장을 기록한다.

### 보류

절대 차단 gate가 fail·blocked·not_run이거나, 증거가 다른 commit·환경에 섞였거나, 영향 범위를 알 수 없다. 일정이 임박해도 승인으로 바꾸지 않는다.

최종 판정은 commit을 바꾸지 않는다. 수정이 필요하면 새 release candidate를 만들고 영향 gate를 다시 실행한다.
