import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { PracticeOpeningPage } from "../types/book-spec";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, toCanvaFontSize, TYPOGRAPHY } from "../theme/typography";
import { CONTENT_WIDTH, GAP, PAGE } from "../theme/page-layout";
import { parseBlocks } from "../parser/blocks";
import { parseInline } from "../parser/inline";
import type { FlowItem } from "../layout/flow";
import { flowIntoPages, renderPlaced } from "../layout/flow";
import { measureLineWidth, measureText } from "../layout/measure";
import {
  blockFlowItems,
  headingItem,
  withContinuationHeading,
} from "../layout/content-flow";
import type { PagePart } from "./page-part";
import { bodyStyle, calloutItem, continuedTitle } from "./shared";

/**
 * 실습 오프닝 카드. 값은 원본 practice-opening1.png(1587×2245)에서 쟀다.
 *
 * - 카드: x 160, y 157, 폭 1262, 높이는 내용에 따라(원본 864), 모서리 50
 * - 배지 줄: 카드 상단에서 67px 아래, 높이 87
 * - 카드 안쪽 글 왼쪽 여백 58, 아래 여백 100
 */
const CARD = {
  left: PAGE.marginX - 5,
  top: 157,
  width: CONTENT_WIDTH + 10,
  radius: 50,
  paddingX: 58,
  paddingTop: 67,
  paddingBottom: 100,
  /** 배지 줄 아래에서 제목까지. */
  afterBadges: 96,
  /** 제목 아래에서 본문까지. 원본: 제목 잉크 425 → 본문 잉크 496. */
  afterTitle: 0,
} as const;

const BADGE = {
  height: 87,
  paddingX: 38,
  gap: 26,
} as const;

type Badge = {
  text: string;
  fill: string;
  color: string;
  align: "left" | "right";
};

/**
 * 배지 한 줄. 원본은 왼쪽에 실습 번호(연노랑)와 실습 종류(남색), 오른쪽 끝에
 * 실습 플랫폼(남색)을 둔다.
 */
function badges(page: PracticeOpeningPage): Badge[] {
  const { colors } = coalaTheme;
  return [
    {
      text: `실습 ${page.practiceId}`,
      fill: colors.keySummaryFill,
      color: colors.primary,
      align: "left",
    },
    {
      text: page.practiceKind,
      fill: colors.primary,
      color: "#FFFFFF",
      align: "left",
    },
    {
      text: page.platform,
      fill: colors.primary,
      color: "#FFFFFF",
      align: "right",
    },
  ];
}

function badgeWidth(text: string): number {
  return measureLineWidth(text, TYPOGRAPHY.badge) + BADGE.paddingX * 2;
}

function badgeElements(
  page: PracticeOpeningPage,
  fonts: ResolvedBookFonts,
  top: number,
): ElementAtPoint[] {
  const innerLeft = CARD.left + CARD.paddingX;
  const innerRight = CARD.left + CARD.width - CARD.paddingX;
  const textTop =
    top +
    (BADGE.height - toCanvaFontSize(TYPOGRAPHY.badge) * LINE_HEIGHT.single) / 2;
  let cursor = innerLeft;

  return badges(page).flatMap((badge) => {
    const width = badgeWidth(badge.text);
    const left = badge.align === "right" ? innerRight - width : cursor;
    if (badge.align === "left") {
      cursor += width + BADGE.gap;
    }
    return [
      createVectorShape({
        left,
        top,
        width,
        height: BADGE.height,
        path: roundedRectPath(width, BADGE.height, BADGE.height / 2),
        fill: badge.fill,
      }),
      createRichText({
        left,
        top: textTop,
        width,
        text: badge.text,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.badge,
        role: "badge",
        fontWeight: fonts.boldWeight,
        color: badge.color,
        textAlign: "center",
        lineHeightEm: LINE_HEIGHT.single,
      }),
    ];
  });
}

/**
 * 흰 실습 카드 하나. 배지 줄, 제목, 설명을 모두 감싼다.
 *
 * 카드는 하나의 조각이라 페이지 중간에서 잘리지 않는다. 높이는 안쪽 글의
 * 실제 줄 수로 계산한다. 설명이 카드 한 장에 들어가지 않으면 카드를 키우는
 * 대신 설명을 문단 단위로 나눠 다음 페이지의 카드로 넘긴다(`layoutPracticeOpening`).
 */
