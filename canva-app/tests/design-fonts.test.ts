import type { Font, FontRef } from "@canva/asset";
import type { openDesign } from "@canva/design";
import { MAX_SCANNED_PAGES, scanDesignFonts } from "../src/theme/design-fonts";

const textElement = (...fontRefs: (string | undefined)[]) => ({
  type: "text",
  text: {
    readTextRegions: () =>
      fontRefs.map((fontRef) => ({
        text: "본문",
        formatting: fontRef ? { fontRef } : {},
      })),
  },
});

const groupElement = (children: unknown[]) => ({
  type: "group",
  contents: { toArray: () => children },
});

const shapeElement = { type: "shape" };

/** openDesign({ type: "all_pages" }) 세션을 흉내 낸다. */
const fakeOpenDesign = (pages: unknown[][]) =>
  jest.fn(
    async (
      _options: unknown,
      callback: (session: unknown) => Promise<void>,
    ) => {
      let cursor = 0;
      await callback({
        pageRefs: {
          toArray: () => pages.map(() => ({ type: "absolute", locked: false })),
        },
        helpers: {
          openPage: async (
            _ref: unknown,
            onPage: (result: unknown) => Promise<void>,
          ) => {
            const elements = pages[cursor] ?? [];
            cursor += 1;
            await onPage({ page: { elements: { toArray: () => elements } } });
            return { status: "executed" };
          },
        },
        sync: async () => undefined,
      });
    },
  ) as unknown as typeof openDesign;

const wantedSans: Font = {
  name: "Wanted Sans",
  ref: "wanted-sans-ref" as FontRef,
  weights: [{ weight: "normal", styles: ["normal"] }],
};

describe("scanning fonts the design already uses", () => {
  it("collects font refs from text elements, including inside groups", async () => {
    const findFonts = jest.fn().mockResolvedValue({ fonts: [wantedSans] });

    const scan = await scanDesignFonts({
      openDesign: fakeOpenDesign([
        [shapeElement, textElement("wanted-sans-ref")],
        [groupElement([textElement("nested-ref")])],
      ]),
      findFonts,
    });

    expect(findFonts).toHaveBeenCalledWith({
      fontRefs: ["wanted-sans-ref", "nested-ref"],
    });
    expect(scan.fonts).toEqual([wantedSans]);
    expect(scan.error).toBeUndefined();
  });

  it("asks Canva for each ref only once", async () => {
    const findFonts = jest.fn().mockResolvedValue({ fonts: [] });

    await scanDesignFonts({
      openDesign: fakeOpenDesign([
        [textElement("same-ref", "same-ref")],
        [textElement("same-ref")],
      ]),
      findFonts,
    });

    expect(findFonts).toHaveBeenCalledWith({ fontRefs: ["same-ref"] });
  });

  it("does not call findFonts when the design has no text", async () => {
    const findFonts = jest.fn();

    const scan = await scanDesignFonts({
      openDesign: fakeOpenDesign([[shapeElement]]),
      findFonts,
    });

    expect(findFonts).not.toHaveBeenCalled();
    expect(scan.fonts).toEqual([]);
  });

  it("stops after the page cap so a long design does not stall generation", async () => {
    const pages = Array.from(
      { length: MAX_SCANNED_PAGES + 5 },
      (_unused, index) => [textElement(`ref-${index}`)],
    );
    const findFonts = jest.fn().mockResolvedValue({ fonts: [] });

    await scanDesignFonts({ openDesign: fakeOpenDesign(pages), findFonts });

    const [[{ fontRefs }]] = findFonts.mock.calls as [[{ fontRefs: string[] }]];
    expect(fontRefs).toHaveLength(MAX_SCANNED_PAGES);
  });

  it("reports a scan failure instead of throwing", async () => {
    const scan = await scanDesignFonts({
      openDesign: jest
        .fn()
        .mockRejectedValue(
          new Error("openDesign is not supported here"),
        ) as unknown as typeof openDesign,
      findFonts: jest.fn(),
    });

    expect(scan.fonts).toEqual([]);
    expect(scan.error).toBe("openDesign is not supported here");
  });
});
