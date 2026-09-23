---
schema_version: 1
title: 코드 상자와 실행 결과 확인용
language: ko
canvas: coala-portrait
numbering: auto
toc: none
assets_dir: ./assets
---

:::page{type="concept" id="print-basics" layout="basic"}
# 화면에 글자 보여 주기

파이썬에서 글자를 화면에 보여 주는 가장 간단한 방법은 **print** 함수입니다. 모든 코드 상자에는 실행 결과가 함께 있습니다.

## 기본 출력

아래 코드를 그대로 적고 실행해 봅시다. 실행 결과가 파란 "실행 결과" 문구 아래 별도 상자에 보여야 합니다.

```python
print("안녕하세요")
print("코알라 앱 만들기")
```

```output
안녕하세요
코알라 앱 만들기
```

두 줄이 차례로 출력됩니다. 따옴표 안의 글자가 그대로 나옵니다.

## 변수와 조건문

주석은 회색, **if**·**else** 같은 키워드는 파란색 굵게로 보여야 합니다. 실행 결과에는 색 구분이 없고 공백과 줄바꿈이 그대로입니다.

```python
name = "코알라"      # 이름을 변수에 담습니다
age = 3

if age >= 3:
    print(name + "는 세 살 이상입니다")
    print("  들여쓴 줄도 그대로 나옵니다")
else:
    print(name + "는 아직 어립니다")
```

```output
코알라는 세 살 이상입니다
  들여쓴 줄도 그대로 나옵니다
```

## 반복문

반복문 코드 아래에 세 줄 이상의 실행 결과 상자가 있어야 합니다.

```python
for number in range(1, 6):
    print(number, "번째 코알라")
```

```output
1 번째 코알라
2 번째 코알라
3 번째 코알라
4 번째 코알라
5 번째 코알라
```

> [!TIP]
> 들여쓰기는 스페이스 네 칸입니다. 탭을 써도 앱이 네 칸으로 바꿔 줍니다.
:::

:::page{type="concept" id="javascript-log" layout="basic"}
# 자바스크립트 출력

## console.log

라벨이 "JavaScript"이고 **const**·**for** 같은 키워드가 파란색이어야 합니다.

```javascript
// 자바스크립트도 같은 상자를 씁니다
const name = "코알라";
for (let i = 1; i <= 2; i += 1) {
  console.log(`${i}번째 안녕, ${name}`);
}
```

```output
1번째 안녕, 코알라
2번째 안녕, 코알라
```
:::

:::page{type="concept" id="gui-window" layout="basic"}
# 창 띄우기

## 버튼 하나짜리 창

GUI 프로그램은 텍스트 대신 실행 화면을 결과로 둡니다. 코드 상자 다음에 파란 "실행 결과" 문구가 붙은 이미지 자리가 있어야 하고, 생성 후 이미지 자리 목록에도 "실행 결과"로 표시되어야 합니다.

```python
import flet as ft


def main(page: ft.Page):
    page.title = "첫 앱"
    page.add(ft.Text("안녕하세요"), ft.ElevatedButton("인사하기"))


ft.app(target=main)
```

::image{src="assets/code/hello-window.png" alt="안녕하세요 문구와 인사하기 버튼이 있는 실행 창" ratio="4:3" width="half" role="result" caption="그림 1 첫 앱의 실행 화면"}

실행하면 가운데에 글자와 버튼이 있는 창이 뜹니다.
:::

:::page{type="concept" id="long-code" layout="basic"}
# 긴 코드 나누기

## 여러 페이지로 이어지는 코드

이 코드는 상자 하나에 들어가지 않아 줄 경계에서 나뉘고, 다음 페이지 상자의 라벨이 "Python (계속)"이어야 합니다. 실행 결과 상자는 마지막 코드 상자 아래에 이어집니다.

