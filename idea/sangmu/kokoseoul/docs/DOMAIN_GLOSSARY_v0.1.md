# 도메인 용어·명명 계약 v0.1

작성일: 2026-11-21 · 상태: schema·UI 구현 전 기준

이 문서는 DigiMan의 제품 개념을 DB, API, TypeScript, 운영 문서와 일본어 화면에서 같은 의미로 쓰기 위한 기준이다. 일본어 표현은 구현용 초안이며 [일본어 문구 검수 절차](JAPANESE_COPY_REVIEW_v0.1.md)에 따라 모어 화자와 확정한다.

## 명명 층

| 층 | 형식 | 예 |
| --- | --- | --- |
| PostgreSQL table·column | `snake_case`, 복수 table | `quest_versions`, `published_version_id` |
| API JSON·query | `camelCase` | `versionId`, `durationMax` |
| TypeScript type | `PascalCase` | `QuestAvailability` |
| TypeScript value·function | `camelCase`, 행동 동사 | `completeRunStep` |
| enum wire value | lowercase `snake_case` | `in_progress` |
| error code | `SCREAMING_SNAKE_CASE` | `STEP_ORDER_CONFLICT` |
| analytics event | lowercase `snake_case` 과거 행동 | `quest_started` |
| route segment | lowercase 복수 noun | `/quests`, `/reports` |
| 일본어 UI | 검수된 자연어 | `クエストを探す` 후보 |

DB 이름을 UI에 노출하거나 일본어 문장을 code identifier로 사용하지 않는다. 같은 개념의 casing만 층에 맞게 바꾸고 의미를 바꾸지 않는다.

## 사람·권한

| canonical 용어 | 의미 | 모호한 대체 |
| --- | --- | --- |
| `visitor` | opaque browser session으로 기록을 소유하는 익명 주체 | user, guest account, customer |
| visitor session | visitor를 증명하는 자체 cookie·DB row | login, account, Auth.js session |
| admin principal | OIDC issuer·subject와 연결된 활성 운영 권한 | Google user, email allow, visitor |
| supplier organization | quest 공급 책임 단위, P0는 내부 운영 공급자 | admin, place owner |
| participant code | 조사 참여자를 익명 구분하는 code | visitor ID, 실명, 계정 |

`user`만으로 visitor인지 운영자인지 알 수 없으므로 schema·권한·로그 문맥에서 쓰지 않는다. 일본어 일반 문장의 “利用者”를 내부 권한 이름으로 역수입하지 않는다.

## 콘텐츠

| canonical 용어 | 불변 의미 | 주요 식별자·상태 |
| --- | --- | --- |
| quest | 여러 version과 수명 상태를 가진 안정된 container | `questId`, `draft/published/paused/archived` |
| quest version | title·body·steps·place snapshot의 한 묶음 | `versionId`, `draft/published` |
| draft version | 수정 가능한 quest당 최대 한 version | 공개 전 review 대상 |
| published version | 공개 transaction 뒤 내용 불변인 version | 기존 run이 계속 pinning |
| quest step | version 안에서 1부터 연속된 자기 안내 단계 | `stepId`, `position` |
| place | 다음 draft 작성에 쓰는 현재 장소 source | 원본 주소·근거·확인일 |
| place snapshot | 공개 당시 step에 고정한 장소 정보 | 기존 run에서 변경 금지 |
| phrase pair | 직원에게 보여 줄 한국어와 일본어 뜻의 쌍 | 둘 다 있거나 둘 다 없음 |
| demo quest | 실제 방문 가능성을 주장하지 않는 가상 콘텐츠 | `isDemo: true`, 표시 필수 |

quest와 version을 같은 것으로 부르지 않는다. quest의 `revision`은 운영 동시 수정 번호이고 version의 `versionNo`는 콘텐츠 이력 번호다.

### 일본어 후보

| 내부 개념 | 일본어 후보 | 검수 쟁점 |
| --- | --- | --- |
| quest | `クエスト` | game 과제로만 오해되지 않는지 |
| demo quest | `デモ体験` | 실제 예약·방문 콘텐츠로 오해 금지 |
| quest list | `クエスト一覧` | 탐색 문맥에서 자연스러운지 |
| paused | `現在このクエストは利用できません` | 기존 기록 읽기와 구분 |
| archived | `このクエストは終了しました` | 일시 중지처럼 보이지 않게 함 |

일본어가 enum의 직역일 필요는 없지만 허용 행동과 손실 의미는 같아야 한다.

