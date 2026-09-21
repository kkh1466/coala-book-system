import fs from "node:fs";
import path from "node:path";
import type { Font, FontRef } from "@canva/asset";
import { createRichtextRange } from "@canva/design";
import { createBook } from "../src/builder/create-book";
import type { PreparedPage } from "../src/builder/create-page";
import { discoverFontCandidates } from "../src/builder/font-application";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import type { BookSpec } from "../src/types/book-spec";

const fixture = (): BookSpec =>
  parseBookMarkdown(
    fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/prototype-book.md"),
      "utf8",
    ),
  );

const font = (name: string, ref: string): Font => ({
  name,
  ref: ref as FontRef,
  weights: [
    { weight: "normal", styles: ["normal"] },
    { weight: "bold", styles: ["normal"] },
  ],
});

const wantedSans = font("Wanted Sans", "wanted-sans-ref");
const notoSansKr = font("Noto Sans KR", "noto-sans-kr-ref");

type Format = { fontRef?: string; fontWeight?: string };
type WrittenPage = { title: string; formats: Format[] };

/**
 * 각 페이지가 실제로 어떤 fontRef로 문단 서식을 지정했는지 기록한다.
 * 페이지 유형별로 글꼴이 갈라지는지 여기서 직접 확인한다.
 */
function createHarness(options: {
  listedFonts: Font[];
  designFonts?: Font[];
  rejectFontRef?: string;
}) {
  const pending: Format[] = [];
  jest.mocked(createRichtextRange).mockImplementation(
    () =>
      ({
        appendText: jest.fn(),
        formatParagraph: jest.fn((_bounds: unknown, formatting: Format) => {
          pending.push({
            fontRef: formatting.fontRef,
            fontWeight: formatting.fontWeight,
          });
        }),
      }) as never,
  );

  const written: WrittenPage[] = [];
  const writeCalls: (string | undefined)[] = [];

  return {
    written,
    writeCalls,
    deps: {
      // 요청 간격과 재시도 지연은 rate-limit 전용 테스트에서 따로 검증한다.
      // 여기서는 글꼴 판정만 보므로 실제로 기다리지 않는다.
      sleep: async () => {},
      discoverFontCandidates: () =>
        discoverFontCandidates({
          findFonts: jest
            .fn()
            .mockResolvedValue({ fonts: options.listedFonts }),
          scanDesignFonts: jest
            .fn()
            .mockResolvedValue({ fonts: options.designFonts ?? [] }),
        }),
      writePage: async (page: PreparedPage) => {
        const formats = pending.splice(0);
        const usedRef = formats[0]?.fontRef;
        writeCalls.push(usedRef);
        if (
          options.rejectFontRef !== undefined &&
          usedRef === options.rejectFontRef
        ) {
          throw new Error("Canva could not apply the requested font.");
        }
        written.push({ title: page.title, formats });
        return undefined;
      },
    },
  };
}

const allFontRefs = (written: WrittenPage[]) =>
  new Set(written.flatMap(({ formats }) => formats.map((f) => f.fontRef)));

describe("font applied across every page type", () => {
  it("uses Wanted Sans on all five page types", async () => {
    const harness = createHarness({ listedFonts: [wantedSans, notoSansKr] });

    const result = await createBook(fixture(), harness.deps);

    expect(result.pageCount).toBe(5);
    expect(harness.written).toHaveLength(5);
    // chapter-opening, concept, comparison, practice-opening, practice-checklist
    harness.written.forEach((page) => {
      expect(page.formats.length).toBeGreaterThan(0);
    });
    expect(allFontRefs(harness.written)).toEqual(
      new Set([wantedSans.ref as string]),
    );
    expect(result.font.usedWantedSans).toBe(true);
    expect(result.font.applied.familyName).toBe("Wanted Sans");
    expect(result.font.attempts).toEqual([]);
  });

  it("applies both regular and bold of the same family, not a second font", async () => {
    const harness = createHarness({ listedFonts: [wantedSans] });

    await createBook(fixture(), harness.deps);

    const weights = new Set(
      harness.written.flatMap(({ formats }) =>
        formats.map(({ fontWeight }) => fontWeight),
      ),
    );
    expect(weights).toEqual(new Set(["normal", "bold"]));
    expect(allFontRefs(harness.written)).toEqual(
      new Set([wantedSans.ref as string]),
    );
  });

  it("does not block generation when findFonts omits Wanted Sans", async () => {
    // 현재 사용자 환경이 바로 이 경우다. 편집기에는 Wanted Sans가 있지만
    // findFonts()는 일부만 돌려주어 목록에 나타나지 않는다.
    const harness = createHarness({
      listedFonts: [notoSansKr],
      designFonts: [wantedSans],
    });

    const result = await createBook(fixture(), harness.deps);

    expect(result.pageCount).toBe(5);
    expect(result.font.usedWantedSans).toBe(true);
    expect(result.font.discovery.wantedSansInList).toBe(false);
    expect(result.font.discovery.wantedSansInDesign).toBe(true);
    expect(allFontRefs(harness.written)).toEqual(
      new Set([wantedSans.ref as string]),
    );
  });

  it("generates with the Canva default font rather than refusing when no font resolves", async () => {
    const harness = createHarness({ listedFonts: [] });

    const result = await createBook(fixture(), harness.deps);

    expect(result.pageCount).toBe(5);
    expect(allFontRefs(harness.written)).toEqual(new Set([undefined]));
    expect(result.font.applied.source).toBe("canva-default");
    expect(result.font.fallbackReason).toContain("일부만 돌려줍니다");
  });
});

describe("fallback only after a real failure", () => {
  it("switches to Noto Sans KR when the real Wanted Sans call fails, and uses it everywhere", async () => {
    const harness = createHarness({
      listedFonts: [wantedSans, notoSansKr],
      rejectFontRef: wantedSans.ref,
    });

    const result = await createBook(fixture(), harness.deps);

    // 1페이지를 Wanted Sans로 실제 시도해 실패한 뒤 Noto Sans KR로 다시 만든다.
    expect(harness.writeCalls[0]).toBe(wantedSans.ref);
    expect(result.font.usedWantedSans).toBe(false);
    expect(result.font.applied.familyName).toBe("Noto Sans KR");
    expect(result.font.attempts).toHaveLength(1);
    expect(result.font.attempts[0]).toMatchObject({
      familyName: "Wanted Sans",
      call: "@canva/design addPage()",
      errorMessage: "Canva could not apply the requested font.",
    });

    // 대체 뒤에도 페이지 유형별로 갈라지지 않고 5개 전부 같은 글꼴을 쓴다.
    expect(harness.written).toHaveLength(5);
    expect(allFontRefs(harness.written)).toEqual(
      new Set([notoSansKr.ref as string]),
    );
  });

  it("does not fall back when Wanted Sans actually works", async () => {
    const harness = createHarness({
      listedFonts: [wantedSans, notoSansKr],
      rejectFontRef: notoSansKr.ref,
    });

    const result = await createBook(fixture(), harness.deps);

    expect(result.font.usedWantedSans).toBe(true);
    expect(harness.writeCalls).toEqual(Array(5).fill(wantedSans.ref));
  });
});
