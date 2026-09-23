import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { ConceptPage, ContentSection } from "../types/book-spec";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import {
  CONTENT_WIDTH,
  GAP,
  PAGE,
  TEXT_WIDTH,
} from "../theme/page-layout";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import { parseBlocks } from "../parser/blocks";
import { plainText } from "../parser/inline";
import type { FlowItem } from "../layout/flow";
import {
  flowIntoPages,
  pendingImagesOf,
  renderPlaced,
} from "../layout/flow";
import { continuationInset } from "../layout/image-placeholder";
import { measureText } from "../layout/measure";
import {
  blockFlowItems,
  headingItem,
  withContinuationHeading,
} from "../layout/content-flow";
import type { PagePart } from "./page-part";
import { bodyStyle, calloutItem, continuedTitle, sectionMarkdown } from "./shared";

const CARD = {
  columns: 2,
  gap: 50,
  paddingX: 42,
  paddingTop: 36,
  paddingBottom: 36,
  afterTitle: 20,
  radius: 28,
} as const;

const CARD_WIDTH = (CONTENT_WIDTH - CARD.gap) / CARD.columns;

/** 카드 안의 글이 실제로 차지하는 높이. */
function cardHeight(section: ContentSection): number {
  const innerWidth = CARD_WIDTH - CARD.paddingX * 2;
  const titleHeight = measureText(section.title, {
    fontSize: TYPOGRAPHY.subsectionTitle,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.global,
  });
  const blocks = parseBlocks(sectionMarkdown(section));
  const bodyHeight = blocks.reduce((sum, block, index) => {
    const gap = index === blocks.length - 1 ? 0 : GAP.paragraph;
    if (block.kind !== "paragraph" && block.kind !== "list") {
      // 카드 안에는 이미지 자리나 프롬프트·응답 상자를 둘 수 없다. 원고 검사가
      // 먼저 거절한다.
      return sum;
    }
    if (block.kind === "paragraph") {
      return (
        sum +
        measureText(plainText(block.segments), {
          fontSize: TYPOGRAPHY.body,
          width: innerWidth,
          lineHeightEm: LINE_HEIGHT.global,
        }) +
        gap
      );
    }
    return (
      sum +
      block.items.reduce(
        (itemSum, item, itemIndex) =>
          itemSum +
          measureText(`• ${plainText(item)}`, {
            fontSize: TYPOGRAPHY.bullet,
            width: innerWidth,
            lineHeightEm: LINE_HEIGHT.global,
          }) +
          (itemIndex === block.items.length - 1 ? 0 : GAP.listItem),
        0,
      ) +
      gap
    );
  }, 0);
  return (
    CARD.paddingTop +
    titleHeight +
    CARD.afterTitle +
    bodyHeight +
    CARD.paddingBottom
  );
}

/**
 * 카드 한 줄(최대 2장).
 *
 * 줄 전체가 하나의 조각이다. 카드가 페이지 경계에서 잘리지 않고, 같은 줄의
 * 두 카드는 높은 쪽에 맞춰 같은 높이가 된다.
 */
