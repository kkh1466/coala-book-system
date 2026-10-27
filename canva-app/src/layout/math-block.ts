import type { FlowItem } from "./flow";
import type { FlowStyle } from "./content-flow";
import { carriedHeadingReserve } from "./content-flow";
import { continuationReserve } from "./image-placeholder";
import { GAP } from "../theme/page-layout";
import { MarkdownBookParseError } from "../parser/markdown-book";
import { mathIssue } from "../builder/math-source";

export function mathBlockItem(
  tex: string,
  style: FlowStyle,
  options: { gapAfter: number; maxHeight: number },
): FlowItem {
  const asset = style.fonts.math?.get(tex);
  if (!asset) {
    throw new MarkdownBookParseError(
      "수식 준비 결과가 없습니다. 페이지 배치 전에 prepareMath를 실행해야 합니다.",
    );
  }
  const maxHeight =
    options.maxHeight - continuationReserve() - carriedHeadingReserve();
  if (asset.width > style.width || asset.height > maxHeight) {
    const issue = mathIssue(
      asset,
      "수식이 본문 안전 영역보다 큽니다. aligned로 줄바꿈하거나 여러 수식 블록으로 나눠 주세요. 글자 크기는 자동 축소하지 않습니다.",
    );
    throw new MarkdownBookParseError(issue.message, issue.line, [issue]);
  }
  return {
    height: asset.height,
    gapAfter: options.gapAfter,
    reservesContinuation: true,
    render: (top) => [
      {
        type: "image",
        dataUrl: asset.dataUrl,
        altText: { text: `수식: ${tex}`, decorative: false },
        left: style.left + (style.width - asset.width) / 2,
        top,
        width: asset.width,
        height: asset.height,
      },
    ],
  };
}

export const MATH_GAP = GAP.paragraph;
