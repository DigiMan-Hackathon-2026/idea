# 사용자 조사 작업공간

조사 실행 게이트: `DRAFT_ONLY`
일본어 검수 근거: 미기록
일본어 검수 완료 시각: 미기록

`DRAFT_ONLY`에서는 모집·동의·P0 자극물의 일본어 초안과 실행 절차만 준비하고 공개 모집·실제 인터뷰 기록을 추가하지 않는다. 모어 화자 검수자 코드와 근거 commit을 `JR01 @ abc1234` 형식으로, 검수 완료 시각을 timezone offset이 있는 ISO 8601로 기록한 뒤에만 `INTERVIEWS_ALLOWED`로 바꾼다. 검증기는 근거 SHA가 현재 HEAD의 실제 선행 commit인지 확인한다. 검수 범위는 해당 commit의 일본어 검수 기록에 남기며 사람 이름·연락처는 근거에 쓰지 않는다. 인터뷰 시각은 검수 완료 시각보다 빠를 수 없다.

이 폴더에는 [일본인 사용자 검증 계획](../docs/USER_RESEARCH_v0.1.md)에 따라 익명화한 인터뷰 기록, 조사 합성, 퀘스트 후보만 저장한다. 연락처, 녹음, 원본 사진과 개인을 식별할 수 있는 정보는 저장소에 커밋하지 않는다.

## 진행 순서

1. [모집 문안](RECRUITMENT_MESSAGES.md)을 일본어 검수한 뒤 참여자를 모집한다.
2. [세션 진행 가이드](INTERVIEW_SESSION_GUIDE.md)로 조사 목적, 메모·녹음 여부, 중단 가능성과 진행 역할을 확인한다.
3. `interviews/TEMPLATE.md`를 복사해 `P01.md`처럼 참여자 코드로 기록한다.
4. 최근 실제 사건 질문을 끝낸 뒤 [가상 안내 예시와 사용 규칙](stimuli/README.md)으로 안내 이해를 관찰하고 두 근거를 분리해 기록한다.
5. 인터뷰 3~5개가 모이면 `synthesis/TEMPLATE.md`로 공통 패턴과 반대 사례를 합성한다.
6. [후보 선택 가이드](CANDIDATE_SELECTION_GUIDE.md)에 따라 evidence ID를 연결하고 `region-candidates/TEMPLATE.md`로 지역 hard gate를 먼저 확인한다.
7. 선택한 문제·지역과 연결된 퀘스트만 `quest-candidates/TEMPLATE.md`로 구체화하고 [콘텐츠 검수 계약](../docs/CONTENT_VERIFICATION_v0.1.md)에 따라 출처·일본어·asset 권리를 기록한다.
8. 타깃·지역·퀘스트 결정이 바뀌면 D04~D06과 B2C 스펙의 변경 기록도 갱신한다.

## 데스크 리서치

[역 스탬프·역명 유래 카드 샘플](desk/substamp/README.md)은 공공데이터와 웹 검색으로 만든 참고 자료다. 인터뷰·현장 근거가 아니므로 evidence ID로 세지 않는다.

## 저장 가능 여부

| 자료 | Git 저장 |
| --- | --- |
| 참여자 코드와 익명화된 사건 요약 | 가능 |
| 짧고 식별 불가능한 인용 | 가능 |
| 진행자의 해석과 남은 질문 | 가능 |
| 이름·연락처·정확한 주소·계정명 | 금지 |
| 녹음·영상·원본 사진 | 금지 |
| 검색 화면 캡처 | 별도 동의 후 저장소 밖에서 관리 |

`research/private`, `research/recordings`, `research/raw-media`와 일반적인 음성·영상 파일은 `.gitignore`에서 제외한다. 제외 규칙은 안전망일 뿐이며 민감한 파일을 이 저장소 폴더에 두는 방식 자체를 권장하지 않는다.

## 파일 이름

- 인터뷰: `interviews/P01.md`, `interviews/P02.md`
- 조사 합성: `synthesis/2026-11-round-01.md`
- 지역 후보: `region-candidates/성수.md`
- 퀘스트 후보: `quest-candidates/지역-행동.md`

파일 이름에도 이름, 연락처, 소속처럼 참여자를 식별할 수 있는 값을 넣지 않는다.
