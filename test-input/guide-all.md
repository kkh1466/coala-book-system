---
schema_version: 1
title: 스크린샷 따라하기 확인용 원고
subtitle: 캡처 비율·너비·캡션·순서·다단계·극단값·책 흐름
language: ko
canvas: coala-portrait
numbering: auto
toc: none
assets_dir: ./assets
---

:::page{type="screenshot-guide" id="ratios"}
# 캡처 비율에 따른 자리 크기

같은 단계 구성에서 캡처 비율만 바꿔 봅니다. 캡처는 모두 반 너비(half)라 카드 여러 장이 한 페이지에 들어가고, 세로로 긴 캡처는 한 페이지에 들어가도록 비율을 지킨 채 줄어듭니다.

## 16:9 — 일반 모니터 화면

가장 흔한 비율입니다. 반 너비 569px에서 높이 320px이 됩니다.

::image{src="assets/guide/ratio-16x9.png" alt="16:9 모니터 전체 화면" ratio="16:9" width="half"}

## 4:3 — 예전 모니터나 태블릿 화면

::image{src="assets/guide/ratio-4x3.png" alt="4:3 태블릿 화면" ratio="4:3" width="half"}

높이가 427px로 16:9보다 큽니다.

## 3:2 — 카메라 사진

카메라로 찍은 사진은 대부분 3:2입니다.

::image{src="assets/guide/ratio-3x2.png" alt="3:2 사진" ratio="3:2" width="half"}

## 1:1 — 정사각형 아이콘 확대

설정 아이콘을 확대한 캡처입니다.

::image{src="assets/guide/ratio-1x1.png" alt="정사각형 설정 아이콘 확대" ratio="1:1" width="half"}

## 3:4 — 세로 창

::image{src="assets/guide/ratio-3x4.png" alt="세로로 긴 대화 상자" ratio="3:4" width="half"}

설정 대화 상자처럼 세로로 조금 긴 창입니다.

## 9:16 — 스마트폰 화면

스마트폰 전체 화면은 세로로 매우 깁니다. 반 너비 569px에서 높이 1012px이라 지시문과 함께 한 카드에 들어갑니다.

::image{src="assets/guide/ratio-9x16.png" alt="스마트폰 앱 전체 화면" ratio="9:16" width="half"}
:::

:::page{type="screenshot-guide" id="widths"}
# 캡처 너비 지정

카드 안에서는 text와 full이 같은 너비(카드 안쪽 너비)이고, half만 절반으로 줄어 가운데 놓입니다. 반 너비 캡처를 쓰면 카드 두 장이 한 페이지에 들어갑니다.

## 기본 너비로 놓기

width를 적지 않으면 카드 안쪽 너비를 다 씁니다.

::image{src="assets/guide/width-text.png" alt="기본 너비 캡처" ratio="16:9"}

## full로 놓기

카드 안에서는 기본값과 같은 결과입니다.

::image{src="assets/guide/width-full.png" alt="full 너비 캡처" ratio="16:9" width="full"}

## half로 놓기 — 첫 번째

작은 대화 상자는 반 너비면 충분합니다.

::image{src="assets/guide/width-half-1.png" alt="반 너비 대화 상자" ratio="16:9" width="half"}

## half로 놓기 — 두 번째

앞 단계와 같은 페이지에 놓이고 사이에 화살표가 있어야 합니다.

::image{src="assets/guide/width-half-2.png" alt="반 너비 확인 창" ratio="16:9" width="half"}

## half + 세로 캡처

반 너비의 9:16은 높이가 1010px입니다. 지시문과 함께 한 카드에 들어갑니다.

::image{src="assets/guide/width-half-tall.png" alt="반 너비 스마트폰 화면" ratio="9:16" width="half"}
:::

:::page{type="screenshot-guide" id="captions"}
# 캡션과 배치 순서

캡처 자리는 지시문 앞, 뒤, 문단과 목록 사이 어디에나 둘 수 있고 원고에 적은 순서가 그대로 지켜집니다.

## 캡처가 지시문 뒤

**파일** 메뉴를 엽니다.

