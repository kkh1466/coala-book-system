import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import { createBook } from "../src/builder/create-book";
import { collectPendingImages, layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import type { FlowItem } from "../src/layout/flow";
import { flowIntoPages } from "../src/layout/flow";
import { parseBlocks } from "../src/parser/blocks";
import { parseImageDirective } from "../src/parser/image-directive";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import { CONTENT_WIDTH, PAGE, TEXT_WIDTH } from "../src/theme/page-layout";
import { createFakeCanva } from "./helpers/fake-canva";
import {
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

beforeEach(() => {
  installRecordingRichtext();
});

const readFixture = (name: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), "../test-input", name), "utf8");

const layoutFixture = (name: string) => {
  const spec = parseBookMarkdown(readFixture(name));
  return layoutBook(spec, planBook(spec).pages, wantedSansFonts);
};

type Shape = Extract<ElementAtPoint, { type: "shape" }> & {
  width: number;
  height: number;
};

/** 이미지를 끌어다 놓을 수 있는 도형(= 이미지 자리)만 고른다. */
const dropTargets = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter(
    (element): element is Shape =>
      element.type === "shape" &&
      element.paths.some((shapePath) => shapePath.fill.dropTarget === true),
  );

const FRONT_MATTER = [
  "---",
  "schema_version: 1",
  "title: 시험",
  "language: ko",
  "canvas: coala-portrait",
  "numbering: auto",
  "toc: none",
  "---",
  "",
].join("\n");

const conceptWith = (body: string, attributes = ""): string =>
  `${FRONT_MATTER}:::page{type="concept" id="p1"${attributes}}\n# 제목\n\n## 소제목\n\n본문입니다.\n\n${body}\n:::\n`;

describe("image directive", () => {
  it("reads the declared ratio, width and caption", () => {
    const image = parseImageDirective(
      '::image{src="assets/a.png" alt="설명" ratio="4:3" width="half" caption="그림 1"}',
    );

    expect(image).toEqual({
      src: "assets/a.png",
      alt: "설명",
      ratio: 4 / 3,
      ratioLabel: "4:3",
      ratioDeclared: true,
      width: "half",
      caption: "그림 1",
    });
  });

  it("falls back to 16:9 and records that the manuscript did not declare it", () => {
    const image = parseImageDirective('::image{src="assets/a.png" alt="설명"}');

    expect(image.ratio).toBeCloseTo(16 / 9);
    expect(image.ratioDeclared).toBe(false);
    expect(image.width).toBe("text");
  });

  it("becomes its own block between the surrounding paragraphs", () => {
    const blocks = parseBlocks(
      '앞 문단입니다.\n::image{src="assets/a.png" alt="설명"}\n뒤 문단입니다.',
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "image",
      "paragraph",
    ]);
  });

  it.each([
    ['::image{alt="설명"}', "src가 필요합니다"],
    ['::image{src="assets/a.png"}', "alt"],
    ['::image{src="assets/a.png" alt="설명" ratio="wide"}', "ratio"],
    ['::image{src="assets/a.png" alt="설명" ratio="1:9"}', "1:4에서 4:1"],
    ['::image{src="assets/a.png" alt="설명" width="huge"}', "width"],
    ['::image{src="assets/a.png" alt="설명" size="big"}', "지원하지 않는"],
    ['::image{src="https://example.com/a.png" alt="설명"}', "상대 경로"],
    ['::image{src="../secret/a.png" alt="설명"}', "상대 경로"],
    ['::image{src="/etc/a.png" alt="설명"}', "상대 경로"],
    ['::image src="assets/a.png"', "한 줄이어야"],
  ])("rejects %s with its manuscript row", (directive, reason) => {
    // 머리말 8줄 + page 여는 줄 + 본문 6줄 다음이므로 지시자는 16번째 줄이다.
    expect(() => parseBookMarkdown(conceptWith(directive))).toThrow(
      new RegExp(`^16행: .*${reason}`),
    );
  });
});

