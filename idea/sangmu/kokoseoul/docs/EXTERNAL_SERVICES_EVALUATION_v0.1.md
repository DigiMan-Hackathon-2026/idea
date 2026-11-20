# 외부 서비스 평가와 선택 조건 v0.1

조사일: 2026-11-21 · 상태: 계정 생성 전 작업 기준

Vercel, Neon, Auth.js Google OIDC와 Google Maps URL을 DigiMan P0 후보로 평가했다. 현재 결론은 Next.js를 Vercel, PostgreSQL을 Neon에 두는 구성이 구현 속도에는 적합하지만, 무료 Neon만으로는 7일 복구 정책을 충족하지 못한다는 것이다. 계정·유료 요금제·운영 설정은 아직 생성하거나 확정하지 않았다.

공식 문서는 변경될 수 있으므로 계정 생성과 공개 배포 직전에 다시 확인한다.

## 작업 기준 요약

| 영역 | 현재 작업 기준 | 아직 확인할 것 |
| --- | --- | --- |
| 애플리케이션 | Vercel Next.js, Node.js Function | 계정 유형·팀 협업·실제 비용 |
| Function 지역 | Neon을 Singapore에 만들면 Vercel도 `sin1` 우선 | 서울 사용자 체감과 DB 왕복 지연 측정 |
| PostgreSQL | Neon Singapore | 계정·plan·connection pooling |
| 복구 | preview는 Free 가능, 7일 정책은 Launch 또는 별도 backup 필요 | 예산 승인·AC20 복구 훈련 |
| 운영자 인증 | Auth.js Google provider + database session | 설치 버전·Drizzle adapter·callback |
| 지도 | Google Maps URL + 한국어 주소 복사 | 일본어 iOS·Android 서울 경로 실제 검수 |

## Vercel

Vercel은 Next.js server rendering을 Function으로 배포하고 Function region을 설정할 수 있다. 새 project의 기본 Function region은 Washington D.C. `iad1`이므로 그대로 사용하지 않는다. Hobby는 single region이고 서울 `icn1`, 싱가포르 `sin1`, 도쿄 `hnd1` 등이 제공된다. 정적 asset은 CDN에서 사용자와 가까운 곳에서 제공된다.

공식 근거:

