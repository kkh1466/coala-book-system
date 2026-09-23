import type { findFonts, Font, FontRef } from "@canva/asset";
import {
  BOOK_FONT_FAMILY,
  buildFontCandidates,
  FALLBACK_FONT_FAMILY,
  findFontsByName,
  FlowchartFontNotFoundError,
  fontNameWords,
  looksKorean,
  matchFontName,
  pickWeights,
  resolveFlowchartFont,
} from "../src/theme/font-resolver";

const font = (
  name: string,
  ref: string,
  weights = ["normal", "bold"],
): Font => ({
  name,
  ref: ref as FontRef,
  weights: weights.map((weight) => ({
    weight: weight as Font["weights"][number]["weight"],
    styles: ["normal"],
  })),
});

const wantedSans = font("Wanted Sans", "wanted-sans-ref");
const notoSansKr = font("Noto Sans KR", "noto-sans-kr-ref");
const flowchartFont = font(
  "Hakgyoansim Chilpanjiugae OTF",
  "flowchart-font-ref",
  ["normal"],
);

const mockFindFonts = (fonts: Font[]) =>
  jest.fn().mockResolvedValue({ fonts }) as unknown as typeof findFonts;

describe("font name comparison", () => {
  it("ignores surrounding and repeated whitespace", () => {
    expect(matchFontName("  Wanted   Sans  ", BOOK_FONT_FAMILY)).toBe("exact");
  });

  it("ignores letter case", () => {
    expect(matchFontName("WANTED SANS", BOOK_FONT_FAMILY)).toBe("exact");
    expect(matchFontName("wanted sans", BOOK_FONT_FAMILY)).toBe("exact");
  });

  it("treats a style name as the same family", () => {
    expect(matchFontName("Wanted Sans Regular", BOOK_FONT_FAMILY)).toBe(
      "exact",
    );
    expect(matchFontName("Wanted Sans Bold", BOOK_FONT_FAMILY)).toBe("exact");
    expect(matchFontName("Wanted Sans SemiBold Italic", BOOK_FONT_FAMILY)).toBe(
      "exact",
    );
  });

  it("matches an internal name written without spaces", () => {
    expect(matchFontName("WantedSans", BOOK_FONT_FAMILY)).toBe("exact");
    expect(matchFontName("wantedsans", BOOK_FONT_FAMILY)).toBe("compact");
    expect(matchFontName("Wanted-Sans", BOOK_FONT_FAMILY)).toBe("exact");
    expect(matchFontName("Wanted_Sans", BOOK_FONT_FAMILY)).toBe("exact");
  });

  it("keeps a wider family name as a family match, not an exact one", () => {
    expect(matchFontName("Wanted Sans Variable", BOOK_FONT_FAMILY)).toBe(
      "exact",
    );
    expect(matchFontName("Wanted Sans Std", BOOK_FONT_FAMILY)).toBe("family");
  });

  it("does not match a different family", () => {
    expect(matchFontName("Open Sans", BOOK_FONT_FAMILY)).toBe("none");
    expect(matchFontName("Noto Sans KR", BOOK_FONT_FAMILY)).toBe("none");
  });

  it("splits camel case and punctuation into words", () => {
    expect(fontNameWords("Wanted-Sans_Bold")).toEqual([
      "wanted",
      "sans",
      "bold",
    ]);
  });

  it("prefers the closest match when several fonts share a family", () => {
    const variable = font("Wanted Sans Std", "variable-ref");
    const exact = font("Wanted Sans Regular", "regular-ref");

    expect(
      findFontsByName([variable, exact], BOOK_FONT_FAMILY).map(
        ({ ref }) => ref,
      ),
    ).toEqual(["regular-ref", "variable-ref"]);
  });
});

