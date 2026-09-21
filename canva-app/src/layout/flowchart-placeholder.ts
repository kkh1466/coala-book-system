import type { ElementAtPoint } from "@canva/design";
import type { InlineSegment } from "../parser/inline";
import { coalaTheme } from "../theme/coala-theme";
import { GAP } from "../theme/page-layout";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { createRichText, createVectorShape } from "../builder/element-factory";
import type { FlowchartConnection, FlowchartNode } from "../types/book-spec";
import type { PendingFlowchart } from "../types/pending-flowchart";
import type { FlowStyle } from "./content-flow";
import type { FlowItem } from "./flow";
import { lineHeight, measureText } from "./measure";

/**
 * 순서도 자리표시자.
 *
 * 앱은 순서도를 그리지 않는다. 스킬은 지정된 Canva 라이브러리 요소만 쓰도록
 * 하고 비슷한 도형으로 대체하는 것을 금지하는데, 공개 Apps SDK에는 그 요소를
 * 넣는 방법이 없다. 그래서 중립적인 회색 자리 하나와, 무엇을 만들어야 하는지
 * 적은 안내 글 하나만 놓는다. 역할별 색이나 모양은 쓰지 않는다. 자리가
 * 순서도처럼 보이면 안 되기 때문이다.
 *
 * 사용자는 이 자리 위에 순서도를 만든 뒤 자리와 안내 글(요소 2개)을 지운다.
 */
const PADDING = { x: 40, y: 32 } as const;

/** 높이 추정에 쓰는 값. 원본 flowchart1.png의 노드 높이와 연결선 길이에서 잡았다. */
const ESTIMATE = {
  nodeHeight: 200,
  linkHeight: 120,
  margin: 40,
  minimum: 600,
} as const;

/**
 * 연결을 따라 갈 수 있는 가장 긴 경로의 노드 수.
 *
 * 스킬은 위에서 아래로 흐르는 배치를 권한다. 그러면 세로로 쌓이는 노드 수는
 * 가장 긴 경로의 길이와 같다. 반복문은 되돌아가는 연결이 있으므로 같은 노드를
 * 두 번 세지 않는다.
 */
export function longestPathLength(
  nodes: readonly FlowchartNode[],
  connections: readonly FlowchartConnection[],
): number {
  const next = new Map<string, string[]>();
  for (const { from, to } of connections) {
    next.set(from, [...(next.get(from) ?? []), to]);
  }
  const visit = (id: string, seen: ReadonlySet<string>): number => {
    const onward = (next.get(id) ?? []).filter((target) => !seen.has(target));
    if (onward.length === 0) {
      return 1;
    }
    const withSelf = new Set([...seen, id]);
    return 1 + Math.max(...onward.map((target) => visit(target, withSelf)));
  };
  return Math.max(
    1,
    ...nodes.map((node) => visit(node.id, new Set([node.id]))),
  );
}

/** 노드 수로 추정한 순서도 높이(px). */
export function estimateFlowchartHeight(
  nodes: readonly FlowchartNode[],
  connections: readonly FlowchartConnection[],
): number {
  const rows = longestPathLength(nodes, connections);
  return Math.max(
    ESTIMATE.minimum,
    rows * ESTIMATE.nodeHeight +
      (rows - 1) * ESTIMATE.linkHeight +
      ESTIMATE.margin * 2,
  );
}

function connectionText(flowchart: PendingFlowchartDraft): string {
  return flowchart.connections
    .map(({ from, to, label }) =>
      label ? `${from} —${label}→ ${to}` : `${from} → ${to}`,
    )
    .join(" · ");
}

