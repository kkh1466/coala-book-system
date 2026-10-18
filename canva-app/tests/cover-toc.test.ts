import fs from "node:fs";
import path from "node:path";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { preparePage } from "../src/builder/create-page";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import { PAGE, TOC } from "../src/theme/page-layout";
import { TYPOGRAPHY } from "../src/theme/typography";
import {
  findText,
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

beforeEach(() => {
  installRecordingRichtext();
});

const manuscriptPath = path.resolve(
  process.cwd(),
  "../coala-book-md/ai-math/cover-toc.md",
);

const source = (body: string, frontMatter = "") =>
  [
    "---",
    "schema_version: 1",
    "title: 표지 시험",
    ...(frontMatter ? [frontMatter] : []),
    "---",
    "",
    body,
  ].join("\n");

const cover = (attributes = "", body = "# AI와 함께하는 앱 개발") =>
  [`:::page{type="cover" id="cover"${attributes}}`, body, ":::"].join("\n");

const toc = (rows: string[], header = "| 번호 | 제목 | 쪽 |\n|---|---|---|") =>
  [':::page{type="toc" id="toc"}', "# 목차", "", header, ...rows, ":::"].join(
    "\n",
  );

describe("cover page", () => {
  it("reads the title, subtitle and brand, and takes the institution from front matter", () => {
    const spec = parseBookMarkdown(
      source(
        cover(' brand="THE COALA"', "# AI와 함께하는 앱 개발\n## 부제목"),
        "institution: 삼육보건대학교",
      ),
    );

    expect(spec.pages[0]).toEqual({
      type: "cover",
      id: "cover",
      title: "AI와 함께하는 앱 개발",
      subtitle: "부제목",
      brand: "THE COALA",
      institution: "삼육보건대학교",
    });
  });

  it("lets the page attribute override the front matter institution", () => {
    const spec = parseBookMarkdown(
      source(cover(' institution="다른 기관"'), "institution: 삼육보건대학교"),
    );

    expect(spec.pages[0]).toMatchObject({ institution: "다른 기관" });
  });

  it("rejects body text other than the title and subtitle", () => {
    const { issues } = checkBookMarkdown(
      source(cover("", "# 제목\n\n설명 문장")),
    );

    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining("cover 페이지에는 '# 제목'과 '## 부제목'"),
    ]);
  });

  it("is one unnumbered page on the cover background", () => {
    const spec = parseBookMarkdown(
      source(cover(' brand="THE COALA"'), "institution: 삼육보건대학교"),
    );

    const pages = layoutBook(spec, planBook(spec).pages, wantedSansFonts);

    expect(pages).toHaveLength(1);
    const page = pages[0];
    if (!page) {
      throw new Error("표지가 배치되지 않았습니다.");
    }
    expect(page.pageNumber).toBeUndefined();
    expect(page.background).toBe(coalaTheme.colors.coverBackground);
    const texts = textElements(page.elements);
    expect(texts.map((text) => text.text)).toEqual([
      "THE COALA",
      "AI와 함께하는 앱 개발",
      "삼육보건대학교",
    ]);
    const title = texts[1];
    expect(title?.fontSizePt).toBe(TYPOGRAPHY.coverTitle);
    expect(title?.left).toBe(PAGE.marginX);
    const prepared = preparePage(page, wantedSansFonts, page.pageNumber);
    expect(prepared.background).toBe(coalaTheme.colors.coverBackground);
    expect(prepared.elements).toHaveLength(page.elements.length);
  });
});

