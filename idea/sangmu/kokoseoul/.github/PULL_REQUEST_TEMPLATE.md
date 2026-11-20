## 변경 결과

<!-- 사용자가 얻게 되는 결과와 구현 결과를 2~4문장으로 적습니다. -->

## 범위

- 포함:
- 제외:

## 근거와 계약

- 관련 issue:
- 사용자 조사 또는 결정 근거:
- 영향받는 스펙·API·화면:
- 관련 AC:
- 신규 dependency·asset·AI 보조 출처:
- 사전 코드 게이트 전/후 (`CLOSED` / `F0_ONLY` / `PRODUCT_ALLOWED`):
- gate 변경 시 공식 근거·허용 시작 시각을 기록한 선행 commit:
- 조사 실행 게이트 전/후 (`DRAFT_ONLY` / `INTERVIEWS_ALLOWED` / 해당 없음):
- 인터뷰 기록이 있으면 `JRxx @ commit` 검수 근거와 완료 시각:

## 검증

실행한 명령과 결과를 적습니다. 실행하지 않은 항목은 이유를 남깁니다.

```text
python3 scripts/verify_all.py
```

- 단위:
- PostgreSQL 통합:
- HTTP 계약:
- Playwright·실제 기기:
- 수동 확인:

## 데이터와 운영 영향

- migration: 없음 / 있음
- backward compatibility:
- 환경 변수·secret:
- 배포·rollback:
- backup·복구 영향:

## 보안과 개인정보

- [ ] 방문자·운영자 소유권과 권한을 서버에서 검사한다.
- [ ] token, cookie, 자유 입력과 개인정보를 로그·diff에 넣지 않았다.
- [ ] 외부 URL·Origin·입력 크기와 unknown field를 검토했다.
- [ ] 삭제·만료·backup 재노출 영향을 검토했다.
- [ ] log·metric에 cookie, token, 자유 입력과 고 cardinality 값이 없다.

## 콘텐츠와 화면

- [ ] 일본어 검수 상태를 표시했다.
- [ ] demo와 실제 콘텐츠를 구분했다.
- [ ] 360px·키보드·오류·빈 상태를 확인했다.
- [ ] focus, dialog, 일본어·한국어 language와 동적 상태 전달을 확인했다.
- [ ] 화면 변경이 있으면 캡처 또는 짧은 설명을 첨부했다.

## 완료 확인

- [ ] 기능 단위이며 무관한 포맷 변경을 섞지 않았다.
- [ ] `docs/EVENT_RULES_CHECKLIST.md`의 사전 코드 게이트가 이 변경 범위를 허용한다.
- [ ] 실제 인터뷰 기록은 조사 실행 게이트가 `INTERVIEWS_ALLOWED`인 뒤의 것만 포함한다.
- [ ] 관련 계약 문서와 변경 기록을 갱신했다.
- [ ] 신규·중복·응답 유실·권한·충돌 경로를 검수했다.
- [ ] 문서·tooling 검증 통과를 제품 AC·build·E2E 통과로 표현하지 않았다.
- [ ] 알려진 제한과 후속 작업을 적었다.