## 진행·완료

| canonical 용어 | 의미 | 금지할 오해 |
| --- | --- | --- |
| run | 한 visitor가 한 quest version으로 시작한 진행 기록 | 예약, 결제, 입장권 |
| run step completion | visitor의 자기 확인 기록 | 위치·출석·구매 증명 |
| in progress | run에 다음 미완료 step이 있음 | quest가 published라는 뜻 |
| completed run | 마지막 step transaction이 완료된 run | 실제 방문·성과 검증 |
| completion card | completed run에서 읽는 요약 UI | 인증서, 업체 확인서 |
| own run | 현재 visitor 소유 run | 다른 device 자동 복구 기록 |
| pinned version | run 시작 시 고정된 version | 최신 내용으로 자동 이동 |

API와 code에서는 `run`을 사용한다. 화면은 `進行記録`, `完了した記録` 후보를 쓰며 내부 영어를 노출하지 않는다. `experience`는 사용자 문장일 수 있지만 DB entity 이름으로 run을 대체하지 않는다.

## feedback·report·incident

| 용어 | 누가·무엇을 | 결과 |
| --- | --- | --- |
| feedback | completed run의 즐거움·새 경험·선택 comment | run당 한 행 upsert |
| report | visitor가 quest/version 정보 오류 제출 | 운영 triage와 revision 상태 전이 |
| internal note | 운영자가 report 처리 근거를 제한해 기록 | 방문자에게 반환하지 않음 |
| incident | 가용성·보안·데이터 운영 사건 | 장애 severity와 런북 적용 |
| audit log | 운영 mutation의 append-only 요약 | report·incident 원문 저장소 아님 |

`report`를 feedback, 고객센터 문의, 보안 incident와 섞지 않는다. 접수는 정보 정정·즉시 해결을 보장하지 않는다.

## 저장 상태와 파생 능력

| 이름 | 종류 | 값·의미 |
| --- | --- | --- |
| `quest.status` | 저장 | `draft`, `published`, `paused`, `archived` |
| `questVersion.state` | 저장 | `draft`, `published` |
| `run.status` | 저장 | `in_progress`, `completed` |
| `report.status` | 저장 | `new`, `in_progress`, `resolved` |
| `availability` | 파생 | 현재 읽기·시작 가능 상태 요약 |
| `canStart` | 파생 | 현재 visitor가 신규 시작 가능 |
| `canContinue` | 파생 | pinned run의 다음 mutation 가능 |
| `nextStepId` | 파생 | 순서를 만족하는 다음 step 또는 null |

화면은 저장 status만 보고 행동을 추측하지 않는다. server는 mutation마다 상태·소유권·version을 다시 검사한다.

### paused와 archived

- `paused`는 재검증 뒤 resume 가능한 일시 중지다.
- `archived`는 종료 상태이며 resume하지 않는다.
- 둘 다 신규 시작은 막지만 completed 기록 삭제를 뜻하지 않는다.
- `unavailable`, `closed`, `disabled`를 DB status 별칭으로 추가하지 않는다.

### absent·unknown·not found

- `absent`는 상태 머신 설명 용어이며 wire enum이 아니다.
- `unknown`은 비용·solo 등 사실을 아직 확인하지 못한 값이다.
- `null`은 field 계약상 값 없음이며 unknown과 항상 같지 않다.
- `NOT_FOUND`는 없음·미공개·타인 소유를 공개 응답에서 구분하지 않는다.
- empty list는 성공 200이며 404가 아니다.

## 검수·사실 시각

| 이름 | 의미 | 바뀌는 조건 |
| --- | --- | --- |
| `reviewedAt` | 일본어·콘텐츠 형식과 공개 기준을 사람이 검수한 시각 | draft review 완료 |
| `verifiedAt` | 장소·가격·혼자 이용 등 사실을 source로 확인한 시각 | 사실 재확인 |
| `firstPublishedAt` | quest가 최초 공개된 불변 시각 | 최초 공개 한 번 |
| `updatedAt` | row가 수정된 시각 | 허용 mutation |
| `expiresAt` | session 접근이 끝나는 절대 instant | 생성 시 고정 |

reviewed와 verified를 같은 값으로 합치지 않는다. AI 초안은 둘 다 충족하지 않는다. `updatedAt`을 사실 확인일이나 pagination 정렬 key로 쓰지 않는다.

## 삭제·중지·익명화

