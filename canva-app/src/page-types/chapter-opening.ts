import type { ElementAtPoint } from "@canva/design";
import type { ChapterOpeningPage } from "../types/book-spec";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { CONTENT_WIDTH, GAP, PAGE, TEXT_WIDTH } from "../theme/page-layout";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { circlePath, roundedRectPath } from "../utils/geometry";
import { parseBlocks } from "../parser/blocks";
import { parseInline } from "../parser/inline";
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
  textItem,
  twoBodyLines,
  withContinuationHeading,
} from "../layout/content-flow";
import type { PagePart } from "./page-part";
import { bodyStyle, continuedTitle } from "./shared";

/** 학습 목표를 여는 안내문. 원고에 없어도 항상 같은 문장을 쓴다. */
const OBJECTIVE_INTRO = "이 장을 학습한 후, 여러분은 다음을 할 수 있습니다.";

const HEADER = {
  /** 장 번호 원. */
  marker: { left: 175, top: 105, size: 112 },
  /** 제목 테두리. */
  left: 230,
  top: 170,
  width: 1195,
  radius: 34,
  stroke: 3,
  /** 테두리 안쪽 여백. 제목과 부제목이 테두리에 붙지 않게 한다. */
  paddingX: 95,
  paddingY: 24,
  /** 제목과 부제목 사이. */
  titleGap: 4,
} as const;

/**
 * 챕터 제목 영역.
 *
 * 그룹을 쓰지 않고 도형과 텍스트를 각각 최상위 요소로 놓는다. Canva의 그룹은
 * 자식의 실제 크기를 선언한 그룹 상자에 맞춰 **축소**하는데, richtext의 높이는
 * 편집기가 계산하므로 제목이 한 줄만 넘겨도 그룹 전체가 줄어들면서 글자가
 * 지정한 50pt보다 작게 그려진다. 그룹을 없애면 그 경로 자체가 사라진다.
 *
 * 테두리 높이는 제목과 부제목의 실제 높이로 계산하므로, 제목이 길어져 두 줄이
 * 되어도 글자가 줄지 않고 테두리가 늘어난다.
 */
function headerElements(
  page: ChapterOpeningPage,
  fonts: ResolvedBookFonts,
): { elements: ElementAtPoint[]; bottom: number } {
  const { colors } = coalaTheme;
  const innerWidth = HEADER.width - HEADER.paddingX * 2;

  const titleHeight = measureText(page.chapterTitle, {
    fontSize: TYPOGRAPHY.chapterTitle,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.chapterTitle,
  });
  const subtitleHeight = measureText(page.chapterSubtitle, {
    fontSize: TYPOGRAPHY.chapterSubtitle,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.chapterSubtitle,
  });
  const height =
    HEADER.paddingY * 2 + titleHeight + HEADER.titleGap + subtitleHeight;

  const titleTop = HEADER.top + HEADER.paddingY;
  const subtitleTop = titleTop + titleHeight + HEADER.titleGap;

  return {
    bottom: Math.max(
      HEADER.top + height,
      HEADER.marker.top + HEADER.marker.size,
    ),
    elements: [
      createVectorShape({
        left: HEADER.left,
        top: HEADER.top,
        width: HEADER.width,
        height,
        path: roundedRectPath(HEADER.width, height, HEADER.radius),
        stroke: colors.primary,
        strokeWeight: HEADER.stroke,
      }),
      createRichText({
        left: HEADER.left + HEADER.paddingX,
        top: titleTop,
        width: innerWidth,
        text: page.chapterTitle,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.chapterTitle,
        role: "chapterTitle",
        fontWeight: fonts.boldWeight,
        color: colors.text,
        lineHeightEm: LINE_HEIGHT.chapterTitle,
      }),
      createRichText({
        left: HEADER.left + HEADER.paddingX,
        top: subtitleTop,
        width: innerWidth,
        text: page.chapterSubtitle,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.chapterSubtitle,
        role: "chapterSubtitle",
        fontWeight: fonts.regularWeight,
        color: colors.secondaryText,
        lineHeightEm: LINE_HEIGHT.chapterSubtitle,
      }),
      // 장 번호 원은 테두리 위에 겹쳐 놓는다. 테두리보다 뒤에 두어야 가려지지
      // 않는다.
      createVectorShape({
        left: HEADER.marker.left,
        top: HEADER.marker.top,
        width: HEADER.marker.size,
        height: HEADER.marker.size,
        path: circlePath(HEADER.marker.size),
        fill: colors.primary,
      }),
      createRichText({
        left: HEADER.marker.left,
        top:
          HEADER.marker.top +
          (HEADER.marker.size -
            TYPOGRAPHY.chapterMarker * LINE_HEIGHT.single) /
            2,
        width: HEADER.marker.size,
        text: String(page.chapterNumber),
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.chapterMarker,
        role: "chapterMarker",
        fontWeight: fonts.boldWeight,
        color: "#FFFFFF",
        textAlign: "center",
        lineHeightEm: LINE_HEIGHT.single,
      }),
    ],
  };
}