::image{src="assets/guide/order-after.png" alt="파일 메뉴가 열린 화면" ratio="16:9" caption="그림 1 파일 메뉴" width="half"}

## 캡처가 지시문 앞

::image{src="assets/guide/order-before.png" alt="새 파일 대화 상자" ratio="16:9" caption="그림 2 새 파일 대화 상자" width="half"}

이 화면이 보이면 **새 파일**을 누릅니다.

## 캡처가 문단과 목록 사이

이름 칸에 파일 이름을 적습니다.

::image{src="assets/guide/order-middle.png" alt="파일 이름 입력 칸" ratio="16:9" width="half"}

- 확장자는 자동으로 붙습니다.
- 한글 이름도 됩니다.
- 이미 있는 이름이면 경고가 뜹니다.

## 비율을 적지 않은 캡처

ratio를 빼면 16:9로 잡히고, 생성 후 목록에 "비율 미지정"으로 표시됩니다. 최종 이미지 비율이 다르면 잘리므로 실제 원고에서는 꼭 적어 주세요.

::image{src="assets/guide/order-noratio.png" alt="비율을 적지 않은 캡처" width="half"}

## 긴 지시문과 목록이 함께 있는 단계

저장 위치를 고릅니다. 기본 위치는 문서 폴더이지만 실습 폴더를 따로 만들어 두면 나중에 제출 파일을 모으기 쉽습니다. 폴더 이름은 과목 이름과 학번으로 짓는 것을 권합니다.

1. 왼쪽 목록에서 **문서**를 고릅니다.
2. **새 폴더**를 누르고 이름을 적습니다.
3. 만든 폴더 안으로 들어가 **저장**을 누릅니다.

::image{src="assets/guide/order-long.png" alt="저장 위치 선택 창" ratio="16:9" caption="그림 3 저장 위치 선택" width="half"}
:::

:::page{type="screenshot-guide" id="many-steps"}
# 첫 앱 만들기 전체 과정

단계가 열 개입니다. 캡처가 모두 반 너비라 한 페이지에 두 단계씩 놓입니다. 넘어간 단계 위에도 화살표가 있어야 하고, 번호는 페이지가 바뀌어도 이어져야 합니다.

## 프로그램 실행하기

1번째 동작입니다.

::image{src="assets/guide/many-01.png" alt="프로그램 실행하기 화면" ratio="16:9" width="half"}

## 새 프로젝트 만들기

2번째 동작입니다.

::image{src="assets/guide/many-02.png" alt="새 프로젝트 만들기 화면" ratio="16:9" width="half"}

## 프로젝트 이름 적기

3번째 동작입니다.

::image{src="assets/guide/many-03.png" alt="프로젝트 이름 적기 화면" ratio="16:9" width="half"}

## 템플릿 고르기

4번째 동작입니다.

::image{src="assets/guide/many-04.png" alt="템플릿 고르기 화면" ratio="16:9" width="half"}

## 화면 크기 정하기

5번째 동작입니다.

::image{src="assets/guide/many-05.png" alt="화면 크기 정하기 화면" ratio="16:9" width="half"}

## 버튼 추가하기

6번째 동작입니다.

::image{src="assets/guide/many-06.png" alt="버튼 추가하기 화면" ratio="16:9" width="half"}

## 버튼 글자 바꾸기

7번째 동작입니다.

::image{src="assets/guide/many-07.png" alt="버튼 글자 바꾸기 화면" ratio="16:9" width="half"}

## 입력 칸 추가하기

8번째 동작입니다.

::image{src="assets/guide/many-08.png" alt="입력 칸 추가하기 화면" ratio="16:9" width="half"}

## 실행해서 확인하기

9번째 동작입니다.

::image{src="assets/guide/many-09.png" alt="실행해서 확인하기 화면" ratio="16:9" width="half"}

## 저장하고 닫기

10번째 동작입니다.

::image{src="assets/guide/many-10.png" alt="저장하고 닫기 화면" ratio="16:9" width="half"}
:::

:::page{type="screenshot-guide" id="banner"}
# 아주 넓은 캡처

도구 모음처럼 가로로 긴 캡처는 허용 범위의 끝인 4:1까지 쓸 수 있습니다.

