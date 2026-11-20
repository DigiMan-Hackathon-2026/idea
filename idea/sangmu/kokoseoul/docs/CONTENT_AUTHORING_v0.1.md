# 콘텐츠 편집·공개 계약 v0.1

작성일: 2026-11-21 · 상태: 운영 UI·repository 구현 전 기준

이 문서는 운영자가 quest draft를 생성·전체 저장·검수·공개·중지·재개·보관하는 화면과 transaction 경계를 정의한다. 사용자에게 노출된 published version은 불변이며, 사실 수정은 새 draft version을 통해서만 공개한다.

## 목표

- 편집 중인 내용을 사용자에게 실수로 노출하지 않는다.
- 일본어·사실·지도·권리·demo 검수를 변경 뒤 다시 수행한다.
- 오래된 저장이 최신 내용을 덮어쓰지 않는다.
- 공개·중지·재개·보관과 audit를 원자적으로 처리한다.
- 기존 run이 시작한 version의 단계·장소 의미를 유지한다.
- 운영 UI 편의를 위해 권한·validation·revision을 client에만 두지 않는다.

## 객체 구분

| 객체 | 책임 | 변경 가능성 |
| --- | --- | --- |
| quest | status, revision, current draft·published pointer | 운영 전이로 변경 |
| draft version | 다음 공개 후보의 전체 content | 전체 저장 가능 |
| published version | 특정 시점의 검수된 content snapshot | 불변 |
| place snapshot | version step이 참조한 당시 장소 정보 | published 뒤 불변 |
| audit log | actor·action·제한된 상태 summary | append-only |
| source register | 사실·권리·확인일의 운영 근거 | 다음 공개 전 갱신 |

공개본을 유지한 채 draft를 편집할 수 있다. quest status가 `published`여도 draft가 별도로 존재할 수 있으며 공개 API는 `publishedVersionId`만 사용한다.

## 상태별 운영 UI

| quest 상태 | 편집 | 공개 | 중지 | 재개 | 보관 |
| --- | --- | --- | --- | --- | --- |
| draft only | 현재 v1 draft | 검수 후 가능 | 불가 | 불가 | 가능 |
| published | 다음 version draft | 새 draft 있을 때 가능 | 가능 | 불가 | 가능 |
| paused | 다음 version draft | 새 version으로 가능 | 이미 중지 | 기존 version만 가능 | 가능 |
| archived | 불가 | 불가 | 불가 | 불가 | 종료 상태 |

버튼 표시만으로 전이를 통제하지 않는다. API와 DB transaction이 current status·published pointer·revision을 다시 검사한다.

## 생성

`POST /admin/quests`는 빈 quest와 v1 draft를 같은 transaction에서 만든다.

- body는 `clientRequestId`만 받는다.
- supplier, actor, status, versionNo, reviewer는 server가 결정한다.
- 같은 actor·key·body는 200 기존 quest, 신규는 201이다.
- 같은 key의 다른 canonical body는 409 `REQUEST_CONFLICT`다.
- audit insert 실패 시 quest·draft 모두 rollback한다.

화면은 응답 유실 뒤 같은 key로 재요청하며 새 draft를 자동 생성하지 않는다.

## draft 전체 저장

`PUT /admin/quests/:questId/draft`는 PATCH가 아니라 편집본 전체를 저장한다.

### client

- 상세 조회에서 받은 `revision`을 `expectedRevision`으로 보낸다.
- field·step을 추가·삭제·재정렬한 전체 상태를 보낸다.
- autosave를 도입하더라도 한 revision에 여러 요청을 병렬 전송하지 않는다.
- server revision이 바뀌면 local draft를 자동 덮어쓰거나 자동 merge하지 않는다.

### server

1. active principal·Origin·입력 크기·strict shape를 확인한다.
2. quest를 잠그고 expected revision과 archived 여부를 검사한다.
3. 기존 draft가 없으면 `max(versionNo)+1`의 draft를 만든다.
4. 전체 field·step·place snapshot 후보를 검증한다.
5. 기존 draft content를 원자적으로 교체한다.
6. review 결과를 미검수 상태로 둔다.
7. quest revision을 1 증가시키고 audit를 기록한다.

published version의 row·step·place를 update하거나 draft row로 재사용하지 않는다.

## field 계약

draft 저장 가능과 public 가능을 구분한다. 작성 중 일부 값이 비어도 타입·크기·소속은 항상 유효해야 한다.

| field | draft 저장 | public gate |
| --- | --- | --- |
| titleJa·summaryJa·bodyJa | 빈 값 후보 허용, 길이·제어문자 검사 | 사용자 의미가 있는 일본어 필수 |
| areaCode | 빈 값 후보 | 허용 area 필수 |
| tags | 빈 배열 가능, 중복·enum 검사 | 추천 조건과 일치 |
| durationMinutes | null 가능 | 양수·표시 가능 값 필수 |
| cost | `unknown` 가능 | unknown이면 0원처럼 표시 금지 |
| solo | unknown 가능 | actual public은 근거 또는 명시적 제한 |
| verifiedAt | null 가능 | actual content는 근거 날짜 필수 |
| isDemo | null 가능 | public 전에 boolean 필수 |
| steps | 작성 중 0개 가능 | 3~5개·연속 position 필수 |
| phrase pair | 둘 다 null 가능 | 하나가 있으면 Ko·Ja pair 검수 |
| place | null 가능 | 필요한 행동이면 snapshot·source·verifiedAt 필수 |

