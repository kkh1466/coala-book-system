import type { DesignEditing, ElementAtPoint, PageId } from "@canva/design";
import type { openDesign, setCurrentPageBackground } from "@canva/design";
import { coalaTheme } from "../theme/coala-theme";
import type { PreparedPage } from "./create-page";

/**
 * 새 디자인의 빈 첫 페이지를 교재 첫 장으로 쓴다.
 *
 * Canva의 새 디자인은 빈 페이지 한 장으로 시작한다. `addPage()`는 그 **뒤에**
 * 새 페이지를 붙이기만 하므로 맨 앞에 빈 페이지가 남는다. 설치된
 * @canva/design 2.13.0에는 페이지를 지우는 API가 없다(`PageRefList`는 읽기
 * 전용). 그래서 빈 페이지를 지우는 대신 그 페이지에 첫 장을 그려 넣는다.
 *
 * 이 경로는 아래 조건이 **모두** 맞을 때만 쓴다. 하나라도 어긋나면 아무것도
 * 바꾸지 않고 `reused: false`를 돌려주며, 호출부는 예전과 똑같이 `addPage()`로
 * 첫 장을 만든다. 즉 최악의 경우가 "이전 동작 그대로"다.
 *
 * - 디자인에 페이지가 정확히 한 장이다.
 * - 그 페이지가 고정 크기이고, 잠겨 있지 않고, 요소가 하나도 없다.
 * - 그 페이지의 크기가 교재 지면(1587 × 2245)과 같다.
 */
export type BlankFirstPageReuse =
  | { reused: true; pageId?: PageId }
  | {
      reused: false;
      /**
       * `not-applicable`: 채울 빈 페이지가 애초에 없었다(평소의 이어서 생성 등).
       * `failed`: 빈 페이지는 있었지만 쓰지 못했다. 사용자에게 사유를 알린다.
       */
      kind: "not-applicable" | "failed";
      reason: string;
    };

export type BlankFirstPageDeps = {
  openDesign: typeof openDesign;
  setCurrentPageBackground: typeof setCurrentPageBackground;
  getDesignPageCount: () => Promise<number | undefined>;
};

/** 편집 API의 색은 소문자 6자리 hex만 받는다. */
const solid = (color: string) =>
  ({ type: "solid", color: color.toLowerCase() }) as const;

/** `addPage()`에 보내던 요소를 편집 API의 요소 상태로 옮긴다. */
function toElementState(
  builder: DesignEditing.ElementStateBuilder,
  element: ElementAtPoint,
): DesignEditing.ShapeElementState | DesignEditing.TextElementState {
  if (element.type === "richtext") {
    if (typeof element.width !== "number") {
      throw new Error("너비가 없는 텍스트 요소는 옮길 수 없습니다.");
    }
    return builder.createTextElement({
      top: element.top,
      left: element.left,
      width: element.width,
      text: { regions: element.range.readTextRegions() },
    });
  }
  if (element.type === "shape") {
    if (
      typeof element.width !== "number" ||
      typeof element.height !== "number"
    ) {
      throw new Error("크기가 없는 도형 요소는 옮길 수 없습니다.");
    }

    return builder.createShapeElement({
      top: element.top,
      left: element.left,
      width: element.width,
      height: element.height,
      viewBox: element.viewBox,
      paths: element.paths.map((path) => ({
        d: path.d,
        ...(path.fill.color
          ? {
              fill: {
                colorContainer: solid(path.fill.color),
                isMediaEditable: path.fill.dropTarget ?? false,
              },
            }
          : {}),
        ...(path.stroke
          ? {
              stroke: {
                weight: path.stroke.weight,
                colorContainer: solid(path.stroke.color),
              },
            }
          : {}),
      })),
    });
  }
  throw new Error(`'${element.type}' 요소는 빈 페이지에 옮길 수 없습니다.`);
}

