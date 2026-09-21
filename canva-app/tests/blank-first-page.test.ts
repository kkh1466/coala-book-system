import type { ElementAtPoint } from "@canva/design";
import type { BlankFirstPageDeps } from "../src/builder/blank-first-page";
import { tryFillBlankFirstPage } from "../src/builder/blank-first-page";
import { createBook } from "../src/builder/create-book";
import type { PreparedPage } from "../src/builder/create-page";
import { createFakeCanva, fivePageBook } from "./helpers/fake-canva";

type FakePage = {
  type: "absolute" | "unsupported";
  id: string;
  locked: boolean;
  dimensions?: { width: number; height: number };
  inserted: unknown[];
  /** 이미 디자인에 반영된 요소 수. */
  committed: number;
};

const blankPage = (overrides: Partial<FakePage> = {}): FakePage => ({
  type: "absolute",
  id: "page-blank",
  locked: false,
  dimensions: { width: 1587, height: 2245 },
  inserted: [],
  committed: 0,
  ...overrides,
});

/** 편집 API 대역. sync()가 불려야만 넣은 요소가 디자인에 반영된다. */
function fakeEditing(
  page: FakePage,
  options: { pageCount?: number; sync?: () => Promise<void> } = {},
) {
  const calls = { sync: 0, background: [] as unknown[], opened: 0 };
  const deps: BlankFirstPageDeps = {
    getDesignPageCount: async () => options.pageCount ?? 1,
    setCurrentPageBackground: (async (fill: unknown) => {
      calls.background.push(fill);
    }) as never,
    openDesign: (async (
      _options: unknown,
      callback: (session: unknown) => Promise<void>,
    ) => {
      calls.opened += 1;
      const pending: unknown[] = [];
      await callback({
        page: {
          type: page.type,
          id: page.id,
          locked: page.locked,
          dimensions: page.dimensions,
          elements: {
            count: () => page.committed,
            insertAfter: (_ref: unknown, state: unknown) => {
              pending.push(state);
              return state;
            },
          },
        },
        helpers: {
          elementStateBuilder: {
            createTextElement: (opts: object) => ({ kind: "text", ...opts }),
            createShapeElement: (opts: object) => ({ kind: "shape", ...opts }),
          },
        },
        sync: async () => {
          calls.sync += 1;
          await options.sync?.();
          page.inserted.push(...pending);
          page.committed += pending.length;
        },
      });
    }) as never,
  };
  return { deps, calls };
}

const shape: ElementAtPoint = {
  type: "shape",
  left: 165,
  top: 724,
  width: 1190,
  height: 669,
  viewBox: { left: 0, top: 0, width: 1190, height: 669 },
  paths: [
    {
      d: "M 0 0 H 1190 V 669 H 0 Z",
      fill: { dropTarget: true, color: "#E3E7EC" },
      stroke: { color: "#D8DDE3", weight: 2, strokeAlign: "inset" },
    },
  ],
};

const text = {
  type: "richtext",
  left: 165,
  top: 145,
  width: 1257,
  range: {
    readTextRegions: () => [{ text: "제목", formatting: { fontSize: 40 } }],
  },
} as unknown as ElementAtPoint;

const prepared: PreparedPage = {
  title: "첫 장",
  key: "p1#0",
  elements: [shape, text],
};

