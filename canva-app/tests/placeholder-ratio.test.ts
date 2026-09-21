import type { PlaceholderRatioDeps } from "../src/builder/placeholder-ratio";
import {
  changeImagePlaceholderRatio,
  listImagePlaceholders,
} from "../src/builder/placeholder-ratio";

type FakeElement = Record<string, unknown> & {
  type: string;
  top: number;
  left: number;
  width: number;
  height: number;
  locked: boolean;
};

const placeholder = (top: number, overrides: Partial<FakeElement> = {}) =>
  ({
    type: "shape",
    top,
    left: 165,
    width: 1190,
    height: 669,
    locked: false,
    paths: {
      toArray: () => [
        {
          fill: {
            isMediaEditable: true,
            colorContainer: { ref: { type: "solid", color: "#E3E7EC" } },
          },
        },
      ],
    },
    ...overrides,
  }) as FakeElement;

/** 안내 글이나 본문 글. `text`는 편집 API의 RichtextRange 대역이다. */
const textElement = (
  top: number,
  content: string,
  overrides: Partial<FakeElement> = {},
) => {
  let current = content;
  return {
    type: "text",
    top,
    left: 165,
    width: 1190,
    height: 75,
    locked: false,
    text: {
      readPlaintext: () => current,
      replaceText: (
        bounds: { index: number; length: number },
        characters: string,
      ) => {
        current =
          current.slice(0, bounds.index) +
          characters +
          current.slice(bounds.index + bounds.length);
      },
    },
    ...overrides,
  } as FakeElement;
};

const LABEL = "🖼 이미지 자리\nnew-project.png · 16:9\n새 프로젝트 만들기 창";

const labelFor = (boxTop: number) =>
  textElement(boxTop + 222, LABEL, { left: 205, width: 1110, height: 225 });

/** 편집 API 대역. 위치는 바로 바뀌고, 넣고 지운 것은 sync()해야 반영된다. */
function fakePage(
  elements: FakeElement[],
  options: { sync?: () => Promise<void> } = {},
) {
  const calls = { sync: 0 };
  const deps: PlaceholderRatioDeps = {
    openDesign: (async (
      _options: unknown,
      callback: (session: unknown) => Promise<void>,
    ) => {
      const draft = [...elements];
      await callback({
        page: {
          type: "absolute",
          elements: {
            toArray: () => [...draft],
            filter: (predicate: (element: FakeElement) => boolean) =>
              draft.filter(predicate),
            insertBefore: (ref: FakeElement, state: FakeElement) => {
              draft.splice(draft.indexOf(ref), 0, state);
              return state;
            },
            delete: (element: FakeElement) => {
              draft.splice(draft.indexOf(element), 1);
            },
          },
        },
        helpers: {
          elementStateBuilder: {
            createShapeElement: (opts: object) => ({ type: "shape", ...opts }),
          },
        },
        sync: async () => {
          calls.sync += 1;
          await options.sync?.();
          elements.splice(0, elements.length, ...draft);
        },
      });
    }) as never,
  };
  return { deps, calls };
}

const readText = (element: FakeElement | undefined): string =>
  (element?.text as { readPlaintext: () => string }).readPlaintext();

describe("listing the image placeholders of the current page", () => {
  it("lists empty placeholders from top to bottom with their guide text", async () => {
    const lower = placeholder(1500, { width: 595, height: 595 });
    const upper = placeholder(300);
    const { deps, calls } = fakePage([lower, upper, labelFor(300)]);

    const list = await listImagePlaceholders(deps);

    expect(list).toEqual({
      ok: true,
      placeholders: [
        { index: 0, width: 1190, height: 669, labelText: LABEL },
        { index: 1, width: 595, height: 595, labelText: undefined },
      ],
    });
    expect(calls.sync).toBe(0);
  });
});

