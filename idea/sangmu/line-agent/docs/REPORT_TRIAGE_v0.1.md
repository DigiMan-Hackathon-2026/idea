# 정보 오류 신고 처리 런북 v0.1

작성일: 2026-11-21 · 상태: 운영 UI 구현 전 처리 기준

이 문서는 방문자의 익명 report를 운영자가 분류하고, 필요한 경우 quest를 먼저 중지한 뒤 독립적으로 사실을 확인해 새 version 공개 또는 재개로 마무리하는 절차다. 신고 원문은 사실 증명이 아니며, 신고자에게 개별 답변하거나 처리 결과를 보낼 계정 정보는 P0에 없다.

## 목표

- 잘못된 주소·이용 조건이 새 사용자에게 계속 노출되는 시간을 줄인다.
- 신고 내용만 믿고 검증된 콘텐츠를 임의 수정하지 않는다.
- published version 불변성과 기존 run 기록을 유지한다.
- report comment를 audit·log·issue·채팅에 복제하지 않는다.
- 운영자 두 명의 동시 처리가 revision으로 서로를 덮어쓰지 않는다.
- 해결과 “신고자에게 알림”을 혼동하지 않는다.

## report 입력 범위

| category | 사용자 의도 | 예 | category만으로 정하지 않는 것 |
| --- | --- | --- | --- |
| `information` | 주소·가격·시간·설명 불일치 | 지도 대상이 다름, 가격 변동 | 위험도·진위 |
| `unavailable` | 방문·이용이 불가능함 | 폐점, 예약 필수, 혼자 거절 | 영구 종료 여부 |
| `other` | 위 두 분류 밖의 문제 | 표현·접근성·불편 | 낮은 우선순위라는 뜻 |

comment는 최대 500자의 plain text다. 운영 화면에서 linkify·HTML render·외부 preview를 하지 않는다.

## triage 우선순위

category보다 잠재 사용자 영향을 먼저 본다.

| 등급 | 예 | 첫 행동 | 목표 시점 후보 |
| --- | --- | --- | --- |
| R0 안전·권리 | 잘못된 위치가 위험 장소로 유도, 개인정보·권리 침해, 사기 가능성 | quest 즉시 pause, 접근 제한, 운영 책임자 알림 | 확인 즉시 |
| R1 핵심 이용 불가 | 폐점·장기 휴업·혼자 이용 불가·필수 예약 누락 | 신규 시작 pause 우선, 공식·현장 확인 | 같은 운영일 |
| R2 중요 정보 오류 | 가격·시간·주소 일부·요청 문구 의미 오류 | 영향 단계 확인, 필요 시 pause, 독립 검증 | 다음 검수 주기 전 |
| R3 표현·비핵심 | 오탈자·자연스러움·보조 설명 | in_progress, 다음 draft에 반영 | 계획된 콘텐츠 수정 |
| RA 남용·무관 | 반복 spam·제품과 무관한 text | 원문 확산 금지, 제한된 요약 후 resolved | batch 처리 |

시점은 SLA가 아니라 초기 운영 후보다. 팀 대응 시간이 없으면 위험 콘텐츠 공개 범위를 줄이거나 전체 quest를 pause한다.

## 첫 5분

1. 운영 session·active principal을 확인한다.
2. report ID로 운영 상세를 열고 visitor·session 정보가 없는지 확인한다.
3. comment를 다른 도구에 복사하지 않고 category·quest·version·createdAt을 본다.
4. 주소·혼자 이용·한국어 문구·권리·안전 영향 여부를 분류한다.
5. R0·R1 또는 불확실하지만 피해가 큰 경우 report 상태 처리보다 quest pause를 먼저 실행한다.
6. pause request ID와 report ID를 운영 기록에서 연결하되 자유 입력은 복제하지 않는다.

신고를 맡았다는 표시가 필요하면 latest report revision으로 `in_progress` 전환한다. 위험 콘텐츠를 계속 공개하면서 report claim 경쟁부터 해결하지 않는다.

## pause 절차

pause와 report 상태 변경은 별도 endpoint·transaction이다. 두 작업을 분산 transaction처럼 묶을 수 없으므로 안전한 순서를 사용한다.

1. quest 상세를 다시 조회해 latest revision·published version을 확인한다.
2. 사용자에게 공개 가능한 일본어 reason을 작성하고 P0 검수 상태를 확인한다.
3. expectedRevision으로 quest를 pause한다.
4. 목록 제외, 직접 상세의 중지 사유, 신규 시작·미완료 step 차단을 확인한다.
5. 기존 run·완료 기록 읽기가 유지되는지 확인한다.
6. report latest revision을 다시 조회해 `in_progress`와 개인정보 없는 internalNote를 저장한다.