function cardRowItem(
  sections: readonly ContentSection[],
  fonts: ResolvedBookFonts,
): FlowItem {
  const height = Math.max(...sections.map(cardHeight));
  const innerWidth = CARD_WIDTH - CARD.paddingX * 2;
  const { colors } = coalaTheme;

  return {
    height,
    gapAfter: GAP.callout,
    render: (top): ElementAtPoint[] =>
      sections.flatMap((section, column) => {
        const left = PAGE.marginX + column * (CARD_WIDTH + CARD.gap);
        const titleHeight = measureText(section.title, {
          fontSize: TYPOGRAPHY.subsectionTitle,
          width: innerWidth,
          lineHeightEm: LINE_HEIGHT.global,
        });
        const style = bodyStyle(fonts, {
          left: left + CARD.paddingX,
          width: innerWidth,
        });
        const bodyItems = blockFlowItems(
          parseBlocks(sectionMarkdown(section)),
          style,
          { maxItemHeight: height },
        );
        let cursor = top + CARD.paddingTop + titleHeight + CARD.afterTitle;
        const bodyElements = bodyItems.flatMap((item) => {
          const drawn = item.render(cursor);
          cursor += item.height + item.gapAfter;
          return drawn;
        });

        return [
          createVectorShape({
            left,
            top,
            width: CARD_WIDTH,
            height,
            path: roundedRectPath(CARD_WIDTH, height, CARD.radius),
            fill: colors.cardFill,
            stroke: colors.softBorder,
            strokeWeight: 2,
          }),
          createRichText({
            left: left + CARD.paddingX,
            top: top + CARD.paddingTop,
            width: innerWidth,
            text: section.title,
            fontRef: fonts.fontRef,
            fontSize: TYPOGRAPHY.subsectionTitle,
            role: "subsectionTitle",
            fontWeight: fonts.boldWeight,
            color: colors.primary,
            lineHeightEm: LINE_HEIGHT.global,
          }),
          ...bodyElements,
        ];
      }),
  };
}

/**
 * concept 페이지를 만든다.
 *
 * 섹션 수 제한이 없다. 들어가지 않으면 `제목(계속)` 페이지로 넘어간다.
 */
export function layoutConcept(
  page: ConceptPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  const wide = bodyStyle(fonts, { width: CONTENT_WIDTH });
  const narrow = bodyStyle(fonts, { width: TEXT_WIDTH });
  const maxItemHeight = PAGE.safeBottom - PAGE.safeTop;

  const items: FlowItem[] = [
    headingItem(page.title, wide, { gapAfter: GAP.afterHeading }),
  ];

  if (page.introduction) {
    items.push(
      ...blockFlowItems(parseBlocks(page.introduction), narrow, {
        maxItemHeight,
      }),
    );
    const last = items[items.length - 1];
    if (last) {
      last.gapAfter = GAP.beforeHeading;
    }
  }

  if (page.layout === "cards") {
    for (let index = 0; index < page.sections.length; index += CARD.columns) {
      items.push(
        cardRowItem(page.sections.slice(index, index + CARD.columns), fonts),
      );
    }
  } else {
    page.sections.forEach((section, index) => {
      if (index > 0) {
        const previous = items[items.length - 1];
        if (previous) {
          previous.gapAfter = GAP.beforeHeading;
        }
      }
      items.push(
        headingItem(section.title, wide, {
          fontSize: TYPOGRAPHY.subsectionTitle,
        }),
        ...blockFlowItems(parseBlocks(sectionMarkdown(section)), narrow, {
          maxItemHeight,
        }),
      );
    });
  }

  if (page.callout) {
    const previous = items[items.length - 1];
    if (previous) {
      previous.gapAfter = GAP.callout;
    }
    items.push(calloutItem(page.callout, fonts, { gapAfter: 0 }));
  }

  // 이미지 자리나 큰 상자가 있는 페이지만 연속 페이지 제목의 몫을 미리 덜어 낸다.
  // 이미지가 없으면 옵션을 넘기지 않으므로 배치는 이전과 똑같다.
  const hasImage = items.some(
    (item) => item.pendingImage || item.reservesContinuation,
  );
  const pages = flowIntoPages(
    items,
    { top: PAGE.safeTop, bottom: PAGE.safeBottom },
    hasImage
      ? {
          continuationInset: continuationInset(
            PAGE.safeTop,
            page.title,
            wide.width,
          ),
        }
      : undefined,
  );

  return pages.map((placed, index) => {
    const pendingImages = pendingImagesOf(placed);
    return {
      title: continuedTitle(page.title, index),
      elements:
        index === 0
          ? renderPlaced(placed)
          : renderPlaced(withContinuationHeading(placed, page.title, wide)),
      ...(pendingImages.length > 0 ? { pendingImages } : {}),
    };
  });
}
