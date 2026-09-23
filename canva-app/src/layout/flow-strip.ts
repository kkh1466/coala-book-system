import type { ElementAtPoint } from "@canva/design";
import type { FlowStep } from "../parser/flow-strip";
import { coalaTheme } from "../theme/coala-theme";
import { CONTENT_WIDTH, FLOW_STRIP, PAGE } from "../theme/page-layout";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import type { FlowStyle } from "./content-flow";
import type { FlowItem } from "./flow";
import { measureText } from "./measure";

/**
 * 가로 흐름.
 *
 * 원본 caution-box.png 위쪽의 구조다. 흰 카드가 한 줄로 놓이고 카드 사이를
 * 가는 선이 잇는다. 카드 안에는 굵은 검정 제목과 파란 부제가 가운데 정렬로
 * 들어간다. 글자 크기는 본문 28pt, 줄 간격 2다.
 *
 * 흐름 하나는 조각 하나다. 페이지 경계에서 잘리지 않고 통째로 넘어간다.
 * 카드 높이는 가장 긴 카드에 맞춰 모두 같다.
 */
const { colors } = coalaTheme;

/** 흐름의 왼쪽과 너비. 본문이 지면 여백에서 시작하면 전체 단 너비다. */
function frameOf(style: FlowStyle): { left: number; width: number } {
  return style.left === PAGE.marginX
    ? { left: PAGE.marginX, width: CONTENT_WIDTH }
    : { left: style.left, width: style.width };
}

export function flowStripItem(
  steps: readonly FlowStep[],
  style: FlowStyle,
  options: { gapAfter: number },
): FlowItem {
  const frame = frameOf(style);
  const count = Math.max(1, steps.length);
  const cardWidth = Math.floor(
    (frame.width - FLOW_STRIP.gap * (count - 1)) / count,
  );
  const innerWidth = cardWidth - FLOW_STRIP.paddingX * 2;
  const measure = (text: string) =>
    measureText(text, {
      fontSize: TYPOGRAPHY.body,
      width: innerWidth,
      lineHeightEm: LINE_HEIGHT.global,
    });
  const heights = steps.map((step) => ({
    title: measure(step.title),
    subtitle: step.subtitle ? measure(step.subtitle) : 0,
  }));
  const textHeight = Math.max(
    ...heights.map((height) => height.title + height.subtitle),
  );
  const cardHeight = FLOW_STRIP.paddingY * 2 + textHeight;

  return {
    height: cardHeight,
    gapAfter: options.gapAfter,
    render: (top): ElementAtPoint[] =>
      steps.flatMap((step, index) => {
        const left = frame.left + index * (cardWidth + FLOW_STRIP.gap);
        const height = heights[index] ?? { title: 0, subtitle: 0 };
        // 카드 안에서 글을 세로 가운데에 둔다.
        const textTop =
          top + Math.round((cardHeight - (height.title + height.subtitle)) / 2);
        const elements: ElementAtPoint[] = [
          createVectorShape({
            left,
            top,
            width: cardWidth,
            height: cardHeight,
            path: roundedRectPath(cardWidth, cardHeight, FLOW_STRIP.radius),
            fill: colors.cardFill,
          }),
          createRichText({
            left: left + FLOW_STRIP.paddingX,
            top: textTop,
            width: innerWidth,
            text: step.title,
            fontRef: style.fonts.fontRef,
            fontSize: TYPOGRAPHY.body,
            role: "body",
            fontWeight: style.fonts.boldWeight,
            color: colors.text,
            textAlign: "center",
            lineHeightEm: LINE_HEIGHT.global,
          }),
        ];
        if (step.subtitle) {
          elements.push(
            createRichText({
              left: left + FLOW_STRIP.paddingX,
              top: textTop + height.title,
              width: innerWidth,
              text: step.subtitle,
              fontRef: style.fonts.fontRef,
              fontSize: TYPOGRAPHY.body,
              role: "body",
              fontWeight: style.fonts.regularWeight,
              color: colors.primary,
              textAlign: "center",
              lineHeightEm: LINE_HEIGHT.global,
            }),
          );
        }
        if (index < steps.length - 1) {
          // 카드 사이를 잇는 가는 선. 카드 가장자리에서 조금 떨어져 있다.
          const lineLeft = left + cardWidth + FLOW_STRIP.connector.inset;
          const lineWidth = FLOW_STRIP.gap - FLOW_STRIP.connector.inset * 2;
          elements.push(
            createVectorShape({
              left: lineLeft,
              top:
                top +
                Math.round((cardHeight - FLOW_STRIP.connector.weight) / 2),
              width: lineWidth,
              height: FLOW_STRIP.connector.weight,
              path: `M 0 0 H ${lineWidth} V ${FLOW_STRIP.connector.weight} H 0 Z`,
              fill: colors.flowConnector,
            }),
          );
        }
        return elements;
      }),
  };
}
