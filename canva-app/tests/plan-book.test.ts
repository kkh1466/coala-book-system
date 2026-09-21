import fs from "node:fs";
import path from "node:path";
import {
  isNumberedPage,
  planBook,
  UNNUMBERED_PAGE_TYPES,
} from "../src/builder/plan-book";
import { layoutBook } from "../src/builder/layout-book";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import type { BookSpec } from "../src/types/book-spec";
import { installRecordingRichtext, wantedSansFonts } from "./helpers/richtext";

const fixturePath = path.resolve(
  process.cwd(),
  "../test-input/prototype-book.md",
);

const readFixture = (): BookSpec =>
  parseBookMarkdown(fs.readFileSync(fixturePath, "utf8"));

beforeEach(() => {
  installRecordingRichtext();
});

describe("book planning pipeline", () => {
  it("keeps the page order and content of the manuscript", () => {
    const spec = readFixture();

    const plan = planBook(spec);

    expect(plan.pages.map((page) => page.id)).toEqual(
      spec.pages.map((page) => page.id),
    );
  });

  it("does not assign page numbers before content is laid out", () => {
    const plan = planBook(readFixture());

    // 번호는 분량 분할이 끝난 뒤에만 생긴다. 여기서 매기면 한 원고 페이지가
    // 여러 장으로 나뉠 때 번호가 어긋난다.
    expect(plan.pages.every((page) => !("pageNumber" in page))).toBe(true);
  });

  it("refuses an automatic table of contents before it is implemented", () => {
    const spec = { ...readFixture(), toc: "auto" as const };

    expect(() => planBook(spec)).toThrow("자동 목차 생성은 아직");
  });
});

describe("page numbering", () => {
  it("numbers physical pages in order once splitting is done", () => {
    const spec = readFixture();
    const plan = planBook(spec);

    const laid = layoutBook(spec, plan.pages, wantedSansFonts);

    expect(laid.length).toBeGreaterThanOrEqual(spec.pages.length);
    expect(laid.map((page) => page.pageNumber)).toEqual(
      laid.map((_, index) => String(index + 1)),
    );
  });

  it("omits page numbers when numbering is none", () => {
    const spec = { ...readFixture(), numbering: "none" as const };
    const plan = planBook(spec);

    const laid = layoutBook(spec, plan.pages, wantedSansFonts);

    expect(laid.every((page) => page.pageNumber === undefined)).toBe(true);
  });
});

describe("page number counting policy", () => {
  it("excludes cover, contents and divider pages from the count", () => {
    expect([...UNNUMBERED_PAGE_TYPES].sort()).toEqual([
      "cover",
      "divider",
      "toc",
    ]);
  });

  it("counts body pages", () => {
    const spec = readFixture();

    expect(spec.pages.every((page) => isNumberedPage(page))).toBe(true);
  });
});
