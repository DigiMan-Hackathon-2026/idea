# 장애 대응 런북 v0.1

작성일: 2026-11-21 · 상태: 운영 체계 확정 전 대응 기준

이 문서는 여기서울의 장애를 탐지한 순간부터 사용자 피해를 제한하고, 안전한 복구를 확인해 종료·사후 검토하는 절차다. 배포·rollback·backup 명령은 [배포와 복구 운영 런북](OPERATIONS_RUNBOOK_v0.1.md), 관측 신호는 [로그·지표·오류 관측 계약](OBSERVABILITY_CONTRACT_v0.1.md)을 따른다.

## 원칙

- 원인 분석보다 사용자 피해 제한을 먼저 한다.
- 장애 중 production 데이터와 schema를 추측으로 직접 수정하지 않는다.
- 현재 상태를 조회하기 전 사용자 mutation을 재실행하지 않는다.
- 개인정보·secret·자유 입력을 incident 문서나 공유 채널에 복제하지 않는다.
- monitoring 부재를 정상 증거로 보지 않는다.
- 복구 선언은 한 화면이 열리는지가 아니라 영향받은 흐름과 데이터 불변식으로 판단한다.
- 종료 시각·영향·미확정 사실을 숨기지 않되 근거 없는 숫자를 발표하지 않는다.

## 역할

한 사람이 여러 역할을 맡을 수 있지만 판단과 실행을 구분해 기록한다.

| 역할 | 책임 | 하지 않는 일 |
| --- | --- | --- |
| commander | 등급·우선순위·완화·종료 결정 | 모든 명령을 직접 실행하지 않음 |
| investigator | release·route·DB·provider 증거 조사 | 원문 사용자 데이터 공유 금지 |
| operator | pause·rollback·secret 교체·복구 실행 | 승인 범위 밖 데이터 수정 금지 |
| communicator | 팀·사용자 상태 갱신 | 추측·개인정보·공격 세부 공개 금지 |
| recorder | 시각·결정·request ID·검증 결과 기록 | log 원문을 문서에 붙이지 않음 |

P0에서 최소 두 사람이 대응할 수 없으면 commander가 실행 전 대상·예상 결과·되돌리기를 소리 내어 확인하고, 사후 검토자를 별도로 지정한다.

## 등급

가장 큰 실제·잠재 영향으로 분류하고, 불확실하면 높은 쪽에서 시작한다.

| 등급 | 예 | 즉시 목표 | 완화 후보 |
| --- | --- | --- | --- |
| P0 | 권한 우회, token·secret·개인정보 노출, 데이터 손상, 삭제 데이터 재노출 | 노출·쓰기·접근 확산 중지 | route 차단, session 폐기, secret 교체, production 격리 |
| P1 | 탐색·시작·진행·완료 전체 불가, 중복·부분 commit 위험, DB 전면 장애 | 핵심 mutation 피해 차단 | 신규 시작 중지, 이전 release, read-only, provider 전환 |
| P2 | 특정 quest·지도·신고·운영 기능 장애 | 범위 격리와 fallback | quest pause, 링크·기능 비노출, 수동 운영 절차 |
| P3 | 오탈자·style·비핵심 지연, 데이터 영향 없는 부분 결함 | 정상 배포에 포함 | issue 기록, 검수 강화 |

등급은 책임 추궁이나 장애 원인 분류가 아니다. 조사 중 영향이 커지면 즉시 상향하고, 낮춰야 할 때는 완화 후 확인한 근거를 남긴다.

## 선언 조건

다음 하나라도 충족하면 일반 debugging과 분리해 incident를 선언한다.

- alert 또는 사용자 사례가 권한·소유권·삭제·부분 commit 위험을 가리킴
- 유효한 사용자 행동에서 동일 핵심 흐름 실패가 반복됨
- 새 release·migration 직후 오류율·DB 대기·진행 실패가 기준선과 다름
- monitoring·audit·backup처럼 안전 판단에 필요한 통제가 동시에 불가
- 콘텐츠 오류가 안전·권리·실제 방문 실패를 지속 유발할 수 있음

한 건의 계약된 404·validation 오류만으로 incident를 만들지 않는다. 반대로 traffic이 적어 alert 임계값을 넘지 않았다는 이유로 확인된 사용자 피해를 무시하지 않는다.

## 첫 10분

1. 발견 시각, 환경, 화면·route template, request ID, 현재 release를 기록한다.
2. commander와 recorder를 지정하고 초기 등급을 선언한다.
3. 최근 deploy·migration·content publish·secret 변경을 확인한다.
4. 사용자 영향과 데이터 정합성 위험을 분리해 적는다.
5. 계속되는 mutation이 피해를 키우면 가장 좁은 범위부터 차단한다.
6. rollback이 현재 schema와 호환되는지 확인한다.
7. 사용자에게 재시도·cookie 전송·새 session 생성을 반복 요청하지 않는다.
8. 다음 상태 갱신 시각을 정한다.

P0·P1에서 상세 원인 확인 때문에 차단을 미루지 않는다. 단, production 전체 차단처럼 영향이 큰 조치는 좁은 route·quest·mutation 차단이 가능한지 먼저 본다.

