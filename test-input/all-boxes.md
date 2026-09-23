---
schema_version: 1
title: 모든 상자 한 번에 보기
subtitle: 상자 14종 · 화살표(→) 넘침 확인
language: ko
canvas: coala-portrait
numbering: auto
toc: none
assets_dir: ./assets
---

:::page{type="chapter-opening" id="box-chapter" chapter="9"}
# 상자 총점검
## 입력 → 처리 → 출력

### 학습 목표

- 앱에서 쓰는 모든 상자 → 한 페이지씩 확인할 수 있다.
- 화살표(→)가 든 글이 상자 오른쪽을 넘지 않는지 볼 수 있다.

### 왜 확인할까?

Canva는 글꼴에 없는 글자(→)를 대체 글꼴로 그리면서 글을 계산보다 넓게 렌더링할 때가 있습니다. 상자마다 → → → 화살표를 섞어 두었으니 오른쪽 테두리를 넘는 곳이 있는지 봅니다.
:::

:::page{type="concept" id="box-cards" layout="cards"}
# 개념 카드 2열

카드 네 장입니다. 카드 안 글이 카드 오른쪽을 넘지 않아야 합니다.

## 입력 → 처리

- 키(cm) → 숫자로 바꾸기
- 몸무게(kg) → 숫자로 바꾸기 → 계산에 넘기기

## 처리 → 출력

계산한 값을 화면에 보여 줍니다 → 글자로 바꿔서 → Text에 넣습니다.

## 화살표가 많은 카드

입력 → 검사 → 계산 → 저장 → 출력 → 종료 → 다시 시작 → 입력

## 짧은 카드

끝 → 끝
:::

:::page{type="concept" id="box-dialogue" layout="basic"}
# 프롬프트와 응답 상자

## 예시

```prompt
입력 → 처리 → 출력 순서로 앱을 설명해 줘. 각 단계를 한 줄씩 → 화살표로 이어서 → 짧게 정리해 줘.
```

```response
앱은 세 단계로 움직입니다.

- 입력 → 사용자가 키와 몸무게를 적습니다.
- 처리 → 버튼을 누르면 BMI를 계산합니다 → 결과를 문장으로 만듭니다.
- 출력 → 화면의 Text에 문장을 보여 줍니다.

세 자리 중 하나라도 빠지면 → 앱은 완성되지 않습니다.
```

> [!TIP]
> 질문에 조건을 붙이면 → 답이 구체적으로 바뀝니다. "각 단계를 한 줄씩" → "예시 숫자를 넣어서"처럼 → 조건을 하나씩 더해 보세요.
:::

:::page{type="concept" id="box-code" layout="basic"}
# 코드 상자와 실행 결과 상자

## 화살표가 든 주석과 출력

```python
# 입력 → 처리 → 출력
height = 165          # cm → m로 바꿉니다
meters = height / 100
print(f"{height}cm → {meters}m")
print("입력 → 처리 → 출력 → 끝")
```

```output
165cm → 1.65m
입력 → 처리 → 출력 → 끝
```

> [!KEY_POINT]
> GUI는 입력 → 처리 → 출력 구조를 눈에 보이게 만든 것입니다. 화면을 설계할 때에도 "무엇을 입력받고(Field), 무엇을 실행하며(Button), 무엇을 보여줄지(Text)"의 순서로 생각하면 쉽습니다.
:::

:::page{type="concept" id="box-flow-image" layout="basic"}
# 가로 흐름과 이미지 자리

## 가로 흐름

```flow
정보 입력 | Field
버튼 클릭 | Button
처리 → 계산 | 기능 실행
결과 확인 | Text
```

## 일반 이미지 자리

캡션에도 화살표를 넣었습니다 → 자리 아래 캡션이 넘치지 않아야 합니다.

::image{src="assets/boxes/screen.png" alt="입력 → 처리 → 출력이 표시된 화면" ratio="16:9" width="half" caption="그림 9-1 입력 → 처리 → 출력 화면"}

