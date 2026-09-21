import type { DesignEditing, openDesign } from "@canva/design";
import { coalaTheme } from "../theme/coala-theme";
import { PAGE, PAGE_NUMBER } from "../theme/page-layout";

/**
 * 이미지 자리의 가로세로 비율을 바꾼다.
 *
 * 이미지 자리는 `dropTarget`을 켠 경로 도형이다. 이미지를 끌어다 놓으면 딱 맞게
 * 채워지지만, Canva 편집기에서는 이 도형의 비율을 바꿀 수 없다. 그래서 앱이
 * 대신 바꿔 준다.
 *
 * 편집 API에서 요소의 너비와 높이는 읽기 전용이다. 크기를 고칠 수 없으므로
 * 같은 자리·같은 쌓임 순서에 새 비율의 도형을 넣고 옛 도형을 지운다. 새 도형도
 * 끌어다 놓기 대상이다(`isMediaEditable: true`). 이 교체가 Canva에서 실제로
 * 동작하고, 바뀐 자리에도 이미지가 딱 맞게 들어가는 것을 확인했다.
 *
 * 선택 API는 도형을 알려 주지 않는다(`plaintext | image | video | richtext`).
 * 그래서 자리는 "현재 페이지에서 위에서부터 n번째"로 가리킨다. 자리 가운데의
 * 안내 글은 richtext라 선택을 알 수 있으므로, 호출부는 그 글로 자리를 찾는다.
 */
export type ImagePlaceholderInfo = {
  /** 현재 페이지에서 위에서부터 몇 번째 자리인지(0부터). */
  index: number;
  width: number;
  height: number;
  /** 자리 안의 안내 글 전체. 안내 글이 없는 자리는 undefined. */
  labelText?: string;
};

export type PlaceholderList =
  | { ok: true; placeholders: ImagePlaceholderInfo[] }
  | { ok: false; reason: string };

export type RatioChange =
  | {
      changed: true;
      width: number;
      previousHeight: number;
      height: number;
      /** 자리 아래에 있어 함께 옮긴 요소의 수. */
      movedBelow: number;
      /** 옮긴 요소가 본문 영역 아래로 넘어갔는가. 사용자가 직접 정리해야 한다. */
      overflows: boolean;
    }
  | { changed: false; reason: string };

export type PlaceholderRatioDeps = {
  openDesign: typeof openDesign;
};

/** 앱이 만든 이미지 자리 도형인가. `dropTarget`을 켠 도형은 자리뿐이다. */
function isImagePlaceholder(
  element: DesignEditing.AbsoluteElement,
): element is DesignEditing.ShapeElement {
  if (element.type !== "shape") {
    return false;
  }
  const paths = element.paths.toArray();
  return paths.length === 1 && paths[0]?.fill.isMediaEditable === true;
}

function isText(
  element: DesignEditing.AbsoluteElement,
): element is DesignEditing.TextElement {
  return element.type === "text";
}

/** 위에서 아래 순서의 이미지 자리. */
function placeholdersOf(
  page: DesignEditing.AbsolutePage,
): DesignEditing.ShapeElement[] {
  return [...page.elements.filter(isImagePlaceholder)].sort(
    (a, b) => a.top - b.top,
  );
}

/** 자리 안에 놓인 안내 글. 자리의 상자 안에서 시작하는 글 요소다. */
function labelOf(
  page: DesignEditing.AbsolutePage,
  shape: DesignEditing.ShapeElement,
): DesignEditing.TextElement | undefined {
  return page.elements
    .filter(isText)
    .find(
      (text) =>
        text.top >= shape.top &&
        text.top < shape.top + shape.height &&
        text.left >= shape.left &&
        text.left < shape.left + shape.width,
    );
}

