import type {
  Bounds,
  GroupContentAtPoint,
  GroupElementAtPoint,
  RichtextElementAtPoint,
  ShapeElementAtPoint,
} from "@canva/design";
import { createRichtextRange } from "@canva/design";
import type { FontRef, FontWeightName } from "@canva/asset";
import type { InlineSegment } from "../parser/inline";
import type { Box } from "../utils/geometry";
import {
  guardFontSize,
  LETTER_SPACING_EM,
  LINE_HEIGHT,
  toCanvaFontSize,
} from "../theme/typography";

type ShapeOptions = Box & {
  path: string;
  fill?: string;
  /**
   * `true`면 사용자가 Canva에서 이 도형 위에 이미지를 끌어다 놓아 채움을
   * 바꿀 수 있다. 이미지 자리표시자만 켠다. 기본은 꺼짐.
   */
  dropTarget?: boolean;
  stroke?: string;
  strokeWeight?: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
};

type RichTextOptions = Pick<Box, "left" | "top" | "width"> & {
  /** 평문. `segments`를 주면 무시된다. */
  text?: string;
  /** `**강조**`를 나눠 둔 구간. 일부 구간만 다른 서식을 받는다. */
  segments?: readonly InlineSegment[];
  /**
   * 생략하면 fontRef를 지정하지 않는다. RichtextFormatting.fontRef는 선택
   * 항목이라, 생략하면 Canva가 디자인 기본 글꼴을 쓴다. 글꼴을 찾지 못했다고
   * 해서 텍스트 생성을 포기하지 않기 위한 경로다.
   */
  fontRef?: FontRef;
  /**
   * 글자 크기(**편집기 pt**). `src/theme/typography.ts`의 TYPOGRAPHY 값만
   * 들어온다. SDK에 넘기기 직전에 `toCanvaFontSize()`로 px로 바꾸는 것이
   * 이 값에 닿는 유일한 산술이다.
   */
  fontSize: number;
  /** 크기 하한 검사에 쓰는 역할 이름. TYPOGRAPHY의 키와 같다. */
  role: string;
  color: string;
  fontWeight: FontWeightName;
  /** 강조 구간에 입힐 굵기. 지정하지 않으면 강조를 굵게 만들지 않는다. */
  emphasisWeight?: FontWeightName;
  /** 강조 구간에 입힐 색. */
  emphasisColor?: string;
  textAlign?: "start" | "center" | "end" | "justify";
  lineHeightEm?: number;
  letterSpacingEm?: number;
};

export function createVectorShape({
  left,
  top,
  width,
  height,
  path,
  fill,
  dropTarget = false,
  stroke,
  strokeWeight = 0,
  viewBoxWidth = width,
  viewBoxHeight = height,
}: ShapeOptions): ShapeElementAtPoint {
  return {
    type: "shape",
    left,
    top,
    width,
    height,
    viewBox: { left: 0, top: 0, width: viewBoxWidth, height: viewBoxHeight },
    paths: [
      {
        d: path,
        fill: { dropTarget, color: fill },
        stroke:
          stroke && strokeWeight > 0
            ? { color: stroke, weight: strokeWeight, strokeAlign: "inset" }
            : undefined,
      },
    ],
  };
}

/**
 * richtext 요소 하나를 만든다.
 *
 * 크기는 문단 서식(`formatParagraph`)으로 한 번만 정한다. 강조 구간은
 * `formatText`로 굵기와 색만 덮어쓴다. `InlineFormatting`에는 `fontSize`가
 * 없으므로 **강조를 입혀도 크기는 절대 바뀌지 않는다.**
 */
export function createRichText({
  left,
  top,
  width,
  text,
  segments,
  fontRef,
  fontSize,
  role,
  color,
  fontWeight,
  emphasisWeight,
  emphasisColor,
  textAlign = "start",
  lineHeightEm = LINE_HEIGHT.global,
  letterSpacingEm = LETTER_SPACING_EM,
}: RichTextOptions): RichtextElementAtPoint {
  guardFontSize(role, fontSize);
  // 편집기 툴바에 `fontSize`pt가 그대로 찍히도록 px로 바꿔 보낸다.
  const canvaFontSize = toCanvaFontSize(fontSize);

  const parts: readonly InlineSegment[] =
    segments && segments.length > 0
      ? segments
      : [{ text: text ?? "", emphasis: false }];

  const range = createRichtextRange();
  const emphasised: Bounds[] = [];
  let cursor = 0;
  for (const part of parts) {
    if (part.text.length === 0) {
      continue;
    }
    range.appendText(part.text);
    if (part.emphasis) {
      emphasised.push({ index: cursor, length: part.text.length });
    }
    cursor += part.text.length;
  }

  range.formatParagraph(
    { index: 0, length: Math.max(cursor, 1) },
    {
      color,
      // 값이 없을 때 키 자체를 넘기지 않는다. undefined를 실어 보내는 것과
      // 지정하지 않는 것을 SDK가 다르게 볼 여지를 남기지 않는다.
      ...(fontRef ? { fontRef } : {}),
      fontSize: canvaFontSize,
      fontWeight,
      textAlign,
      lineHeightEm,
      letterSpacingEm,
    },
  );

  // 문단 서식 다음에 적용해야 강조 구간의 굵기와 색이 남는다.
  for (const bounds of emphasised) {
    range.formatText(bounds, {
      ...(emphasisWeight ? { fontWeight: emphasisWeight } : {}),
      ...(emphasisColor ? { color: emphasisColor } : {}),
    });
  }

  return { type: "richtext", range, left, top, width };
}

export function createEditableGroup(
  box: Box,
  children: GroupContentAtPoint[],
): GroupElementAtPoint {
  if (children.length < 2) {
    throw new Error("A Canva group must contain at least two elements.");
  }
  return { type: "group", ...box, children };
}