## 안전한 증거 수집

허용되는 기본 정보:

- 발생 시각과 timezone
- environment, release SHA, schema version
- route template, HTTP status, error code, request ID
- 집계된 오류율·latency·DB pool 상태
- provider 공개 상태와 변경 이력
- 실행한 명령의 이름·결과 category와 승인자

수집·공유하지 않는 정보:

- cookie·Authorization·session token·OIDC token
- feedback·report·internalNote·인터뷰 원문
- visitor·run UUID, raw URL query, IP, 전체 User-Agent
- SQL row dump, DB connection string, secret 값
- 운영자 개인 계정 화면 전체 캡처

객체 수준 조회가 꼭 필요하면 목적·대상 범위·접근자·폐기 시점을 먼저 기록한다. 조사 데이터를 개인 PC나 public issue에 보관하지 않는다.

## 조사 순서

1. production·preview·demo·test 신호를 분리한다.
2. 현재 release와 직전 정상 release, schema 호환성을 확인한다.
3. route·status·errorCode별 집계와 첫 발생 시각을 확인한다.
4. application, DB, OIDC, deployment, network provider 상태를 분리한다.
5. 최근 변경과 시간 상관관계를 보되 원인으로 단정하지 않는다.
6. 재현은 local·preview의 가상 데이터에서 한다.
7. transaction 결과가 불명확하면 API 조회와 DB 불변식으로 commit 여부를 확인한다.
8. 완화 뒤 같은 신호와 사용자 흐름을 다시 측정한다.

## 증상별 첫 대응

### 진행 mutation 실패

- 같은 step을 재실행하기 전에 run을 조회한다.
- 성공 응답 유실과 transaction rollback을 구분한다.
- run step 중복, completedAt, 현재 step, audit 원자성을 확인한다.
- 수동 수정이 필요하면 별도 승인·이전값·이후값·검수 방법을 기록한다.

### 운영 권한 이상

- 신규 운영 mutation을 차단한다.
- active principal, OIDC callback, allowlist, session 발급 시각을 확인한다.
- 권한 없는 접근 가능성이 있으면 관련 운영 session을 폐기한다.
- 존재 여부가 드러나는 403·404 차이와 audit 누락을 확인한다.

### secret·token 노출

- 값을 incident 문서에 붙이지 않는다.
- 노출된 credential을 먼저 폐기·교체한 뒤 history·log 정리를 판단한다.
- 영향받는 session과 downstream 권한을 만료한다.
- 노출 가능 기간과 접근 범위는 근거 있는 최소·최대 범위로 기록한다.

### DB·migration 장애

- 새 migration과 application version 호환성을 확인한다.
- connection pool·lock wait·retry exhaustion을 구분한다.
- destructive migration에 application rollback만 시도하지 않는다.
- backup 복구는 별도 검수 DB에서만 하고 privacy-first promotion gate를 지킨다.

### 콘텐츠·장소 오류

- 위험 quest를 먼저 pause하고 published version을 직접 수정하지 않는다.
- [정보 오류 신고 처리 런북](REPORT_TRIAGE_v0.1.md)에 따라 독립 검증한다.
- 새 version 공개 또는 기존 version 재개 전 일본어·사실·권리를 검수한다.

### monitoring 장애

- 관측 불가와 서비스 정상을 같은 뜻으로 쓰지 않는다.
- audit log를 임의로 끄고 운영 mutation을 계속하지 않는다.
- monitoring SDK가 사용자 transaction을 실패시키면 sampling·drop·비동기 분리를 확인한다.
- 대체 확인은 provider 상태, 제한된 server health와 read-only smoke test로 수행한다.

## 완화 선택

완화는 사용자 피해를 줄이는 가장 좁고 되돌릴 수 있는 조치부터 고른다.

1. 잘못된 quest·route·mutation만 pause 또는 차단
2. 신규 시작 차단, 기존 기록 read-only 유지
3. feature flag나 공개 진입점 비노출
4. schema 호환이 확인된 application rollback
5. credential 교체와 session 폐기
6. production 격리와 검수 DB restore

rollback은 원인 규명이나 데이터 복구를 대신하지 않는다. rollback 뒤 이미 생성된 중복·부분 기록과 노출된 credential은 별도로 확인한다.

## 사용자 상태 안내

공개 안내는 현재 확인한 영향과 사용자가 할 행동만 담는다.

- 장애 시작 시각은 확인된 범위로 표기한다.
- “조사 중”, “신규 시작 중지”, “기존 기록 조회 가능”을 구분한다.
- 복구 예상 시각이 근거 없으면 약속하지 않고 다음 갱신 시각을 알린다.
- 사용자에게 token·cookie·전체 화면 녹화를 보내 달라고 하지 않는다.
- 보안 사고 세부는 악용 방지와 법적·개인정보 검토를 거쳐 공개한다.
- 복구 뒤 실제 데이터 손실·재시도 필요 여부를 명확히 한다.

