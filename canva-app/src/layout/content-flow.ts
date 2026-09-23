import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { ContentBlock } from "../parser/blocks";
import type { InlineSegment } from "../parser/inline";
import { plainText } from "../parser/inline";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import {
  BULLET_INDENT,
  GAP,
  LIST_MARKER_OFFSET,
  PAGE,
} from "../theme/page-layout";
import { createRichText } from "../builder/element-factory";
import type { FlowItem, PlacedItem } from "./flow";
import { imagePlaceholderItem } from "./image-placeholder";
import { lineHeight, measureText } from "./measure";
import { promptItem, responseItems } from "./prompt-response";

/**
 * Markdown 블록을 세로 흐름 조각으로 바꾼다.
 *
 * 문단, 목록, 목록 항목이 각각 별개의 Canva 요소가 된다. 하나의 긴 텍스트
 * 상자로 합치지 않는다.
 */
export type FlowStyle = {
  fonts: ResolvedBookFonts;
  /** 텍스트 왼쪽 시작점. */
  left: number;
  /** 텍스트가 흐르는 폭. */
  width: number;
  /** 본문 색. 기본은 교재 검정. */
  color?: string;
};

const { colors } = coalaTheme;

/** 본문 두 줄 높이. 제목이 페이지 하단에 홀로 남지 않게 하는 기준. */
export function twoBodyLines(): number {
  return lineHeight(TYPOGRAPHY.body, LINE_HEIGHT.global) * 2;
}

/** 문단 하나를 조각으로 만든다. 강조 구간은 굵기와 색만 바뀐다. */
function paragraphItem(
  segments: readonly InlineSegment[],
  style: FlowStyle,
  gapAfter: number,
): FlowItem {
  const height = measureText(plainText(segments), {
    fontSize: TYPOGRAPHY.body,
    width: style.width,
    lineHeightEm: LINE_HEIGHT.global,
  });
  return {
    height,
    gapAfter,
    render: (top) => [
      createRichText({
        left: style.left,
        top,
        width: style.width,
        segments,
        fontRef: style.fonts.fontRef,
        fontSize: TYPOGRAPHY.body,
        role: "body",
        fontWeight: style.fonts.regularWeight,
        color: style.color ?? colors.text,
        emphasisWeight: style.fonts.boldWeight,
        emphasisColor: colors.primary,
        lineHeightEm: LINE_HEIGHT.global,
      }),
    ],
  };
}

/**
 * 목록 항목 하나. 기호와 본문이 별개의 요소이고 간격은 항상 같다.
 *
 * 항목 하나는 통째로 한 페이지에 들어간다. 페이지 사이에서 잘리지 않는다.
 */
function listItem(
  segments: readonly InlineSegment[],
  marker: string,
  style: FlowStyle,
  gapAfter: number,
  options: { fontSize: number; lineHeightEm: number; role: string },
): FlowItem {
  const textWidth = style.width - BULLET_INDENT;
  const height = measureText(plainText(segments), {
    fontSize: options.fontSize,
    width: textWidth,
    lineHeightEm: options.lineHeightEm,
  });
  return {
    height,
    gapAfter,
    render: (top): ElementAtPoint[] => [
      createRichText({
        left: style.left + LIST_MARKER_OFFSET,
        top,
        width: BULLET_INDENT - LIST_MARKER_OFFSET,
        text: marker,
        fontRef: style.fonts.fontRef,
        fontSize: options.fontSize,
        role: options.role,
        fontWeight: style.fonts.regularWeight,
        color: colors.primary,
        lineHeightEm: options.lineHeightEm,
      }),
      createRichText({
        left: style.left + BULLET_INDENT,
        top,
        width: textWidth,
        segments,
        fontRef: style.fonts.fontRef,
        fontSize: options.fontSize,
        role: options.role,
        fontWeight: style.fonts.regularWeight,
        color: style.color ?? colors.text,
        emphasisWeight: style.fonts.boldWeight,
        emphasisColor: colors.primary,
        lineHeightEm: options.lineHeightEm,
      }),
    ],
  };
}

