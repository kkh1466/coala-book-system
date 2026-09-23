import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { GuideStep } from "../types/book-spec";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import {
  CONTENT_WIDTH,
  GAP,
  PAGE,
  STEP_CARD,
  TEXT_WIDTH,
} from "../theme/page-layout";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import type { ContentBlock } from "../parser/blocks";
import { parseBlocks } from "../parser/blocks";
import type { FlowItem } from "../layout/flow";
import { flowIntoPages, pendingImagesOf, renderPlaced } from "../layout/flow";
import {
  continuationInset,
  continuationReserve,
} from "../layout/image-placeholder";
import { measureText } from "../layout/measure";
import {
  blockFlowItems,
  headingItem,
  withContinuationHeading,
} from "../layout/content-flow";
import type { PagePart } from "./page-part";
import { PageContentTooDenseError, bodyStyle, continuedTitle } from "./shared";

/**
 * STEP 카드 페이지의 공용 배치.
 *
 * 원본 process-steps.png의 구조다. 단계마다 흰 카드 하나이고, 카드 안에
 * "STEP n. 동작" 제목과 본문(문단·목록, 필요하면 캡처 자리)이 위에서 아래로
 * 놓인다. 카드 사이에는 아래쪽 화살표가 있다.
 *
 * `screenshot-guide`(단계마다 캡처 필수)와 `step-process`(글만)가 함께 쓴다.
 * 무엇을 담을 수 있는지는 원고 파서가 페이지 종류별로 거절하므로 여기서는
 * 들어온 블록을 그대로 놓는다.
 *
 * 카드는 페이지 경계에서 잘리지 않는다. 들어가지 않으면 통째로 다음 페이지로
 * 넘어가고, 그때는 앞 단계에서 이어짐을 보이도록 화살표가 카드 위에 그대로
 * 그려진다. 글자 크기는 어느 카드에서도 같다.
 */
const { colors } = coalaTheme;

const INNER_WIDTH = CONTENT_WIDTH - STEP_CARD.paddingX * 2;

/** 카드 사이 간격 안에 가운데 놓이는 아래쪽 화살표. */
function arrowPath(): string {
  const { width, height, shaftWidth, shaftHeight } = STEP_CARD.arrow;
  const shaftLeft = (width - shaftWidth) / 2;
  return [
    `M ${shaftLeft} 0`,
    `H ${shaftLeft + shaftWidth}`,
    `V ${shaftHeight}`,
    `H ${width}`,
    `L ${width / 2} ${height}`,
    `L 0 ${shaftHeight}`,
    `H ${shaftLeft}`,
    "Z",
  ].join(" ");
}

function arrowElement(top: number): ElementAtPoint {
  const { width, height } = STEP_CARD.arrow;
  return createVectorShape({
    left: PAGE.marginX + Math.round((CONTENT_WIDTH - width) / 2),
    top: top + Math.round((STEP_CARD.gap - height) / 2),
    width,
    height,
    path: arrowPath(),
    fill: colors.connector,
  });
}

/**
 * 단계 하나 = 카드 하나.
 *
 * 첫 단계가 아니면 카드 위에 화살표 몫(`STEP_CARD.gap`)이 붙는다. 그래서 카드가
 * 다음 페이지로 넘어가도 화살표가 함께 간다.
 *
 * `maxHeight`는 화살표까지 포함해 이 조각이 놓일 수 있는 높이다. 캡처 자리는
 * 제목·지시문을 놓고 남는 높이에 맞춰 비율을 지킨 채 줄어든다.
 */