describe("weight selection", () => {
  it("uses normal and bold when both exist", () => {
    expect(pickWeights(wantedSans.weights)).toEqual({
      regularWeight: "normal",
      boldWeight: "bold",
    });
  });

  it("does not reject a font that exposes only one weight", () => {
    expect(pickWeights([{ weight: "medium", styles: ["normal"] }])).toEqual({
      regularWeight: "medium",
      boldWeight: "medium",
    });
  });

  it("falls back to the closest available emphasis weight", () => {
    expect(
      pickWeights([
        { weight: "normal", styles: ["normal"] },
        { weight: "semibold", styles: ["normal"] },
      ]),
    ).toEqual({ regularWeight: "normal", boldWeight: "semibold" });
  });

  it("uses safe defaults when the font lists no weights", () => {
    expect(pickWeights([])).toEqual({
      regularWeight: "normal",
      boldWeight: "bold",
    });
  });
});

describe("korean font detection", () => {
  it("detects hangul names and known korean families", () => {
    expect(looksKorean("나눔고딕")).toBe(true);
    expect(looksKorean("Noto Sans KR")).toBe(true);
    expect(looksKorean("Pretendard")).toBe(true);
    expect(looksKorean("Nanum Gothic")).toBe(true);
  });

  it("does not treat a latin-only family as korean", () => {
    expect(looksKorean("Open Sans")).toBe(false);
    expect(looksKorean("Roboto")).toBe(false);
  });
});

describe("candidate ordering", () => {
  it("puts Wanted Sans first even when other fonts are listed", () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [notoSansKr, wantedSans, font("Open Sans", "open-sans-ref")],
    });

    expect(candidates[0]?.familyName).toBe("Wanted Sans");
    expect(candidates[1]?.familyName).toBe("Noto Sans KR");
    expect(report.wantedSansInList).toBe(true);
  });

  it("still offers Wanted Sans when only the design knows it", () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [notoSansKr],
      designFonts: [wantedSans],
    });

    expect(candidates[0]).toMatchObject({
      familyName: "Wanted Sans",
      source: "design-scan",
    });
    expect(report.wantedSansInList).toBe(false);
    expect(report.wantedSansInDesign).toBe(true);
  });

  it("orders fallbacks as Noto Sans KR, then other korean fonts", () => {
    const { candidates } = buildFontCandidates({
      listedFonts: [
        font("Open Sans", "open-sans-ref"),
        font("나눔명조", "nanum-myeongjo-ref"),
        notoSansKr,
      ],
    });

    expect(candidates.map(({ familyName }) => familyName)).toEqual([
      FALLBACK_FONT_FAMILY,
      "나눔명조",
      "Canva 디자인 기본 글꼴",
    ]);
  });

  it("always ends with an unspecified-font candidate so generation is never blocked", () => {
    const { candidates } = buildFontCandidates({ listedFonts: [] });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: "canva-default",
      fontRef: undefined,
    });
  });

  it("does not repeat the same font ref", () => {
    const { candidates } = buildFontCandidates({
      listedFonts: [wantedSans],
      designFonts: [wantedSans],
    });

    expect(
      candidates.filter(({ fontRef }) => fontRef === wantedSans.ref),
    ).toHaveLength(1);
  });

  it("records why a lookup produced nothing", () => {
    const { report } = buildFontCandidates({
      listedFonts: [],
      findFontsError: "boom",
      designScanError: "not supported",
    });

    expect(report).toMatchObject({
      listedFontCount: 0,
      wantedSansInList: false,
      wantedSansInDesign: false,
      findFontsError: "boom",
      designScanError: "not supported",
    });
  });
});

describe("flowchart font resolver", () => {
  it("returns only the exact Hakgyoansim family", async () => {
    await expect(
      resolveFlowchartFont(mockFindFonts([wantedSans, flowchartFont])),
    ).resolves.toEqual({
      familyName: "Hakgyoansim Chilpanjiugae OTF",
      fontRef: flowchartFont.ref,
      availableWeights: ["normal"],
    });
  });

  it("does not silently substitute Wanted Sans", async () => {
    await expect(
      resolveFlowchartFont(mockFindFonts([wantedSans])),
    ).rejects.toBeInstanceOf(FlowchartFontNotFoundError);
  });
});
