# PostgreSQL migration·backfill 배포 계약 v0.1

작성일: 2026-11-21 · 상태: 실제 schema·운영 DB 생성 전 기준

이 문서는 첫 schema 이후 PostgreSQL 변경을 preview에서 검수하고 production에 expand → code switch → contract 순서로 배포하는 기준이다. 구체 명령·timeout은 provider·plan·데이터 규모를 측정한 뒤 고정하며, 이 문서만으로 production migration 실행을 승인하지 않는다.

## 원칙

- application rollback과 schema rollback은 같은 일이 아니다.
- 기존 release와 새 release가 겹치는 동안 양쪽이 schema를 안전하게 읽고 써야 한다.
- `DROP`, column rename, type rewrite를 긴급 복구 수단으로 사용하지 않는다.
- migration 생성 도구의 SQL을 검토 없이 실행하지 않는다.
- schema 변경, backfill, read switch, old write 중단, destructive contract를 가능한 한 별도 release로 나눈다.
- production 데이터나 connection string을 local 검증용으로 복사하지 않는다.
- 이미 공유·적용한 migration 파일의 checksum을 바꾸지 않는다.

## 변경 분류

| 분류 | 예 | 기본 release |
| --- | --- | --- |
| M0 metadata·작은 additive | 새 nullable column, 새 작은 table | expand 한 단계 후보 |
| M1 index·constraint | index, FK, check, unique | lock·중복 검수 후 분리 |
| M2 backfill | 기존 row 계산·copy | bounded batch job |
| M3 application switch | 새 column read/write 전환 | code release |
| M4 destructive | drop, rename, type rewrite, null 금지 | 관찰 뒤 별도 contract release |
| M5 emergency repair | 잘못된 row·pointer 수정 | incident·두 사람 승인·별도 operation |

변경이 여러 분류에 걸치면 가장 위험한 분류의 gate를 따른다. table이 작을 것이라는 추측만으로 M4를 M0처럼 실행하지 않는다.

## migration 불변식

- migration ID와 적용 순서가 전 환경에서 같다.
- 각 파일의 checksum과 검토 commit을 기록한다.
- schema history table은 runtime role이 수정하지 못한다.
- application이 의존하는 constraint·index 이름은 명시적이다.
- timestamp timezone, nullability, default, FK delete/update가 data contract와 일치한다.
- 한 migration의 transaction 가능 여부와 non-transaction statement를 알고 있다.
- 실패 뒤 applied·not applied 상태를 migration tool에서 구분할 수 있다.

“명령이 0으로 끝남”만으로 schema가 기대 상태라고 판단하지 않고 catalog query와 application contract test를 실행한다.

## target 확인

실행 전 사람이 전체 URL을 출력하지 않고 다음을 두 신호 이상 확인한다.

- `APP_ENV`
- database host category·region
- database name·role category
- environment marker 또는 database comment
- current schema version
- release 대상 project·branch의 제한된 reference

preview와 production은 exact 승인 target 목록을 따로 둔다. target이 불명확하거나 runtime pooled URL로 DDL을 시도하면 시작 전에 실패한다.

## 권한·연결

| 역할 | 허용 | 금지 |
| --- | --- | --- |
| migration | 승인된 DDL·history | application request 처리 |
| backfill | 대상 table의 제한 select·update | DDL·다른 domain table |
| runtime | application DML | DDL·history 수정 |
| diagnostics | 제한 select·catalog | mutation·row export |

provider가 같은 credential에 넓은 권한을 강제하면 그 제한과 rotation 범위를 release 판정에 기록한다. migration·backfill credential을 application 환경 변수에 남기지 않는다.

## expand → switch → contract

### 1. expand

- 새 nullable column·table·index를 기존 code가 무시할 수 있게 추가한다.
- 기존 column·constraint를 제거하거나 의미를 바꾸지 않는다.
- old application의 insert가 새 schema에서 계속 성공하는지 검수한다.
- default가 table rewrite·lock을 만드는 PostgreSQL version 동작을 확인한다.

### 2. dual-compatible code

- 새 application이 old row를 읽을 fallback을 가진다.
- 필요하면 dual write하되 어느 값이 source of truth인지 명시한다.
- partial failure에서 old/new 값이 갈라질 때 복구 방법을 test한다.
- dual write 기간은 owner·종료 조건이 있는 임시 상태다.

### 3. backfill

- stable primary key order와 bounded batch를 사용한다.
- 같은 batch를 다시 실행해도 결과가 같아야 한다.
- transaction·sleep·batch 크기는 DB pool·lock·replication lag 측정으로 조정한다.
- progress는 count·last safe key category로 기록하고 row 원문을 출력하지 않는다.
- application write와 경쟁하는 row의 precedence 규칙을 고정한다.