describe("changing the aspect ratio of an image placeholder", () => {
  it("swaps the placeholder in place, keeps it a drop target, and carries the page along", async () => {
    const card = placeholder(100, { height: 300 });
    (card.paths as { toArray: () => unknown[] }).toArray = () => [
      { fill: { isMediaEditable: false, colorContainer: { ref: undefined } } },
    ];
    const box = placeholder(724);
    const label = labelFor(724);
    const caption = textElement(1397, "그림 1-4 새 프로젝트 만들기");
    const paragraph = textElement(1500, "이 화면이 보이면 끝난 것입니다.");
    const above = textElement(621, "다음 화면이 나옵니다.");
    const pageNumber = textElement(2150, "7", { left: 1335, width: 80 });
    const elements = [card, above, box, label, caption, paragraph, pageNumber];
    const { deps, calls } = fakePage(elements);

    const outcome = await changeImagePlaceholderRatio(
      { ratio: 4 / 3, ratioLabel: "4:3", index: 0 },
      deps,
    );

    // 669 → 893: 아래의 캡션과 문단 두 개가 224px씩 내려간다.
    expect(outcome).toEqual({
      changed: true,
      width: 1190,
      previousHeight: 669,
      height: 893,
      movedBelow: 2,
      overflows: false,
    });
    expect(calls.sync).toBe(1);
    expect(elements[2]).toEqual({
      type: "shape",
      top: 724,
      left: 165,
      width: 1190,
      height: 893,
      viewBox: { top: 0, left: 0, width: 1190, height: 893 },
      paths: [
        {
          d: "M 0 0 H 1190 V 893 H 0 Z",
          fill: {
            colorContainer: { type: "solid", color: "#e3e7ec" },
            isMediaEditable: true,
          },
        },
      ],
    });
    // 쌓임 순서가 그대로여서 안내 글은 계속 자리 위에 있다.
    expect(elements.indexOf(label)).toBe(3);
    expect(caption.top).toBe(1397 + 224);
    expect(paragraph.top).toBe(1500 + 224);
    // 위의 글, 다른 도형, 쪽번호는 제자리다.
    expect(above.top).toBe(621);
    expect(card.top).toBe(100);
    expect(pageNumber.top).toBe(2150);
    // 안내 글은 새 상자의 가운데로 가고, 표기도 새 비율이 된다.
    expect(label.top).toBe(724 + Math.round((893 - 225) / 2));
    expect(readText(label)).toBe(
      "🖼 이미지 자리\nnew-project.png · 4:3\n새 프로젝트 만들기 창",
    );
  });

  it("pulls the page up when the placeholder gets shorter", async () => {
    const box = placeholder(724);
    const paragraph = textElement(1500, "아래 문단");
    const { deps } = fakePage([box, labelFor(724), paragraph]);

    const outcome = await changeImagePlaceholderRatio(
      { ratio: 4, ratioLabel: "4:1", index: 0 },
      deps,
    );

    expect(outcome).toMatchObject({ changed: true, height: 298 });
    expect(paragraph.top).toBe(1500 - (669 - 298));
  });

  it("warns when the content below is pushed out of the body area", async () => {
    const box = placeholder(724);
    const paragraph = textElement(1900, "지면 끝의 문단");
    const { deps } = fakePage([box, paragraph]);

    const outcome = await changeImagePlaceholderRatio(
      { ratio: 1, ratioLabel: "1:1", index: 0 },
      deps,
    );

    expect(outcome).toMatchObject({ changed: true, overflows: true });
  });

  it("changes the placeholder picked from the top of the page, whatever the stacking order", async () => {
    const lower = placeholder(1500);
    const upper = placeholder(300);
    const elements = [lower, upper];
    const { deps } = fakePage(elements);

    await changeImagePlaceholderRatio(
      { ratio: 1, ratioLabel: "1:1", index: 1 },
      deps,
    );

    expect(elements[0]).toMatchObject({ top: 1500, height: 1190 });
    expect(elements[1]).toBe(upper);
    // 위쪽 자리는 아래쪽 자리보다 위에 있으므로 움직이지 않는다.
    expect(upper.top).toBe(300);
  });

  it("leaves a guide without a ratio alone", async () => {
    const box = placeholder(724);
    const label = textElement(900, "new-project.png", { left: 205 });
    const { deps } = fakePage([box, label]);

    await changeImagePlaceholderRatio(
      { ratio: 1, ratioLabel: "1:1", index: 0 },
      deps,
    );

    expect(readText(label)).toBe("new-project.png");
  });

  it.each([
    [
      "the page has no empty placeholder",
      [textElement(100, "글")],
      0,
      "이미지 자리가 없습니다",
    ],
    [
      "the index is past the last placeholder",
      [placeholder(724)],
      3,
      "1곳입니다",
    ],
    [
      "the placeholder is locked",
      [placeholder(724, { locked: true })],
      0,
      "잠겨",
    ],
  ])("changes nothing when %s", async (_name, elements, index, reason) => {
    const before = [...elements];
    const { deps, calls } = fakePage(elements);

    const outcome = await changeImagePlaceholderRatio(
      { ratio: 1, ratioLabel: "1:1", index },
      deps,
    );

    expect(outcome.changed === false && outcome.reason).toContain(reason);
    expect(calls.sync).toBe(0);
    expect(elements).toEqual(before);
  });

  it("keeps the original placeholder when the change cannot be saved", async () => {
    const original = placeholder(724);
    const elements = [original];
    const { deps } = fakePage(elements, {
      sync: async () => {
        throw new Error("rate limited");
      },
    });

    const outcome = await changeImagePlaceholderRatio(
      { ratio: 4 / 3, ratioLabel: "4:3", index: 0 },
      deps,
    );

    expect(outcome).toEqual({ changed: false, reason: "rate limited" });
    expect(elements).toEqual([original]);
  });
});