/** 섹션 제목 조각. 뒤따르는 본문 두 줄을 붙잡는다. */
export function headingItem(
  text: string,
  style: FlowStyle,
  options: { fontSize?: number; color?: string; gapAfter?: number } = {},
): FlowItem {
  const fontSize = options.fontSize ?? TYPOGRAPHY.sectionTitle;
  return {
    height: measureText(text, {
      fontSize,
      width: style.width,
      lineHeightEm: LINE_HEIGHT.global,
    }),
    gapAfter: options.gapAfter ?? GAP.afterHeading,
    keepWithNext: twoBodyLines(),
    render: (top) => [
      createRichText({
        left: style.left,
        top,
        width: style.width,
        text,
        fontRef: style.fonts.fontRef,
        fontSize,
        role: "sectionTitle",
        fontWeight: style.fonts.boldWeight,
        color: options.color ?? colors.primary,
        lineHeightEm: LINE_HEIGHT.global,
      }),
    ],
  };
}

/**
 * 문단을 문장 단위로 쪼갠다.
 *
 * 한 문단이 페이지 하나보다 길 때만 쓴다. 줄 중간이 아니라 문장 경계에서
 * 끊어야 Canva에서 이어서 편집하기 자연스럽다.
 */
function splitIntoSentences(
  segments: readonly InlineSegment[],
): InlineSegment[][] {
  const sentences: InlineSegment[][] = [];
  let current: InlineSegment[] = [];

  for (const segment of segments) {
    const pieces = segment.text.match(/[^.!?]*[.!?]+["'”’)\]]*\s*|[^.!?]+$/g);
    for (const piece of pieces ?? [segment.text]) {
      if (piece.length === 0) {
        continue;
      }
      current.push({ text: piece, emphasis: segment.emphasis });
      if (/[.!?]["'”’)\]]*\s*$/.test(piece)) {
        sentences.push(current);
        current = [];
      }
    }
  }
  if (current.length > 0) {
    sentences.push(current);
  }
  return sentences.length > 0 ? sentences : [[...segments]];
}

/**
 * 한 페이지에 들어가지 않는 문단을 들어가는 크기로 나눈다.
 *
 * **글자를 줄이는 대신** 문장 단위로 나눠 다음 페이지로 넘기기 위한 것이다.
 */
function paragraphItems(
  segments: readonly InlineSegment[],
  style: FlowStyle,
  gapAfter: number,
  maxHeight: number,
): FlowItem[] {
  const whole = paragraphItem(segments, style, gapAfter);
  if (whole.height <= maxHeight) {
    return [whole];
  }

  const sentences = splitIntoSentences(segments);
  const groups: InlineSegment[][] = [];
  let group: InlineSegment[] = [];

  const groupHeight = (candidate: InlineSegment[]) =>
    measureText(plainText(candidate), {
      fontSize: TYPOGRAPHY.body,
      width: style.width,
      lineHeightEm: LINE_HEIGHT.global,
    });

  for (const sentence of sentences) {
    const candidate = [...group, ...sentence];
    if (group.length > 0 && groupHeight(candidate) > maxHeight) {
      groups.push(group);
      group = [...sentence];
      continue;
    }
    group = candidate;
  }
  if (group.length > 0) {
    groups.push(group);
  }

  return groups.map((piece, index) =>
    paragraphItem(
      piece,
      style,
      index === groups.length - 1 ? gapAfter : GAP.paragraph,
    ),
  );
}

/** 순서 없는 목록의 기호. 순서 있는 목록은 번호를 쓴다. */
const DISC = "•";

/** 글(문단·목록) 다음에 `next` 블록이 올 때의 여백. 마지막이면 0. */
function gapBefore(next: ContentBlock | undefined, isLast: boolean): number {
  if (isLast || !next) {
    return 0;
  }
  switch (next.kind) {
    case "image":
      return GAP.beforeImage;
    case "prompt":
      return GAP.beforePrompt;
    case "list":
      return GAP.beforeList;
    default:
      return GAP.paragraph;
  }
}

export type BlockFlowOptions = {
  /** 한 조각이 넘을 수 없는 높이. 보통 안전 영역 전체 높이. */
  maxItemHeight: number;
  /** 목록·문단에 쓸 글자 크기. 기본은 본문 크기. */
  fontSize?: number;
  /** 목록 줄 간격. */
  listLineHeightEm?: number;
  /** 목록 항목 사이 여백. */
  listGap?: number;
  /** 역할 이름. 크기 하한 검사에 쓴다. */
  role?: string;
};

/** 블록 목록 전체를 흐름 조각으로 바꾼다. */
export function blockFlowItems(
  blocks: readonly ContentBlock[],
  style: FlowStyle,
  options: BlockFlowOptions,
): FlowItem[] {
  const items: FlowItem[] = [];

  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    const isLast = index === blocks.length - 1;

    if (block.kind === "image") {
      items.push(
        imagePlaceholderItem(block.image, style, {
          gapAfter: isLast ? 0 : GAP.afterImage,
          maxHeight: options.maxItemHeight,
        }),
      );
      return;
    }

    if (block.kind === "prompt") {
      items.push(promptItem(block.text, style));
      return;
    }

    if (block.kind === "response") {
      // 프롬프트 상자는 응답 상자와 함께 넘어가므로, 첫 응답 상자는 프롬프트
      // 상자와 같은 페이지에 들어갈 수 있는 높이여야 한다.
      const prompt = items[items.length - 1];
      const promptShare =
        blocks[index - 1]?.kind === "prompt" && prompt
          ? prompt.height + prompt.gapAfter
          : 0;
      items.push(
        ...responseItems(block.markdown, style, {
          gapAfter: isLast ? 0 : GAP.afterResponse,
          maxHeight: options.maxItemHeight - promptShare,
        }),
      );
      return;
    }

    if (block.kind === "paragraph") {
      // 문단 다음에 목록이 오면, 그 문단은 목록을 이끄는 도입 문장이다.
      items.push(
        ...paragraphItems(
          block.segments,
          style,
          gapBefore(next, isLast),
          options.maxItemHeight,
        ),
      );
      return;
    }

    const fontSize = options.fontSize ?? TYPOGRAPHY.bullet;
    const listLineHeightEm = options.listLineHeightEm ?? LINE_HEIGHT.global;
    const itemGap = options.listGap ?? GAP.listItem;
    block.items.forEach((segments, itemIndex) => {
      const lastItem = itemIndex === block.items.length - 1;
      items.push(
        listItem(
          segments,
          block.ordered ? `${itemIndex + 1}.` : DISC,
          style,
          lastItem
            ? next?.kind === "image" || next?.kind === "prompt"
              ? gapBefore(next, isLast)
              : isLast
                ? 0
                : GAP.afterList
            : itemGap,
          {
            fontSize,
            lineHeightEm: listLineHeightEm,
            role: options.role ?? "bullet",
          },
        ),
      );
    });
  });

  return items;
}

/** 목록이 아닌 한 줄짜리 안내문 등을 조각으로 만든다. */
export function textItem(
  text: string,
  style: FlowStyle,
  options: {
    fontSize: number;
    role: string;
    gapAfter: number;
    lineHeightEm?: number;
    bold?: boolean;
    color?: string;
    keepWithNext?: number;
  },
): FlowItem {
  const lineHeightEm = options.lineHeightEm ?? LINE_HEIGHT.global;
  return {
    height: measureText(text, {
      fontSize: options.fontSize,
      width: style.width,
      lineHeightEm,
    }),
    gapAfter: options.gapAfter,
    ...(options.keepWithNext ? { keepWithNext: options.keepWithNext } : {}),
    render: (top) => [
      createRichText({
        left: style.left,
        top,
        width: style.width,
        text,
        fontRef: style.fonts.fontRef,
        fontSize: options.fontSize,
        role: options.role,
        fontWeight: options.bold
          ? style.fonts.boldWeight
          : style.fonts.regularWeight,
        color: options.color ?? style.color ?? colors.text,
        lineHeightEm,
      }),
    ],
  };
}

/**
 * 연속 페이지 맨 위에 `제목(계속)`을 놓고 나머지를 그 아래로 민다.
 *
 * 조각 사이의 간격은 처음 계산한 그대로 유지되고, 글자 크기는 첫 페이지와
 * 같다. 연속 페이지라고 해서 작아지는 곳이 없다.
 */
export function withContinuationHeading(
  placed: readonly PlacedItem[],
  title: string,
  style: FlowStyle,
): PlacedItem[] {
  const heading = headingItem(`${title}(계속)`, style, {
    gapAfter: GAP.afterHeading,
  });
  const first = placed[0];
  if (!first) {
    return [{ item: heading, top: PAGE.safeTop }];
  }
  const offset = PAGE.safeTop + heading.height + heading.gapAfter - first.top;
  return [
    { item: heading, top: PAGE.safeTop },
    ...placed.map(({ item, top }) => ({ item, top: top + offset })),
  ];
}