describe("where an image placeholder may go", () => {
  const directive = '::image{src="assets/a.png" alt="설명"}';

  it("refuses the cards layout, where a placeholder cannot fit", () => {
    expect(() =>
      parseBookMarkdown(conceptWith(directive, ' layout="cards"')),
    ).toThrow('layout="basic"');
  });

  it("refuses a placeholder inside a callout", () => {
    expect(() =>
      parseBookMarkdown(conceptWith(`> [!TIP]\n> ${directive}`)),
    ).toThrow("강조 박스");
  });

  it("refuses a placeholder above the page title", () => {
    const source = `${FRONT_MATTER}:::page{type="concept" id="p1"}\n${directive}\n# 제목\n\n## 소제목\n\n본문.\n:::\n`;

    expect(() => parseBookMarkdown(source)).toThrow("페이지 제목(#) 아래");
  });

  it("refuses a placeholder among the learning objectives", () => {
    const source = `${FRONT_MATTER}:::page{type="chapter-opening" id="c1" chapter="1"}\n# 장\n## 부제\n\n### 학습 목표\n\n- 목표\n${directive}\n\n### 개념\n\n본문.\n:::\n`;

    expect(() => parseBookMarkdown(source)).toThrow("개념 소제목(###) 아래");
  });

  it.each([
    [
      "practice-opening",
      ' practice="001-1" practice-kind="실습" platform="PC"',
      `# 실습\n\n설명.\n\n${directive}`,
    ],
    ["practice-checklist", "", `# 목표\n\n${directive}\n\n- [ ] 항목`],
    [
      "comparison",
      "",
      `# 비교\n\n${directive}\n\n| A | B |\n| --- | --- |\n| 1 | 2 |`,
    ],
  ])("refuses a placeholder on a %s page", (type, attributes, body) => {
    const source = `${FRONT_MATTER}:::page{type="${type}" id="p1"${attributes}}\n${body}\n:::\n`;

    expect(() => parseBookMarkdown(source)).toThrow(
      `${type} 페이지에는 image를 넣을 수 없습니다`,
    );
  });
});

