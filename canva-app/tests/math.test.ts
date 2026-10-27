import fs from "node:fs";
import {
  checkBookMarkdown,
  parseBookMarkdown,
  MarkdownBookParseError,
} from "../src/parser/markdown-book";
import { parseBlocks } from "../src/parser/blocks";
import { scanMathBlocks } from "../src/parser/math-block";
import { prepareMath } from "../src/builder/prepare-math";
import { renderMath } from "../src/math/render-math";
import { createBook } from "../src/builder/create-book";
import { layoutBook } from "../src/builder/layout-book";
import {
  bookFingerprint,
  buildFailureReport,
} from "../src/builder/generation-state";
import { flowIntoPages, renderPlaced } from "../src/layout/flow";
import { mathBlockItem } from "../src/layout/math-block";
import { PAGE, TEXT_WIDTH } from "../src/theme/page-layout";
import { validateBookSpec } from "../src/types/book-spec";
import { createFakeCanva } from "./helpers/fake-canva";
import { installRecordingRichtext, wantedSansFonts } from "./helpers/richtext";

const equation = (tex: string) => `$$\n${tex}\n$$`;
const source = (body: string, layout = "basic") => `---
schema_version: 1
title: 수식 검증
---
:::page{type="concept" id="math" layout="${layout}"}
# 수식

## 개념

${body}
:::
`;
const em = (28 * 4) / 3;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test value");
  return value;
}

beforeEach(() => installRecordingRichtext());

describe("수식 원고 경계와 기존 본문 보존", () => {
  it("수식을 별도 블록으로 읽고 문단·목록 순서를 유지한다", () => {
    const blocks = parseBlocks(
      `앞 문단\n\n${equation(String.raw`\frac{a_1}{b^2}`)}\n\n- 뒤 목록`,
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "math",
      "list",
    ]);
    expect(blocks[1]).toEqual({
      kind: "math",
      tex: String.raw`\frac{a_1}{b^2}`,
    });
  });

  it("수식 내부 기호를 HTML·제목·목록·표로 해석하지 않는다", () => {
    const tex = String.raw`\begin{aligned}x_1&<x^2\\P(A|B)&>0\end{aligned}`;
    expect(checkBookMarkdown(source(equation(tex))).issues).toEqual([]);
    expect(
      scanMathBlocks(["$$", "## literal", "|a|", "-b", "$$"]).mask,
    ).toEqual([true, true, true, true, true]);
  });

  it.each([
    ["$$\n", "닫는"],
    ["$$\n\n$$", "비어"],
    ["$$x^2$$", "독립된"],
    ["문장 $x^2$ 안", "인라인"],
    [String.raw`\(x^2\)`, "인라인"],
    ["> $$", "강조 박스"],
    ["- $$", "목록"],
    ["  $$\nx\n  $$", "들여쓰기"],
    ["| $$ | 글 |", "표"],
  ])("잘못된 위치와 경계를 행 번호로 보고한다: %s", (body, expected) => {
    const result = checkBookMarkdown(source(body));
    expect(result.spec).toBeUndefined();
    expect(
      result.issues.some((issue) => issue.message.includes(expected)),
    ).toBe(true);
    expect(result.issues[0]).toMatchObject({ line: 10, pageId: "math" });
  });

  it("카드 안 수식을 거절한다", () => {
    const result = checkBookMarkdown(
      source(`${equation("x^2")}\n\n## 두 번째\n\n글`, "cards"),
    );
    expect(result.spec).toBeUndefined();
    expect(
      result.issues.some((issue) => issue.message.includes('layout="basic"')),
    ).toBe(true);
  });

  it("수식이 제목 위에서 조용히 사라지지 않는다", () => {
    const result = checkBookMarkdown(
      source("본문").replace("# 수식", () => `${equation("x")}\n# 수식`),
    );
    expect(result.spec).toBeUndefined();
    expect(
      result.issues.some((issue) => issue.message.includes("페이지 제목 아래")),
    ).toBe(true);
  });

  it("코드·프롬프트·출력의 달러와 수식 문법은 기존 텍스트로 남는다", () => {
    const literal = "$$\nx^2\n$$";
    const body = `\`\`\`python\nprint('$$')\n\`\`\`\n\`\`\`output\n${literal}\n\`\`\`\n\n\`\`\`prompt\n${literal}\n\`\`\`\n\`\`\`response\n${literal}\n\`\`\``;
    const spec = parseBookMarkdown(source(body));
    expect(scanMathBlocks(body.split("\n")).blocks).toEqual([]);
    expect(spec.pages).toHaveLength(1);
    expect(parseBlocks(literal, false)[0]?.kind).toBe("paragraph");
  });

  it("수식 검사 전에 기존 BookSpec 구조 오류를 정상 보고한다", () => {
    const spec = parseBookMarkdown(source("본문"));
    Object.assign(spec.pages[0] ?? {}, { sections: undefined });
    expect(() => validateBookSpec(spec)).toThrow("sections must not be empty");
  });

  it("직접 전달된 BookSpec도 지원 위치와 경계를 검사한다", () => {
    const spec = parseBookMarkdown(source("본문"));
    const page = spec.pages[0];
    if (page?.type !== "concept") throw new Error("fixture");
    required(page.sections[0]).content = "$$\nx";
    expect(() => validateBookSpec(spec)).toThrow("닫는");
    required(page.sections[0]).content = equation("x^2");
    page.sections.push({ title: "다른 카드", body: "설명" });
    page.layout = "cards";
    expect(() => validateBookSpec(spec)).toThrow('layout="basic"');
  });
});