report 변경이 실패해도 이미 성공한 pause를 되돌리지 않는다. report를 다시 조회해 처리 상태를 이어 간다. pause가 revision 충돌로 실패하면 latest quest 상태를 확인하고 공개 상태가 유지 중이면 다시 판단한다.

## pause reason 일본어 기준

- 확인 중인 사실만 말하고 원인을 단정하지 않는다.
- 신고자·업체·운영자 탓을 공개하지 않는다.
- 재개 시각이 확정되지 않았으면 약속하지 않는다.
- 기존 기록은 볼 수 있지만 다음 단계는 진행할 수 없는지 명확히 한다.

작업 초안 예:

> 利用条件を再確認しているため、現在このクエストを開始・継続できません。これまでの記録は確認できます。

실제 공개 전 [일본어 문구 검수 절차](JAPANESE_COPY_REVIEW_v0.1.md)의 P0 검수를 받는다.

## 독립 사실 확인

report comment를 공식 source로 사용하지 않는다. [콘텐츠 검수 계약](CONTENT_VERIFICATION_v0.1.md)에 따라 다음을 확인한다.

| 주장 | 우선 확인 |
| --- | --- |
| 주소·지도 대상 | 공식 장소 정보 + 현장 또는 직접 확인 |
| 영업·휴무 | 공식 공지 + 확인 시각 |
| 가격 | 공식 메뉴·현장 + 포함 조건 |
| 혼자 이용 | 업체 직접 확인 또는 재현 가능한 공식 정책 |
| 예약 필요 | 공식 예약 경로·현장 절차 |
| 한국어 요청 문구 | 한국어 상황·존댓말 + 일본어 의미 pair 검수 |
| 권리 문제 | asset 원본·license·동의 범위 |

검색 snippet·블로그·다른 사용자 댓글만으로 “오류 없음”을 결정하지 않는다. 확인 시각, source URL과 검수자 코드를 content register에 남긴다.

## 결과별 처리

### 오류 확인

1. paused를 유지한다.
2. 현재 published version을 수정하지 않고 새 draft를 만든다.
3. 사실·일본어·권리·지도·demo 검수를 다시 한다.
4. 새 version을 publish하면 quest가 published로 전환된다.
5. public 상세·신규 run은 새 version, 기존 run은 과거 version인지 확인한다.
6. report를 latest revision으로 resolved 처리하고 제한된 근거를 internalNote에 남긴다.

R0·권리 침해에서 과거 asset도 노출하면 안 되는 경우 일반 불변 원칙만으로 해결하지 말고 긴급 비노출 범위와 법적·안전 책임을 별도 결정한다.

### 오류 아님을 확인

1. source·확인 시각을 register에 기록한다.
2. quest가 pause됐으면 기존 publishedVersion을 resume한다.
3. 목록·신규 시작·기존 run의 상태를 확인한다.
4. report를 resolved하고 “공식 source와 현장 조건 재확인” 같은 제한된 요약만 남긴다.

신고자가 틀렸다고 비난하거나 spam label을 공개하지 않는다.

### 확인 불가

- quest를 pause 상태로 유지한다.
- report는 in_progress 또는 운영상 resolved하더라도 quest 미확인을 명확히 분리한다.
- 확인 불가를 오류 없음으로 간주하지 않는다.
- 일정 내 확인할 수 없으면 archive 또는 실제 공개 범위 제외를 결정한다.

### 일시 조건

휴일·재고·행사처럼 일시적인 문제라도 사용자가 현재 행동할 수 없으면 pause가 우선이다. 자동 시각 재개를 P0에 두지 않고 조건을 다시 검수한 운영자가 resume한다.

## report 상태 전이

| 현재 | 허용 다음 상태 | 사용 조건 |
| --- | --- | --- |
| new | in_progress | owner가 검증 시작 |
| new | resolved | 명백한 중복·무관 또는 즉시 검증 완료 |
| in_progress | resolved | 검증과 콘텐츠 조치 완료 |
| resolved | in_progress | 새 사실로 재검토 |

new로 되돌리지 않는다. 같은 status·같은 note의 빈 PATCH는 거절한다. 모든 변경은 expectedRevision과 audit log를 사용한다.

resolved는 quest가 반드시 published라는 뜻이 아니다. “신고 운영 처리를 닫음”과 “콘텐츠를 다시 공개해도 됨”을 별도 판단한다.

## internalNote

허용:

- `공식 페이지 2026-11-21 확인, 주소 일치`
- `현장 확인 대기, quest pause 유지`
- `새 version v3 공개 후 resolved`

금지:

- report comment 원문 복사
- visitor·session·request key
- 이름·연락처·계정·개인 평가
- 전체 주소·좌표가 불필요한 반복
- 외부 시스템 credential·비공개 provider response

audit summary에도 internalNote 전체를 복제하지 않고 status·revision·action만 제한적으로 둔다.

## 개인정보·민감 내용

