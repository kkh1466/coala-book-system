import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { Callout, ContentSection } from "../types/book-spec";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import {
  CALLOUT_PADDING,
  CONTENT_WIDTH,
  GAP,
  PAGE,
  PAGE_NUMBER,
} from "../theme/page-layout";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import { parseBlocks } from "../parser/blocks";
import { parseInline, plainText } from "../parser/inline";
import type { FlowItem } from "../layout/flow";
import { measureText } from "../layout/measure";
import type { FlowStyle } from "../layout/content-flow";

/**
 * 렌더러가 더 이상 쓰지 않는 오류.
 *
 * 내용이 많다는 이유로 페이지 생성을 거절하던 시절의 타입이다. 지금은 분량이
 * 넘치면 페이지를 나누므로 레이아웃 때문에 던지는 곳이 없다. 표처럼 구조상
 * 한 페이지에 담아야 하는 요소가 물리적으로 불가능할 때만 남는다.
 */
export class PageContentTooDenseError extends Error {
  constructor(pageId: string, guidance: string) {
    super(
      `페이지 '${pageId}'의 내용이 현재 템플릿 용량을 초과합니다. ${guidance}`,
    );
    this.name = "PageContentTooDenseError";
  }
}

/** 연속 페이지의 제목. 두 번째 조각부터 `(계속)`이 붙는다. */
export function continuedTitle(title: string, partIndex: number): string {
  return partIndex === 0 ? title : `${title}(계속)`;
}

export function buildPageNumber(
  pageNumber: string | undefined,
  fonts: ResolvedBookFonts,
): ElementAtPoint[] {
  if (!pageNumber) {
    return [];
  }
  return [
    createRichText({
      left: PAGE_NUMBER.right - PAGE_NUMBER.width,
      top: PAGE_NUMBER.top,
      width: PAGE_NUMBER.width,
      text: pageNumber,
      fontRef: fonts.fontRef,
      fontSize: TYPOGRAPHY.pageNumber,
      role: "pageNumber",
      fontWeight: fonts.regularWeight,
      color: coalaTheme.colors.secondaryText,
      textAlign: "end",
      lineHeightEm: LINE_HEIGHT.single,
    }),
  ];
}

/**
 * 섹션의 Markdown 원문을 돌려준다.
 *
 * Markdown 원고에서 온 페이지는 `content`에 구조가 그대로 남아 있다. JSON으로
 * 직접 작성한 원고에는 없으므로 `body`와 `bullets`로 같은 구조를 복원한다.
 */
export function sectionMarkdown(section: ContentSection): string {
  if (section.content && section.content.trim().length > 0) {
    return section.content;
  }
  const parts: string[] = [];
  if (section.body) {
    parts.push(section.body);
  }
  if (section.bullets && section.bullets.length > 0) {
    parts.push(section.bullets.map((item) => `- ${item}`).join("\n"));
  }
  return parts.join("\n\n");
}

const CALLOUT_LABEL = {
  tip: "💡 Tip",
  "key-point": "📑 핵심 정리",
} as const;

/**
 * Tip / 핵심 정리 박스.
 *
 * 박스는 페이지 중간에서 잘리지 않는다. 통째로 한 페이지에 들어가거나 통째로
 * 다음 페이지로 넘어간다. 높이는 안쪽 글의 실제 줄 수로 계산하므로 내용이
 * 짧다고 빈 박스가 남지 않는다.
 */
export function calloutItem(
  callout: Callout,
  fonts: ResolvedBookFonts,
  options: { left?: number; width?: number; gapAfter?: number } = {},
): FlowItem {
  const left = options.left ?? PAGE.marginX;
  const width = options.width ?? CONTENT_WIDTH;
  const innerWidth = width - CALLOUT_PADDING.x * 2;
  const label = CALLOUT_LABEL[callout.type];
  // 강조 박스 안에는 이미지 자리를 둘 수 없다. 원고 파서가 먼저 거절한다.
  const blocks = parseBlocks(callout.text).filter(
    (block): block is Exclude<typeof block, { kind: "image" }> =>
      block.kind !== "image",
  );
  const bodyText = blocks
    .map((block) =>
      block.kind === "paragraph"
        ? plainText(block.segments)
        : block.items.map((item) => `• ${plainText(item)}`).join("\n"),
    )
    .join("\n");

  const titleHeight = measureText(label, {
    fontSize: TYPOGRAPHY.calloutTitle,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.global,
  });
  const bodyHeight = measureText(bodyText, {
    fontSize: TYPOGRAPHY.calloutBody,
    width: innerWidth,
    lineHeightEm: LINE_HEIGHT.global,
  });
  const height =
    CALLOUT_PADDING.top +
    titleHeight +
    CALLOUT_PADDING.afterTitle +
    bodyHeight +
    CALLOUT_PADDING.bottom;

  const fill =
    callout.type === "tip"
      ? coalaTheme.colors.tipFill
      : coalaTheme.colors.keySummaryFill;

  return {
    height,
    gapAfter: options.gapAfter ?? GAP.callout,
    render: (top) => [
      createVectorShape({
        left,
        top,
        width,
        height,
        path: roundedRectPath(width, height, 24),
        fill,
      }),
      createRichText({
        left: left + CALLOUT_PADDING.x,
        top: top + CALLOUT_PADDING.top,
        width: innerWidth,
        text: label,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.calloutTitle,
        role: "calloutTitle",
        fontWeight: fonts.boldWeight,
        color: coalaTheme.colors.primary,
        lineHeightEm: LINE_HEIGHT.global,
      }),
      createRichText({
        left: left + CALLOUT_PADDING.x,
        top: top + CALLOUT_PADDING.top + titleHeight + CALLOUT_PADDING.afterTitle,
        width: innerWidth,
        segments: parseInline(bodyText),
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.calloutBody,
        role: "calloutBody",
        fontWeight: fonts.regularWeight,
        color: coalaTheme.colors.text,
        emphasisWeight: fonts.boldWeight,
        emphasisColor: coalaTheme.colors.primary,
        lineHeightEm: LINE_HEIGHT.global,
      }),
    ],
  };
}

/** 본문이 흐르는 기본 스타일. */
export function bodyStyle(
  fonts: ResolvedBookFonts,
  overrides: Partial<FlowStyle> = {},
): FlowStyle {
  return {
    fonts,
    left: PAGE.marginX,
    width: CONTENT_WIDTH,
    ...overrides,
  };
}
