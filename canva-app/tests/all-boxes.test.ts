import fs from "node:fs";
import path from "node:path";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { PAGE } from "../src/theme/page-layout";
import { TYPOGRAPHY } from "../src/theme/typography";
import {
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

beforeEach(() => {
  installRecordingRichtext();
});

/**
 * `test-input/all-boxes.md`는 앱이 그리는 모든 상자를 한 원고에 모은 것이다.
 * Canva에서 눈으로 보는 용도이지만, 여기서는 검사를 통과하고 모든 요소가
 * 안전 영역 안에 놓이며 글자 크기가 규칙을 지키는지 확인한다.
 */
describe("all-boxes.md", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "../test-input/all-boxes.md"),
    "utf8",
  );

  it("모든 페이지 형식을 담고 검사를 통과한다", () => {
    const { spec, issues } = checkBookMarkdown(source);

    expect(issues).toEqual([]);
    expect(new Set(spec?.pages.map((page) => page.type))).toEqual(
      new Set([
        "chapter-opening",
        "concept",
        "comparison",
        "practice-opening",
        "practice-checklist",
        "screenshot-guide",
        "step-process",
        "flowchart",
      ]),
    );
  });

  it("모든 상자와 글이 안전 영역 안에 놓이고 본문 크기 아래로 내려가지 않는다", () => {
    const spec = parseBookMarkdown(source);
    const pages = layoutBook(spec, planBook(spec).pages, wantedSansFonts);

    expect(pages.length).toBeGreaterThanOrEqual(spec.pages.length);
    for (const page of pages) {
      const shapes = page.elements.filter(
        (
          element,
        ): element is Extract<typeof element, { type: "shape" }> & {
          height: number;
        } => element.type === "shape",
      );
      const bottoms = shapes.map((shape) => shape.top + shape.height);
      expect(shapes.every((shape) => shape.top >= 0)).toBe(true);
      expect(Math.max(0, ...bottoms)).toBeLessThanOrEqual(PAGE.safeBottom);
      for (const text of textElements(page.elements)) {
        expect(text.fontSizePt).toBeGreaterThanOrEqual(TYPOGRAPHY.pageNumber);
        expect(text.left + text.width).toBeLessThanOrEqual(
          PAGE.width - PAGE.marginX,
        );
      }
    }
    // 이미지 자리 셋(일반, 실행 결과, 캡처 둘)과 순서도 자리 하나가 보고된다.
    expect(pages.flatMap((page) => page.pendingImages ?? [])).toHaveLength(4);
    expect(pages.flatMap((page) => page.pendingFlowcharts ?? [])).toHaveLength(
      1,
    );
  });
});