describe("실제 수식 엔진과 한글 글꼴", () => {
  it.each([
    String.raw`P(A)=\frac{\text{사건 A가 일어나는 경우의 수}}{\text{일어날 수 있는 모든 경우의 수}}`,
    String.raw`\sqrt{\frac{x-1}{x+1}}`,
    String.raw`x^{n+1}+a_i+\sqrt[3]{x}`,
    String.raw`A\cap B\subseteq A\cup B\quad x\in A`,
    String.raw`P(A\mid B)=\frac{P(A\cap B)}{P(B)}`,
    String.raw`\begin{aligned}P(\text{비})&=\frac{32}{100}\\&=0.32=32\%\end{aligned}`,
  ])("외부 글꼴과 text 요소 없는 SVG를 만든다: %s", (tex) => {
    const result = renderMath(tex, em, "#1400AE");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.svg).toContain("<path");
    expect(result.svg).not.toMatch(
      /<(text|foreignObject|image|use)\b|currentColor|href=/,
    );
    expect(result.dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(atob(required(result.dataUrl.split(",")[1]))).toBe(result.svg);
  });

  it("한글 실제 폭을 사용하고 기준 크기를 바꾸면 치수도 비례한다", () => {
    const tex = String.raw`\frac{\text{먹구름}}{\text{비}}`;
    const a = renderMath(tex, em, "#000000");
    const b = renderMath(tex, em * 2, "#000000");
    expect(b.width).toBeCloseTo(a.width * 2);
    expect(b.height).toBeCloseTo(a.height * 2);
    expect(
      renderMath(String.raw`\text{먹구름}`, em, "#000000").width,
    ).toBeGreaterThan(renderMath(String.raw`\text{비}`, em, "#000000").width);
  });

  it.each([
    String.raw`\frac{1}{`,
    String.raw`\unknown{x}`,
    String.raw`\require{html}`,
    String.raw`\gdef\x{1}`,
    "",
  ])("잘못된 식을 이미지로 통과시키지 않는다: %s", (tex) => {
    expect(() => renderMath(tex, em, "#000000")).toThrow();
    // An invalid expression must not corrupt subsequent conversions.
    expect(renderMath("x^2", em, "#000000").svg).toContain("<path");
  });

  it("같은 수식을 재사용하고 색상별 결과를 구분한다", () => {
    const a = renderMath("x^2", em, "#000000");
    expect(renderMath("x^2", em, "#000000")).toBe(a);
    expect(renderMath("x^2", em, "#1400AE").svg).not.toBe(a.svg);
  });
});

