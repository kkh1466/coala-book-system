import fs from "node:fs";
import path from "node:path";
import { layoutPage, preparePage } from "../src/builder/create-page";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import { PAGE } from "../src/theme/page-layout";
import {
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

beforeEach(() => {
  installRecordingRichtext();
});

describe("implemented page renderers", () => {
  const readSpec = () =>
    parseBookMarkdown(
      fs.readFileSync(
        path.resolve(process.cwd(), "../test-input/prototype-book.md"),
        "utf8",
      ),
    );

  it("lays out every page in the canonical Markdown fixture", () => {
    const spec = readSpec();
    const plan = planBook(spec);

    const laid = layoutBook(spec, plan.pages, wantedSansFonts);

    expect(laid.length).toBeGreaterThanOrEqual(5);
    laid.forEach((page) => {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.elements.length).toBeGreaterThan(0);
    });
  });

  it("keeps every text element at or above the fixed minimum size", () => {
    const spec = readSpec();
    const plan = planBook(spec);

    const laid = layoutBook(spec, plan.pages, wantedSansFonts);

    for (const page of laid) {
      const prepared = preparePage(page, wantedSansFonts, page.pageNumber);
      for (const element of textElements(prepared.elements)) {
        const minimum = element.top >= PAGE.safeBottom ? 22 : 28;
        expect(element.fontSizePt).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("keeps the same left margin on every page", () => {
    const spec = readSpec();
    const plan = planBook(spec);

    const laid = layoutBook(spec, plan.pages, wantedSansFonts);
    const lefts = laid.flatMap((page) =>
      textElements(page.elements)
        .filter((element) => element.left < PAGE.width / 2)
        .map((element) => element.left),
    );

    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(PAGE.marginX);
  });

  it("refuses an unsupported page type by name", () => {
    expect(() =>
      layoutPage({ type: "unknown", id: "x" } as never, wantedSansFonts),
    ).toThrow("지원하지 않는 페이지 형식입니다");
  });
});
