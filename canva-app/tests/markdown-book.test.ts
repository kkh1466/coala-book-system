import fs from "node:fs";
import path from "node:path";
import {
  MarkdownBookParseError,
  parseBookMarkdown,
} from "../src/parser/markdown-book";

const fixturePath = path.resolve(
  process.cwd(),
  "../test-input/prototype-book.md",
);

describe("Markdown textbook parser", () => {
  it("parses the canonical manuscript without assigning page numbers", () => {
    const spec = parseBookMarkdown(fs.readFileSync(fixturePath, "utf8"));

    expect(spec.title).toBe("AI와 함께하는 앱 개발");
    expect(spec.pages.map((page) => page.type)).toEqual([
      "chapter-opening",
      "concept",
      "comparison",
      "practice-opening",
      "practice-checklist",
    ]);
    // 회귀 가드: 파싱 단계는 페이지 번호를 확정하지 않는다. 번호는 분할과
    // 구조 페이지 삽입이 끝난 뒤 planBook()이 매긴다.
    expect(spec.pages.every((page) => !("pageNumber" in page))).toBe(true);
  });

  it("rejects body content outside a page container", () => {
    const source = [
      "---",
      "schema_version: 1",
      "title: 잘못된 원고",
      "---",
      "",
      "# page 밖의 제목",
    ].join("\n");

    expect(() => parseBookMarkdown(source)).toThrow(MarkdownBookParseError);
    expect(() => parseBookMarkdown(source)).toThrow(
      "모든 본문은 :::page{...} 구역 안에 있어야 합니다.",
    );
  });

  it("rejects a practice opening with both a tip and objectives", () => {
    const source = [
      "---",
      "schema_version: 1",
      "title: 잘못된 실습",
      "---",
      "",
      ':::page{type="practice-opening" id="p1" practice="001-1" practice-kind="실습" platform="알고플로"}',
      "# 실습 제목",
      "설명입니다.",
      "- [ ] 목표",
      "> [!TIP]",
      "> 팁",
      ":::",
    ].join("\n");

    expect(() => parseBookMarkdown(source)).toThrow(
      "Tip 또는 실습 목표 중 하나만",
    );
  });

  it("rejects duplicate page ids", () => {
    const source = fs
      .readFileSync(fixturePath, "utf8")
      .replace('id="ai-strengths"', 'id="chapter-01"');

    expect(() => parseBookMarkdown(source)).toThrow(
      "중복된 page id입니다: chapter-01",
    );
  });
});
