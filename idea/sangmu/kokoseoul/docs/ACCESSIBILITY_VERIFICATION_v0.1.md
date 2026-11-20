# 모바일 접근성 구현·검수 v0.1

작성일: 2026-11-21 · 상태: UI 구현 전 검수 기준

이 문서는 DigiMan B2C 모바일 웹의 일본어 탐색·시작·진행·완료·신고 흐름을 키보드, screen reader, 확대, 작은 화면과 지도 실패 상태에서 검수하는 기준이다. 자동 검사는 보조 수단이며 실제 키보드와 일본어 screen reader 관찰을 대체하지 않는다.

## 완료 목표

- 360px 폭과 200% 확대에서 핵심 정보·행동이 가려지거나 가로 스크롤되지 않는다.
- 키보드만으로 탐색부터 완료·삭제·신고까지 순서대로 사용할 수 있다.
- 일본어 UI와 한국어 주소·요청 카드의 언어가 보조기술에 구분된다.
- loading·success·error·중지 상태가 색이나 위치만이 아니라 text와 의미로 전달된다.
- dialog, validation, 응답 유실 복구 뒤 focus가 예측 가능한 위치에 있다.
- 지도 앱·clipboard·위치 권한 없이도 주소와 단계 완료를 사용할 수 있다.

## 문서 구조와 언어

| 항목 | 구현 기준 |
| --- | --- |
| page language | 일본어 화면 root는 `lang="ja"` |
| 한국어 구간 | 주소와 요청 문구에 `lang="ko"` |
| 제목 | page마다 의미 있는 h1 하나, heading level을 건너뛰지 않음 |
| landmark | header, nav, main, footer를 중복 없이 사용 |
| navigation | 첫 focus에 main content skip link 제공 |
| 목록 | quest·run·step은 실제 list semantics 사용 |
| 날짜 | 보이는 일본어 표기와 machine-readable datetime 구분 |
| 금액 | 숫자만 읽어 의미가 사라지지 않게 통화·미확인 상태 포함 |

quest title의 장식용 `ひとり`, 한국어 문장, 영문 서비스명 전환이 지나치게 잘게 끊겨 screen reader가 불편하지 않은지 실제 발음으로 확인한다.

## interaction 기본

- route 이동은 link, 현재 화면의 상태 변경은 button을 사용한다.
- click handler가 있는 `div`·`span`으로 control을 만들지 않는다.
- 카드 전체 link 안에 button이나 또 다른 link를 중첩하지 않는다.
- disabled button만으로 이유를 숨기지 않고 가까운 text로 설명한다.
- 주요 touch target은 최소 44×44 CSS px을 목표로 한다.
- focus indicator는 배경과 구분되고 clipping되지 않는다.
- hover만으로 나타나는 필수 정보가 없다.
- browser back·reload 뒤 URL과 focus가 예상 가능한 화면으로 돌아간다.

같은 이름의 `もう一度試す` 버튼이 여러 개면 accessible name에 대상이 드러나거나 가까운 heading과 programmatically 연결한다.

## 색·텍스트·motion

| 항목 | 초기 기준 |
| --- | --- |
| 본문 대비 | 일반 text 4.5:1 이상 |
| 큰 text·굵은 큰 text | 3:1 이상 |
| control·focus·상태 경계 | 인접 색과 3:1 이상 |
| text 확대 | 200%에서 기능·내용 손실 없음 |
| reflow | 360px 한 열에서 양방향 스크롤 없이 핵심 흐름 사용 |
| motion | `prefers-reduced-motion`에서 비필수 animation 제거 |

demo·중지·오류·완료를 색만으로 구분하지 않는다. icon은 보조이며 text label을 유지한다. 배경 이미지 위 text는 모든 실제 asset에서 대비를 다시 확인한다.

## focus와 dialog

### 시작 전 기록 안내

1. 시작 button이 dialog를 열면 focus를 dialog 제목 또는 첫 의미 있는 control로 옮긴다.
2. dialog에 programmatic title과 설명을 연결한다.
3. Tab과 Shift+Tab이 열린 dialog 범위에서 순환한다.
4. Escape와 명시적 `戻る`가 닫는다. 파괴적 확인 중에는 의도치 않은 닫힘을 방지하되 이유를 제공한다.
5. 취소하면 원래 시작 button으로 focus가 돌아간다.
6. 성공하면 새 run 화면 h1 또는 진행 상태로 focus가 이동한다.