/** 현재 페이지의 비어 있는 이미지 자리를 읽는다. 디자인은 바꾸지 않는다. */
export async function listImagePlaceholders(
  deps: PlaceholderRatioDeps,
): Promise<PlaceholderList> {
  let outcome: PlaceholderList = {
    ok: false,
    reason: "현재 페이지를 열지 못했습니다.",
  };
  try {
    await deps.openDesign({ type: "current_page" }, async (session) => {
      const page = session.page;
      if (page.type !== "absolute") {
        outcome = { ok: false, reason: "고정 크기 페이지가 아닙니다." };
        return;
      }
      outcome = {
        ok: true,
        placeholders: placeholdersOf(page).map((shape, index) => ({
          index,
          width: Math.round(shape.width),
          height: Math.round(shape.height),
          labelText: labelOf(page, shape)?.text.readPlaintext(),
        })),
      };
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  return outcome;
}

/** 안내 글 속의 `· 16:9` 표기를 새 비율로 고친다. 표기가 없으면 그대로 둔다. */
function relabelRatio(
  label: DesignEditing.TextElement,
  ratioLabel: string,
): void {
  const plain = label.text.readPlaintext();
  const match = /· (\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)?)(?=\n|$)/.exec(plain);
  const shown = match?.[1];
  if (!match || shown === undefined || shown === ratioLabel) {
    return;
  }
  label.text.replaceText(
    { index: match.index + 2, length: shown.length },
    ratioLabel,
  );
}

export async function changeImagePlaceholderRatio(
  options: {
    /** 가로 ÷ 세로. */
    ratio: number;
    /** 안내 글에 적을 표기(예: "4:3"). */
    ratioLabel: string;
    /** 위에서부터 몇 번째 자리인지(0부터). */
    index: number;
  },
  deps: PlaceholderRatioDeps,
): Promise<RatioChange> {
  let outcome: RatioChange = {
    changed: false,
    reason: "현재 페이지를 열지 못했습니다.",
  };
  try {
    await deps.openDesign({ type: "current_page" }, async (session) => {
      const page = session.page;
      if (page.type !== "absolute") {
        outcome = { changed: false, reason: "고정 크기 페이지가 아닙니다." };
        return;
      }
      const placeholders = placeholdersOf(page);
      const shape = placeholders[options.index];
      if (!shape) {
        outcome = {
          changed: false,
          reason:
            placeholders.length === 0
              ? "현재 페이지에 비어 있는 이미지 자리가 없습니다. (이미지를 이미 넣은 자리는 바꿀 수 없습니다.)"
              : `현재 페이지의 이미지 자리는 ${placeholders.length}곳입니다.`,
        };
        return;
      }
      if (shape.locked) {
        outcome = { changed: false, reason: "이미지 자리가 잠겨 있습니다." };
        return;
      }

      const width = Math.round(shape.width);
      const previousHeight = Math.round(shape.height);
      const height = Math.round(width / options.ratio);
      const delta = height - previousHeight;
      const previousBottom = shape.top + shape.height;
      const label = labelOf(page, shape);

      // 자리 아래의 요소(캡션, 이어지는 글, 다른 자리)를 늘거나 준 만큼 옮긴다.
      // 쪽번호는 제자리에 둔다. 잠긴 요소는 옮길 수 없다.
      const below = page.elements.toArray().filter(
        (
          element,
        ): element is Exclude<
          DesignEditing.AbsoluteElement,
          DesignEditing.UnsupportedElement
        > =>
          // 지원하지 않는 요소는 위치를 쓸 수 없다.
          element.type !== "unsupported" &&
          element !== shape &&
          element !== label &&
          !element.locked &&
          element.top >= previousBottom - 1 &&
          element.top < PAGE_NUMBER.top,
      );
      for (const element of below) {
        element.top += delta;
      }

      if (label) {
        label.top = shape.top + Math.round((height - label.height) / 2);
        relabelRatio(label, options.ratioLabel);
      }

      const current = shape.paths.toArray()[0]?.fill.colorContainer.ref;
      const color =
        current?.type === "solid"
          ? current.color
          : coalaTheme.colors.placeholderFill;
      page.elements.insertBefore(
        shape,
        session.helpers.elementStateBuilder.createShapeElement({
          top: shape.top,
          left: shape.left,
          width,
          height,
          viewBox: { top: 0, left: 0, width, height },
          paths: [
            {
              d: `M 0 0 H ${width} V ${height} H 0 Z`,
              fill: {
                colorContainer: { type: "solid", color: color.toLowerCase() },
                isMediaEditable: true,
              },
            },
          ],
        }),
      );
      page.elements.delete(shape);
      await session.sync();

      const lowest = Math.max(
        shape.top + height,
        ...below.map((element) => element.top + element.height),
      );
      outcome = {
        changed: true,
        width,
        previousHeight,
        height,
        movedBelow: below.length,
        overflows: lowest > PAGE.safeBottom,
      };
    });
  } catch (error) {
    return {
      changed: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  return outcome;
}