### 4. read switch

- 새 field의 null·불일치 count가 gate를 통과했는지 확인한다.
- 새 application이 새 field를 읽고 old application rollback도 가능한지 검수한다.
- error·latency·lock을 관찰한다.

### 5. contract

- old release가 더는 배포·rollback되지 않음을 확인한다.
- dual write와 fallback 제거가 먼저 배포됐는지 확인한다.
- 보존·backup·과거 run·audit 영향 검토가 끝난 뒤 old column·constraint를 제거한다.
- destructive SQL은 별도 migration·review·release로 실행한다.

하루에 모두 끝낼 수 있다는 이유로 단계 경계를 한 transaction에 합치지 않는다.

## column 추가·NOT NULL

기존 row가 있는 table에 필수 column을 추가하는 후보 순서:

1. nullable column 추가
2. 새 code가 값 쓰기
3. 기존 row bounded backfill
4. null count 0과 concurrent write 검수
5. 필요하면 `NOT VALID` check 후보 추가
6. constraint validation
7. application rollback 호환 확인
8. 최종 NOT NULL·old fallback 제거를 별도 단계로 판단

constant default 최적화 여부를 PostgreSQL major에서 확인한다. volatile default·large table rewrite 가능성을 SQL diff에서 분류한다.

## FK·check·unique

### FK·check

기존 table에는 `NOT VALID` 추가 후 validation을 분리하는 방법을 검토한다. 새 write를 즉시 보호하는 범위와 기존 row validation 범위를 실제 PostgreSQL version에서 확인한다.

### unique

unique 추가 전 duplicate query를 제한된 집계로 실행한다. duplicate를 삭제·병합하는 기준이 없으면 constraint를 만들지 않는다. 큰 table은 unique index 생성 방식과 constraint attach 가능성을 검토한다.

### index

일반 `CREATE INDEX`와 `CREATE INDEX CONCURRENTLY`의 lock·transaction 차이를 구분한다. concurrently 실패로 invalid index가 남는지 확인하고 cleanup target 이름을 exact하게 검증한다.

constraint·index 이름은 client 오류에 노출하지 않지만 server error mapping과 운영 진단에서 allowlist로 사용한다.

## enum·상태 변경

- 새 enum value를 추가해도 old application이 읽을 때 처리할 수 있는지 확인한다.
- value rename·삭제는 column contract와 같은 M4로 취급한다.
- text + check를 쓰면 application schema·DB check·API enum을 같은 release chain에서 갱신한다.
- unknown state를 old code가 default success로 처리하지 않는다.

quest·report 상태 전이를 schema migration만으로 바꾸지 않고 상태 머신·API·UI·audit action을 함께 갱신한다.

## type·column rename

large table의 in-place type change와 direct rename은 기본 금지 후보다.

1. 새 column 추가
2. 새 write 또는 dual write
3. idempotent backfill
4. compare query와 read switch
5. old write 제거
6. 관찰 뒤 old column drop

view·alias로 호환할 경우 write 의미와 ORM mapping을 실제 test한다. rename이 metadata-only여도 old application을 즉시 깨뜨리면 안전하지 않다.

## backfill 계약

각 backfill은 다음을 문서화한다.

- 대상 predicate와 예상 count 범주
- stable ordering key
- batch size·transaction timeout 후보
- 이미 처리된 row 식별 방식
- concurrent application write와 충돌 정책
- pause·resume·abort 조건
- row별 실패와 전체 실패 처리
- 완료 query와 rollback·forward fix
- log allowlist와 개인정보 금지

backfill script를 일반 runtime route나 public endpoint로 노출하지 않는다. 전체 row JSON, 주소·comment·token을 progress log에 출력하지 않는다.

## timeout·lock

실제 값은 preview에서 측정한 뒤 정하지만 다음을 무제한으로 두지 않는다.

- connection acquire timeout
- `lock_timeout`
- `statement_timeout`
- backfill transaction duration
- migration 전체 관찰·중단 기준

lock timeout은 migration 실패를 숨기는 성공이 아니다. 어떤 statement가 적용됐는지 history·catalog에서 확인한다. long transaction, active connection과 예상 lock level을 production 전에 preview의 유사 schema·row count에서 측정한다.

## 배포 전 rehearsal

1. production과 같은 PostgreSQL major의 빈 DB에 전체 history 적용
2. 직전 production schema snapshot 구조의 검수 DB에 신규 migration 적용
3. old application contract test
4. new application contract test
5. backfill dry-run count·bounded batch 실행
6. rollback application과 expanded schema 호환 검수
7. lock·duration·disk·connection 관찰
8. backup을 별도 DB에 restore해 migration 적용 후보 검수