## GUI 실행 결과 자리

```python
import flet as ft


def main(page: ft.Page):
    page.add(ft.Text("입력 → 처리 → 출력"))


ft.app(target=main)
```

::image{src="assets/boxes/result.png" alt="입력 → 처리 → 출력 문구가 보이는 실행 창" ratio="16:9" width="half" role="result"}
:::

:::page{type="comparison" id="box-table"}
# 비교 표

표 칸 안의 글이 칸을 넘지 않아야 합니다.

| 단계 | 하는 일 → 결과 |
|---|---|
| 입력 | 키와 몸무게를 적는다 → 숫자 두 개 |
| 처리 | BMI를 계산한다 → 소수 한 자리 숫자 |
| 출력 | 문장으로 보여 준다 → "BMI는 19.1입니다" |

> [!TIP]
> 표에 넣을 내용이 길면 → 줄을 나누지 말고 → 페이지를 나누세요.
:::

:::page{type="practice-opening" id="box-practice" practice="009-1" practice-kind="상자 실습" platform="알고플로에서 실습하기"}
# 입력 → 처리 → 출력을 직접 만들어 보기

실습 카드 안의 글입니다. 키 → 몸무게 → 계산 → 결과 순서로 진행하며 → 각 단계의 화면을 확인합니다.

> [!TIP]
> 막히면 → 앞 페이지의 흐름 카드로 돌아가 → 어느 단계인지 확인하세요.
:::

:::page{type="practice-checklist" id="box-checklist"}
# 실습 목표

- [ ] 입력 → 처리 → 출력 순서를 말할 수 있다.
- [ ] 키 → 몸무게 → BMI 계산 코드를 적을 수 있다.
- [ ] 결과 → 화면 → 문장으로 보여 줄 수 있다.
:::

:::page{type="screenshot-guide" id="box-guide"}
# 캡처가 있는 STEP 카드

## 입력 칸 만들기 → 이름 붙이기

키 → 몸무게 순서로 입력 칸 두 개를 놓습니다 → 각 칸에 이름을 붙입니다.

::image{src="assets/boxes/step-01.png" alt="입력 칸 두 개가 놓인 화면 → 이름 붙이기" ratio="16:9" width="half"}

## 버튼 놓기 → 연결하기

::image{src="assets/boxes/step-02.png" alt="버튼을 놓고 함수와 연결한 화면" ratio="16:9" width="half"}

- 버튼을 끌어다 놓습니다 → 화면 가운데
- 누르면 실행될 함수 → calculate와 연결합니다
:::

:::page{type="step-process" id="box-process"}
# 캡처가 없는 STEP 카드

입력 → 처리 → 출력 세 단계로 설계합니다.

## 입력 데이터 정하기 → 숫자 두 개

- 키(cm) → 숫자
- 몸무게(kg) → 숫자

## 버튼 정하기 → 계산하기 하나

사용자가 누를 버튼은 하나면 됩니다 → BMI 계산하기.

## 결과 정하기 → 문장 하나

앱은 문장 하나를 보여 줍니다 → "BMI는 19.1입니다".
:::

:::page{type="flowchart" id="box-flowchart"}
# 순서도 자리

입력 → 조건 → 출력 순서의 순서도입니다. 자리 위아래 글이 → 자리를 넘지 않아야 합니다.

```flowchart
control_structure: if-else
nodes:
  - id: height
    role: input
    text: 키 입력
  - id: check
    role: decision
    text: 키가 0보다 큰가?
  - id: ok
    role: output
    text: BMI 계산 → 출력
  - id: retry
    role: output
    text: 다시 입력
connections:
  - from: height
    to: check
  - from: check
    to: ok
    label: YES
  - from: check
    to: retry
    label: NO
```

순서도를 만든 뒤 → 자리 안내 글을 지우면 → 이 문단이 그 아래에 남습니다.
:::
