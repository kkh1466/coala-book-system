import type { ElementAtPoint } from "@canva/design";
import type { TocEntry, TocPage } from "../types/book-spec";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { CONTENT_WIDTH, PAGE, TOC } from "../theme/page-layout";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import type { FlowItem } from "../layout/flow";
import { flowIntoPages, renderPlaced } from "../layout/flow";
import { lineHeight, measureText } from "../layout/measure";
import { withContinuationHeading } from "../layout/content-flow";
import type { PagePart } from "./page-part";
import { bodyStyle, continuedTitle } from "./shared";

/**
 * 목차의 한 줄.
 *
 * 번호(파랑, 굵게) · 제목 · 쪽수(오른쪽 끝)를 한 줄에 놓고 아래에 가는
 * 구분선을 긋는다. 줄 하나가 조각 하나이므로 줄 중간에서 페이지가 나뉘지
 * 않는다. 제목이 길어 두 줄이 되면 줄 높이가 그만큼 커진다.
 */
function entryItem(
  entry: TocEntry,
  fonts: ResolvedBookFonts,
  isLast: boolean,
): FlowItem {
  const { colors } = coalaTheme;
  const { row } = TOC;
  const titleLeft = PAGE.marginX + row.labelWidth;
  const pageLeft = PAGE.marginX + CONTENT_WIDTH - row.pageWidth;
  const titleWidth = entry.page
    ? pageLeft - row.gap - titleLeft
    : PAGE.marginX + CONTENT_WIDTH - titleLeft;

  const titleHeight = measureText(entry.title, {
    fontSize: TYPOGRAPHY.tocEntry,
    width: titleWidth,
    lineHeightEm: LINE_HEIGHT.single,
  });
  const height = Math.max(row.minHeight, titleHeight + row.paddingY * 2);
  // 한 줄짜리 글은 줄의 세로 가운데에, 여러 줄 제목은 위쪽 여백부터 놓는다.
  const singleLine = lineHeight(TYPOGRAPHY.tocEntry, LINE_HEIGHT.single);
  const textTop = (top: number) =>
    top +
    (titleHeight <= singleLine ? (height - singleLine) / 2 : row.paddingY);

  return {
    height,
    gapAfter: 0,
    render: (top): ElementAtPoint[] => [
      createRichText({
        left: PAGE.marginX,
        top: textTop(top),
        width: row.labelWidth,
        text: entry.label,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.tocLabel,
        role: "tocLabel",
        fontWeight: fonts.boldWeight,
        color: colors.primary,
        lineHeightEm: LINE_HEIGHT.single,
      }),
      createRichText({
        left: titleLeft,
        top: textTop(top),
        width: titleWidth,
        text: entry.title,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.tocEntry,
        role: "tocEntry",
        fontWeight: fonts.boldWeight,
        color: colors.text,
        lineHeightEm: LINE_HEIGHT.single,
      }),
      ...(entry.page
        ? [
            createRichText({
              left: pageLeft,
              top: textTop(top),
              width: row.pageWidth,
              text: entry.page,
              fontRef: fonts.fontRef,
              fontSize: TYPOGRAPHY.tocEntry,
              role: "tocEntry",
              fontWeight: fonts.regularWeight,
              color: colors.text,
              textAlign: "end",
              lineHeightEm: LINE_HEIGHT.single,
            }),
          ]
        : []),
      // 마지막 항목 아래에는 선을 긋지 않는다. 원본과 같다.
      ...(isLast
        ? []
        : [
            createVectorShape({
              left: PAGE.marginX,
              top: top + height - TOC.separator.weight,
              width: CONTENT_WIDTH,
              height: TOC.separator.weight,
              path: roundedRectPath(CONTENT_WIDTH, TOC.separator.weight, 0),
              fill: colors.text,
            }),
          ]),
    ],
  };
}

/**
 * 목차 페이지를 만든다.
 *
 * 원본 table-of-contents.png의 배치를 따른다. 항목이 한 장을 넘으면 줄
 * 경계에서 나누고 연속 페이지에 `목차(계속)`을 붙인다. 쪽번호는 찍지 않는다
 * (`plan-book.ts`의 UNNUMBERED_PAGE_TYPES).
 */
export function layoutToc(page: TocPage, fonts: ResolvedBookFonts): PagePart[] {
  const { colors } = coalaTheme;
  const wide = bodyStyle(fonts, { width: CONTENT_WIDTH });

  const titleElement = createRichText({
    left: PAGE.marginX,
    top: TOC.title.top,
    width: CONTENT_WIDTH,
    text: page.title,
    fontRef: fonts.fontRef,
    fontSize: TYPOGRAPHY.tocTitle,
    role: "tocTitle",
    fontWeight: fonts.boldWeight,
    color: colors.text,
    lineHeightEm: LINE_HEIGHT.chapterTitle,
  });

  const items = page.entries.map((entry, index) =>
    entryItem(entry, fonts, index === page.entries.length - 1),
  );
  const pages = flowIntoPages(items, {
    top: page.layout === "compact" ? TOC.compactEntriesTop : TOC.entriesTop,
    bottom: PAGE.safeBottom,
  });

  return pages.map((placed, index) => ({
    title: continuedTitle(page.title, index),
    background: colors.contentsBackground,
    elements:
      index === 0
        ? [titleElement, ...renderPlaced(placed)]
        : renderPlaced(withContinuationHeading(placed, page.title, wide)),
  }));
}
