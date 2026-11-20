# 의존성·에셋·AI 출처 관리 v0.1

작성일: 2026-11-21 · 상태: 패키지 도입 전 작업 기준

이 문서는 DigiMan에 들어오는 package, template, 코드 조각, 폰트, icon, 이미지, 문구와 AI 보조 결과의 출처·권리·검토 증거를 관리한다. 행사 규칙과 각 라이선스 원문이 최종 기준이며, 이 문서는 법률 판단을 대신하지 않는다.

## 기본 원칙

- 필요가 생긴 기능 단위에서만 의존성을 추가한다.
- lockfile의 실제 package와 direct dependency 이유를 함께 검토한다.
- “무료”, 검색 결과 노출, AI 생성이라는 이유로 사용 권리가 생기지 않는다.
- license가 없거나 출처를 확인할 수 없는 코드·에셋은 포함하지 않는다.
- secret·개인정보·비공개 인터뷰 원문을 외부 도구나 AI 입력에 넣지 않는다.
- 생성·복사한 결과도 보안·정확성·접근성·일본어 검수를 동일하게 거친다.

## 범위

| 유형 | 예 | 필요한 기록 |
| --- | --- | --- |
| runtime package | Next.js, DB driver, Auth adapter | 이름·version·license·사용 이유·공식 출처 |
| development package | lint, test, build plugin | 같은 항목 + CI install script |
| template·starter | scaffold, component template | 원본 repository·commit/tag·변경 범위 |
| 코드 조각 | 문서·issue·답변에서 가져온 함수 | 직접 링크·license·수정 내용 |
| 폰트·icon | webfont, icon set | family/set·license·배포 방식·notice |
| 이미지·영상 | hero, quest photo, screenshot | 제작자·원본·사용 범위·수정 허용·확인일 |
| 외부 콘텐츠 | 주소·가격·운영 정보 | [콘텐츠 검수 계약](CONTENT_VERIFICATION_v0.1.md)의 사실 근거 |
| AI 보조 결과 | 코드·번역·문서·이미지 초안 | 도구·용도·검토자·영향 파일·인간 검증 |

package의 간접 의존성도 배포 결과에 포함될 수 있으므로 release 시 전체 license inventory를 확인한다.

## 도입 질문

dependency를 추가하기 전에 issue 또는 PR에 답한다.

1. 현재 표준 API나 기존 package로 해결할 수 없는가?
2. runtime bundle·server·dev 중 어디에 필요한가?
3. 유지보수 상태와 공식 배포 출처를 확인했는가?
4. Node·Next.js·Auth.js·브라우저 지원 범위와 맞는가?
5. install script, native binary, network access가 있는가?
6. license와 notice·source 제공 의무를 확인했는가?
7. 대안과 제거 비용은 무엇인가?
8. package가 없어졌을 때 핵심 사용자 흐름이 멈추는가?

package 하나로 몇 줄을 줄이는 것보다 공급망·bundle·업데이트 비용이 크면 추가하지 않는다.

## license 검토 단계

| 단계 | 예시 | 행동 |
| --- | --- | --- |
| 일반 검토 | MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0 | 원문·notice 의무 확인 후 inventory 기록 |
| 추가 판단 | MPL, LGPL, GPL, AGPL, SSPL, source-available, custom terms | 배포 방식과 의무를 담당자·행사 규칙과 확인 전 보류 |
| 사용 보류 | license 없음, 출처 불명, 비상업 전용, 재배포 금지, 조건 불명 | 명시적 사용 근거 전 포함 금지 |

위 분류는 자동 허용 목록이 아니다. 같은 이름의 license라도 예외·추가 조건·asset별 약관이 있을 수 있으므로 원문과 package version을 확인한다. Apache-2.0 등 notice가 필요한 경우 제출물과 배포물에 필요한 표시를 유지한다.

## package 변경 절차

1. 공식 registry·repository에서 정확한 package를 확인한다.
2. exact direct version과 package manager 결과를 lockfile에 기록한다.
3. manifest·lockfile diff에서 예상하지 않은 package와 install script를 본다.
4. license inventory와 알려진 취약점 결과를 확인한다.
5. 최소 사용 예와 제거 경계를 만든다.
6. lint, typecheck, test, build와 bundle 영향을 검증한다.
7. 변경 이유·대안·license를 PR에 기록한다.

lockfile만 바뀐 이유를 설명할 수 없으면 merge하지 않는다. 보안 경고는 숫자만 0으로 만들기 위해 무관한 major upgrade를 섞지 않고 영향 경로와 조치를 기록한다.

## install script와 binary

다음 package는 추가 검토한다.

- `preinstall`, `install`, `postinstall`에서 실행 파일을 실행
- 외부 URL에서 binary·browser·schema를 다운로드
- native addon을 build
- 시스템 credential·home directory·Git 설정에 접근
- telemetry를 기본 전송

