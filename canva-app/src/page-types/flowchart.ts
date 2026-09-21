import type { ElementAtPoint } from "@canva/design";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { FlowchartPage } from "../types/book-spec";
import { CONTENT_WIDTH, GAP, PAGE, TEXT_WIDTH } from "../theme/page-layout";
import { parseBlocks } from "../parser/blocks";
import type { FlowItem } from "../layout/flow";
import {
  flowIntoPages,
  pendingFlowchartsOf,
  renderPlaced,
} from "../layout/flow";
import {
  blockFlowItems,
  headingItem,
  withContinuationHeading,
} from "../layout/content-flow";
import type { PendingFlowchartDraft } from "../layout/flowchart-placeholder";
import {
  estimateFlowchartHeight,
  flowchartPlaceholderItem,
} from "../layout/flowchart-placeholder";
import { continuationInset } from "../layout/image-placeholder";
import type { PagePart } from "./page-part";
import { bodyStyle, continuedTitle } from "./shared";

export const REQUIRED_FLOWCHART_GRAPHICS = {
  declaration: {
    name: "Arrow block convex",
    id: "MAE7lCxHi8M",
    url: "https://www.canva.com/graphics/MAE7lCxHi8M/",
  },
  input: {
    name: "Flowchart Input-Output",
    id: "MAGpWHDxa1c",
    url: "https://www.canva.com/graphics/MAGpWHDxa1c/",
  },
  output: {
    name: "Flowchart Document",
    id: "MAGpWDtQbCc",
    url: "https://www.canva.com/graphics/MAGpWDtQbCc/",
  },
  process: {
    name: "Flowchart Process",
    id: "MAGpWHT7x4M",
    url: "https://www.canva.com/graphics/MAGpWHT7x4M/",
  },
  decision: {
    name: "Flowchart Decision",
    id: "MAGpWETGMb4",
    url: "https://www.canva.com/graphics/MAGpWETGMb4/",
  },
} as const;

export class FlowchartLibraryAssetUnavailableError extends Error {
  constructor() {
    super(
      "현재 공개 Canva Apps SDK로는 지정된 Canva 플로차트 라이브러리 요소를 그래픽 ID로 삽입할 수 없습니다. 임의 벡터 도형으로 대체하지 않았습니다. 필수 요소가 들어 있는 Canva 네이티브 템플릿 또는 사용자 삽입 단계가 필요합니다.",
    );
    this.name = "FlowchartLibraryAssetUnavailableError";
  }
}

export function assertFlowchartLibraryAssetSupport(): never {
  throw new FlowchartLibraryAssetUnavailableError();
}

export function buildFlowchartElements(): ElementAtPoint[] {
  return assertFlowchartLibraryAssetSupport();
}

const ROLE_LABEL = {
  declaration: "선언",
  input: "입력",
  output: "출력",
  process: "처리",
  decision: "조건",
} as const;

/** 제어 구조의 이름과, 스킬 규칙(`flowcharts.md`)대로 만드는 방법 한 줄. */
const STRUCTURE = {
  linear: {
    label: "순차",
    hint: "도형을 위에서 아래로 놓고 연결선으로 잇습니다.",
  },
  "if-else": {
    label: "조건문(if/else)",
    hint: "분기마다 Flowchart Process 틀(채움 #FFDEE7, 테두리 #FF5757)을 두고, 그 왼쪽 위에 Flowchart Decision을 겹쳐 올립니다.",
  },
  "if-else-if": {
    label: "다중 조건문(if/else-if/else)",
    hint: "Process 틀 없이 조건마다 Flowchart Decision을 하나씩 두고 평가 순서대로 잇습니다.",
  },
  loop: {
    label: "반복문",
    hint: "Flowchart Process(채움 #EBEBF9, 테두리 #1800AD)를 바깥 틀로 쓰고, 굵기 10의 남색 실선으로 조건과 본문을 나눕니다.",
  },
} as const;

/** 원고의 순서도를 "사용자가 만들어야 할 것"의 목록으로 바꾼다. */
export function describeFlowchart(page: FlowchartPage): PendingFlowchartDraft {
  const numberOf = new Map(page.nodes.map((node, index) => [node.id, index + 1]));
  const structure = page.controlStructure
    ? STRUCTURE[page.controlStructure]
    : undefined;
  return {
    title: page.title,
    structureLabel: structure?.label,
    structureHint: structure?.hint,
    nodes: page.nodes.map((node, index) => ({
      number: index + 1,
      role: node.role,
      roleLabel: ROLE_LABEL[node.role],
      elementName: REQUIRED_FLOWCHART_GRAPHICS[node.role].name,
      elementId: REQUIRED_FLOWCHART_GRAPHICS[node.role].id,
      text: node.text,
    })),
    connections: page.connections.map((connection) => ({
      from: numberOf.get(connection.from) ?? 0,
      to: numberOf.get(connection.to) ?? 0,
      ...(connection.label ? { label: connection.label } : {}),
    })),
  };
}

/**
 * flowchart 페이지를 만든다.
 *
 * 순서도 자체는 그리지 않는다. 제목과 도입문, 비워 둔 순서도 자리, 마무리 글을
 * 놓는다. 자리는 사용자가 Canva에서 지정된 요소로 직접 채운다.
 */
export function layoutFlowchart(
  page: FlowchartPage,
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
      last.gapAfter = GAP.beforeImage;
    }
  }

  items.push(
    flowchartPlaceholderItem(describeFlowchart(page), wide, {
      gapAfter: page.conclusion ? GAP.afterImage : 0,
      maxHeight: maxItemHeight,
      estimatedHeight: estimateFlowchartHeight(page.nodes, page.connections),
      declaredHeight: page.placeholderHeight,
    }),
  );

  if (page.conclusion) {
    items.push(
      ...blockFlowItems(parseBlocks(page.conclusion), narrow, {
        maxItemHeight,
      }),
    );
  }

  const pages = flowIntoPages(
    items,
    { top: PAGE.safeTop, bottom: PAGE.safeBottom },
    {
      continuationInset: continuationInset(
        PAGE.safeTop,
        page.title,
        wide.width,
      ),
    },
  );

  return pages.map((placed, index) => {
    const pendingFlowcharts = pendingFlowchartsOf(placed);
    return {
      title: continuedTitle(page.title, index),
      elements:
        index === 0
          ? renderPlaced(placed)
          : renderPlaced(withContinuationHeading(placed, page.title, wide)),
      ...(pendingFlowcharts.length > 0 ? { pendingFlowcharts } : {}),
    };
  });
}