/**
 * chapter-opening 페이지를 만든다.
 *
 * 첫 페이지에는 제목 영역과 학습 목표가 들어가고, 이어지는 본문이 안전 영역을
 * 넘으면 `제목(계속)` 페이지로 넘어간다. 어느 경우에도 글자 크기는 그대로다.
 */
export function layoutChapterOpening(
  page: ChapterOpeningPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  const { colors } = coalaTheme;
  const header = headerElements(page, fonts);
  const wide = bodyStyle(fonts, { width: CONTENT_WIDTH });
  const narrow = bodyStyle(fonts, { width: TEXT_WIDTH });
  const maxItemHeight = PAGE.safeBottom - PAGE.safeTop;

  const items: FlowItem[] = [
    headingItem("학습 목표", wide, { gapAfter: GAP.afterHeading }),
    textItem(OBJECTIVE_INTRO, narrow, {
      fontSize: TYPOGRAPHY.learningObjective,
      role: "learningObjective",
      gapAfter: GAP.afterObjectiveIntro,
      keepWithNext: twoBodyLines(),
    }),
    // 원고에 적힌 학습 목표를 하나도 빼지 않고, 항목마다 따로 그린다.
    ...blockFlowItems(
      [
        {
          kind: "list",
          ordered: false,
          items: page.learningObjectives.map((objective) =>
            parseInline(objective),
          ),
        },
      ],
      narrow,
      {
        maxItemHeight,
        fontSize: TYPOGRAPHY.learningObjective,
        listGap: GAP.objectiveItem,
        role: "learningObjective",
      },
    ),
  ];

  // 학습 목표가 끝나면 다음 섹션이 바로 이어진다. 남은 자리를 비워 두지 않는다.
  const last = items[items.length - 1];
  if (last) {
    last.gapAfter = GAP.beforeHeading;
  }

  items.push(
    headingItem(page.subsectionTitle, wide, { color: colors.primary }),
    ...blockFlowItems(parseBlocks(page.body), narrow, { maxItemHeight }),
  );

  const flowTop = header.bottom + GAP.beforeHeading;
  // 이미지 자리가 있는 페이지만 연속 페이지 제목의 몫을 미리 덜어 낸다.
  // 이미지가 없으면 옵션을 넘기지 않으므로 배치는 이전과 똑같다.
  const hasImage = items.some((item) => item.pendingImage);
  const pages = flowIntoPages(
    items,
    { top: flowTop, bottom: PAGE.safeBottom },
    hasImage
      ? {
          continuationInset: continuationInset(
            flowTop,
            page.subsectionTitle,
            wide.width,
          ),
        }
      : undefined,
  );

  return pages.map((placed, index) => ({
    ...(pendingImagesOf(placed).length > 0
      ? { pendingImages: pendingImagesOf(placed) }
      : {}),
    title: continuedTitle(
      `${page.chapterNumber}. ${page.chapterTitle}`,
      index,
    ),
    elements:
      index === 0
        ? [...header.elements, ...renderPlaced(placed)]
        : [
            // 연속 페이지는 제목 영역 없이, 어디에서 이어지는지 알려 주는
            // 제목부터 시작한다.
            ...renderPlaced(
              withContinuationHeading(placed, page.subsectionTitle, wide),
            ),
          ],
  }));
}