### 삭제 확인

- button 이름만 `確認`으로 두지 않고 삭제 대상을 포함한다.
- 30일 기록과 다른 기기 복구 불가를 dialog 설명에서 읽을 수 있다.
- 삭제 중 중복 제출을 막되 진행 상태를 text로 알린다.
- 204 뒤 존재하지 않는 control로 focus를 돌리지 않고 시작 화면 heading으로 이동한다.

modal처럼 보이지만 focus를 가두지 않는 임의 overlay를 만들지 않는다.

## dynamic 상태와 live region

| 상태 | 알림 기준 |
| --- | --- |
| 페이지 loading | skeleton을 반복 낭독하지 않고 page 또는 영역 busy 상태 전달 |
| form 오류 | submit 뒤 summary와 첫 오류 입력을 연결, 입력별 설명 유지 |
| 주소 복사 성공 | 짧은 polite status, button label을 영구 변경하지 않아도 됨 |
| 주소 복사 실패 | 주소 선택·수동 복사 방법을 text로 제공 |
| 단계 저장 중 | button의 busy·disabled와 `保存しています…` |
| 응답 유실 재조회 | 현재 상태 확인 중임을 한 번 알림, timer마다 반복 낭독 금지 |
| 완료 | page title과 h1로 새 상태 전달, confetti에 의존하지 않음 |
| 네트워크 오류 | retry 가능 여부와 유지된 입력을 설명 |

`aria-live` 영역을 화면 전체에 두지 않는다. 동시에 여러 toast를 낭독하지 않고, route 이동으로 이미 전달되는 heading을 중복 발표하지 않는다.

## form과 오류

- 모든 input·select·textarea에 보이는 label이 있다.
- 필수 여부, 길이 제한과 예시는 placeholder에만 두지 않는다.
- 오류는 `aria-describedby` 등으로 해당 field와 연결한다.
- 오류 summary의 link가 해당 field로 이동한다.
- 입력 오류 뒤 기존 값과 선택 조건을 유지한다.
- category radio는 fieldset·legend로 묶는다.
- 점수는 별 icon만 사용하지 않고 1~5 의미와 선택 상태를 text로 전달한다.
- 자유 입력에 민감정보 금지 안내를 입력 전에 읽을 수 있다.

서버 오류 code를 그대로 읽지 않고 [화면 상태 계약](SCREEN_STATES_v0.1.md)의 일본어 행동 문구를 사용한다. request ID는 지원이 필요한 오류에서 복사 가능한 text로 제공한다.

## 화면별 핵심 검수

### 시작·목록

- 지역·관심사·시간 label과 선택 상태가 읽힌다.
- 여러 관심사 선택의 개수와 해제 방법이 명확하다.
- 적용 조건과 결과 수를 새 heading 또는 status에서 확인한다.
- 결과 없음에서 선택 조건을 임의로 바꾸지 않고 조건 변경 link로 이동한다.
- 추천 카드의 이유·시간·비용·혼자 이용·demo 상태가 link 이름만으로 과도하게 중복되지 않는다.

### 상세

- h1 뒤 demo·중지 상태와 핵심 이용 조건을 읽는다.
- 정보 확인일, 비용 미확인, 혼자 이용 미확인을 숨기지 않는다.
- 단계 개요는 ordered list이며 잠긴 진행 control처럼 읽히지 않는다.
- 시작·이어하기·기록 보기 중 서버가 허용한 주요 행동 하나가 명확하다.
- 정보 신고는 주요 시작 행동과 혼동되지 않는 보조 행동이다.

### 진행

- 현재 단계와 전체 단계 위치를 text로 전달한다.
- 완료한 단계와 현재·잠긴 단계가 색 외에도 구분된다.
- 한국어 요청 카드와 일본어 뜻이 각각 올바른 language로 읽힌다.
- 한국어 주소는 선택 가능한 text이며 복사 button과 중복 낭독을 줄인다.
- 외부 지도 link는 새 앱·창 가능성을 이름 또는 주변 설명에서 알린다.
- 마지막 단계 완료가 실제 방문 인증이 아님을 도움말로 확인할 수 있다.

### 완료·나의 기록

- 완료 heading, demo 상태, 완료 시각, 다시 볼 행동이 있다.
- 진행 중과 완료 목록을 heading·list로 구분한다.
- 각 카드의 link 이름에 quest와 상태가 포함된다.
- 30일 만료일을 시각적 badge에만 두지 않는다.
- 삭제는 목록 탐색보다 먼저 focus되지 않는다.