/** 지금 페이지가 첫 장으로 쓸 수 있는 빈 페이지인가. 아니면 그 사유. */
function blankPageProblem(
  page: DesignEditing.Page,
): { kind: "not-applicable" | "failed"; reason: string } | undefined {
  if (page.type !== "absolute") {
    return {
      kind: "failed",
      reason: "현재 페이지가 고정 크기 페이지가 아닙니다.",
    };
  }
  if (page.elements.count() > 0) {
    return {
      kind: "not-applicable",
      reason: "현재 페이지에 이미 요소가 있습니다.",
    };
  }
  if (page.locked) {
    return { kind: "failed", reason: "빈 첫 페이지가 잠겨 있습니다." };
  }
  const { width, height } = coalaTheme.canvas;
  if (
    !page.dimensions ||
    Math.round(page.dimensions.width) !== width ||
    Math.round(page.dimensions.height) !== height
  ) {
    const actual = page.dimensions
      ? `${Math.round(page.dimensions.width)} × ${Math.round(page.dimensions.height)}`
      : "알 수 없음";
    return {
      kind: "failed",
      reason: `빈 첫 페이지의 크기(${actual})가 교재 지면(${width} × ${height})과 다릅니다.`,
    };
  }
  return undefined;
}

export async function fillBlankFirstPage(
  prepared: PreparedPage,
  deps: BlankFirstPageDeps,
): Promise<BlankFirstPageReuse> {
  const pageCount = await deps.getDesignPageCount();
  if (pageCount !== 1) {
    return {
      reused: false,
      kind: "not-applicable",
      reason:
        pageCount === undefined
          ? "디자인의 페이지 수를 확인할 수 없습니다."
          : `디자인에 페이지가 ${pageCount}장 있습니다.`,
    };
  }

  // 1) 읽기만 해서 조건을 확인한다. sync()를 부르지 않으므로 바뀌는 것이 없다.
  let problem: ReturnType<typeof blankPageProblem> = {
    kind: "not-applicable",
    reason: "현재 페이지를 열지 못했습니다.",
  };
  await deps.openDesign({ type: "current_page" }, async (session) => {
    problem = blankPageProblem(session.page);
  });
  if (problem) {
    return { reused: false, ...problem };
  }

  // 2) 배경을 먼저 맞춘다. 여기서 실패하면 요소는 아직 하나도 넣지 않은 상태라
  //    예전 경로로 돌아가도 남는 것이 없다.
  await deps.setCurrentPageBackground({
    color: coalaTheme.colors.pageBackground,
  });

  // 3) 모든 요소를 한 번의 sync()로 넣는다. 일부만 들어가는 일이 없다.
  let pageId: PageId | undefined;
  let syncStarted = false;
  try {
    await deps.openDesign({ type: "current_page" }, async (session) => {
      const stillBlank = blankPageProblem(session.page);
      if (stillBlank || session.page.type !== "absolute") {
        throw new Error(stillBlank?.reason ?? "현재 페이지를 쓸 수 없습니다.");
      }
      const builder = session.helpers.elementStateBuilder;
      for (const element of prepared.elements) {
        // ref가 undefined면 목록의 끝(가장 위)에 놓인다. addPage()와 같은 순서다.
        session.page.elements.insertAfter(
          undefined,
          toElementState(builder, element),
        );
      }
      pageId = session.page.id;
      syncStarted = true;
      await session.sync();
    });
  } catch (error) {
    if (!syncStarted) {
      // 아직 아무것도 보내지 않았다. 디자인은 그대로다.
      throw error;
    }
    // sync()가 오류를 냈어도 요소가 실제로 들어갔다면 첫 장은 이미 있는 것이다.
    // 그때 addPage()로 다시 만들면 첫 장이 두 번 생기므로 반드시 확인한다.
    let landed = false;
    await deps.openDesign({ type: "current_page" }, async (session) => {
      landed =
        session.page.type === "absolute" && session.page.elements.count() > 0;
    });
    if (!landed) {
      throw error;
    }
  }
  return { reused: true, pageId };
}

/**
 * 던지지 않는 판. 어떤 이유로든 빈 페이지를 쓰지 못하면 사유만 돌려준다.
 *
 * 호출부는 `reused: false`를 받으면 예전과 똑같이 `addPage()`를 쓴다.
 */
export async function tryFillBlankFirstPage(
  prepared: PreparedPage,
  deps: BlankFirstPageDeps,
): Promise<BlankFirstPageReuse> {
  try {
    return await fillBlankFirstPage(prepared, deps);
  } catch (error) {
    return {
      reused: false,
      kind: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
