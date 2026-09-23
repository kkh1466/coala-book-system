import type { ElementAtPoint } from "@canva/design";
import type { ContentBlock } from "../parser/blocks";
import { parseBlocks } from "../parser/blocks";
import { parseInline, plainText } from "../parser/inline";
import { coalaTheme } from "../theme/coala-theme";
import { CONTENT_WIDTH, GAP, PAGE, PROMPT_BOX } from "../theme/page-layout";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import type { BlockFlowOptions, FlowStyle } from "./content-flow";
import { blockFlowItems, twoBodyLines } from "./content-flow";
import type { FlowItem } from "./flow";
import { lineHeight, measureText } from "./measure";

/**
 * AI 프롬프트·응답 상자.
 *
 * 원본 ai-prompt-response.png의 두 영역을 따른다. 프롬프트는 알약형 테두리
 * 안의 글 한 덩어리이고, 응답은 둥근 사각형 테두리 안에 문단과 목록이 본문과
 * 같은 크기로 흐른다. 글자 크기는 본문 28pt, 줄 간격 2로 다른 본문과 같다.
 *
 * 응답이 한 페이지보다 길면 **글자를 줄이지 않고** 상자를 문단·목록 항목
 * 경계에서 나눠 다음 상자로 넘긴다. 프롬프트 상자는 응답 상자와 같은 페이지에
 * 있어야 하므로 페이지 하단에 홀로 남지 않는다.
 */
const { colors } = coalaTheme;

/** 상자의 왼쪽과 너비. 본문이 지면 여백에서 시작하면 카드·표와 같은 전체 단 너비다. */
function boxFrame(style: FlowStyle): { left: number; width: number } {
  return style.left === PAGE.marginX
    ? { left: PAGE.marginX, width: CONTENT_WIDTH }
    : { left: style.left, width: style.width };
}

export function promptItem(text: string, style: FlowStyle): FlowItem {
  const frame = boxFrame(style);
  const innerWidth = frame.width - PROMPT_BOX.paddingX * 2;
  const segments = parseInline(text);
  const textHeight = measureText(plainText(segments), {
    fontSize: TYPOGRAPHY.body,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.global,
  });
  const height = textHeight + PROMPT_BOX.paddingY * 2;

  return {
    height,
    gapAfter: GAP.promptToResponse,
    // 응답 상자가 다음 페이지로 넘어가면 프롬프트도 함께 넘어간다.
    keepWithNext: twoBodyLines(),
    render: (top): ElementAtPoint[] => [
      createVectorShape({
        left: frame.left,
        top,
        width: frame.width,
        height,
        // 반지름을 높이보다 크게 주면 roundedRectPath가 높이의 절반으로 맞춘다.
        path: roundedRectPath(frame.width, height, height),
        fill: colors.pageBackground,
        stroke: colors.promptStroke,
        strokeWeight: PROMPT_BOX.strokeWeight,
      }),
      createRichText({
        left: frame.left + PROMPT_BOX.paddingX,
        top: top + PROMPT_BOX.paddingY + PROMPT_BOX.textOffsetY,
        width: innerWidth,
        segments,
        fontRef: style.fonts.fontRef,
        fontSize: TYPOGRAPHY.body,
        role: "body",
        fontWeight: style.fonts.regularWeight,
        color: colors.text,
        emphasisWeight: style.fonts.boldWeight,
        emphasisColor: colors.primary,
        lineHeightEm: LINE_HEIGHT.global,
      }),
    ],
  };
}

/**
 * 연속 페이지 맨 위에 놓이는 `제목(계속)`의 몫.
 *
 * 응답 상자 하나의 상한을 잡을 때 이 높이를 미리 빼 둔다. 이미지 자리와 같은
 * 계산이다.
 */
function continuationReserve(): number {
  return (
    lineHeight(TYPOGRAPHY.sectionTitle, LINE_HEIGHT.global) * 2 +
    GAP.afterHeading
  );
}

/**
 * 응답 하나를 상자 조각 목록으로 만든다. 보통 하나, 길면 여럿.
 *
 * 안쪽 글은 본문과 같은 규칙(`blockFlowItems`)으로 조각을 내고, 상자 하나가
 * 페이지에 들어가는 높이를 넘지 않도록 조각을 앞에서부터 담는다.
 */
export function responseItems(
  markdown: string,
  style: FlowStyle,
  options: { gapAfter: number; maxHeight: number },
): FlowItem[] {
  const frame = boxFrame(style);
  const innerStyle: FlowStyle = {
    ...style,
    left: frame.left + PROMPT_BOX.paddingX,
    width: frame.width - PROMPT_BOX.paddingX * 2,
  };
  const padding = PROMPT_BOX.responsePaddingY * 2;
  const maxInner = Math.max(
    1,
    Math.floor(options.maxHeight - continuationReserve() - padding),
  );
  // 응답 안에는 문단과 목록만 온다. 원고 검사가 나머지를 거절한다.
  const blocks = parseBlocks(markdown).filter(
    (block): block is Extract<ContentBlock, { kind: "paragraph" | "list" }> =>
      block.kind === "paragraph" || block.kind === "list",
  );
  const flowOptions: BlockFlowOptions = { maxItemHeight: maxInner };
  const inner = blockFlowItems(blocks, innerStyle, flowOptions);

  const groups: FlowItem[][] = [];
  let group: FlowItem[] = [];
  let used = 0;
  for (const item of inner) {
    if (group.length > 0 && used + item.height > maxInner) {
      groups.push(group);
      group = [];
      used = 0;
    }
    group.push(item);
    used += item.height + item.gapAfter;
  }
  if (group.length > 0) {
    groups.push(group);
  }
  if (groups.length === 0) {
    groups.push([]);
  }

  return groups.map((items, index) => {
    const contentHeight = items.reduce(
      (sum, item, at) =>
        sum + item.height + (at === items.length - 1 ? 0 : item.gapAfter),
      0,
    );
    const height = contentHeight + padding;
    const isLast = index === groups.length - 1;
    return {
      height,
      gapAfter: isLast ? options.gapAfter : GAP.promptToResponse,
      reservesContinuation: true,
      render: (top): ElementAtPoint[] => {
        let cursor = top + PROMPT_BOX.responsePaddingY;
        const drawn = items.flatMap((item) => {
          const elements = item.render(cursor);
          cursor += item.height + item.gapAfter;
          return elements;
        });
        return [
          createVectorShape({
            left: frame.left,
            top,
            width: frame.width,
            height,
            path: roundedRectPath(
              frame.width,
              height,
              PROMPT_BOX.responseRadius,
            ),
            fill: colors.pageBackground,
            stroke: colors.promptStroke,
            strokeWeight: PROMPT_BOX.strokeWeight,
          }),
          ...drawn,
        ];
      },
    };
  });
}