### feedback·report

- 미완료 feedback 오류 뒤 진행 화면으로 갈 수 있다.
- 점수, 새 경험 여부, comment label이 있다.
- report 성공 status가 focus를 빼앗지 않되 screen reader에 전달된다.
- 같은 요청 충돌에서 입력을 유지하고 사용자가 새 제출을 선택한다.

## viewport·입력 matrix

| 환경 | 최소 검수 |
| --- | --- |
| 360×800 Chromium | 전체 B2C 세로 흐름, keyboard |
| 390×844 WebKit emulation | dialog·주소 복사·완료 |
| 430×932 Chromium | 긴 일본어·한국어 phrase |
| desktop browser 200% | reflow·focus·dialog |
| iOS Safari + VoiceOver 일본어 | 목록·상세·진행·완료 |
| Android Chrome + TalkBack 일본어 | 가능한 경우 핵심 흐름; 미실행이면 제한 기록 |

emulation 결과를 실제 iOS clipboard·지도 앱 동작의 증거로 사용하지 않는다. 실제 기기 model·OS·브라우저·언어 설정을 증거에 남긴다.

## 자동 검사

Playwright에서 다음을 회귀 검사한다.

- keyboard로 모든 interactive element 접근
- focus visible과 dialog focus 복귀
- 360px에서 `scrollWidth <= clientWidth`인 핵심 container
- heading·label·button accessible name
- nested interactive element 없음
- 주요 상태에서 자동 accessibility rule 검사
- `lang="ja"`, 한국어 구간 `lang="ko"`
- reduced motion media에서 비필수 animation 없음

자동 rule 통과는 자연스러운 일본어 낭독 순서, 명확한 버튼 이름, 실제 clipboard·지도 fallback을 증명하지 않는다.

## 수동 검수 순서

1. mouse 없이 새 browser context를 연다.
2. skip link → 조건 선택 → 목록 → 상세로 이동한다.
3. 시작 dialog를 열고 취소한 뒤 다시 열어 시작한다.
4. 주소를 복사하고 실패 상태도 강제로 확인한다.
5. 한국어 카드, 단계 저장·응답 유실·완료를 확인한다.
6. feedback과 report validation을 발생시킨다.
7. 나의 기록과 삭제 확인을 검수한다.
8. screen reader로 같은 핵심 흐름을 다시 실행한다.
9. 200% 확대와 긴 fixture로 clipping을 확인한다.

검수자가 기능을 알고 있어도 처음 듣는 label의 의미를 추측하지 말고 실제 announcement를 기록한다.

## 증거 양식

```markdown
# 접근성 검수 YYYY-MM-DD

- commit:
- URL·환경:
- 기기·OS:
- browser:
- viewport·zoom:
- 입력: keyboard / touch / VoiceOver / TalkBack
- UI 언어:

| 경로·상태 | 검사 | 결과 | 관찰한 announcement·focus | issue |
| --- | --- | --- | --- | --- |
|  |  | pass / fail / blocked |  |  |

## 자동 검사

- 명령:
- 결과:
- 제외 rule과 이유:

## 제한

- 미실행 기기·보조기술:
- 알려진 문제:
- 출시 결정:
```

실제 참여자의 보조기술 설정·음성·화면을 동의 없이 저장하지 않는다. 증거에는 제품 상태와 비식별 관찰만 남긴다.

## 출시 gate

- [ ] 360px·200% 확대에서 핵심 흐름에 양방향 스크롤이 없다.
- [ ] keyboard만으로 탐색·시작·완료·feedback·삭제가 가능하다.
- [ ] dialog 열기·닫기·성공 뒤 focus가 올바르다.
- [ ] loading·오류·복사·저장·완료가 text와 적절한 announcement로 전달된다.
- [ ] 일본어 root와 한국어 phrase language가 구분된다.
- [ ] demo·중지·완료·미확인 상태가 색 외에 text로 표시된다.
- [ ] 실제 일본어 VoiceOver 핵심 흐름을 확인했다.
- [ ] 지도·clipboard 실패에도 주소로 진행 가능하다.
- [ ] 자동 검사 예외와 수동 미실행 항목을 숨기지 않았다.

연결 검수: AC01, AC02, AC06, AC08, AC17~AC19
