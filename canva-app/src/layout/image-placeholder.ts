import type { ElementAtPoint } from "@canva/design";
import type { ImageDirective } from "../parser/image-directive";
import type { InlineSegment } from "../parser/inline";
import { coalaTheme } from "../theme/coala-theme";
import { CODE_BOX, CONTENT_WIDTH, GAP, PAGE } from "../theme/page-layout";
import { RESULT_LABEL } from "../parser/code-result";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { createRichText, createVectorShape } from "../builder/element-factory";
import type { FlowStyle } from "./content-flow";
import type { FlowItem } from "./flow";
import { lineHeight, measureText } from "./measure";

/**
 * 이미지 자리표시자.
 *
 * 원고가 선언한 비율만큼 자리를 **정확히** 비워 둔다. 자리는 `dropTarget`이
 * 켜진 도형이라, Canva에서 이미지를 그 위에 끌어다 놓으면 도형의 채움이
 * 이미지로 바뀐다. 도형의 위치와 크기는 그대로이므로 나머지 지면은 움직이지
 * 않는다.
 *
 * Canva는 놓인 이미지를 도형에 맞춰 채운다(넘치는 쪽은 잘린다). 그래서 원고에
 * 적는 `ratio`가 곧 최종 이미지의 비율이어야 한다.
 */
const LABEL_PADDING = { x: 40, y: 24 } as const;

/**
 * 연속 페이지 맨 위에 놓이는 `제목(계속)`의 몫.
 *
 * 자리 하나가 지면보다 크면 나눌 수 없으므로 줄여서 넣는다. 그 상한을 잡을 때
 * 연속 페이지 제목(두 줄까지)이 차지할 높이를 미리 빼 둔다.
 */
export function continuationReserve(): number {
  return (
    lineHeight(TYPOGRAPHY.sectionTitle, LINE_HEIGHT.global) * 2 +
    GAP.afterHeading
  );
}

/** 모서리가 곧은 사각형. 화면 캡처의 모서리를 깎지 않는다. */
function rectPath(width: number, height: number): string {
  return `M 0 0 H ${width} V ${height} H 0 Z`;
}

function fileName(src: string): string {
  return src.split("/").pop() || src;
}

/** 자리 안에 들어가는 가장 자세한 라벨을 고른다. 하나도 안 들어가면 없음. */
function pickLabel(
  image: ImageDirective,
  innerWidth: number,
  innerHeight: number,
): InlineSegment[] | undefined {
  const heading: InlineSegment = { text: "🖼 이미지 자리", emphasis: true };
  const file = `${fileName(image.src)} · ${image.ratioLabel}`;
  const candidates: InlineSegment[][] = [
    [heading, { text: `\n${file}\n${image.alt}`, emphasis: false }],
    [heading, { text: `\n${file}`, emphasis: false }],
    [{ text: fileName(image.src), emphasis: false }],
  ];
  return candidates.find(
    (segments) =>
      innerWidth > 0 &&
      measureText(segments.map((segment) => segment.text).join(""), {
        fontSize: TYPOGRAPHY.body,
        width: innerWidth,
        lineHeightEm: LINE_HEIGHT.global,
      }) <= innerHeight,
  );
}

