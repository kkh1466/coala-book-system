import type { ElementAtPoint } from "@canva/design";
import type { PendingFlowchart } from "../types/pending-flowchart";
import type { PendingImage } from "../types/pending-image";

/**
 * 세로 흐름 배치와 페이지 분할.
 *
 * 모든 요소의 Y 위치는 고정 좌표가 아니라
 *   `다음 Y = 이전 Y + 이전 요소의 실제 높이 + 유형별 여백`
 * 으로 계산된다. 높이는 `layout/measure.ts`가 실제 줄 수로 추정한다.
 *
 * 내용이 안전 영역을 넘으면 **글자를 줄이지 않고** 다음 페이지로 넘긴다.
 * 이 파일에는 글자 크기를 만지는 코드가 없다.
 */
export type FlowItem = {
  /** 이 조각이 차지하는 높이(px). */
  height: number;
  /** 아래쪽 여백. 다음 조각은 이만큼 떨어져 시작한다. */
  gapAfter: number;
  /**
   * 다음 조각이 같은 페이지에 함께 있어야 하는 최소 높이.
   *
   * 섹션 제목에 본문 2줄 높이를 걸어 두면, 제목만 페이지 하단에 홀로 남는
   * 일이 생기지 않는다.
   */
  keepWithNext?: number;
  /** 이 조각이 이미지 자리표시자일 때만 있다. 생성 후 보고 목록에 쓴다. */
  pendingImage?: PendingImage;
  /** 이 조각이 순서도 자리표시자일 때만 있다. 생성 후 보고 목록에 쓴다. */
  pendingFlowchart?: PendingFlowchart;
  /** 확정된 Y 위치로 실제 Canva 요소를 만든다. */
  render: (top: number) => ElementAtPoint[];
};

export type PlacedItem = {
  item: FlowItem;
  top: number;
};

export type SafeArea = {
  top: number;
  bottom: number;
};

export type FlowOptions = {
  /**
   * 두 번째 장부터 아래쪽에서 덜어 낼 높이.
   *
   * 연속 페이지는 배치가 끝난 뒤 `제목(계속)`만큼 통째로 아래로 밀린다
   * (`content-flow.ts`의 withContinuationHeading). 글줄은 그 정도 밀려도
   * 표가 나지 않지만, 이미지 자리는 큰 면이라 쪽번호 영역을 덮는다. 이미지가
   * 있는 페이지만 이 값을 넘긴다. 생략하면 0이고 배치는 이전과 똑같다.
   */
  continuationInset?: number;
};

/**
 * 조각들을 위에서 아래로 흘려 넣고, 안전 영역을 넘기 전에 페이지를 끊는다.
 *
 * 돌려주는 배열의 길이가 곧 물리 페이지 수다. 조각 하나가 페이지 하나보다
 * 크면 그 조각만 담은 페이지가 만들어진다. 그런 조각이 생기지 않도록 문단은
 * 미리 문장 단위로 쪼개 들어온다(`content-flow.ts`).
 */
export function flowIntoPages(
  items: readonly FlowItem[],
  area: SafeArea,
  options: FlowOptions = {},
): PlacedItem[][] {
  const pages: PlacedItem[][] = [];
  let current: PlacedItem[] = [];
  let cursor = area.top;
  const inset = options.continuationInset ?? 0;
  const bottom = () => (pages.length === 0 ? area.bottom : area.bottom - inset);

  const place = (item: FlowItem) => {
    current.push({ item, top: cursor });
    cursor += item.height + item.gapAfter;
  };

  for (const item of items) {
    if (current.length > 0 && cursor + item.height > bottom()) {
      // 페이지를 끊는다. 직전 조각이 "다음과 함께"를 요구하면(섹션 제목 등)
      // 그 조각도 같이 넘겨 제목만 하단에 홀로 남지 않게 한다.
      const carried: PlacedItem[] = [];
      while (current.length > 1 && current[current.length - 1]?.item.keepWithNext) {
        const moved = current.pop();
        if (moved) {
          carried.unshift(moved);
        }
      }

      pages.push(current);
      current = [];
      cursor = area.top;
      for (const { item: carriedItem } of carried) {
        place(carriedItem);
      }
    }

    place(item);
  }

  if (current.length > 0) {
    pages.push(current);
  }
  return pages.length > 0 ? pages : [[]];
}

/** 배치가 끝난 페이지 하나를 실제 요소 목록으로 바꾼다. */
export function renderPlaced(placed: readonly PlacedItem[]): ElementAtPoint[] {
  return placed.flatMap(({ item, top }) => item.render(top));
}

/** 이 페이지에 놓인 이미지 자리표시자들. */
export function pendingImagesOf(
  placed: readonly PlacedItem[],
): PendingImage[] {
  return placed.flatMap(({ item }) =>
    item.pendingImage ? [item.pendingImage] : [],
  );
}

/** 이 페이지에 놓인 순서도 자리표시자들. */
export function pendingFlowchartsOf(
  placed: readonly PlacedItem[],
): PendingFlowchart[] {
  return placed.flatMap(({ item }) =>
    item.pendingFlowchart ? [item.pendingFlowchart] : [],
  );
}

/** 조각들이 차지하는 전체 높이(마지막 여백 제외). */
export function totalHeight(items: readonly FlowItem[]): number {
  return items.reduce(
    (sum, item, index) =>
      sum + item.height + (index === items.length - 1 ? 0 : item.gapAfter),
    0,
  );
}