unknown을 빈 string, 0원, false로 coercion하지 않는다. draft 저장 성공은 공개 준비 완료를 뜻하지 않는다.

## step identity·재정렬

- client position은 1부터 연속인지 server가 검사한다.
- draft step ID 입력 여부는 구현 전에 schema로 고정한다.
- published step ID를 새 draft의 수정 대상으로 재사용하지 않는다.
- 삭제한 draft step은 같은 save transaction에서 제거되며 published run에는 영향이 없다.
- position만으로 place·phrase를 잘못 결합하지 않게 전체 payload와 identity를 검수한다.
- public 뒤 next draft에는 content를 복사할 수 있지만 새 version step·place snapshot으로 만든다.

UI drag-and-drop이 없어도 keyboard로 순서를 바꾸고 현재 순서를 text로 확인할 수 있어야 한다.

## 편집 후 review 무효화

일본어·사실·지도·권리·demo review는 특정 draft content와 revision에 대한 결과다.

- draft를 저장하면 이전 review check·reviewedAt·reviewedBy를 새 공개 근거로 재사용하지 않는다.
- 공백·정규화처럼 의미가 같아도 revision이 올랐으면 publish에서 현재 revision을 다시 확인한다.
- publish boolean만으로 source register·권리·필수 field를 대신하지 않는다.
- review 결과는 published version에 확정되며 다음 draft는 별도 검수 대상이다.

reviewer와 작성자가 같은 작은 팀이면 그 제한을 release evidence에 기록하되 자동 검증을 생략하지 않는다.

## 공개 전 gate

### content

- 일본어 제목·요약·본문과 3~5단계
- 시간·비용·혼자 이용·예약·중단 조건
- 단계별 장소·한국어 주소·지도 target
- 한국어 요청 문구와 일본어 뜻 pair
- actual/demo의 일관된 분류

### evidence

- 사실 source 등급·URL 또는 확인 방법·확인일·다음 확인일
- 혼자 이용의 최소 인원·주문·시간 조건
- 일본어 모어 화자 검수 code·날짜·범위
- 이미지·설명·icon 권리와 attribution
- actual이면 현장 또는 공식 source, demo면 특정 업체 오인 방지

### technical

- latest expectedRevision
- current status가 draft·published·paused 중 허용 상태
- draft가 current quest 소속이며 아직 published가 아님
- position·field·foreign key·place snapshot invariant
- audit actor가 active principal

중요 항목이 비면 400 field details와 DB 무변경이다. client check가 true라는 이유로 server source를 만들지 않는다.

## publish transaction

1. quest를 잠근다.
2. expectedRevision·허용 상태·draft pointer를 확인한다.
3. draft version을 잠근다.
4. content·evidence·review gate를 현재 값으로 다시 계산한다.
5. draft state를 published로 확정하고 reviewed metadata를 기록한다.
6. quest `publishedVersionId`를 교체한다.
7. status를 published로 바꾸고 pauseReason을 제거한다.
8. revision을 1 증가시킨다.
9. audit log를 기록하고 commit한다.

어느 단계든 실패하면 version state, pointer, status, revision, audit가 모두 이전 값이다. analytics 실패는 publish를 rollback하지 않지만 사실 원본은 DB 상태다.

## 공개 뒤 검수

- 공개 목록·직접 상세가 새 version을 반환한다.
- 새 run은 새 version에 고정된다.
- 기존 run은 이전 version·step·place snapshot을 유지한다.
- draft가 public serializer·cache·검색에 없다.
- actual/demo label과 analytics environment가 일치한다.
- audit에 action·version·revision summary가 있고 body·source 원문은 없다.

public smoke test가 실패하면 필요에 따라 quest를 pause한다. published row를 수정하거나 pointer를 DB에서 직접 바꾸지 않는다.

## revision 충돌

409 `VERSION_CONFLICT`은 데이터 보호 결과다.

1. local 편집본을 화면 memory에서 분리 보존한다.
2. 최신 quest 상세·revision·draft를 조회한다.
3. 변경된 field·step·status를 사용자에게 보여 준다.
4. local 변경을 폐기하거나 최신본에 수동 반영한다.
5. 새 expectedRevision으로 명시적 저장한다.

server나 client가 두 전체 document를 자동 merge하지 않는다. 응답은 currentRevision만 공개하고 다른 운영자 identity를 넣지 않는다.

## pause

- publishedVersion이 있는 published quest만 중지한다.
- 공개 가능한 일본어 reason과 expectedRevision이 필요하다.
- status, reason, revision, audit를 한 transaction에 저장한다.
- 신규 시작·미완료 step을 막고 기존 run·completion 읽기를 유지한다.
- draft가 있으면 보존하되 공개하지 않는다.