```python
import flet as ft


def build_row(label, value):
    # 라벨과 값을 한 줄에 놓습니다
    return ft.Row([ft.Text(label, width=120), ft.Text(value)])


def main(page: ft.Page):
    page.title = "코알라 건강 기록"
    page.vertical_alignment = ft.MainAxisAlignment.START

    name = ft.TextField(label="이름")
    height = ft.TextField(label="키(cm)")
    weight = ft.TextField(label="몸무게(kg)")
    result = ft.Text("")

    def calculate(e):
        # BMI = 몸무게 / (키 m)^2
        meters = float(height.value) / 100
        bmi = float(weight.value) / (meters * meters)
        result.value = f"{name.value}님의 BMI는 {bmi:.1f}입니다"
        print(result.value)
        page.update()

    button = ft.ElevatedButton("계산하기", on_click=calculate)

    page.add(
        build_row("앱 이름", "코알라 건강 기록"),
        name,
        height,
        weight,
        button,
        result,
    )


ft.app(target=main)
```

```output
코알라님의 BMI는 22.5입니다
```

코드가 길어도 글자 크기는 그대로입니다.
:::

:::page{type="concept" id="long-output" layout="basic"}
# 긴 실행 결과 나누기

## 구구단

실행 결과가 여러 페이지로 나뉘고, 이어지는 결과 상자 위의 문구가 "실행 결과 (계속)"이어야 합니다. 모든 줄이 순서대로 한 번씩 있어야 합니다.

```python
for dan in range(2, 7):
    print(f"[{dan}단]")
    for n in range(1, 10):
        print(f"{dan} x {n} = {dan * n}")
```

```output
[2단]
2 x 1 = 2
2 x 2 = 4
2 x 3 = 6
2 x 4 = 8
2 x 5 = 10
2 x 6 = 12
2 x 7 = 14
2 x 8 = 16
2 x 9 = 18
[3단]
3 x 1 = 3
3 x 2 = 6
3 x 3 = 9
3 x 4 = 12
3 x 5 = 15
3 x 6 = 18
3 x 7 = 21
3 x 8 = 24
3 x 9 = 27
[4단]
4 x 1 = 4
4 x 2 = 8
4 x 3 = 12
4 x 4 = 16
4 x 5 = 20
4 x 6 = 24
4 x 7 = 28
4 x 8 = 32
4 x 9 = 36
[5단]
5 x 1 = 5
5 x 2 = 10
5 x 3 = 15
5 x 4 = 20
5 x 5 = 25
5 x 6 = 30
5 x 7 = 35
5 x 8 = 40
5 x 9 = 45
[6단]
6 x 1 = 6
6 x 2 = 12
6 x 3 = 18
6 x 4 = 24
6 x 5 = 30
6 x 6 = 36
6 x 7 = 42
6 x 8 = 48
6 x 9 = 54
```
:::

:::page{type="concept" id="gui-next-page" layout="basic"}
# 실행 화면이 다음 페이지로 넘어가는 경우

## 코드 아래 공간이 부족할 때

코드 상자 아래에 남은 공간이 실행 화면보다 작으면, 이미지 자리는 잘리지 않고 다음 페이지 안전 영역 안에 놓여야 합니다. 읽는 순서에서는 여전히 코드 바로 다음입니다.

```python
import flet as ft


def main(page: ft.Page):
    page.title = "설문 앱"
    question = ft.Text("오늘 기분은 어떤가요?", size=24)
    choices = ft.RadioGroup(
        content=ft.Column(
            [
                ft.Radio(value="good", label="좋아요"),
                ft.Radio(value="soso", label="그저 그래요"),
                ft.Radio(value="bad", label="별로예요"),
            ]
        )
    )
    submit = ft.ElevatedButton("제출")
    page.add(question, choices, submit)


ft.app(target=main)
```

::image{src="assets/code/survey-window.png" alt="질문과 라디오 버튼 세 개, 제출 버튼이 있는 설문 앱 실행 창" ratio="16:9" role="result"}
:::