comment에 실명·연락처·예약번호 등으로 보이는 내용이 있어도 issue·채팅·AI·검색에 복사하지 않는다.

1. 접근을 필요한 운영자에게만 제한한다.
2. 사실 확인에는 개인정보 없는 요약만 사용한다.
3. 조기 익명화·삭제가 필요하면 privacy 절차와 audit 가능한 operation을 사용한다.
4. 일반 resolved 처리만으로 원문이 즉시 사라진다고 약속하지 않는다.
5. visitor 전체 삭제·만료에서는 정책대로 comment를 제거한다.

민감정보 사고 가능성이 있으면 P0 incident로 올리고 [운영 런북](OPERATIONS_RUNBOOK_v0.1.md)을 따른다.

## 중복·관련 신고

P0는 여러 report를 자동 병합하지 않는다.

- 각각의 report status·revision·audit를 유지한다.
- 같은 quest·category 시간대의 건수를 운영 목록에서 참고할 수 있다.
- 한 source 검증으로 여러 건을 해결해도 각 report를 latest revision으로 별도 처리한다.
- comment similarity나 fingerprint를 위한 새 개인정보 처리를 추가하지 않는다.

반복 신고가 많으면 낮은 등급이라도 실제 영향 범위를 다시 평가한다.

## 신고자와 communication

P0는 이메일·계정·push token을 수집하지 않으므로 개별 진행 상황·결과 알림을 제공하지 않는다.

- 접수 화면은 확인하겠다고만 하고 해결 시각을 약속하지 않는다.
- 공개 quest의 확인일·상태 변경으로 최신 정보를 제공한다.
- “신고 처리 완료” metric을 사용자 만족·업체 품질 점수로 해석하지 않는다.
- 후속 연락을 위해 report에 연락처 입력을 유도하지 않는다.

## 운영 지표

| 지표 | 원본 | 주의 |
| --- | --- | --- |
| 신규 report 수 | reports | demo·test 분리 필요 |
| category·status 수 | reports | 자유 입력 분석 금지 |
| 접수→첫 처리 시간 | createdAt·updatedAt/audit | 근무시간·표본 수 표시 |
| pause까지 시간 | report·quest audit | 원문 없이 연결 가능한 운영 증거 필요 |
| 해결 뒤 재신고 | quest·category 기간 집계 | 같은 사용자 추적 금지 |

작은 업체·지역을 외부에 비교 공개하지 않는다. metric label에 report·visitor UUID와 comment를 넣지 않는다.

## 검수 시나리오

- [ ] new report를 두 운영자가 revision 1로 동시에 claim
- [ ] R1 신고에서 report 처리보다 quest pause가 먼저 성공
- [ ] pause 성공·report PATCH 실패 뒤 안전하게 재개
- [ ] quest revision 충돌 뒤 latest 상태 재평가
- [ ] 오류 확인 후 새 version publish, 기존 run 과거 version 유지
- [ ] 오류 아님 확인 후 기존 version resume
- [ ] resolved report를 in_progress로 reopen
- [ ] same status·same note 빈 PATCH 거절
- [ ] comment의 HTML·URL·개인정보 canary가 render·log·audit에 없음
- [ ] visitor 삭제·만료 뒤 report 연결·comment 제거
- [ ] anonymous 상태 때문에 신고자 알림을 약속하지 않음

## 처리 증거 양식

```markdown
# report 처리 YYYY-MM-DD HH:mm KST

- report ID: 저장소 외 운영 reference
- quest ID·version: 저장소 외 운영 reference
- 분류: R0 / R1 / R2 / R3 / RA
- 처리자·reviewer 역할:
- pause 여부·request ID:
- 확인 source와 시각:
- 사실 판단: 확인 / 오류 아님 / 불명확
- 콘텐츠 action: 새 version / resume / pause 유지 / archive
- report 최종 status·revision:
- 검수 commit:
- 알려진 제한:
```

이 양식을 public issue에 그대로 붙이지 않는다. repository에는 개인정보 없는 결정·콘텐츠 근거와 기능 개선만 남긴다.

## 운영 준비 gate

- [ ] report 목록이 visitor·session·token을 반환하지 않는다.
- [ ] comment가 plain text이고 log·audit·metric에 복제되지 않는다.
- [ ] R0·R1 pause 권한과 일본어 reason 검수자가 있다.
- [ ] pause와 report PATCH의 부분 성공 복구를 연습했다.
- [ ] 독립 source 확인과 content register 갱신 경로가 있다.
- [ ] 새 version·resume·archive의 reviewer가 정해졌다.
- [ ] report revision 충돌과 reopen을 검수했다.
- [ ] 익명 신고자에게 개별 알림을 약속하지 않는다.
- [ ] 삭제·만료 시 report 익명화가 구현됐다.

연결 검수: AC07, AC08, AC13~AC16, AC19
