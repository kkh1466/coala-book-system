import type { ElementAtPoint } from "@canva/design";
import type { PendingFlowchart } from "../types/pending-flowchart";
import type { PendingImage, PlacedImage } from "../types/pending-image";

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
  /** 소제목과 본문으로 이루어진 의미 단위의 시작. 분량 재배분 경계로 우선한다. */
  startsSection?: true;
  /** 이 조각이 비워 둔 이미지 자리일 때만 있다. 생성 후 보고 목록에 쓴다. */
  pendingImage?: PendingImage;
  /** 이 조각이 폴더의 파일로 채운 이미지일 때만 있다. */
  placedImage?: PlacedImage;
  /** 이 조각이 순서도 자리표시자일 때만 있다. 생성 후 보고 목록에 쓴다. */
  pendingFlowchart?: PendingFlowchart;
  /**
   * 지면 하나에 가깝게 커질 수 있는 상자(응답 상자 등). 이 조각이 있는 페이지는
   * `continuationInset`을 넘겨, 연속 페이지에서 `제목(계속)`만큼 밀린 뒤에도
   * 안전 영역 안에 남게 한다. 이미지 자리는 `pendingImage`로 같은 처리를 받는다.
   */
  reservesContinuation?: true;
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
      while (
        current.length > 1 &&
        current[current.length - 1]?.item.keepWithNext
      ) {
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
export function pendingImagesOf(placed: readonly PlacedItem[]): PendingImage[] {
  return placed.flatMap(({ item }) =>
    item.pendingImage ? [item.pendingImage] : [],
  );
}

/** 이 페이지에서 파일로 채운 이미지들. */
export function placedImagesOf(placed: readonly PlacedItem[]): PlacedImage[] {
  return placed.flatMap(({ item }) =>
    item.placedImage ? [item.placedImage] : [],
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

/**
 * 넘친 끝 문단만 연속 페이지에 남으면 앞 장의 내용을 함께 넘겨 분량을 고른다.
 * 먼저 소제목 경계를 고르고, 가능한 소제목 경계가 없으면 블록 경계를 쓴다.
 * 순서·크기·여백·페이지 수를 유지하며 양쪽의 실제 안전 영역 안에서만 옮긴다.
 * 다른 원고 페이지와 합치지 않으며, 호출하지 않은 페이지 유형은 기존 분할을 유지한다.
 */
export function balanceSparsePages(
  pages: readonly (readonly PlacedItem[])[],
  area: SafeArea,
  continuationInset = 0,
): PlacedItem[][] {
  const balanced = pages.map((page) => [...page]);
  const minFill = 0.35;
  const capacity = (index: number) =>
    area.bottom - area.top - (index > 0 ? continuationInset : 0);
  const position = (items: readonly FlowItem[]): PlacedItem[] => {
    let top = area.top;
    return items.map((item) => {
      const placed = { item, top };
      top += item.height + item.gapAfter;
      return placed;
    });
  };

  for (let index = balanced.length - 1; index > 0; index -= 1) {
    const previous = (balanced[index - 1] ?? []).map(({ item }) => item);
    const current = (balanced[index] ?? []).map(({ item }) => item);
    const previousCapacity = capacity(index - 1);
    const currentCapacity = capacity(index);
    if (previousCapacity <= 0 || currentCapacity <= 0 || !current.length)
      continue;
    const currentFill = totalHeight(current) / currentCapacity;
    if (currentFill >= minFill) continue;
    const originalDifference = Math.abs(
      totalHeight(previous) / previousCapacity - currentFill,
    );
    const candidates: { cut: number; difference: number; section: boolean }[] =
      [];

    for (let cut = 1; cut < previous.length; cut += 1) {
      // 제목·프롬프트와 뒤따르는 본문의 연결을 유지한다.
      if (previous[cut - 1]?.keepWithNext) continue;
      const left = previous.slice(0, cut);
      const right = [...previous.slice(cut), ...current];
      if (!left.some((item) => !item.keepWithNext)) continue;
      const leftFill = totalHeight(left) / previousCapacity;
      const rightFill = totalHeight(right) / currentCapacity;
      if (
        leftFill < minFill ||
        leftFill > 1 ||
        rightFill < minFill ||
        rightFill > 1
      )
        continue;
      const difference = Math.abs(leftFill - rightFill);
      if (difference >= originalDifference) continue;
      candidates.push({
        cut,
        difference,
        section: previous[cut]?.startsSection === true,
      });
    }

    const sectionCandidates = candidates.filter(
      (candidate) => candidate.section,
    );
    const preferred = sectionCandidates.length ? sectionCandidates : candidates;
    preferred.sort((a, b) => a.difference - b.difference);
    const best = preferred[0];
    if (!best) continue; // 큰 이미지·수식 등 나눌 수 없는 내용은 억지로 줄이지 않는다.
    balanced[index - 1] = position(previous.slice(0, best.cut));
    balanced[index] = position([...previous.slice(best.cut), ...current]);
  }
  return balanced;
}