실제 production row를 개발 환경으로 복사하지 않는다. 구조·분포가 필요하면 비식별 synthetic fixture를 만든다.

## production 실행 순서

1. 대상 commit·migration ID·checksum·DB identity를 두 사람이 확인한다.
2. backup 또는 복구 가능한 기준 시점과 RPO를 확인한다.
3. current application·schema·active incident가 없는지 확인한다.
4. migration timeout·중단 기준·commander를 기록한다.
5. expand migration을 한 runner에서 실행한다.
6. catalog·history·constraint·index 상태를 확인한다.
7. old application read/write smoke test를 한다.
8. 새 application을 단계적으로 배포한다.
9. backfill·read switch는 각각 별도 gate로 실행한다.
10. 관찰 후 contract migration을 별도 release로 판단한다.

여러 application instance가 migration을 동시에 실행하지 않게 migration lock 또는 단일 pipeline을 사용한다. 일반 server startup마다 production DDL을 실행하지 않는다.

## 실패 처리

### migration 시작 전

target·checksum·backup·호환성이 불명확하면 실행하지 않는다.

### transaction 안 실패

rollback 여부를 history·catalog에서 확인한다. 오류 message에 SQL 값·connection string을 복사하지 않는다.

### non-transaction statement 실패

invalid index·부분 object를 exact name과 catalog로 확인한다. 자동 전체 rollback을 가정하지 않는다.

### application 오류 증가

새 release를 중지하고 expanded schema에서 old release가 안전한지 확인한다. destructive change가 이미 실행됐다면 application rollback만 시도하지 않는다.

### data invariant 위반

write를 좁게 차단하고 incident를 선언한다. row를 즉시 삭제·수정하기 전 영향 범위와 복구 operation을 review한다.

## rollback·forward fix

- additive expand 뒤 code 문제는 old code rollback 후보가 될 수 있다.
- migration down SQL을 production 자동 복구로 실행하지 않는다.
- 이미 backfill한 값은 source of truth와 concurrent write를 확인하기 전 지우지 않는다.
- constraint 때문에 실패하면 원인을 해결한 forward migration을 우선 검토한다.
- data 손상이면 backup restore의 privacy-first promotion gate를 따른다.

rollback decision은 schema, application, data, credential 네 축의 상태를 기록한다.

## destructive gate

다음을 모두 만족하기 전 drop·rewrite를 실행하지 않는다.

- [ ] old application·worker·script가 대상 object를 읽거나 쓰지 않음
- [ ] 최소 관찰 기간과 query·error evidence가 있음
- [ ] backfill·read switch·fallback 제거 완료
- [ ] 과거 run·version·audit·삭제·backup 영향 검토
- [ ] backup 시점과 별도 DB restore 훈련 완료
- [ ] 예상 lock·duration·disk와 중단 기준 확인
- [ ] application rollback이 contract 뒤 불가능한 범위 승인
- [ ] 두 reviewer와 실행·incident 역할 지정

마감이 임박한 것은 destructive gate 완화 근거가 아니다.

## 증거 양식

```markdown
# DB migration release YYYY-MM-DD HH:mm KST

- commit·release·PostgreSQL major:
- migration ID·checksum:
- 분류: M0 / M1 / M2 / M3 / M4 / M5
- target environment·DB identity 신호:
- current→target schema:
- old/new application 호환:
- transaction / non-transaction statement:
- 예상·실제 lock·duration·row count 범주:
- backfill batch·resume·완료 query:
- backup 시점·restore rehearsal:
- 실행·중단·rollback/forward fix:
- smoke test·관찰:
- 알려진 제한·contract 예정일:
```

connection string·password·실제 row·운영자 identity·전체 provider response를 기록하지 않는다.

## release gate

- [ ] shared migration checksum을 수정하지 않았다.
- [ ] 빈 DB와 직전 schema 모두에서 rehearsal했다.
- [ ] old·new·rollback application 호환 범위를 확인했다.
- [ ] runtime·migration·backfill role이 분리됐다.
- [ ] lock·statement·batch timeout과 중단 기준이 있다.
- [ ] backfill이 idempotent하고 concurrent write 규칙이 있다.
- [ ] schema history·catalog·constraint·index를 실제 확인했다.
- [ ] destructive change는 별도 release와 restore evidence가 있다.
- [ ] log·증거에 credential·row 원문·개인정보가 없다.

연결 검수: AC03~AC16, AC20