describe("toc page", () => {
  it("reads number, title and page columns", () => {
    const spec = parseBookMarkdown(
      source(
        toc(["| 01 | AI 디지털 리터러시 | 1 |", "| 02 | 바이브 코딩 | |"]),
      ),
    );

    expect(spec.pages[0]).toEqual({
      type: "toc",
      id: "toc",
      title: "목차",
      entries: [
        { label: "01", title: "AI 디지털 리터러시", page: "1" },
        { label: "02", title: "바이브 코딩" },
      ],
    });
  });

  it("accepts a two-column table without pages", () => {
    const spec = parseBookMarkdown(
      source(
        toc(["| 01 | AI 디지털 리터러시 |"], "| 번호 | 제목 |\n|---|---|"),
      ),
    );

    expect(spec.pages[0]).toMatchObject({
      entries: [{ label: "01", title: "AI 디지털 리터러시" }],
    });
  });

  it("rejects a table with the wrong number of columns", () => {
    const { issues } = checkBookMarkdown(
      source(
        toc(["| 01 | 제목 | 1 | 더 |"], "| a | b | c | d |\n|---|---|---|---|"),
      ),
    );

    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining("2열(번호 | 제목) 또는 3열"),
    ]);
  });

  it("rejects an empty number or title cell", () => {
    const { issues } = checkBookMarkdown(source(toc(["| | 제목 | 1 |"])));

    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining("번호와 제목 칸은 비울 수 없습니다"),
    ]);
  });

  it("rejects body text outside the title and table", () => {
    const { issues } = checkBookMarkdown(
      source(toc(["| 01 | 제목 | 1 |", "", "표 아래 글"])),
    );

    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining("표 아래의 글은 지면에 나오지 않습니다"),
      expect.stringContaining("toc 페이지에는 '# 제목'과 표만"),
    ]);
  });

  it("lays out one row per entry with separators between rows", () => {
    const spec = parseBookMarkdown(
      source(
        toc([
          "| 01 | AI 디지털 리터러시 | 1 |",
          "| 02 | 바이브 코딩 | 11 |",
          "| 03 | 데이터와 그래프 | 21 |",
        ]),
      ),
    );

    const [page, ...rest] = layoutBook(
      spec,
      planBook(spec).pages,
      wantedSansFonts,
    );

    expect(rest).toHaveLength(0);
    expect(page?.pageNumber).toBeUndefined();
    expect(page?.background).toBe(coalaTheme.colors.contentsBackground);
    const texts = textElements(page?.elements ?? []);
    expect(texts.map((text) => text.text)).toEqual([
      "목차",
      "01",
      "AI 디지털 리터러시",
      "1",
      "02",
      "바이브 코딩",
      "11",
      "03",
      "데이터와 그래프",
      "21",
    ]);
    const separators = (page?.elements ?? []).filter(
      (element) => element.type === "shape",
    );
    expect(separators).toHaveLength(2);
    // 항목 줄 간격은 원본과 같은 125px이다.
    const labels = texts.filter(
      (text) => /^\d\d$/.test(text.text) && text.left === PAGE.marginX,
    );
    const tops = labels.map((label) => label.top);
    expect(tops.slice(1).map((top, index) => top - (tops[index] ?? 0))).toEqual(
      [TOC.row.minHeight, TOC.row.minHeight],
    );
    // 쪽수는 오른쪽 여백에 맞춰 끝난다.
    const pageNumber = findText(page?.elements ?? [], "1");
    expect(pageNumber.left + pageNumber.width).toBe(PAGE.width - PAGE.marginX);
  });

  it("continues onto a second page when the entries overflow", () => {
    const rows = Array.from(
      { length: 20 },
      (_, index) =>
        `| ${String(index + 1).padStart(2, "0")} | 항목 ${index + 1} | ${index + 1} |`,
    );
    const spec = parseBookMarkdown(source(toc(rows)));

    const pages = layoutBook(spec, planBook(spec).pages, wantedSansFonts);

    expect(pages).toHaveLength(2);
    expect(pages[1]?.title).toBe("목차(계속)");
    expect(pages.every((page) => page.pageNumber === undefined)).toBe(true);
    for (const page of pages) {
      const shapes = page.elements.filter(
        (
          element,
        ): element is Extract<typeof element, { type: "shape" }> & {
          height: number;
        } => element.type === "shape",
      );
      for (const shape of shapes) {
        expect(shape.top + shape.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
  });
});

describe("ai-math cover-toc manuscript", () => {
  it("passes validation and becomes exactly two unnumbered pages", () => {
    const { spec, issues } = checkBookMarkdown(
      fs.readFileSync(manuscriptPath, "utf8"),
    );

    expect(issues).toEqual([]);
    if (!spec) {
      throw new Error("원고가 검사를 통과하지 못했습니다.");
    }
    expect(spec.pages.map((page) => page.type)).toEqual(["cover", "toc"]);

    const pages = layoutBook(spec, planBook(spec).pages, wantedSansFonts);
    expect(pages).toHaveLength(2);
    expect(pages.every((page) => page.pageNumber === undefined)).toBe(true);
  });
});