describe("reusing the blank first page of a new design", () => {
  it("draws the first book page onto the blank page in one sync", async () => {
    const page = blankPage();
    const { deps, calls } = fakeEditing(page);

    const outcome = await tryFillBlankFirstPage(prepared, deps);

    expect(outcome).toEqual({ reused: true, pageId: "page-blank" });
    expect(calls.sync).toBe(1);
    expect(calls.background).toEqual([{ color: "#F8F9FA" }]);
    // 순서가 곧 쌓이는 순서다. addPage()에 보내던 순서 그대로여야 한다.
    expect(page.inserted).toEqual([
      {
        kind: "shape",
        top: 724,
        left: 165,
        width: 1190,
        height: 669,
        viewBox: { left: 0, top: 0, width: 1190, height: 669 },
        paths: [
          {
            d: "M 0 0 H 1190 V 669 H 0 Z",
            fill: {
              colorContainer: { type: "solid", color: "#e3e7ec" },
              isMediaEditable: true,
            },
            stroke: {
              weight: 2,
              colorContainer: { type: "solid", color: "#d8dde3" },
            },
          },
        ],
      },
      {
        kind: "text",
        top: 145,
        left: 165,
        width: 1257,
        text: { regions: [{ text: "제목", formatting: { fontSize: 40 } }] },
      },
    ]);
  });

  it.each([
    ["the design already has several pages", blankPage(), 3, "not-applicable"],
    [
      "the page already has content",
      blankPage({ committed: 2 }),
      1,
      "not-applicable",
    ],
    ["the blank page is locked", blankPage({ locked: true }), 1, "failed"],
    [
      "the blank page is a different size",
      blankPage({ dimensions: { width: 1080, height: 1080 } }),
      1,
      "failed",
    ],
    [
      "the page is not a fixed-size page",
      blankPage({ type: "unsupported" }),
      1,
      "failed",
    ],
  ])(
    "leaves the design untouched when %s",
    async (_name, page, pageCount, kind) => {
      const { deps, calls } = fakeEditing(page, { pageCount });

      const outcome = await tryFillBlankFirstPage(prepared, deps);

      expect(outcome).toMatchObject({ reused: false, kind });
      expect(calls.sync).toBe(0);
      expect(calls.background).toEqual([]);
      expect(page.inserted).toEqual([]);
    },
  );

  it("names both sizes when the blank page does not match the book", async () => {
    const { deps } = fakeEditing(
      blankPage({ dimensions: { width: 1080, height: 1350 } }),
    );

    const outcome = await tryFillBlankFirstPage(prepared, deps);

    expect(outcome).toMatchObject({
      reason: expect.stringMatching(/1080 × 1350.*1587 × 2245/),
    });
  });

  it("reports a failure, not a reuse, when sync rejects and nothing landed", async () => {
    const page = blankPage();
    const { deps } = fakeEditing(page, {
      sync: async () => {
        throw new Error("font could not be applied");
      },
    });

    const outcome = await tryFillBlankFirstPage(prepared, deps);

    expect(outcome).toEqual({
      reused: false,
      kind: "failed",
      reason: "font could not be applied",
    });
    expect(page.committed).toBe(0);
  });

  it("counts the page as reused when sync errors after the elements landed", async () => {
    // 이때 addPage()로 다시 만들면 첫 장이 두 번 생긴다.
    const page = blankPage();
    const { deps } = fakeEditing(page, {
      sync: async () => {
        page.committed = 2;
        throw new Error("timed out");
      },
    });

    const outcome = await tryFillBlankFirstPage(prepared, deps);

    expect(outcome).toMatchObject({ reused: true });
  });

  it("refuses an element it cannot carry over before touching the page", async () => {
    const page = blankPage();
    const { deps, calls } = fakeEditing(page);
    const withGroup: PreparedPage = {
      ...prepared,
      elements: [{ type: "group", children: [] } as unknown as ElementAtPoint],
    };

    const outcome = await tryFillBlankFirstPage(withGroup, deps);

    expect(outcome).toMatchObject({ reused: false, kind: "failed" });
    expect(calls.sync).toBe(0);
  });
});

describe("book generation with a blank first page", () => {
  it("fills the blank page with page 1 and adds only the remaining pages", async () => {
    const canva = createFakeCanva();
    const filled: string[] = [];

    const result = await createBook(fivePageBook(), {
      ...canva.deps,
      fillBlankFirstPage: async (page) => {
        filled.push(page.key);
        return { reused: true };
      },
    });

    expect(filled).toHaveLength(1);
    expect(canva.createdKeys).not.toContain(filled[0]);
    expect(canva.createdKeys).toHaveLength(result.pageCount - 1);
    expect(result.createdPageCount).toBe(result.pageCount);
    expect(result.records[0]).toMatchObject({ index: 0, status: "done" });
    expect(result.blankFirstPage).toEqual({ reused: true });
  });

  it("adds page 1 with addPage exactly as before when the blank page cannot be used", async () => {
    const canva = createFakeCanva();

    const result = await createBook(fivePageBook(), {
      ...canva.deps,
      fillBlankFirstPage: async () => ({
        reused: false,
        kind: "failed",
        reason: "크기가 다릅니다.",
      }),
    });

    expect(canva.createdKeys).toHaveLength(result.pageCount);
    expect(result.createdPageCount).toBe(result.pageCount);
    expect(result.blankFirstPage).toMatchObject({ reused: false });
  });

  it("never tries the blank page when resuming a partly generated book", async () => {
    const canva = createFakeCanva();
    const fill = jest.fn();

    const result = await createBook(
      fivePageBook(),
      { ...canva.deps, fillBlankFirstPage: fill },
      { alreadyCreatedIndexes: [0, 1] },
    );

    expect(fill).not.toHaveBeenCalled();
    expect(result.blankFirstPage).toBeUndefined();
    expect(canva.createdKeys).toHaveLength(result.pageCount - 2);
  });

  it("reports every page as completed when page 1 went onto the blank page", async () => {
    const canva = createFakeCanva();
    const done: number[] = [];

    const result = await createBook(
      fivePageBook(),
      { ...canva.deps, fillBlankFirstPage: async () => ({ reused: true }) },
      {
        onProgress: (event) => {
          if (event.type === "page-done") {
            done.push(event.completed);
          }
        },
      },
    );

    expect(done).toEqual(
      Array.from({ length: result.pageCount }, (_, index) => index + 1),
    );
  });
});
