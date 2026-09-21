import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { ComparisonPage } from "../types/book-spec";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { CONTENT_WIDTH, GAP, PAGE, TEXT_WIDTH } from "../theme/page-layout";
import { parseBlocks } from "../parser/blocks";
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

const CELL = {
  paddingX: 28,
  paddingY: 26,
  /** 칸의 최소 높이. 글이 짧아도 표가 납작해지지 않게 한다. */
  minHeight: 110,
} as const;

/**
 * 표의 한 행.
 *
 * 행 하나가 하나의 조각이다. 행이 페이지 경계에서 잘리지 않고, 행 높이는
 * 그 행에서 가장 긴 칸의 실제 줄 수로 정해진다. 칸 글자는 항상 28pt다.
 */
function rowItem(
  cells: readonly string[],
  columnWidth: number,
  isHeader: boolean,
  fonts: ResolvedBookFonts,
  gapAfter: number,
): FlowItem {
  const innerWidth = columnWidth - CELL.paddingX * 2;
  const height = Math.max(
    CELL.minHeight,
    CELL.paddingY * 2 +
      Math.max(
        ...cells.map((cell) =>
          measureText(cell, {
            fontSize: TYPOGRAPHY.tableCell,
            width: innerWidth,
            lineHeightEm: LINE_HEIGHT.global,
          }),
        ),
      ),
  );
  const { colors } = coalaTheme;

  return {
    height,
    gapAfter,
    // 머리글 행은 첫 데이터 행과 같은 페이지에 있어야 한다.
    ...(isHeader ? { keepWithNext: CELL.minHeight } : {}),
    render: (top): ElementAtPoint[] =>
      cells.flatMap((cell, column) => {
        const left = PAGE.marginX + column * columnWidth;
        return [
          createVectorShape({
            left,
            top,
            width: columnWidth,
            height,
            path: roundedRectPath(columnWidth, height, isHeader ? 16 : 1),
            fill: isHeader ? colors.contentsBackground : colors.cardFill,
            stroke: colors.softBorder,
            strokeWeight: 2,
          }),
          createRichText({
            left: left + CELL.paddingX,
            top: top + CELL.paddingY,
            width: innerWidth,
            text: cell,
            fontRef: fonts.fontRef,
            fontSize: TYPOGRAPHY.tableCell,
            role: "tableCell",
            fontWeight: isHeader ? fonts.boldWeight : fonts.regularWeight,
            color: isHeader ? colors.primary : colors.text,
            lineHeightEm: LINE_HEIGHT.global,
          }),
        ];
      }),
  };
}

/**
 * comparison 페이지를 만든다.
 *
 * 행 수 제한이 없다. 표가 한 페이지에 들어가지 않으면 행 경계에서 나누고
 * 연속 페이지에 `제목(계속)`을 붙인다. 칸 글자를 줄이지 않는다.
 */
export function layoutComparison(
  page: ComparisonPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  const wide = bodyStyle(fonts, { width: CONTENT_WIDTH });
  const narrow = bodyStyle(fonts, { width: TEXT_WIDTH });
  const columnWidth = CONTENT_WIDTH / page.columns.length;

  const items: FlowItem[] = [
    headingItem(page.title, wide, { gapAfter: GAP.afterHeading }),
  ];

  if (page.introduction) {
    items.push(
      ...blockFlowItems(parseBlocks(page.introduction), narrow, {
        maxItemHeight: PAGE.safeBottom - PAGE.safeTop,
      }),
    );
    const last = items[items.length - 1];
    if (last) {
      last.gapAfter = GAP.table;
    }
  }

  const rows = [page.columns, ...page.rows];
  rows.forEach((cells, index) => {
    const isLast = index === rows.length - 1;
    items.push(
      rowItem(
        cells,
        columnWidth,
        index === 0,
        fonts,
        isLast ? (page.callout ? GAP.callout : 0) : 0,
      ),
    );
  });

  if (page.callout) {
    items.push(calloutItem(page.callout, fonts, { gapAfter: 0 }));
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