| 행동 | 대상 | 의미 |
| --- | --- | --- |
| delete | visitor 연결 개인 기록 | active DB 물리 제거, report는 정책에 따라 익명화 |
| anonymize | report·analytics visitor 연결 | identity·자유 입력 제거, 제한 상태 유지 가능 |
| pause | quest | 신규 시작·미완료 mutation 차단, 복구 가능 |
| archive | quest | 운영 종료, 다시 공개하지 않음 |
| expire | visitor session | DB clock 뒤 인증 즉시 실패 |
| cleanup | 만료 data | 비동기 물리 삭제·익명화 |

UI의 “삭제”를 cookie clear로 구현하지 않는다. `remove` 하나로 delete·archive·anonymize·cleanup을 뭉뚱그리지 않는다.

## API·DB field 매핑

| 의미 | API | DB |
| --- | --- | --- |
| quest ID | `questId` 또는 resource `id` | `quest_id` 또는 `quests.id` |
| pinned version | `versionId` | `runs.version_id` |
| 운영 동시성 | `expectedRevision`, `revision` | quest·report `revision` |
| 단계 순서 | `position`, `nextStepId` | `quest_steps.position` |
| visitor 만료 | `expiresAt`, `visitorExpiresAt` | `visitors.expires_at` |
| 최초 공개 정렬 | opaque cursor tuple | `first_published_at`, quest `id` |
| 신고 멱등성 | `clientRequestId` | `reports.client_request_id` |
| 요청 추적 | `X-Request-Id`, `requestId` | audit `request_id`, log field |

resource body의 `id`와 관계 field의 `questId`를 섞지 않는다. DB 이름을 JSON에 snake_case로 반환하지 않는다. cursor 내부 구조는 public API가 아니다.

## 함수 동사

| 행동 | 권장 | 피할 이름 |
| --- | --- | --- |
| 초안 전체 저장 | `saveQuestDraft` | `updateThing`, `patchQuest` |
| 공개 | `publishQuestDraft` | `activateVersion` |
| 중지·재개 | `pauseQuest`, `resumeQuest` | `toggleQuest` |
| 단계 완료 | `completeRunStep` | `finishQuest` |
| 전체 기록 삭제 | `eraseVisitorData` | `clearCookie` |
| report 처리 | `transitionReport` 후보 | `fixReport` |
| session 인증 | `authenticateVisitorSession` | `getUser` |

중요 mutation을 `handle`, `process`, `manage`만으로 숨기지 않는다.

## 변경 규칙

- 새 entity·status·error code 전에 기존 개념으로 표현 가능한지 확인한다.
- 의미 rename은 DB migration, API compatibility, analytics와 일본어 copy 영향을 기록한다.
- 일본어 후보 변경이 내부 enum rename을 자동으로 요구하지는 않는다.
- 서로 다른 의미를 한 번역 key로 합치지 않는다.
- 인터뷰 표현은 익명 evidence로 보관하고 검수 없이 canonical 용어로 승격하지 않는다.
- provider 용어를 내부 권한·상태 이름으로 그대로 가져오지 않는다.

## 검수 checklist

- [ ] quest/version과 revision/versionNo가 구분됨
- [ ] visitor session과 admin session이 type·cookie·module에서 분리됨
- [ ] run 완료가 방문·구매·출석 인증처럼 표현되지 않음
- [ ] paused와 archived의 복구 가능성이 UI·API에서 다름
- [ ] feedback·report·incident·audit가 서로 다른 경계임
- [ ] reviewedAt·verifiedAt·updatedAt·expiresAt 의미가 섞이지 않음
- [ ] delete·anonymize·archive·expire·cleanup 동사가 정확함
- [ ] API camelCase와 DB snake_case 매핑이 contract test에 있음
- [ ] 일본어 후보가 화면 문맥에서 모어 화자 검수를 받음
- [ ] error code·enum이 사용자 문구에 노출되지 않음

## 구현 gate

- [ ] schema·API type·fixture가 canonical entity 이름을 사용한다.
- [ ] 상태별 server 능력과 일본어 문구가 상태 머신에 연결된다.
- [ ] review에서 모호한 `user`, `version`, `status`, `delete`를 확인한다.
- [ ] 공개 copy는 source section·reviewer code·날짜를 가진다.
- [ ] 호환되지 않는 rename에는 migration·rollback 영향이 있다.

연결 검수: AC01, AC03, AC06, AC08, AC09, AC13, AC15, AC16, AC20