export function imagePlaceholderItem(
  image: ImageDirective,
  style: FlowStyle,
  options: { gapAfter: number; maxHeight: number },
): FlowItem {
  const { colors } = coalaTheme;

  // `full`은 카드·표와 같은 전체 단 너비다. 본문이 지면 여백에서 시작할 때만
  // 의미가 있고, 그렇지 않으면 흐름의 폭을 넘지 않는다.
  const frameWidth =
    image.width === "full" && style.left === PAGE.marginX
      ? CONTENT_WIDTH
      : style.width;
  const declaredWidth =
    image.width === "half" ? Math.round(frameWidth / 2) : frameWidth;

  const captionHeight = image.caption
    ? measureText(image.caption, {
        fontSize: TYPOGRAPHY.body,
        width: frameWidth,
        lineHeightEm: LINE_HEIGHT.global,
      })
    : 0;
  const captionBlock = image.caption ? GAP.imageCaption + captionHeight : 0;
  // GUI 실행 결과 자리에는 위에 "실행 결과" 라벨이 영구히 놓인다. 이미지를
  // 넣어도 라벨은 자리 밖에 있으므로 그대로 남는다.
  const labelHeight =
    image.role === "result"
      ? measureText(RESULT_LABEL, {
          fontSize: TYPOGRAPHY.body,
          width: frameWidth,
          lineHeightEm: LINE_HEIGHT.global,
        })
      : 0;
  const labelBlock =
    image.role === "result" ? labelHeight + CODE_BOX.afterResultLabel : 0;

  const maxBoxHeight = Math.max(
    1,
    Math.floor(
      options.maxHeight - continuationReserve() - captionBlock - labelBlock,
    ),
  );
  const declaredHeight = Math.round(declaredWidth / image.ratio);
  const scaledToFit = declaredHeight > maxBoxHeight;
  const boxHeight = scaledToFit ? maxBoxHeight : declaredHeight;
  const boxWidth = scaledToFit
    ? Math.round(boxHeight * image.ratio)
    : declaredWidth;
  const boxLeft = style.left + Math.round((frameWidth - boxWidth) / 2);

  const innerWidth = boxWidth - LABEL_PADDING.x * 2;
  const label = pickLabel(image, innerWidth, boxHeight - LABEL_PADDING.y * 2);
  const placeholderLabelHeight = label
    ? measureText(label.map((segment) => segment.text).join(""), {
        fontSize: TYPOGRAPHY.body,
        width: innerWidth,
        lineHeightEm: LINE_HEIGHT.global,
      })
    : 0;

  return {
    height: labelBlock + boxHeight + captionBlock,
    gapAfter: options.gapAfter,
    pendingImage: {
      src: image.src,
      alt: image.alt,
      ratioLabel: image.ratioLabel,
      ratioDeclared: image.ratioDeclared,
      width: boxWidth,
      height: boxHeight,
      scaledToFit,
      ...(image.role === "result" ? { role: "result" as const } : {}),
    },
    render: (itemTop): ElementAtPoint[] => [
      ...(image.role === "result"
        ? [
            createRichText({
              left: style.left,
              top: itemTop,
              width: frameWidth,
              text: RESULT_LABEL,
              fontRef: style.fonts.fontRef,
              fontSize: TYPOGRAPHY.body,
              role: "body",
              fontWeight: style.fonts.boldWeight,
              color: colors.primary,
              lineHeightEm: LINE_HEIGHT.global,
            }),
          ]
        : []),
      createVectorShape({
        left: boxLeft,
        top: itemTop + labelBlock,
        width: boxWidth,
        height: boxHeight,
        path: rectPath(boxWidth, boxHeight),
        fill: colors.placeholderFill,
        dropTarget: true,
      }),
      ...(label
        ? [
            createRichText({
              left: boxLeft + LABEL_PADDING.x,
              top:
                itemTop +
                labelBlock +
                Math.round((boxHeight - placeholderLabelHeight) / 2),
              width: innerWidth,
              segments: label,
              fontRef: style.fonts.fontRef,
              fontSize: TYPOGRAPHY.body,
              role: "body",
              fontWeight: style.fonts.regularWeight,
              emphasisWeight: style.fonts.boldWeight,
              color: colors.placeholderText,
              textAlign: "center",
              lineHeightEm: LINE_HEIGHT.global,
            }),
          ]
        : []),
      ...(image.caption
        ? [
            createRichText({
              left: style.left,
              top: itemTop + labelBlock + boxHeight + GAP.imageCaption,
              width: frameWidth,
              text: image.caption,
              fontRef: style.fonts.fontRef,
              fontSize: TYPOGRAPHY.body,
              role: "body",
              fontWeight: style.fonts.regularWeight,
              color: colors.secondaryText,
              textAlign: "center",
              lineHeightEm: LINE_HEIGHT.global,
            }),
          ]
        : []),
    ],
  };
}

/**
 * 연속 페이지에서 `제목(계속)`이 본문을 아래로 미는 높이.
 *
 * 이미지가 있는 페이지는 이 값을 `flowIntoPages`의 `continuationInset`으로
 * 넘겨, 밀린 뒤에도 자리가 안전 영역 안에 남게 한다.
 */
export function continuationInset(
  flowTop: number,
  continuationTitle: string,
  width: number,
): number {
  const headingHeight = measureText(`${continuationTitle}(계속)`, {
    fontSize: TYPOGRAPHY.sectionTitle,
    width,
    lineHeightEm: LINE_HEIGHT.global,
  });
  return Math.max(0, PAGE.safeTop + headingHeight + GAP.afterHeading - flowTop);
}