function stepCardItem(
  step: GuideStep,
  stepNumber: number,
  fonts: ResolvedBookFonts,
  options: { withArrow: boolean; maxHeight: number; pageId: string },
): FlowItem {
  const arrowShare = options.withArrow ? STEP_CARD.gap : 0;
  const title = `STEP ${stepNumber}. ${step.title}`;
  const titleHeight = measureText(title, {
    fontSize: TYPOGRAPHY.subsectionTitle,
    width: INNER_WIDTH,
    lineHeightEm: LINE_HEIGHT.global,
  });
  const chrome =
    STEP_CARD.paddingTop +
    titleHeight +
    STEP_CARD.afterTitle +
    STEP_CARD.paddingBottom;
  const maxInner = Math.max(1, options.maxHeight - arrowShare - chrome);

  const innerStyle = bodyStyle(fonts, {
    left: PAGE.marginX + STEP_CARD.paddingX,
    width: INNER_WIDTH,
  });
  // 단계 안에는 문단, 목록, 캡처 자리만 온다. 원고 검사가 나머지를 거절한다.
  const blocks = parseBlocks(step.content).filter(
    (
      block,
    ): block is Extract<
      ContentBlock,
      { kind: "paragraph" | "list" | "image" }
    > =>
      block.kind === "paragraph" ||
      block.kind === "list" ||
      block.kind === "image",
  );
  // 먼저 글만 놓아 높이를 재고, 남는 높이를 캡처 자리에 준다.
  const textOnly = blockFlowItems(
    blocks.filter((block) => block.kind !== "image"),
    innerStyle,
    { maxItemHeight: maxInner },
  );
  const textHeight = textOnly.reduce(
    (sum, item) => sum + item.height + item.gapAfter,
    0,
  );
  const imageBudget = Math.max(
    1,
    maxInner - textHeight - GAP.beforeImage - GAP.afterImage,
  );
  // imagePlaceholderItem은 연속 페이지 제목의 몫을 스스로 빼므로, 여기서 정한
  // 예산이 그대로 캡처 자리의 상한이 되도록 그만큼을 더해서 넘긴다.
  const inner = blockFlowItems(blocks, innerStyle, {
    maxItemHeight: imageBudget + continuationReserve(),
  });
  const contentHeight = inner.reduce(
    (sum, item, index) =>
      sum + item.height + (index === inner.length - 1 ? 0 : item.gapAfter),
    0,
  );
  if (contentHeight > maxInner) {
    // 카드는 나눌 수 없다. 캡처 자리는 이미 지면에 맞게 줄었으므로 남은 원인은
    // 글의 분량뿐이다.
    throw new PageContentTooDenseError(
      options.pageId,
      `단계 '${step.title}'의 내용이 한 페이지에 들어가지 않습니다. 지시문을 줄이거나 단계를 나눠 주세요.`,
    );
  }
  const cardHeight = chrome + contentHeight;
  const pendingImage = inner.find((item) => item.pendingImage)?.pendingImage;

  return {
    height: arrowShare + cardHeight,
    gapAfter: 0,
    reservesContinuation: true,
    ...(pendingImage ? { pendingImage } : {}),
    render: (top): ElementAtPoint[] => {
      const cardTop = top + arrowShare;
      let cursor =
        cardTop + STEP_CARD.paddingTop + titleHeight + STEP_CARD.afterTitle;
      const body = inner.flatMap((item) => {
        const drawn = item.render(cursor);
        cursor += item.height + item.gapAfter;
        return drawn;
      });
      return [
        ...(options.withArrow ? [arrowElement(top)] : []),
        createVectorShape({
          left: PAGE.marginX,
          top: cardTop,
          width: CONTENT_WIDTH,
          height: cardHeight,
          path: roundedRectPath(CONTENT_WIDTH, cardHeight, STEP_CARD.radius),
          fill: colors.cardFill,
        }),
        createRichText({
          left: PAGE.marginX + STEP_CARD.paddingX,
          top: cardTop + STEP_CARD.paddingTop,
          width: INNER_WIDTH,
          text: title,
          fontRef: fonts.fontRef,
          fontSize: TYPOGRAPHY.subsectionTitle,
          role: "subsectionTitle",
          fontWeight: fonts.boldWeight,
          color: colors.text,
          lineHeightEm: LINE_HEIGHT.global,
        }),
        ...body,
      ];
    },
  };
}

/** STEP 카드 페이지가 공통으로 가진 내용. */
export type StepCardPage = {
  id: string;
  title: string;
  introduction?: string;
  steps: GuideStep[];
};

export function layoutStepCards(
  page: StepCardPage,
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
  }
  const last = items[items.length - 1];
  if (last) {
    last.gapAfter = STEP_CARD.beforeFirst;
  }
  const headerHeight = items.reduce(
    (sum, item) => sum + item.height + item.gapAfter,
    0,
  );

  // 연속 페이지는 `제목(계속)`만큼 본문이 아래로 밀린다. 카드는 지면 하나에
  // 가깝게 클 수 있으므로 그 몫을 항상 덜어 낸다.
  const inset = continuationInset(PAGE.safeTop, page.title, wide.width);
  const laterAvailable = maxItemHeight - inset;
  // 첫 카드는 페이지 제목·도입문과 같은 페이지에 놓이도록 그 아래 남는 높이에
  // 맞춘다. 도입문이 길어 남는 높이가 반도 안 되면 다음 페이지 기준을 쓴다.
  const firstAvailable = maxItemHeight - headerHeight;
  const firstMax =
    firstAvailable >= laterAvailable / 2 ? firstAvailable : laterAvailable;

  page.steps.forEach((step, index) => {
    items.push(
      stepCardItem(step, index + 1, fonts, {
        withArrow: index > 0,
        maxHeight: index === 0 ? firstMax : laterAvailable,
        pageId: page.id,
      }),
    );
  });

  const pages = flowIntoPages(
    items,
    { top: PAGE.safeTop, bottom: PAGE.safeBottom },
    { continuationInset: inset },
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