## 도구 모음에서 실행 단추 찾기

도구 모음 오른쪽 끝의 **실행** 단추를 찾습니다.

::image{src="assets/guide/extreme-4x1.png" alt="가로로 긴 도구 모음" ratio="4:1" width="half"}

## 상태 표시줄 확인하기

허용 범위의 반대쪽 끝인 1:4입니다. 반 너비에서도 높이가 2276px이라 지면에 맞게 줄어들고 가운데 놓입니다.

::image{src="assets/guide/extreme-1x4.png" alt="세로로 긴 상태 표시줄" ratio="1:4" width="half"}
:::

:::page{type="screenshot-guide" id="long-intro"}
# 도입문이 긴 페이지

이 페이지는 도입문이 깁니다. 따라하기 앞에 왜 이 작업이 필요한지 설명하는 경우입니다. 도입문이 길어도 첫 카드는 같은 페이지에 놓여야 합니다.

실습 환경을 처음 여는 학생은 화면 구성이 낯설기 때문에 어디를 눌러야 하는지 한눈에 알기 어렵습니다. 그래서 첫 화면에서 가장 중요한 세 곳을 먼저 짚고 넘어갑니다.

- 왼쪽은 파일 목록입니다.
- 가운데는 코드를 적는 곳입니다.
- 오른쪽은 실행 결과가 나오는 곳입니다.

## 왼쪽 메뉴에서 설정을 열고 글꼴 항목을 찾아 크기를 28로 바꾼 뒤 저장 단추 누르기

제목이 두 줄로 접히는 경우입니다. 카드 높이가 그만큼 늘어나야 합니다.

::image{src="assets/guide/extreme-long-title.png" alt="글꼴 설정 화면" ratio="16:9" width="half"}
:::

:::page{type="screenshot-guide" id="single"}
# 단계가 하나뿐인 페이지

## 실행 결과 확인하기

화살표 없이 카드 하나만 놓입니다.

::image{src="assets/guide/extreme-single.png" alt="실행 결과 창" ratio="16:9" caption="그림 4 실행 결과" width="half"}
:::

:::page{type="chapter-opening" id="chapter-03" chapter="3"}
# 첫 앱 만들기
## 버튼 하나로 시작하는 GUI

### 학습 목표

- 새 프로젝트를 만들 수 있다.
- 버튼을 화면에 놓고 글자를 바꿀 수 있다.

### 무엇을 만들까?

누르면 인사말이 바뀌는 버튼 하나짜리 앱을 만듭니다. 화면을 따라 하며 순서대로 진행합니다.
:::

:::page{type="screenshot-guide" id="chapter-03-guide"}
# 버튼 놓기

## 새 프로젝트 만들기

첫 화면에서 **새 프로젝트**를 누릅니다.

::image{src="assets/guide/book-01.png" alt="첫 화면의 새 프로젝트 단추" ratio="16:9" width="half"}

## 버튼 끌어다 놓기

왼쪽 부품 목록에서 **Button**을 화면 가운데로 끌어다 놓습니다.

::image{src="assets/guide/book-02.png" alt="부품 목록에서 버튼을 끄는 모습" ratio="16:9" width="half"}

## 글자 바꾸기

::image{src="assets/guide/book-03.png" alt="버튼 속성 창의 text 칸" ratio="3:2" width="half"}

오른쪽 속성 창의 **text** 칸에 **안녕하세요**를 적습니다.
:::

:::page{type="concept" id="chapter-03-tip" layout="basic"}
# 잘 안 될 때

## 버튼이 보이지 않아요

부품을 놓은 뒤 실행 단추를 눌러야 화면에 나타납니다.

> [!TIP]
> 따라하기 페이지에는 Tip을 둘 수 없습니다. 이렇게 뒤따르는 concept 페이지에 적습니다.
:::

:::page{type="practice-checklist" id="chapter-03-check"}
# 실습 목표

- [ ] 새 프로젝트를 만들었다.
- [ ] 버튼을 화면에 놓았다.
- [ ] 버튼 글자를 바꿨다.
:::