describe("수식 준비·배치·생성", () => {
  it("모든 구문 오류를 원본 행과 page id로 모아 보고한다", async () => {
    const input = source(
      `${equation(String.raw`\unknown{x}`)}\n\n${equation(String.raw`\frac{1}{`)}`,
    );
    const error: unknown = await prepareMath(parseBookMarkdown(input)).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(MarkdownBookParseError);
    if (!(error instanceof MarkdownBookParseError))
      throw new Error("Expected manuscript error");
    const issues = error.issues;
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.line)).toEqual([10, 14]);
    expect(issues.every((issue) => issue.pageId === "math")).toBe(true);
    expect(buildFailureReport(error).kind).toBe("manuscript");
  });

  it("뒤쪽 식에 오류가 있어도 Canva 페이지를 한 장도 쓰지 않는다", async () => {
    const fake = createFakeCanva();
    const spec = parseBookMarkdown(
      source(`${equation("x^2")}\n\n${equation(String.raw`\unknown{x}`)}`),
    );
    await expect(createBook(spec, fake.deps)).rejects.toThrow("수식 오류");
    expect(fake.writes).toEqual([]);
  });

  it("실제 수식 크기로 지면을 배치하고 자리표시자와 구분한다", async () => {
    const spec = parseBookMarkdown(
      fs.readFileSync("../test-input/math-smoke.md", "utf8"),
    );
    const prepared = await prepareMath(spec);
    expect(prepared.count).toBe(4);
    const pages = layoutBook(spec, spec.pages, {
      ...wantedSansFonts,
      math: prepared.math,
    });
    const images = pages.flatMap((page) =>
      page.elements.filter((element) => element.type === "image"),
    );
    expect(images).toHaveLength(4);
    for (const image of images) {
      expect(image.top).toBeGreaterThanOrEqual(PAGE.safeTop);
      expect(image.top + Number(image.height)).toBeLessThanOrEqual(
        PAGE.safeBottom,
      );
      expect(image.altText?.text).toContain("수식:");
    }
    expect(pages.flatMap((page) => page.pendingImages ?? [])).toEqual([]);
  });

  it("남은 공간이 부족하면 수식을 자르거나 축소하지 않고 다음 장으로 이동한다", async () => {
    const tex = String.raw`\sqrt{\frac{x-1}{x+1}}`;
    const spec = parseBookMarkdown(source(equation(tex)));
    const { math } = await prepareMath(spec);
    const asset = required(math.get(tex));
    const item = mathBlockItem(
      tex,
      {
        fonts: { ...wantedSansFonts, math },
        left: PAGE.marginX,
        width: TEXT_WIDTH,
      },
      { gapAfter: 0, maxHeight: PAGE.safeBottom - PAGE.safeTop },
    );
    const pages = flowIntoPages(
      [
        {
          height: PAGE.safeBottom - PAGE.safeTop - asset.height / 2,
          gapAfter: 0,
          render: () => [],
        },
        item,
      ],
      { top: PAGE.safeTop, bottom: PAGE.safeBottom },
    );
    expect(pages).toHaveLength(2);
    const image = required(renderPlaced(required(pages[1]))[0]);
    expect(image).toMatchObject({
      type: "image",
      top: PAGE.safeTop,
      height: asset.height,
      width: asset.width,
    });
  });

  it("너무 큰 수식은 페이지를 생성하기 전에 줄바꿈을 요청한다", async () => {
    const tex = `\\text{${"아주긴한글수식".repeat(30)}}`;
    const fake = createFakeCanva();
    await expect(
      createBook(parseBookMarkdown(source(equation(tex))), fake.deps),
    ).rejects.toThrow("aligned");
    expect(fake.writes).toEqual([]);
  });

  it("생성 결과에 수식 수를 보고하고 같은 식도 원고의 등장 횟수로 센다", async () => {
    const spec = parseBookMarkdown(
      source(`${equation("x^2")}\n\n${equation("x^2")}`),
    );
    const prepared = await prepareMath(spec);
    expect(prepared.count).toBe(2);
    expect(prepared.math.size).toBe(1);
    const fake = createFakeCanva();
    const result = await createBook(spec, fake.deps);
    expect(result.mathCount).toBe(2);
    expect(result.pendingImages).toEqual([]);
    expect(result.placedImages).toEqual([]);
    expect(fake.maxConcurrentWrites()).toBe(1);
  });

  it("수식을 수정하면 생성 재개 지문이 달라지고 일반 원고는 수식 자원이 없다", async () => {
    const a = parseBookMarkdown(source(equation("x^2")));
    const b = parseBookMarkdown(source(equation("x^3")));
    expect(bookFingerprint(a)).not.toBe(bookFingerprint(b));
    expect(await prepareMath(parseBookMarkdown(source("일반 본문")))).toEqual({
      math: new Map(),
      count: 0,
    });
  });
});
