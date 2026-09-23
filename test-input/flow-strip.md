---
schema_version: 1
title: 가로 흐름과 핵심정리 확인용
language: ko
canvas: coala-portrait
numbering: auto
toc: none
---

:::page{type="concept" id="gui-flow" layout="basic"}
# GUI 앱의 기본 흐름

## GUI 앱의 기본 흐름

```flow
정보 입력 | Field
버튼 클릭 | Button
처리 | 기능 실행
결과 확인 | Text
```

이 흐름은 4차시에서 배운 구조와 정확히 같습니다.

BMI 앱으로 바꿔 말하면 이렇습니다. 키 165와 몸무게 52를 적고(입력) → 버튼을 눌러 BMI를 계산하고(처리) → "BMI는 19.10입니다"라는 글자를 보여줍니다(출력).

세 자리 중 하나라도 빠지면 앱은 완성되지 않습니다. 값을 받을 자리가 없으면 계산할 것이 없고, 보여줄 자리가 없으면 계산해도 사용자는 결과를 알 수 없습니다.

> [!KEY_POINT]
> GUI는 입력 → 처리 → 출력 구조를 눈에 보이게 만든 것입니다.
> 화면을 설계할 때에도 "무엇을 입력받고(Field), 무엇을 실행하며(Button), 무엇을 보여줄지(Text)"의 순서로 생각하면 쉽습니다.
:::

:::page{type="concept" id="flow-variants" layout="basic"}
# 카드 수와 글 길이

## 카드 두 개, 부제 없음

부제가 없으면 제목만 가운데에 놓입니다.

```flow
질문하기
답 받기
```

## 카드 다섯 개

허용되는 최대 개수입니다. 카드가 좁아지므로 짧은 글을 씁니다.

```flow
계획 | Plan
설계 | Design
구현 | Build
검사 | Test
배포 | Release
```

## 긴 제목이 접히는 카드

한 카드의 글이 두 줄로 접히면 모든 카드의 높이가 그만큼 같이 커져야 합니다.

```flow
사용자 정보 입력받기 | Field
계산 버튼 누르기 | Button
계산 결과를 화면에 문장으로 보여주기 | Text
```
:::