describe("image placeholder layout", () => {
  it("reserves exactly the declared ratio for every placeholder that fits", () => {
    const laid = layoutFixture("image-placeholder.md");
    const pending = collectPendingImages(laid);

    expect(pending.map((image) => image.src)).toEqual([
      "assets/ch01/welcome.png",
      "assets/ch01/overview.png",
      "assets/ch01/default-ratio.png",
      "assets/ch01/button.png",
      "assets/ch01/phone.png",
      "assets/ch01/install-done.png",
      "assets/ch01/new-project.png",
    ]);

    const bySrc = Object.fromEntries(
      pending.map((image) => [image.src, image]),
    );
    expect(bySrc["assets/ch01/welcome.png"]).toMatchObject({
      width: TEXT_WIDTH,
      height: Math.round(TEXT_WIDTH / (16 / 9)),
      scaledToFit: false,
    });
    expect(bySrc["assets/ch01/overview.png"]).toMatchObject({
      width: CONTENT_WIDTH,
      height: Math.round(CONTENT_WIDTH / (4 / 3)),
    });
    expect(bySrc["assets/ch01/default-ratio.png"]).toMatchObject({
      ratioDeclared: false,
      height: Math.round(TEXT_WIDTH / (16 / 9)),
    });
    expect(bySrc["assets/ch01/button.png"]).toMatchObject({
      width: TEXT_WIDTH / 2,
      height: TEXT_WIDTH / 2,
    });
  });

  it("draws each placeholder as one drop target of the reported size", () => {
    const laid = layoutFixture("image-placeholder.md");

    for (const page of laid) {
      const boxes = dropTargets(page.elements);
      const reported = page.pendingImages ?? [];

      expect(boxes.map(({ width, height }) => ({ width, height }))).toEqual(
        reported.map(({ width, height }) => ({ width, height })),
      );
    }
  });

  it("shrinks a placeholder that is taller than a page without changing its ratio", () => {
    const laid = layoutFixture("image-placeholder.md");
    const phone = collectPendingImages(laid).find(
      (image) => image.src === "assets/ch01/phone.png",
    );

    expect(phone?.scaledToFit).toBe(true);
    expect(phone?.height).toBeLessThan(PAGE.safeBottom - PAGE.safeTop);
    expect((phone?.width ?? 0) / (phone?.height ?? 1)).toBeCloseTo(9 / 16, 2);
  });

  it("keeps every placeholder inside the safe area, continuation pages included", () => {
    const laid = layoutFixture("image-placeholder.md");
    const continued = laid.filter((page) => page.partIndex > 0);

    expect(
      continued.some((page) => dropTargets(page.elements).length > 0),
    ).toBe(true);
    for (const page of laid) {
      for (const box of dropTargets(page.elements)) {
        expect(box.top).toBeGreaterThanOrEqual(PAGE.safeTop);
        expect(box.top + box.height).toBeLessThanOrEqual(PAGE.safeBottom);
        expect(box.left).toBeGreaterThanOrEqual(PAGE.marginX);
        expect(box.left + box.width).toBeLessThanOrEqual(
          PAGE.marginX + CONTENT_WIDTH,
        );
      }
    }
  });

  it("lets no body text run underneath a placeholder", () => {
    const laid = layoutFixture("image-placeholder.md");

    for (const page of laid) {
      for (const box of dropTargets(page.elements)) {
        const inside = textElements(page.elements).filter(
          (text) => text.top >= box.top && text.top < box.top + box.height,
        );
        // 자리 안에 있는 글은 가운데에 놓인 안내 라벨 하나뿐이다.
        expect(inside.length).toBeLessThanOrEqual(1);
        inside.forEach((label) => {
          expect(label.left).toBeGreaterThan(box.left);
          expect(label.left + label.width).toBeLessThan(box.left + box.width);
        });
      }
    }
  });

  it("never sends the directive itself to Canva as text", () => {
    const laid = layoutFixture("image-placeholder.md");
    const allText = laid.flatMap((page) =>
      textElements(page.elements).map((element) => element.text),
    );

    expect(allText.some((text) => text.includes("::image"))).toBe(false);
    expect(allText).toContain("그림 1-3 설치 완료");
  });

  it("reports the pending images with final page numbers after generation", async () => {
    const canva = createFakeCanva();
    // 가짜 Canva의 richtext 대역에는 formatText가 없다. 자리 라벨은 굵은 구간을
    // 쓰므로, 강조 서식까지 받는 기록용 대역으로 바꿔 둔다.
    installRecordingRichtext();
    const spec = parseBookMarkdown(readFixture("image-placeholder.md"));

    const result = await createBook(spec, canva.deps);

    expect(result.pendingImages).toHaveLength(7);
    const pageNumbers = result.pendingImages.map((image) =>
      Number(image.pageNumber),
    );
    expect(pageNumbers).toEqual([...pageNumbers].sort((a, b) => a - b));
    expect(pageNumbers.every((value) => value >= 1)).toBe(true);
  });
});

describe("manuscripts without images are laid out exactly as before", () => {
  it.each(["prototype-book.md", "prototype-book-v2.md"])(
    "%s has no drop target and no pending image",
    (fixture) => {
      const laid = layoutFixture(fixture);

      expect(collectPendingImages(laid)).toEqual([]);
      laid.forEach((page) => {
        expect(dropTargets(page.elements)).toEqual([]);
        expect(page).not.toHaveProperty("pendingImages");
      });
    },
  );

  it("paginates identically when no continuation inset is given", () => {
    const items: FlowItem[] = Array.from({ length: 40 }, (_, index) => ({
      height: 90 + (index % 7) * 35,
      gapAfter: index % 3 === 0 ? 28 : 0,
      ...(index % 9 === 0 ? { keepWithNext: 150 } : {}),
      render: () => [],
    }));
    const area = { top: PAGE.safeTop, bottom: PAGE.safeBottom };

    const before = flowIntoPages(items, area);
    const withZero = flowIntoPages(items, area, { continuationInset: 0 });
    const withInset = flowIntoPages(items, area, { continuationInset: 108 });

    expect(withZero).toEqual(before);
    // 첫 장은 어떤 경우에도 같다. 인셋은 두 번째 장부터만 적용된다.
    expect(withInset[0]).toEqual(before[0]);
  });
});
