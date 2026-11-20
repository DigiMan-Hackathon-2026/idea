# 분석 이벤트와 지표 계약 v0.1

작성일: 2026-11-21 · 상태: schema 구현 전 검토 기준

이 문서는 [B2C 설계 스펙](B2C_SPEC_v0.1.md)의 측정 항목을 서버 이벤트, 집계 원본, 개인정보 삭제와 검수 절차로 구체화한다. 분석 이벤트는 제품 상태를 대신하지 않는다. 시작·완료·피드백·신고의 최종 집계 원본은 각각 `runs`, `feedback`, `reports`다.

## 목적과 해석 한계

- 첫 사용자 검증에서는 행동 횟수보다 실제 사례와 인터뷰 근거를 우선한다.
- `completed`는 화면에서 모든 단계를 확인했다는 기록이며 실제 장소 방문 인증이 아니다.
- `demo`와 `test` 데이터는 실제 사용 성과에 합치지 않는다.
- 분모가 0이면 0%가 아니라 `데이터 없음`으로 표시한다.
- 표본 수, 관찰 기간, 제외 조건을 비율과 함께 표시한다.
- 이벤트 유실이 있을 수 있으므로 이벤트 행 수를 run 시작·완료 수로 사용하지 않는다.

## 공통 봉투

| 필드 | 형식 | 생성 주체와 제약 |
| --- | --- | --- |
| `event_id` | UUID | 서버 생성, primary key |
| `event_name` | enum | 이 문서의 다섯 값만 허용 |
| `dedupe_key` | 문자열 | 서버 생성, 1~160자, unique |
| `visitor_id` | UUID 또는 null | 유효한 방문자 세션이 있을 때만 서버가 연결 |
| `quest_id` | UUID | 서버가 조회한 quest |
| `run_id` | UUID 또는 null | run 이후 이벤트에 필수 |
| `environment` | enum | 서버가 `demo`, `test`, `production` 중 결정 |
| `properties` | JSON object | 이벤트별 허용 키만, 직렬화 기준 1KB 이하 |
| `created_at` | timestamptz | DB 시각, 클라이언트 시각을 신뢰하지 않음 |

클라이언트는 `event_id`, 참조 ID, environment를 지정하지 않는다. 쿠키·세션 토큰·요청 본문·검색어·주소·좌표·User-Agent 원문·referrer 원문·피드백과 신고 원문을 `properties`에 넣지 않는다. 알 수 없는 키가 있으면 조용히 저장하지 말고 계측 코드 오류로 기록한다.

## environment 결정

서버는 다음 우선순위로 한 값을 정한다.

1. 연결된 공개 버전의 `is_demo=true`이면 배포 위치와 무관하게 `demo`
2. local·preview·자동화 검수 또는 seed test principal이면 `test`
3. production 배포에서 `is_demo=false`인 검수 완료 콘텐츠만 `production`

클라이언트 쿼리나 헤더로 environment를 바꿀 수 없다. 한 run의 모든 이벤트는 run 생성 시 결정한 environment를 따른다.

## 이벤트 정의

| 이벤트 | 서버 발생 조건 | 참조 | 허용 properties | 중복 기준 |
| --- | --- | --- | --- | --- |
| `detail_viewed` | 공개 상세 응답을 성공적으로 반환한 뒤 | quest 필수, visitor 선택 | 없음 | HTTP 요청 단위 key; 조회 수는 근사치 |
| `quest_started` | 새 run commit 성공 뒤 | visitor·quest·run 필수 | 없음 | run당 1개 |
| `step_completed` | 해당 run_step이 최초로 완료된 commit 뒤 | visitor·quest·run 필수 | `stepPosition`: 1 이상의 정수 | run과 step당 1개 |
| `quest_completed` | run이 최초로 completed가 된 commit 뒤 | visitor·quest·run 필수 | 없음 | run당 1개 |
| `feedback_submitted` | run의 feedback이 최초 저장된 commit 뒤 | visitor·quest·run 필수 | 없음 | run당 1개 |

같은 시작·단계 완료·피드백 PUT을 재전송해 기존 상태를 반환한 경우 새 이벤트를 만들지 않는다. 마지막 단계가 run 완료를 만들면 `step_completed`와 `quest_completed`를 각각 한 번 시도한다. 이벤트 insert는 도메인 commit 뒤 별도 best-effort 작업으로 수행하며, 실패해도 사용자 응답을 실패로 바꾸지 않는다.

권장 dedupe key 형식은 다음과 같다. 값은 서버 내부 계약이며 외부 API에 노출하지 않는다.

