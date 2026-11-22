# 초안을 앱 퀘스트로 올리는 순서

작성일: 2026-11-23 · 상태: 퀘스트 담당 작업 절차

[퀘스트 초안](README.md)을 앱의 방문 가이드로 올릴 때 고칠 파일과, 빠뜨리면 실패하는 검사를 순서대로 정리했다. 공개 기준은 [콘텐츠 검수 계약](../../../docs/CONTENT_VERIFICATION_v0.1.md)과 [역에서 시작하는 퀘스트 개발 계획](../../../docs/QUEST_STATION_PLAN_v0.1.md)을 따른다.

## 올리기 전에

- 초안의 `미확인` 항목 중 이용 조건(여는 날·시간·요금·혼자 이용)과 출구 번호는 [현장 확인표](../field-check/field-check-items.csv)나 공식 안내로 채운다. 채우지 못한 조건은 앱 문구에 쓰지 않는다.
- 일본어 문장은 [일본어 검수 시트](../japanese-review/README.md)에 초안 행으로 이미 들어가 있다. 검수 결과를 반영한 뒤 옮긴다.

## 1. 방문 가이드 데이터

`src/modules/content/visit-guides/<목적>.json`(food, culture, shopping, beauty, rest, discovery)에 한 항목을 더한다.

`python3 scripts/draft_to_visit_guide.py research/desk/quest-drafts/<slug>.md --purpose <목적> --area <지역> --minutes <분>`이 초안의 단계·보여 줄 문장·출처를 옮기고 새 UUID를 넣은 뼈대를 출력한다. 초안에 없는 일본어 제목·요약, 완료 버튼 문구, 장소 이름·주소는 `TODO`로 남고, `TODO`가 하나라도 남으면 `quest-content-rules.test.ts`가 실패한다. 보여 줄 문장은 둘째 단계에 넣으므로 맞는 단계로 옮긴다.

| 필드 | 적을 것 |
| --- | --- |
| `id`, `versionId`, `place.id`, `steps[].id`, `seed.*` | 새 UUID. 다른 퀘스트와 겹치지 않게 만든다 |
| `slug` | 초안 파일 이름과 같게 쓴다. 상세 주소가 `/quests/<slug>`가 된다 |
| `areaCode` | [지역 목록](../../../src/modules/content/demo-quests.ts)의 `AREA_LABELS` 중 하나. 맞는 지역이 없으면 지역을 먼저 추가한다 |
| `purpose`, `durationMinutes`, `costMin`, `walking` | 목록 필터에 쓰인다. 모르면 `costMin`·`walking`은 비운다 |
| `title`·`summary`·`body`·`detail`의 `Ko`·`Ja` | 초안의 한·일 문구. 첫 단계에 출구를 쓰면 아래 출구 목록과 같은 번호로 쓴다 |
| `place` | 이름, 한국어 주소, 공식 안내 URL(`guideUrlKo`·`guideUrlJa`), 공식 안내를 확인한 날(`verifiedAt`). 확인일은 상세 화면에 그대로 보인다 |
| `steps[]` | 단계 제목·안내·완료 버튼 문구, 직원에게 보여 줄 문장(`phraseKo`·`phraseJa`). 장소를 보여 줄 단계는 `showsPlace: true` |

## 2. 출구와 시작점

[출구·시작점 목록](../../../scripts/db/quest-search-locations.json)에 넣어야 퀘스트 상세의 "지하철로 가기", 목록의 출구 표시, 역에서 찾기, 코스, 완료 화면의 다음 행동이 동작한다.

- `places`에 `slug`, `questId`, `versionId`, `placeId`, `addressKo`, 시작점 좌표, 좌표 출처 URL, `originId`(가까운 출구 id), `radiusM`(800·1500·2000 중 하나)을 더한다. 출구가 800m보다 멀면 반경을 넓힌다.
- 출구가 목록에 없으면 `exits`에 더한다. 이름은 `○○역 N번 출구`, 일본어는 `○○駅N番出口` 형식이어야 역과 출구 번호를 읽을 수 있다.
- 출구가 1~9호선 역이 아니면(예: 서울숲역) 노선 표시와 지하철 안내 링크 없이 출구 이름만 보인다.

## 3. 검사

| 검사 | 실패하는 경우 |
| --- | --- |
| `pnpm test` 중 `quest-content-rules.test.ts` | DB가 거절할 내용이다: 단계 3~5개, 단계마다 한·일 제목·안내·완료 문구, 짝이 맞는 보여 줄 문장, 길이 제한, 소요 시간 15~240분, 알려진 지역·목적, 겹치지 않는 UUID, https 출처 |
| `pnpm test` 중 `quest-access.test.ts` | 출구가 없는 퀘스트가 생겼다. 쇼핑 데모만 예외다 |
| `pnpm test` 중 `quest-exit-mentions.test.ts` | 문구에 적은 출구가 출구 목록과 다른 번호만 말한다 |
| `pnpm test` 중 `quest-detail-path.test.ts` | 출구 목록의 `slug`와 상세 주소가 맞지 않는다 |
| `pnpm test` 중 `quest-access.test.ts`의 버전 대조 | 콘텐츠 파일과 출구 목록의 `versionId`가 다르다 |
| `pnpm test` 중 `quest-courses.test.ts` | 코스에 넣은 퀘스트를 찾지 못하거나, 코스 문구의 정거장 수가 계산과 다르다 |
| `pnpm test:e2e`의 "shows five ongoing visit guides in each category" | 한 목적에 방문 가이드가 다섯 개가 아니게 됐다. 목적별 개수를 바꾸면 이 테스트도 고친다 |
| `python3 scripts/build_japanese_review_sheet.py` 뒤 `python3 scripts/check_ko_ja_consistency.py` | 한·일 문구의 숫자나 요일이 다르다 |
| `python3 scripts/verify_all.py` | 문서·조사 산출물 규칙 |

## 4. DB와 Preview

- 새 퀘스트: `pnpm db:seed:visit-guides <목적>`으로 로컬 DB에 넣는다. 시드는 이미 있는 퀘스트를 건너뛴다.
- 공개된 퀘스트의 문구 수정: 콘텐츠 파일과 [출구·시작점 목록](../../../scripts/db/quest-search-locations.json)의 `versionId`를 같은 새 UUID로 바꾼 뒤 `pnpm db:publish:content`를 실행한다. 기본은 확인만 하고 되돌리는 dry-run이고, `--apply`를 붙이면 바뀐 퀘스트마다 새 버전을 공개한다. 기존 버전과 그 버전으로 시작한 진행 기록은 그대로 남고, 시작점은 새 버전으로 복사된다. `versionId`가 같은 퀘스트는 건드리지 않는다.
- Preview DB: 같은 명령에 `--preview`를 붙인다(Preview 전용 접속 정보가 있어야 한다). 출구·시작점 등록 `scripts/db/register-preview-quest-locations.mjs --preview`는 새 버전을 공개한 뒤에 실행한다.
- 초안의 `draft_updated`·현장 확인표의 `app` 열에 앱 데이터 파일을 적어 다음 점검이 앱 문구를 대조하게 한다.

## 5. 코스와 역 연결

같은 노선에서 이어지는 퀘스트가 생기면 [코스 목록](../../../src/modules/content/quest-courses.ts)에 넣을 수 있다. 코스 문구에 "한 정거장" 같은 말을 쓰면 `quest-courses.test.ts`에 그 값을 확인하는 줄을 더한다.
