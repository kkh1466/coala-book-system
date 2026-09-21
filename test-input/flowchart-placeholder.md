---
schema_version: 1
title: 순서도 자리표시자 시험 원고
language: ko
canvas: coala-portrait
numbering: auto
toc: none
---

:::page{type="concept" id="before-flowcharts"}
# 조건문이란

## 조건에 따라 달라지는 결과

프로그램은 조건에 따라 서로 다른 일을 할 수 있습니다.
:::

:::page{type="flowchart" id="age-check"}
# 순서도로 이해하기

조건문은 순서도로 표현하면 더 쉽게 이해할 수 있습니다.

예를 들어 나이를 입력했을 때 결과를 나누는 경우를 생각해봅시다.

```flowchart
control_structure: if-else
nodes:
  - id: age
    role: input
    text: 나이 입력
  - id: condition
    role: decision
    text: 나이가 20세 이상인가?
  - id: adult
    role: output
    text: 성인입니다.
  - id: minor
    role: output
    text: 미성년자입니다.
connections:
  - from: age
    to: condition
  - from: condition
    to: adult
    label: YES
  - from: condition
    to: minor
    label: NO
```

이처럼 조건에 따라 결과가 달라지는 구조를 앱에서도 자주 사용합니다.
:::

:::page{type="flowchart" id="sleep-check"}
# 수면 시간에 따른 건강 상태 안내

```flowchart
control_structure: if-else-if
nodes:
  - id: hours
    role: input
    text: 수면시간 입력
  - id: eight
    role: decision
    text: 8시간 이상인가?
  - id: five
    role: decision
    text: 5시간 이상인가?
  - id: enough
    role: output
    text: 충분한 수면입니다
  - id: fair
    role: output
    text: 적정 수면입니다
  - id: lacking
    role: output
    text: 수면 부족입니다
connections:
  - from: hours
    to: eight
  - from: eight
    to: enough
    label: YES
  - from: eight
    to: five
    label: NO
  - from: five
    to: fair
    label: YES
  - from: five
    to: lacking
    label: NO
```
:::

:::page{type="flowchart" id="count-loop" height="900"}
# 1부터 5까지 출력하기

반복문은 같은 일을 여러 번 할 때 씁니다.

```flowchart
control_structure: loop
nodes:
  - id: start
    role: declaration
    text: i = 1
  - id: check
    role: decision
    text: i가 5 이하인가?
  - id: print
    role: output
    text: i 출력
  - id: step
    role: process
    text: i를 1 늘린다
connections:
  - from: start
    to: check
  - from: check
    to: print
    label: YES
  - from: print
    to: step
  - from: step
    to: check
```

조건이 거짓이 되면 반복이 끝납니다.
:::

:::page{type="flowchart" id="long-order"}
# 주문 처리 전체 과정

```flowchart
control_structure: linear
nodes:
  - id: n1
    role: declaration
    text: 주문 정보를 담을 변수를 준비한다
  - id: n2
    role: input
    text: 고객이 고른 상품 목록을 입력받는다
  - id: n3
    role: process
    text: 상품마다 가격과 수량을 곱해 합계를 구한다
  - id: n4
    role: process
    text: 할인 쿠폰이 있으면 합계에서 할인 금액을 뺀다
  - id: n5
    role: process
    text: 배송 지역에 따라 배송비를 더한다
  - id: n6
    role: decision
    text: 결제할 금액이 고객의 잔액보다 적거나 같은가?
  - id: n7
    role: process
    text: 잔액에서 결제 금액을 빼고 주문을 확정한다
  - id: n8
    role: output
    text: 주문이 완료되었다는 안내와 영수증을 보여 준다
  - id: n9
    role: output
    text: 잔액이 부족하다는 안내와 충전 방법을 보여 준다
  - id: n10
    role: process
    text: 주문 내역을 기록에 저장한다
  - id: n11
    role: output
    text: 예상 배송일을 계산해서 고객에게 알려 준다
  - id: n12
    role: process
    text: 창고에 출고 요청을 보낸다
connections:
  - from: n1
    to: n2
  - from: n2
    to: n3
  - from: n3
    to: n4
  - from: n4
    to: n5
  - from: n5
    to: n6
  - from: n6
    to: n7
    label: YES
  - from: n6
    to: n9
    label: NO
  - from: n7
    to: n8
  - from: n8
    to: n10
  - from: n10
    to: n11
  - from: n11
    to: n12
```
:::