function cardItem(
  page: PracticeOpeningPage,
  description: FlowItem[],
  fonts: ResolvedBookFonts,
  gapAfter: number,
): FlowItem {
  const { colors } = coalaTheme;
  const innerWidth = CARD.width - CARD.paddingX * 2;
  const titleHeight = measureText(page.title, {
    fontSize: TYPOGRAPHY.sectionTitle,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.global,
  });
  const descriptionHeight = description.reduce(
    (sum, item, index) =>
      sum + item.height + (index === description.length - 1 ? 0 : item.gapAfter),
    0,
  );
  const height =
    CARD.paddingTop +
    BADGE.height +
    CARD.afterBadges +
    titleHeight +
    CARD.afterTitle +
    descriptionHeight +
    CARD.paddingBottom;

  return {
    height,
    gapAfter,
    render: (top): ElementAtPoint[] => {
      const titleTop = top + CARD.paddingTop + BADGE.height + CARD.afterBadges;
      let cursor = titleTop + titleHeight + CARD.afterTitle;
      const descriptionElements = description.flatMap((item) => {
        const drawn = item.render(cursor);
        cursor += item.height + item.gapAfter;
        return drawn;
      });
      return [
        createVectorShape({
          left: CARD.left,
          top,
          width: CARD.width,
          height,
          path: roundedRectPath(CARD.width, height, CARD.radius),
          fill: colors.cardFill,
          stroke: colors.softBorder,
          strokeWeight: 2,
        }),
        ...badgeElements(page, fonts, top + CARD.paddingTop),
        createRichText({
          left: CARD.left + CARD.paddingX,
          top: titleTop,
          width: innerWidth,
          text: page.title,
          fontRef: fonts.fontRef,
          fontSize: TYPOGRAPHY.sectionTitle,
          role: "sectionTitle",
          fontWeight: fonts.boldWeight,
          color: colors.text,
          lineHeightEm: LINE_HEIGHT.global,
        }),
        ...descriptionElements,
      ];
    },
  };
}

/** 설명 조각을 카드 한 장에 들어가는 만큼씩 나눈다. */
function chunkDescription(
  page: PracticeOpeningPage,
  items: readonly FlowItem[],
  fonts: ResolvedBookFonts,
  available: number,
): FlowItem[][] {
  const chunks: FlowItem[][] = [];
  let current: FlowItem[] = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (
      current.length > 0 &&
      cardItem(page, candidate, fonts, 0).height > available
    ) {
      chunks.push(current);
      current = [item];
      continue;
    }
    current = candidate;
  }
  chunks.push(current);
  return chunks;
}

/**
 * practice-opening 페이지를 만든다.
 *
 * 카드 아래에는 Tip 하나 또는 실습 목표 하나만 온다(스킬 규칙). 목표 개수
 * 제한은 없고, 들어가지 않으면 `제목(계속)` 페이지로 넘어간다.
 */
export function layoutPracticeOpening(
  page: PracticeOpeningPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  const wide = bodyStyle(fonts, { width: CONTENT_WIDTH });
  const inner = bodyStyle(fonts, {
    left: CARD.left + CARD.paddingX,
    width: CARD.width - CARD.paddingX * 2,
  });
  const available = PAGE.safeBottom - CARD.top;

  const description = blockFlowItems(parseBlocks(page.description), inner, {
    maxItemHeight: available,
  });
  const chunks = chunkDescription(page, description, fonts, available);
  const cards = chunks.map((chunk) => cardItem(page, chunk, fonts, GAP.callout));
  const items: FlowItem[] = [...cards];

  if (page.support?.type === "tip") {
    items.push(
      calloutItem({ type: "tip", text: page.support.text }, fonts, {
        gapAfter: 0,
      }),
    );
  } else if (page.support?.type === "objectives") {
    items.push(
      headingItem("📑 실습 목표", wide, { gapAfter: GAP.afterHeading }),
      ...blockFlowItems(
        [
          {
            kind: "list",
            ordered: false,
            items: page.support.items.map((item) => parseInline(item)),
          },
        ],
        bodyStyle(fonts, { width: CONTENT_WIDTH }),
        { maxItemHeight: available, listGap: GAP.objectiveItem },
      ),
    );
  } else {
    const last = items[items.length - 1];
    if (last) {
      last.gapAfter = 0;
    }
  }

  // 카드는 원본과 같은 y에서 시작한다. 연속 페이지도 같다.
  const pages = flowIntoPages(items, {
    top: CARD.top,
    bottom: PAGE.safeBottom,
  });

  return pages.map((placed, index) => {
    // 카드로 시작하는 페이지는 배지가 어느 실습인지 알려 주므로 `(계속)`
    // 제목을 따로 두지 않는다. 목표 목록만 넘어온 페이지에는 붙인다.
    const startsWithCard = cards.includes(placed[0]?.item as FlowItem);
    return {
      title: continuedTitle(`실습 ${page.practiceId}. ${page.title}`, index),
      elements:
        index === 0 || startsWithCard
          ? renderPlaced(placed)
          : renderPlaced(withContinuationHeading(placed, page.title, wide)),
    };
  });
}