R0·R1 신고에서는 report PATCH보다 quest pause를 먼저 수행한다. 두 transaction의 부분 성공은 [정보 오류 신고 처리 런북](REPORT_TRIAGE_v0.1.md)을 따른다.

## resume와 새 version publish

| 행동 | 사용 조건 | 결과 |
| --- | --- | --- |
| resume | 기존 published content가 여전히 정확함 | 같은 publishedVersion, reason 제거 |
| publish | 사실·문구·단계 수정이 필요함 | 새 immutable version으로 pointer 교체 |

paused에 draft가 있어도 resume가 draft를 공개하지 않는다. 오류 없음의 독립 검증 없이 demo가 급하다는 이유로 resume하지 않는다.

## archive

- draft-only·published·paused에서 expectedRevision으로 가능
- archivedAt, status, revision, audit를 한 transaction에 기록
- 이후 draft 저장·publish·pause·resume 거절
- public 목록·신규 시작·미완료 진행 차단
- 기존 published run·completion 읽기 유지
- draft-only archived quest는 public에서 계속 404

실수 archive를 되돌리는 hidden endpoint나 DB 수정은 두지 않는다. 같은 개념이 필요하면 새 quest를 만들고 중복 판단을 기록한다.

## audit summary

| action | 허용 summary |
| --- | --- |
| create | quest·draft version, revision |
| save draft | 변경 field category·step count, revision 전후 |
| publish | published version·review category, revision 전후 |
| pause·resume | status·reason 존재 여부, revision 전후 |
| archive | 이전 status·archivedAt·revision |

본문·주소·phrase·source 답변·OIDC identity·token을 audit에 복제하지 않는다. before·after 전체 document JSON을 넣지 않는다.

## 운영 화면

- quest status, public version, editing draft version과 revision을 분리 표시한다.
- “저장됨”과 “공개됨”을 다른 text로 표시한다.
- unsaved change와 다른 운영자 conflict를 구분한다.
- archive는 결과와 기존 run 유지 범위를 확인받는다.
- pause reason은 사용자에게 보일 일본어 preview를 제공한다.
- validation error는 field와 summary에 연결하고 focus를 첫 오류로 보낸다.
- published content는 read-only로 보이고 직접 수정 행동을 제공하지 않는다.

## 실패·응답 유실

- draft save 유실: 상세 재조회, revision·field가 같으면 성공 확인
- publish 유실: 상세 재조회, publishedVersion·status 확인
- pause·resume·archive 유실: 최신 status·revision 확인, 자동 반복 금지
- 503: DB 상태 확인 뒤 사용자 명시 재시도
- audit 실패: mutation 전체 rollback
- analytics 실패: domain 상태 유지, 제한된 기술 signal

자세한 client 상태는 [요청·복구 계약](CLIENT_RECOVERY_v0.1.md)을 따른다.

## 검수 matrix

- [ ] 빈 draft 생성과 같은 key 재전송 200 기존 결과
- [ ] draft-only 저장이 public 목록·상세에 없음
- [ ] published quest 편집이 next draft를 만들고 public pointer 유지
- [ ] draft 변경 뒤 이전 review 재사용 불가
- [ ] validation 하나씩 누락해 publish DB 무변경
- [ ] 두 운영자 같은 revision 저장에서 하나만 성공
- [ ] publish와 run 시작 경쟁이 old 또는 new version 하나로 직렬화
- [ ] publish 각 단계 실패에서 pointer·audit rollback
- [ ] 공개 뒤 기존 run은 old version, 신규 run은 new version
- [ ] pause와 step 완료 경쟁이 quest→run 잠금 순서로 결정
- [ ] paused resume는 draft를 공개하지 않음
- [ ] archived 이후 모든 운영 mutation 거절
- [ ] public serializer·cache·log에 draft·source·audit 원문 없음
- [ ] keyboard로 step 순서·validation·conflict 처리 가능

## 증거 양식

```markdown
# 콘텐츠 편집·공개 검수 YYYY-MM-DD HH:mm KST

- commit·schema·환경:
- quest·draft·published fixture reference:
- create idempotency:
- full save·review invalidation:
- validation field matrix:
- revision conflict:
- publish transaction·failure injection:
- old/new run version:
- pause·resume·archive:
- public serializer·cache·audit canary:
- keyboard·focus:
- 알려진 제한:
```

실제 업체 비공개 답변·운영자 identity·content body 전체·credential을 증거에 넣지 않는다.

## 구현 gate

- [ ] API request·response와 DB version schema가 이 계약과 일치한다.
- [ ] published version update repository method가 존재하지 않는다.
- [ ] draft 저장 때 이전 review를 새 공개 근거로 쓰지 않는다.
- [ ] publish·상태 변경과 audit가 한 transaction이다.
- [ ] expectedRevision conflict와 응답 유실 복구가 UI에 연결됐다.
- [ ] content register·일본어·권리 reviewer와 일정이 있다.
- [ ] AC07·AC08·AC13~AC15·AC19를 실제 PostgreSQL과 UI에서 통과했다.

연결 검수: AC07, AC08, AC13, AC14, AC15, AC19