- [Function region 설정](https://vercel.com/docs/functions/configuring-functions/region)
- [Vercel plan](https://vercel.com/docs/plans)
- [Function 사용량과 지역 가격](https://vercel.com/docs/functions/usage-and-pricing)

### 지역 선택

Function과 DB 사이의 왕복이 공개 목록·진행 mutation의 지연에 직접 영향을 준다. Neon에 서울 region이 없고 Singapore가 가장 가까운 현재 후보이므로 Function도 `sin1`에 두는 것을 첫 작업 기준으로 삼는다. 정적 파일은 CDN이 가까운 위치에서 제공한다.

이는 공식 문서에서 “애플리케이션 서버와 데이터 source를 가깝게 두라”는 원칙과 현재 region 목록을 결합한 판단이다. 실제 preview에서 다음 두 구성을 측정해 최종 확정한다.

1. Vercel Singapore `sin1` ↔ Neon Singapore
2. Vercel Seoul `icn1` ↔ Neon Singapore

목록·상세 p95와 단계 완료 transaction p95를 비교한다. 사용자와 Function의 거리만 보고 `icn1`을 먼저 확정하지 않는다.

### plan 판단

Hobby는 개인 project와 기본 preview·HTTPS·Function 자원을 제공한다. 팀 협업, 상업적 사용 조건, 사용량과 지원 요구가 생기면 Pro 필요 여부를 확인한다. 현재 저장소가 개인 준비 단계라는 이유만으로 최종 팀 배포도 Hobby가 적합하다고 가정하지 않는다.

## Neon

Neon project는 생성할 때 하나의 region에 고정되며 기존 project region을 변경할 수 없다. 현재 공식 AWS region 목록의 아시아 후보는 Singapore `aws-ap-southeast-1`와 Sydney이며 서울·도쿄는 없다. DigiMan의 첫 후보는 Singapore다.

공식 근거:

- [Neon region](https://neon.com/docs/introduction/regions)
- [Neon backup 전략](https://neon.com/docs/postgres/backup-restore/backups)
- [Neon pricing](https://neon.com/pricing)

### Free와 Launch

2026-11-21 공식 페이지 기준:

| 항목 | Free | Launch |
| --- | --- | --- |
| 기본 목적 | 개발·학습·초기 prototype | 사용량 기반 운영 |
| storage | project당 1GB 포함 | 사용량 과금 |
| compute | project당 월 100 CU-hour 포함 | 사용량 과금 |
| instant restore history | 최대 6시간 | 최대 7일 |
| 7일 backup 정책 | 충족하지 못함 | 설정·검증 시 후보 |

가격과 quota는 계정 생성 시점에 다시 확인한다. 유료 plan은 compute, DB storage와 instant restore history storage가 별도로 과금될 수 있다.

### 환경 구성

행사 preview에서 가상 데이터만 사용하고 6시간 복구 제한을 명시한다면 Free를 개발·시연 검수에 사용할 수 있다. 다음 중 하나가 준비되기 전에는 스펙의 7일 backup과 AC20을 충족했다고 표시하지 않는다.

- Neon Launch에서 7일 history window를 설정하고 별도 DB 복구 훈련
- 별도 저장소에 암호화한 `pg_dump` 자동 backup과 7일 lifecycle, 복구 훈련

별도 backup은 credential, 저장소 권한, 암호화, 비용과 삭제 데이터 재노출 처리가 추가되므로 해커톤 P0에서는 Launch 후보를 먼저 비교한다.

### branch 사용

- production과 preview를 같은 branch로 공유하지 않는다.
- preview branch에는 가상 seed만 둔다.
- 임시 branch는 expiration을 설정하고 검수 뒤 제거한다.
- 복구 branch는 production endpoint에 바로 연결하지 않고 별도 검수 DB에서 AC20을 실행한다.
- restore 뒤 만료·삭제 cleanup을 실행한다.

## Auth.js와 Google OIDC

Auth.js는 Next.js 통합, Google provider와 database session을 지원한다. database session cookie는 DB session을 찾는 token을 담으며 서버에서 폐기할 수 있다.

공식 근거:

- [Auth.js Next.js reference](https://authjs.dev/reference/nextjs)
- [OAuth provider](https://authjs.dev/getting-started/authentication/oauth)
- [Session strategy](https://authjs.dev/concepts/session-strategies)

### DigiMan 적용

- Google 로그인 성공과 운영 권한을 분리한다.
- Google issuer와 subject가 `admin_principals`에 있을 때만 운영 API를 허용한다.
- local·preview·production OAuth client와 callback을 분리한다.
- session strategy는 `database`를 우선한다.
- Auth.js adapter table과 제품 `admin_principals`를 분리한다.
- 실제 package version과 Drizzle adapter가 Node.js runtime에서 동작하는지 F0에서 검증한다.

Auth.js 문서와 package 상태가 구현 시점에 달라질 수 있으므로 `latest`를 무조건 설치하지 않는다. 호환 조합을 lockfile로 고정하고 운영 로그인·폐기·disabled principal 통합 테스트를 통과해야 한다.

## Google Maps URL

Google Maps URL은 search·directions를 앱 또는 browser에서 열 수 있는 공통 URL 형식이며 별도 API key 없이 사용할 수 있다. 이는 Maps JavaScript API나 Places API 호출과 다르다. SDK·API를 추가하면 Google Cloud project, billing, 제한된 API key가 필요할 수 있다.

공식 근거:

- [Google Maps URL 시작](https://developers.google.com/maps/documentation/urls/get-started)
- [Maps URL quick reference](https://developers.google.com/maps/documentation/urls/quick-reference)

### P0 적용

- search: `https://www.google.com/maps/search/?api=1&query=...`
- directions: `https://www.google.com/maps/dir/?api=1&destination=...`
- 장소명·한국어 주소·좌표를 표준 URL encoder로 처리한다.
- 모든 URL에 `api=1`을 포함한다.
- 같은 화면에 선택 가능한 한국어 주소와 복사 버튼을 둔다.
- 지도 연결 실패를 단계 실패로 처리하지 않는다.
- server가 외부 URL을 fetch하지 않는다.

서울의 도보·대중교통 결과와 일본어 기기 UX는 문서만으로 확정할 수 없다. 실제 일본어 iOS Safari와 Android Chrome에서 Google Maps URL을 확인하고 필요하면 Naver Map을 보조 링크로 비교한다.

## 비용·복구 결정

| 사용 단계 | 후보 구성 | 제한 |
| --- | --- | --- |
| local 계약 검수 | local PostgreSQL | 외부 배포 검수 아님 |
| 행사 preview | Vercel + Neon Free Singapore | 6시간 restore, 가상 데이터만 |
| 7일 정책을 요구하는 공개 운영 | Vercel + Neon Launch Singapore | 실제 비용·history 설정·복구 검수 필요 |
| 별도 backup 선택 | Neon + encrypted pg_dump storage | 운영 복잡도와 secret 추가 |

사용자 기록을 받는 production을 Free preview와 같은 수준으로 표현하지 않는다. 비용 승인이 없으면 보존 정책을 낮춰 조용히 출시하지 않고 공개 운영을 보류한다.

## 계정 생성 전 체크

- [ ] 행사 규칙에서 preview·외부 서비스 설정이 허용된다.
- [ ] Vercel 개인·팀 plan과 저장소 연결 주체를 정한다.
- [ ] Neon Singapore region과 plan을 정한다.
- [ ] 7일 복구 비용과 책임자를 승인한다.
- [ ] local·preview·production DB를 분리한다.
- [ ] Vercel Function region 후보를 실제 측정한다.
- [ ] Google OIDC callback·consent screen·허용 운영자를 정한다.
- [ ] Maps URL을 일본어 실제 기기에서 검수한다.
- [ ] 계정 ID·secret을 Git이 아닌 secret store에 둔다.

## 재검토 조건

- Neon에 서울·도쿄 region이 추가됨
- plan·history window·가격 변경
- 팀 배포에 Vercel Pro가 필요함
- Auth.js·adapter 호환 문제
- Google Maps의 서울 경로 품질이 사용자 테스트에서 부족함
- 실제 사용자 기록 보존·복구 요구 변경

변경 시 조사 날짜, 공식 근거, 비용·AC·운영 런북 영향을 같은 기능 커밋에서 갱신한다.
