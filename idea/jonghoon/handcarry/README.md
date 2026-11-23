# HandCarry (가칭) 프로토타입

일본인 여행자가 일본 한정 굿즈를 사서 서울로 들고 오고, 한국 구매자가 에스크로로 결제하는 핸드캐리 중개 서비스의 시연용 프로토타입입니다. 백엔드 없이 브라우저 안에서만 동작하며, 결제·인증·번역은 모두 가짜(mock)입니다.

## 실행

```bash
npm install
npm run build
npm run start
```

`http://localhost:3000`을 너비 1024px 이상의 창으로 엽니다. 왼쪽 시연 패널에서 구매자·여행자·운영자 역할을 바꿀 수 있고, `데모 초기화`로 처음 상태로 돌아갑니다.

## 문서

- [DEMO.md](DEMO.md): 5분 시연 대본과 예상 질문
- [PRD.md](PRD.md): 제품 요구사항
- [DESIGN.md](DESIGN.md): 디자인 시스템
- [CLAUDE.md](CLAUDE.md): 개발 명령어와 구조
