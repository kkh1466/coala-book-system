import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { PracticeChecklistPage } from "../types/book-spec";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { CONTENT_WIDTH, GAP, PAGE, TEXT_WIDTH } from "../theme/page-layout";
import { parseBlocks } from "../parser/blocks";
import { parseInline } from "../parser/inline";
import type { FlowItem } from "../layout/flow";
import { flowIntoPages, renderPlaced } from "../layout/flow";
import { measureText } from "../layout/measure";
import {
  blockFlowItems,
  headingItem,
  withContinuationHeading,
} from "../layout/content-flow";
import type { PagePart } from "./page-part";
import { bodyStyle, calloutItem, continuedTitle } from "./shared";

const CHECK = {
  box: 52,
  /** 체크 상자와 글 사이. 모든 항목에서 같다. */
  indent: 90,
  paddingX: 55,
  paddingY: 34,
  itemGap: 30,
  radius: 28,
} as const;

/**
 * 체크리스트 카드.
 *
 * 카드 높이는 항목 글의 실제 줄 수로 정한다. 항목마다 고정 150px을 쓰던
 * 이전 방식은 글이 짧으면 빈칸이, 길면 겹침이 생겼다.
 */
function checklistItem(
  items: readonly string[],
  fonts: ResolvedBookFonts,
  gapAfter: number,
): FlowItem {
  const textWidth = CONTENT_WIDTH - CHECK.paddingX * 2 - CHECK.indent;
  const heights = items.map((item) =>
    Math.max(
      CHECK.box,
      measureText(item, {
        fontSize: TYPOGRAPHY.bullet,
        width: textWidth,
        lineHeightEm: LINE_HEIGHT.global,
      }),
    ),
  );
  const height =
    CHECK.paddingY * 2 +
    heights.reduce((sum, value) => sum + value, 0) +
    CHECK.itemGap * Math.max(items.length - 1, 0);
  const { colors } = coalaTheme;

  return {
    height,
    gapAfter,
    render: (top): ElementAtPoint[] => {
      const elements: ElementAtPoint[] = [
        createVectorShape({
          left: PAGE.marginX,
          top,
          width: CONTENT_WIDTH,
          height,
          path: roundedRectPath(CONTENT_WIDTH, height, CHECK.radius),
          fill: colors.cardFill,
          stroke: colors.softBorder,
          strokeWeight: 2,
        }),
      ];
      let cursor = top + CHECK.paddingY;
      items.forEach((item, index) => {
        elements.push(
          createVectorShape({
            left: PAGE.marginX + CHECK.paddingX,
            top: cursor,
            width: CHECK.box,
            height: CHECK.box,
            path: roundedRectPath(CHECK.box, CHECK.box, 8),
            fill: colors.cardFill,
            stroke: colors.primary,
            strokeWeight: 3,
          }),
          createRichText({
            left: PAGE.marginX + CHECK.paddingX + CHECK.indent,
            top: cursor,
            width: textWidth,
            segments: parseInline(item),
            fontRef: fonts.fontRef,
            fontSize: TYPOGRAPHY.bullet,
            role: "bullet",
            fontWeight: fonts.regularWeight,
            color: colors.text,
            emphasisWeight: fonts.boldWeight,
            emphasisColor: colors.primary,
            lineHeightEm: LINE_HEIGHT.global,
          }),
        );
        cursor += (heights[index] ?? CHECK.box) + CHECK.itemGap;
      });
      return elements;
    },
  };
}

/** 한 카드에 담을 항목 수. 카드가 페이지보다 커지지 않게 나눈다. */
function chunkItems(
  items: readonly string[],
  fonts: ResolvedBookFonts,
  available: number,
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (
      current.length > 0 &&
      checklistItem(candidate, fonts, 0).height > available
    ) {
      chunks.push(current);
      current = [item];
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * practice-checklist 페이지를 만든다.
 *
 * 항목 수 제한이 없다. 카드가 한 페이지에 들어가지 않으면 항목 경계에서
 * 나누고 연속 페이지에 `제목(계속)`을 붙인다.
 */
export function layoutPracticeChecklist(
  page: PracticeChecklistPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  const wide = bodyStyle(fonts, { width: CONTENT_WIDTH });
  const narrow = bodyStyle(fonts, { width: TEXT_WIDTH });
  const available = PAGE.safeBottom - PAGE.safeTop;

  const items: FlowItem[] = [
    headingItem(page.title, wide, { gapAfter: GAP.afterHeading }),
  ];

  if (page.introduction) {
    items.push(
      ...blockFlowItems(parseBlocks(page.introduction), narrow, {
        maxItemHeight: available,
      }),
    );
    const last = items[items.length - 1];
    if (last) {
      last.gapAfter = GAP.callout;
    }
  }

  for (const chunk of chunkItems(page.items, fonts, available)) {
    items.push(checklistItem(chunk, fonts, GAP.callout));
  }

  if (page.tip) {
    items.push(calloutItem({ type: "tip", text: page.tip }, fonts, {
      gapAfter: 0,
    }));
  } else {
    const last = items[items.length - 1];
    if (last) {
      last.gapAfter = 0;
    }
  }

  const pages = flowIntoPages(items, {
    top: PAGE.safeTop,
    bottom: PAGE.safeBottom,
  });

  return pages.map((placed, index) => ({
    title: continuedTitle(page.title, index),
    elements:
      index === 0
        ? renderPlaced(placed)
        : renderPlaced(withContinuationHeading(placed, page.title, wide)),
  }));
}
