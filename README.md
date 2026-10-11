# Coala Book System

구조화된 Markdown 원고를 검증하고, Canva Apps SDK로 편집 가능한 교재 페이지(1587 × 2245)를 자동 생성하는 프로젝트다.

```
coala-book-system/
├─ canva-app/        Canva 앱 소스. 원고 파서·검증기·페이지 생성기 (TypeScript, React)
├─ coala-book-md/    완성된 원고(book.md)와 이미지(assets/)를 두는 곳
├─ skill/            원고 작성·교재 제작 규칙을 담은 Claude 스킬 (coala-canva-textbook)
└─ test-input/       파서 테스트용 원고 예시. invalid/ 는 일부러 틀린 원고
```

## 빠른 시작 (복붙용)

준비물: [Node.js 24](https://nodejs.org) 설치, Canva 계정

**1. 설치 (최초 1회)**

```bash
git clone <저장소 주소> coala-book-system
cd coala-book-system/canva-app
npm install
```

**2. Canva 앱 만들기 (최초 1회)**

1. https://www.canva.com/developers/apps 접속 → **Create an app** 클릭
2. 왼쪽 메뉴 **Configuration** 의 **App source** → **Development URL** 에 `http://localhost:8080` 입력 → 저장
3. 같은 화면의 **Permissions** 에서 `canva:design:content:read`, `canva:design:content:write` 두 개 켜기

**3. 서버 켜기 (매번)**

```bash
cd coala-book-system/canva-app
npm start
```

터미널에 `localhost:8080` 이 보이면 켜진 것. 이 창은 닫지 말고 둔다.

**4. Canva에서 열기 (매번)**

1. https://www.canva.com/developers/apps → **Your apps** → 2번에서 만든 앱 클릭
2. 오른쪽 위 **Preview** (미리보기) 클릭 → 새 Canva 디자인이 열리고 왼쪽에 앱 패널이 뜬다
3. 패널에서 **Choose file** → `coala-book-md/ch05-conditionals/book.md` 선택
4. **교재 페이지 생성** 클릭

종료할 때는 터미널에서 `Ctrl + C`. 자세한 내용은 아래 절을 본다.

## 1. 요구 사항

| 항목 | 값 |
| --- | --- |
| Node.js | 22 또는 24 (권장 24) |
| npm | 11 |
| Canva 계정 | 개발 서버로 앱을 실행할 때만 필요 |

원고 검증과 자동 테스트는 Canva 계정 없이 터미널에서만 돌아간다.

## 2. 설치

```bash
cd canva-app
npm install
```

## 3. 원고 검증 (Canva 없이)

앱이 원고를 올릴 때 쓰는 파서를 그대로 터미널에서 부른다. 여기서 통과한 원고는 앱에서도 통과한다.

```bash
cd canva-app
npm run validate -- ../coala-book-md/ch05-conditionals/book.md            # 문법·구조 검사
npm run validate -- ../coala-book-md/ch05-conditionals/book.md --layout   # 배치까지 계산
npm run validate -- ../coala-book-md/ch05-conditionals/book.md --json     # 기계가 읽을 출력
```

- 여러 파일을 한 번에 줄 수 있다.
- 오류는 첫 번째에서 멈추지 않고 모두 모아 원고 행 번호와 page id를 함께 보여 준다.
- `--layout`을 주면 원고 페이지마다 Canva 몇 장이 되는지(`← 분할됨`), 이미지·순서도 자리가 어디에 몇 개인지 보고한다.
- 종료 코드: 오류 없음 0, 오류 있음 1, 사용법 오류 2.

지원하는 Markdown 문법은 [manuscript-format.md](skill/coala-canva-textbook/references/manuscript-format.md)의 "Supported Markdown, and nothing else" 표가 기준이다. 그 밖의 문법(HTML, 중첩 목록, 링크 등)은 오류로 거절된다.

## 4. 테스트·검사·빌드

```bash
cd canva-app
npm test              # Jest 자동 테스트
npm run lint          # ESLint
npm run lint:types    # TypeScript 타입 검사
npm run lint:check    # lint + 타입 검사
npm run build         # production 빌드 (dist/)
```

자동 테스트는 파서, 배치 엔진, 글꼴 적용 순서, 속도 제한 재시도 등을 Canva SDK 대역으로 검증한다. 실제 Canva 렌더링은 아래 5~6절에서 수동으로 확인한다.

## 5. Canva 개발 서버 실행

### 5-1. Canva Developer Portal 준비 (최초 1회)

1. [Canva Developer Portal](https://www.canva.com/developers/apps)에서 새 앱을 만든다.
2. **App source > Development URL**을 `http://localhost:8080`으로 설정한다. Safari는 `https://localhost:8080`을 쓰고 로컬 인증서 경고를 먼저 통과한다.
3. 앱 권한에서 `canva:design:content:read`와 `canva:design:content:write`를 켠다. 저장소의 [canva-app.json](canva-app/canva-app.json)에도 같은 권한이 선언돼 있다.

개발자 계정 등록, 앱 생성과 ID 발급, 권한 승인은 사용자 계정에서만 할 수 있다.

### 5-2. CLI 로그인과 앱 연결 (최초 1회)

```bash
cd canva-app
npx @canva/cli login        # 브라우저로 Canva 계정 로그인
npx @canva/cli apps link    # 5-1에서 만든 앱을 고르면 .env에 CANVA_APP_ID가 기록된다
npx @canva/cli apps doctor  # 설정 점검 (선택)
```

`.env`는 `.gitignore`에 들어 있어 커밋되지 않는다.

### 5-3. 서버 시작

```bash
cd canva-app
npm start                 # http://localhost:8080
npm start -- --use-https  # Safari용 HTTPS
npm run start:preview     # 서버를 띄우고 Canva 미리보기까지 자동으로 연다
```

### 5-4. Canva에서 열기

1. Canva에서 **1587 × 2245 고정 크기** 디자인을 새로 만든다. Docs, Whiteboard 같은 가변 크기 디자인은 대상이 아니다.
2. Developer Portal의 앱 페이지에서 **Preview**를 눌러 그 디자인에 앱을 띄운다.

## 6. 앱 사용 순서

1. **Choose file**로 `.md` 원고를 고른다. 제목, 페이지 수, 페이지 타입이 표시되고 오류가 있으면 행 번호와 함께 목록이 뜬다.
2. (선택) **폴더 입력**으로 이미지가 든 폴더를 고른다. `assets/`만 골라도, 원고 폴더를 통째로 골라도 된다. 원고의 `::image` src와 경로 끝부분이 일치하는 파일은 실제 이미지로 들어가고, 없는 파일은 끌어다 놓기 자리로 비워진다.
3. **교재 페이지 생성**을 누른다. 페이지는 Canva 속도 제한에 맞춰 한 장씩 추가되며 진행 상황이 패널에 보인다.
4. 생성이 끝나면 패널의 보고를 확인한다. 적용된 글꼴, 비워 둔 이미지 자리, 직접 만들어야 하는 순서도 목록이 나온다.

처음이라면 `test-input/prototype-book.md`로 먼저 시험한 뒤 실제 원고를 올린다.

### 알아 둘 제한

- **순서도는 앱이 그리지 않는다.** 회색 자리와 안내 글만 놓이고, 사용자가 Canva의 순서도 도형으로 직접 만든다. 필요한 요소 이름과 그래픽 ID는 패널에 표시된다.
- **되돌리기가 없다.** Canva SDK에 페이지 삭제 API가 없어 앱이 추가한 페이지를 지울 수 없다. 같은 원고로 다시 생성하면 이어서 생성 / 처음부터 다시 생성(중복) / 취소를 묻는다.
- 글꼴은 Wanted Sans → Noto Sans KR → 그 밖의 한글 글꼴 순으로 실제 적용을 시도하며, 어떤 글꼴이 쓰였는지 패널에 표시된다.

## 7. 원고 작성

원고는 `coala-book-md/<교재 또는 차시>/book.md`에 둔다.

```
coala-book-md/<교재>/
├─ notes.md   사용자가 준 원재료 (선택)
├─ book.md    검증기를 통과한 원고
└─ assets/    book.md가 가리키는 이미지
```

메모·개요 같은 대충 적은 재료에서 원고를 쓰려면 Claude에서 `skill/coala-canva-textbook` 스킬을 쓴다. 스킬은 원고를 쓰고 3절의 검증기를 통과할 때까지 고친다. 본보기 원고는 [coala-book-md/ch05-conditionals/book.md](coala-book-md/ch05-conditionals/book.md)이고, `test-input/`의 원고는 문법 예시다.

스킬을 Claude Code에서 쓰려면 `skill/coala-canva-textbook` 폴더를 `~/.claude/skills/` 아래에 복사하거나 링크한다.

## 8. 더 읽을 문서

- [canva-app/TESTING.md](canva-app/TESTING.md) — SDK 구현 근거와 제한, 속도 제한 정책, 수동 검증 체크리스트
- [coala-book-md/README.md](coala-book-md/README.md) — 원고 폴더 구조
- [skill/coala-canva-textbook/SKILL.md](skill/coala-canva-textbook/SKILL.md) — 교재 제작 규칙 전체
- [references/manuscript-format.md](skill/coala-canva-textbook/references/manuscript-format.md) — 원고 문법
- [references/manuscript-authoring.md](skill/coala-canva-textbook/references/manuscript-authoring.md) — 원재료에서 원고 쓰기
- [references/page-types.md](skill/coala-canva-textbook/references/page-types.md) — 페이지 타입과 블록