초기 일본어 문구는 [일본어 문구 검수 절차](JAPANESE_COPY_REVIEW_v0.1.md)의 P0 검수를 받는다. 자동 번역 초안을 그대로 production에 게시하지 않는다.

## 복구 검증

복구 선언 전 영향 영역에 맞는 항목을 두 사람이 확인한다.

- [ ] 공개 목록·상세가 검수된 published content만 반환
- [ ] 신규 visitor session과 cookie 속성 정상
- [ ] run 시작·조회·단계 완료가 중복 없이 원자적
- [ ] 응답 유실 재시도에서 현재 상태로 복구
- [ ] pause quest의 신규 시작·미완료 진행 차단
- [ ] 운영 로그인·principal·revision conflict·audit 정상
- [ ] 전체 삭제·만료·report 익명화 불변식 정상
- [ ] log·metric·error response에 canary·token·원문 없음
- [ ] DB pool·5xx·latency가 관찰 구간 동안 악화하지 않음
- [ ] rollback release와 schema가 실제로 호환

P0 개인정보·삭제 사고에서 backup restore를 사용했다면 [방문자 데이터 보존·삭제·복구 계약](DATA_RETENTION_ERASURE_v0.1.md)의 ledger replay 또는 visitor purge가 끝나기 전 production에 연결하지 않는다.

## 종료 조건

다음을 모두 만족하면 commander가 incident를 종료한다.

- 피해를 만드는 경로가 차단됐거나 정상 동작을 검증함
- 데이터 정합성·권한·삭제 영향 범위를 확인함
- 임시 완화와 남은 위험의 owner·기한이 있음
- 사용자 안내가 현재 상태와 일치함
- monitoring에서 재발 신호가 없는 관찰 구간을 가짐
- incident 기록에 결정·검증·미확정 사실이 분리됨

관찰 구간 길이는 traffic과 장애 종류에 따라 정한다. 요청이 한 건도 없었던 기간만으로 복구를 선언하지 않는다.

## 기록 양식

```markdown
# INC-YYYYMMDD-NN 제한된 제목

- 환경·release·schema:
- 발견·선언·완화·복구·종료 시각(KST):
- commander / operator / recorder 역할:
- 등급 변화와 근거:
- 사용자 영향: 확인 / 추정 / 불명확
- 데이터·권한 영향:
- 최근 변경:
- 실행한 완화와 승인:
- 검증한 흐름·불변식:
- 공개 안내 시각·요약:
- 임시 조치·owner·만료일:
- 후속 issue:
- 알려지지 않은 것:
```

실제 ID·log·사용자 원문·credential·비공개 provider response를 이 파일에 넣지 않는다.

## 사후 검토

P0·P1은 복구 뒤 가능한 빠른 운영일에 blame-free 검토를 한다. P2도 반복되거나 사용자의 실제 방문 실패를 만들었으면 포함한다.

1. 탐지부터 종료까지 사실 timeline을 작성한다.
2. 영향과 데이터 무결성을 근거 수준별로 구분한다.
3. 어떤 통제가 피해를 줄였고 어떤 신호가 늦었는지 적는다.
4. 근본 원인 하나로 과도하게 단순화하지 않고 contributing factor를 찾는다.
5. 재발 방지 항목마다 owner·기한·검증 방법을 둔다.
6. 임시 flag·확대 권한·추가 log를 제거할 시점을 둔다.
7. 관련 계약·테스트·런북을 같은 기능 커밋에서 갱신한다.

후속 작업은 “주의하기” 대신 자동 검증, 권한 축소, transaction constraint, 안전한 fallback처럼 재현 가능한 통제로 작성한다.

## 훈련 시나리오

- [ ] step commit 뒤 응답 유실: 재실행 전 조회
- [ ] migration 뒤 구 release rollback 불호환: 쓰기 차단과 안전한 forward fix 판단
- [ ] admin allowlist 오류: 운영 mutation 차단·session 폐기
- [ ] secret이 log에 노출: 교체·보존 범위·canary 검수
- [ ] monitoring sink 실패: 사용자 transaction 유지, audit 실패는 rollback
- [ ] 위험 quest 신고: pause 성공·report PATCH 실패 복구
- [ ] 삭제 전 backup restore: ledger 없음, visitor purge 뒤 승격 검수
- [ ] provider 전면 장애: 상태 안내와 실제 recovery 확인

## 운영 준비 gate

- [ ] incident 역할·연락 경로·대체 담당자가 정해졌다.
- [ ] route·quest·신규 시작을 좁게 차단할 수 있다.
- [ ] rollback과 schema 호환성을 preview에서 연습했다.
- [ ] secret 교체와 session 폐기 절차를 검수했다.
- [ ] 사용자 상태 안내를 일본어로 검수했다.
- [ ] request ID만으로 제한된 조사를 한 번 연습했다.
- [ ] P0·P1 기록과 사후 검토 저장 위치·접근권한을 정했다.
- [ ] 훈련이 production 사용자 데이터나 실제 secret을 사용하지 않는다.

연결 검수: AC05, AC09, AC13~AC16, AC19, AC20