필요한 script라면 공식 목적, 실행 환경, network destination, CI cache와 disable 방법을 기록한다. 검토 없이 install script를 전체 허용하거나 security flag를 끄지 않는다.

## template와 코드 조각

- starter 전체를 가져오기 전에 임시 디렉터리에서 생성 파일과 license를 검토한다.
- 기존 README·Git history·보안 설정을 template가 덮어쓰지 않게 한다.
- 코드 조각도 창작성이 있는 부분이면 원본 license와 표시 조건을 확인한다.
- Stack Overflow·blog·issue 답변의 코드를 출처 없이 그대로 복사하지 않는다.
- 아이디어만 참고하고 새로 구현했더라도 판단에 중요한 출처는 설계 문서나 PR에 링크한다.

외부 코드를 “AI가 다시 써 줬다”는 이유로 출처 기록에서 제거하지 않는다.

## 폰트·icon·이미지

### 폰트

- 일본어·한국어 glyph와 실제 weight를 포함하는지 확인한다.
- web embedding·subset·재배포 조건을 확인한다.
- 필요한 weight만 사용하고 fallback에서 레이아웃이 깨지지 않는지 본다.
- 외부 font host가 사용자 요청 데이터를 받는지 검토한다.

### icon

- icon set 이름·version·license를 기록한다.
- icon만으로 상태를 전달하지 않고 accessible name 또는 text를 제공한다.
- 서로 다른 set의 style을 무계획하게 섞지 않는다.

### 이미지

- 실제 업체·인물·상표가 있는 사진은 촬영·사용·수정·공개 범위를 확인한다.
- EXIF·위치·촬영자 식별 정보 제거 여부를 검토한다.
- demo 이미지는 실제 업체 제휴나 이용 가능성을 암시하지 않는다.
- AI 이미지도 도구 약관, reference 권리와 오인 가능성을 기록한다.

퀘스트 asset별 register는 콘텐츠 검수 문서에 둔다.

## AI 보조 작업

AI는 초안·대안·검사 보조로 사용할 수 있지만 승인자나 사실 출처가 아니다.

### 입력 금지

- secret, token, connection string, 비공개 repository credential
- 참여자 이름·연락처·녹음·원본 화면·식별 가능한 인용
- 운영자 OIDC 정보, production log·DB row
- 계약상 외부 전송이 금지된 콘텐츠

### 반드시 인간이 확인

- 코드: 권한·transaction·오류·dependency·test
- 일본어: 모어 화자와 실제 문맥
- 한국어 요청 카드: 두 언어 의미·존댓말·사용 상황
- 사실: 공식 source·현장 확인일
- 이미지: 권리·실제 콘텐츠 오인·상표·개인정보

### 기록 단위

전체 prompt나 대화 원문 대신 제출 규칙에 필요한 최소 정보만 남긴다.

```markdown
## AI 보조 기록

- 날짜:
- 도구:
- 사용 목적: 아이디어 / 문서 초안 / 코드 초안 / 번역 초안 / 이미지 초안 / 검토
- 영향 파일:
- 외부 reference:
- 인간 검토자 코드:
- 실행한 검사:
- 폐기하거나 수정한 핵심 내용:
- 행사 제출 표시 필요 여부:
```

도구 사용 사실을 commit author와 혼동하지 않는다. 최종 변경을 검토·실행한 사람이 결과에 책임을 진다.

## inventory 양식

실제 의존성 또는 asset을 처음 추가할 때 다음 표를 별도 파일로 만든다.

```markdown
# Third-party inventory

| 구분 | 이름 | version·source commit | 공식 URL | license·terms | 용도 | 배포 포함 | notice 조치 | 검토일 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| package |  |  |  |  |  | 예 / 아니오 |  |  |
```

버전이 바뀌면 license·terms도 다시 확인한다. GitHub repository의 license와 배포 package의 license metadata가 다르면 해결 전 보류한다.

## release와 제출 확인

- [ ] manifest와 lockfile의 direct dependency가 inventory에 있다.
- [ ] 배포 포함 transitive license 보고서를 확인했다.
- [ ] 필요한 copyright·license·NOTICE 파일이 배포·제출물에 있다.
- [ ] 출처 불명 코드·폰트·icon·이미지가 없다.
- [ ] install script와 binary 다운로드를 검토했다.
- [ ] unresolved security warning의 영향·완화·결정을 기록했다.
- [ ] AI·template·기존 작업 공개 조건을 행사 규칙과 맞췄다.
- [ ] 실제 콘텐츠 asset의 권리와 확인일이 register에 있다.
- [ ] 개인 정보나 secret이 출처 기록에 들어 있지 않다.
- [ ] 제거한 dependency가 lockfile·bundle·notice에 남지 않았다.

규칙 답변이 오기 전에는 “표시 불필요”로 가정하지 않는다. 제출 양식이 별도 형식을 요구하면 이 inventory를 그 형식으로 변환하고 원본 근거는 유지한다.