```text
detail_viewed:{requestId}
quest_started:{runId}
step_completed:{runId}:{stepId}
quest_completed:{runId}
feedback_submitted:{runId}
```

## 상세 조회와 세션 경계

AC01에 따라 쿠키 없는 탐색만으로 visitor session이나 개인 기록을 만들지 않는다. 따라서 쿠키 없는 `detail_viewed`는 `visitor_id=null`로만 저장할 수 있고 시작까지 걸린 시간의 연결 근거로 사용하지 않는다.

시작까지 걸린 시간은 run 시작 전에 이미 유효한 visitor cookie가 있었고, 같은 visitor·quest의 상세 조회가 시작 전 24시간 안에 있을 때만 계산한다. 가장 가까운 상세 조회 시각과 `runs.started_at`의 차이를 사용한다. 그 외 run은 미관찰로 분류하고, 관찰 표본 수와 전체 시작 수를 함께 표시한다. 이 지표를 늘리기 위해 탐색 시 세션을 강제로 만들지 않는다.

## 지표 계산

| 지표 | 집계 원본 | 계산과 제외 |
| --- | --- | --- |
| 시작 수 | `runs` | 기간 안에 `started_at`, production·비데모 run만 |
| 완료율 | `runs` | 시작 cohort 중 관찰 종료 시점에 completed / cohort 전체 |
| 시작까지 걸린 시간 | `analytics_events` + `runs` | 위의 관찰 가능한 run만, 중앙값·p75·표본 수 표시 |
| 기쁨 점수 | `feedback` + `runs` | production 완료 run의 평균·응답 수·응답률 함께 표시 |
| 새 경험 응답률 | `feedback` | boolean에 응답한 수를 분모로 사용 |
| 정보 오류 | `reports` | category와 status별 수, 익명화된 운영 요약 포함 |
| 기술 품질 | 구조화 로그·APM | 요청 ID 기준 오류율·p95·단계 완료 실패율 |

완료율의 관찰 종료 시점은 보고서에 명시한다. 예를 들어 7일 cohort 완료율은 `started_at` 이후 7일 안에 완료한 run을 분자로 사용하며, 아직 7일이 지나지 않은 시작은 제외한다. 기간 도중 생성된 모든 시작을 즉시 분모에 넣어 완료율을 낮추지 않는다.

## 개인정보·보존·삭제

- 방문자 연결 이벤트는 visitor 만료 또는 전체 기록 삭제 때 함께 제거한다.
- `visitor_id=null`인 상세 조회는 개인 행동 연결에 사용하지 않고 최대 30일 뒤 제거한다.
- 삭제한 run을 별도 집계 테이블이나 내보낸 CSV에 남기지 않는다.
- 작은 표본의 조합을 외부에 공개하지 않는다. 외부 공유는 기본 5건 이상인 집계만 사용한다.
- 분석 도구를 추가하면 전송 필드, 국외 이전, 보존 기간, 삭제 전파를 별도 검토하기 전까지 원격 전송하지 않는다.

백업 복구 뒤 서비스 공개 전에 만료·삭제 정리를 실행한다. 복구 데이터에서 이미 삭제된 방문자 이벤트가 다시 집계되지 않는지 AC20 증적에 포함한다.

## 실패 관찰

이벤트 저장 실패는 토큰이나 사용자 원문 없이 다음 운영 수치만 증가시킨다.

- event name
- environment
- 실패 분류: validation, database, timeout
- 발생 시각 구간

실패 로그에 visitor·run·quest ID를 남기지 않는다. 시작·완료 이벤트 유실은 `runs`와 비교하는 일일 정합성 검사로 발견하되, 과거 이벤트를 임의 시각으로 복원해 퍼널을 왜곡하지 않는다.

## 구현 검수

- [ ] 허용하지 않은 event name과 properties key 저장이 거절된다.
- [ ] environment를 클라이언트가 조작할 수 없다.
- [ ] 동시 시작·마지막 단계 완료에서 의미상 이벤트가 각각 하나다.
- [ ] 이벤트 DB 오류가 run·step·feedback commit을 rollback하지 않는다.
- [ ] 쿠키 없는 상세 조회가 visitor를 생성하지 않는다.
- [ ] 전체 기록 삭제와 만료 정리가 visitor 연결 이벤트를 제거한다.
- [ ] demo·test가 production 지표에서 제외된다.
- [ ] 분모 0, 미성숙 cohort, 관찰 불가능 run을 올바르게 표시한다.
- [ ] 보고서에 기간·environment·표본 수·실제 방문 미인증 한계를 표시한다.