/** 가장 자세한 것부터. 자리 안에 들어가는 첫 번째 판을 쓴다. */
function guideCandidates(flowchart: PendingFlowchartDraft): InlineSegment[][] {
  const heading: InlineSegment = {
    text: "🔀 순서도 자리 · Canva에서 직접 만들어 주세요",
    emphasis: true,
  };
  const structure = flowchart.structureLabel
    ? `\n구조: ${flowchart.structureLabel}`
    : "";
  const nodeLines = flowchart.nodes
    .map((node) => `\n${node.number}. [${node.roleLabel}] ${node.text}`)
    .join("");
  const summary = `\n도형 ${flowchart.nodes.length}개 · 연결 ${flowchart.connections.length}개`;
  return [
    [
      heading,
      {
        text: `${structure}${nodeLines}\n연결: ${connectionText(flowchart)}`,
        emphasis: false,
      },
    ],
    [heading, { text: `${structure}${nodeLines}`, emphasis: false }],
    [heading, { text: `${structure}${summary}`, emphasis: false }],
    [heading],
  ];
}

const plain = (segments: readonly InlineSegment[]): string =>
  segments.map((segment) => segment.text).join("");

/** 자리 크기가 정해지기 전의 순서도 정보. */
export type PendingFlowchartDraft = Omit<
  PendingFlowchart,
  "width" | "height" | "heightDeclared"
>;

export function flowchartPlaceholderItem(
  flowchart: PendingFlowchartDraft,
  style: FlowStyle,
  options: {
    gapAfter: number;
    /** 자리 하나가 넘을 수 없는 높이. 보통 안전 영역 전체 높이. */
    maxHeight: number;
    /** 노드 수로 추정한 높이. */
    estimatedHeight: number;
    /** 원고가 직접 적은 높이. */
    declaredHeight?: number;
  },
): FlowItem {
  const { colors } = coalaTheme;
  const innerWidth = style.width - PADDING.x * 2;
  const measure = (segments: readonly InlineSegment[]) =>
    measureText(plain(segments), {
      fontSize: TYPOGRAPHY.body,
      width: innerWidth,
      lineHeightEm: LINE_HEIGHT.global,
    });

  // 연속 페이지로 넘어가면 `제목(계속)`이 위를 차지한다. 그 몫을 미리 뺀다.
  const ceiling = Math.floor(
    options.maxHeight -
      lineHeight(TYPOGRAPHY.sectionTitle, LINE_HEIGHT.global) * 2 -
      GAP.afterHeading,
  );
  const candidates = guideCandidates(flowchart);
  const fullGuide = candidates[0] ?? [];

  // 원고가 높이를 적었으면 그대로 따른다. 아니면 추정 높이와 "안내 글이 모두
  // 들어가는 높이" 중 큰 쪽을 쓴다. 어느 쪽이든 지면을 넘지 않는다.
  const wanted =
    options.declaredHeight ??
    Math.max(options.estimatedHeight, measure(fullGuide) + PADDING.y * 2);
  const height = Math.max(1, Math.min(Math.round(wanted), ceiling));

  const guide = candidates.find(
    (segments) => measure(segments) <= height - PADDING.y * 2,
  );

  return {
    height,
    gapAfter: options.gapAfter,
    pendingFlowchart: {
      ...flowchart,
      width: style.width,
      height,
      heightDeclared: options.declaredHeight !== undefined,
    },
    render: (top): ElementAtPoint[] => [
      createVectorShape({
        left: style.left,
        top,
        width: style.width,
        height,
        path: `M 0 0 H ${style.width} V ${height} H 0 Z`,
        fill: colors.placeholderFill,
      }),
      ...(guide
        ? [
            createRichText({
              left: style.left + PADDING.x,
              top: top + PADDING.y,
              width: innerWidth,
              segments: guide,
              fontRef: style.fonts.fontRef,
              fontSize: TYPOGRAPHY.body,
              role: "body",
              fontWeight: style.fonts.regularWeight,
              emphasisWeight: style.fonts.boldWeight,
              color: colors.placeholderText,
              lineHeightEm: LINE_HEIGHT.global,
            }),
          ]
        : []),
    ],
  };
}
