# 배포와 복구 운영 런북 v0.1

작성일: 2026-11-21 · 상태: 외부 서비스 확정 전 초안

preview와 production의 배포, DB migration, 장애 확인, backup 복구와 개인정보 정리를 같은 순서로 실행하기 위한 런북이다. Neon·Vercel을 실제 채택한 뒤 명령과 화면 경로를 확정한다.

request ID, log allowlist, 기술 지표와 alert 기준은 [로그·지표·오류 관측 계약](OBSERVABILITY_CONTRACT_v0.1.md)을 따른다.

## 환경

| 환경 | 용도 | 데이터 원칙 |
| --- | --- | --- |
| local | 개발·통합 테스트 | 가상 seed만 |
| preview | 모바일·OIDC·시연 검수 | demo·test event만 |
| production | 검수 완료 사용자 흐름 | 실제 공개 콘텐츠만 |

DB, OIDC callback, cookie 이름과 secret을 환경별로 분리한다. preview가 production DB에 연결되면 배포를 중단한다.

## 배포 전 확인

- [ ] 대상 commit과 변경 기능을 기록했다.
- [ ] lint, typecheck, unit, PostgreSQL integration, build가 통과했다.
- [ ] migration을 별도 검수 DB에 적용했다.
- [ ] destructive migration과 되돌리기 계획을 검토했다.
- [ ] 새 환경 변수의 소유자·저장 위치·교체 방법을 확인했다.
- [ ] 관련 AC와 일본어 문구 검수 상태를 확인했다.
- [ ] 운영 콘텐츠의 사실 확인일·권리·demo 여부를 확인했다.
- [ ] 알려진 제한과 사용자 영향을 기록했다.

## 배포 순서

1. backup 또는 복구 가능한 기준 시점을 확인한다.
2. backward compatible migration을 먼저 적용한다.
3. 애플리케이션을 preview에 배포한다.
4. 공개 탐색, visitor session, run 한 건, 운영자 로그인을 smoke test한다.
5. request ID와 DB 오류가 monitoring에서 연결되는지 확인한다.
6. production 애플리케이션을 배포한다.
7. production에서 쓰기 없는 공개 조회를 먼저 확인한다.
8. 전용 demo 콘텐츠와 test 환경 표시로 제한된 mutation을 확인한다.
9. 배포 시각·commit·schema version·검수자를 기록한다.

migration과 애플리케이션 순서가 호환되지 않으면 한 번에 배포하지 않는다. expand → code switch → contract 순서로 나눈다.

## smoke test

| 영역 | 확인 |
| --- | --- |
| 공개 | `/`, 목록, 상세가 일본어로 열림 |
| session | 명시적 시작 전 cookie 없음, 시작 뒤 secure cookie |
| progress | 시작·한 단계 완료·재조회가 같은 run |
| admin | 허용 principal 로그인, 비허용 principal 403 |
| content | draft는 공개 404, published만 목록 노출 |
| pause | 신규 시작·미완료 단계 차단, 이유 표시 |
| observability | request ID, status, latency 확인; token·자유 입력 없음 |

smoke test에서 만든 기록은 `environment=test`로 구분하고 검수 후 삭제한다.

## rollback 판단

다음 중 하나면 신규 변경을 중지하고 rollback 또는 기능 차단을 판단한다.

- 소유권 우회 또는 운영 권한 오류
- 중복 run·완료·feedback 생성
- 공개되지 않은 콘텐츠 노출
- 단계 완료·전체 삭제의 부분 commit
- cookie·token·자유 입력 로그 노출
- migration으로 기존 run 조회 실패
- 오류율 급증 또는 DB connection 고갈

애플리케이션 rollback이 새 schema와 호환되는지 먼저 확인한다. destructive migration은 application rollback만으로 복구되지 않는다.

## 장애 분류

| 등급 | 예 | 첫 행동 |
| --- | --- | --- |
| P0 | 권한 우회, 개인정보·secret 노출, 데이터 손상 | 쓰기 차단·secret 교체·영향 보존 |
| P1 | 시작·진행·완료 전체 장애 | 신규 시작 중지·상태 공지·DB 확인 |
| P2 | 지도·일부 화면·신고 장애 | fallback 제공·범위 확인 |
| P3 | 문구·스타일·비핵심 오류 | 기록 후 정상 배포 절차 |

로그 원문을 공유 채널에 복사하지 않는다. request ID와 제한된 요약으로 조사한다.

## 진행 mutation 장애

1. 사용자의 재시도 전에 현재 run 상태를 조회한다.
2. DB commit 여부와 응답 전달 실패를 구분한다.
3. 같은 step 행과 run completedAt의 중복 여부를 확인한다.
4. 수동으로 상태를 추측해 변경하지 않는다.
5. 복구 mutation이 필요하면 대상·이전·이후·승인자를 audit log에 남긴다.

분석 이벤트 누락을 runs 데이터 수정으로 보정하지 않는다.

## 콘텐츠 긴급 중지

1. 사실 오류와 사용자 영향 범위를 확인한다.
2. 공개 가능한 일본어 사유를 작성한다.
3. expected revision으로 pause한다.
4. 신규 시작과 미완료 단계가 차단되는지 확인한다.
5. 기존 안내·완료 기록이 읽히는지 확인한다.
6. 수정 draft를 검수하고 새 버전 공개 또는 기존본 재개를 결정한다.

published version을 직접 수정하지 않는다.

## backup 복구 훈련

1. 사용할 backup 시점과 예상 RPO를 기록한다.
2. production이 아닌 별도 검수 DB로 복구한다.
3. schema version과 주요 table count를 확인한다.
4. 공개 목록·기존 run·완료 카드를 읽는다.
5. 검수 visitor로 단계 mutation을 실행한다.
6. 만료 session과 삭제 대상 cleanup을 실행한다.
7. 삭제한 사용자 데이터가 재노출되지 않는지 확인한다.
8. 시작부터 검수 완료까지 시간을 기록해 RTO와 비교한다.
9. 검수 DB와 임시 credential을 폐기한다.

복구 성공만으로 AC20을 통과하지 않는다. 삭제·만료 재적용 결과가 필수다.

## secret 유출

1. 노출 위치와 접근 가능 기간을 보존하되 secret 값을 다시 복사하지 않는다.
2. 해당 secret을 즉시 비활성화·교체한다.
3. DB, OIDC, 배포, session 중 영향 범위를 확인한다.
4. 필요하면 운영 session과 방문자 session을 만료한다.
5. Git history에 들어갔다면 값 교체를 먼저 하고 history 처리 범위를 결정한다.
6. 로그·배포 이력에서 악용 증거를 확인한다.
7. 원인과 재발 방지 통제를 기록한다.

## 배포 기록 양식

```markdown
# 배포 YYYY-MM-DD HH:mm KST

- commit:
- schema version:
- 환경:
- 실행자:
- 시작·완료 시각:
- 포함 기능:
- migration:
- smoke test:
- 관련 AC:
- 알려진 제한:
- rollback 기준과 결과:
```

## 외부 서비스 확정 후 채울 항목

- [ ] Vercel project·region·rollback 절차
- [ ] Neon project·branch·pooling·PITR 보존 범위
- [ ] Google OIDC client와 환경별 callback
- [ ] monitoring dashboard와 alert 수신자
- [ ] backup 수행 주체와 검증 주기
- [ ] production 도메인·Origin allowlist
- [ ] 장애 공지 채널과 의사결정자

실제 계정·프로젝트 ID·secret 값은 이 문서에 기록하지 않는다.
