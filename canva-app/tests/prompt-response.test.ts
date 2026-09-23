import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { parseBlocks } from "../src/parser/blocks";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import { CONTENT_WIDTH, GAP, PAGE, PROMPT_BOX } from "../src/theme/page-layout";
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

const FRONT_MATTER = ["---", "schema_version: 1", "title: 시험", "---", ""];

const book = (...pages: string[][]): string =>
  [...FRONT_MATTER, ...pages.flat()].join("\n");

const concept = (body: string[], attributes = ' layout="basic"'): string[] => [
  `:::page{type="concept" id="p1"${attributes}}`,
  "# 제목",
  "",
  "## 소제목",
  "",
  ...body,
  ":::",
  "",
];

const dialogue = (prompt: string, response: string[]): string[] => [
  "```prompt",
  prompt,
  "```",
  "",
  "```response",
  ...response,
  "```",
];

const errorsOf = (source: string) =>
  checkBookMarkdown(source)
    .issues.filter((issue) => issue.severity === "error")
    .map((issue) => `${issue.line}: ${issue.message}`);

const layoutOf = (source: string) => {
  const spec = parseBookMarkdown(source);
  return layoutBook(spec, planBook(spec).pages, wantedSansFonts);
};

type Shape = Extract<ElementAtPoint, { type: "shape" }> & {
  width: number;
  height: number;
};

/** 프롬프트·응답 테두리 상자만 고른다. */
const dialogueBoxes = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter(
    (element): element is Shape =>
      element.type === "shape" &&
      element.paths.some(
        (shapePath) =>
          shapePath.stroke?.color === coalaTheme.colors.promptStroke,
      ),
  );

describe("prompt·response 블록 읽기", () => {
  it("프롬프트는 평문, 응답은 Markdown 원문으로 남긴다", () => {
    const blocks = parseBlocks(
      [
        "도입 문장",
        "",
        "```prompt",
        "일정을 **추천**해줘.",
        "```",
        "",
        "```response",
        "DAY 1",
        "",
        "- 경복궁",
        "- 북촌",
        "```",
        "",
        "마무리 문장",
      ].join("\n"),
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "prompt",
      "response",
      "paragraph",
    ]);
    expect(blocks[1]).toEqual({ kind: "prompt", text: "일정을 **추천**해줘." });
    expect(blocks[2]).toEqual({
      kind: "response",
      markdown: "DAY 1\n\n- 경복궁\n- 북촌",
    });
  });

  it("보관된 원고가 문제 없이 통과한다", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/prompt-response.md"),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);

    expect(issues).toEqual([]);
    expect(spec?.pages).toHaveLength(1);
  });
});

describe("prompt·response 원고 검사", () => {
  it("prompt 다음에 response가 없으면 거절한다", () => {
    const errors = errorsOf(
      book(concept(["```prompt", "질문", "```", "", "다른 문단"])),
    );

    expect(errors).toEqual([
      expect.stringContaining("사이에는 다른 내용을 둘 수 없습니다"),
    ]);
  });

  it("페이지 끝까지 response가 없어도 거절한다", () => {
    const errors = errorsOf(book(concept(["```prompt", "질문", "```"])));

    expect(errors).toEqual([
      expect.stringContaining("response 블록이 와야 합니다"),
    ]);
  });

  it("prompt 없는 response를 거절한다", () => {
    const errors = errorsOf(book(concept(["```response", "답", "```"])));

    expect(errors).toEqual([
      expect.stringContaining("prompt 블록이 있어야 합니다"),
    ]);
  });

  it("빈 블록과 닫히지 않은 블록을 거절한다", () => {
    const errors = errorsOf(
      book(concept(["```prompt", "```", "", "```response", "답"])),
    );

    expect(errors).toEqual([
      expect.stringContaining("prompt 블록이 비어 있습니다"),
      expect.stringContaining("닫는 ``` 줄이 없습니다"),
    ]);
  });

  it("상자 안의 지원하지 않는 문법을 안쪽 행 번호로 거절한다", () => {
    const errors = errorsOf(
      book(
        concept(
          dialogue("- 목록으로 쓴 질문", [
            "문단",
            "### 제목",
            "| a | b |",
            "- 상위",
            "  - 하위",
            "`코드`",
          ]),
        ),
      ),
    );

    expect(errors).toEqual([
      "12: prompt 블록 안에는 문장만 적을 수 있습니다.",
      "17: response 블록 안에는 문단과 목록만 적을 수 있습니다.",
      "18: response 블록 안에는 문단과 목록만 적을 수 있습니다.",
      expect.stringMatching(/^20: 중첩 목록/),
      expect.stringMatching(/^21: 인라인 코드/),
    ]);
  });

  it("카드, 강조 박스, 다른 페이지 형식에서는 거절한다", () => {
    expect(
      errorsOf(book(concept(dialogue("질문", ["답"]), ' layout="cards"'))),
    ).toEqual([
      expect.stringContaining('layout="basic"에서만'),
      expect.stringContaining('layout="basic"에서만'),
    ]);

    expect(
      errorsOf(
        book(
          concept(["본문", "", "> [!TIP]", "> ```prompt", "> 질문", "> ```"]),
        ),
      ),
    ).toEqual([expect.stringContaining("강조 박스 안에는 코드 블록")]);

    expect(
      errorsOf(
        book([
          ':::page{type="practice-checklist" id="c1"}',
          "# 목표",
          "",
          "- [ ] 항목",
          "",
          ...dialogue("질문", ["답"]),
          ":::",
        ]),
      ),
    ).toEqual([
      expect.stringContaining("practice-checklist 페이지에는 prompt 블록"),
      expect.stringContaining("practice-checklist 페이지에는 response 블록"),
    ]);
  });
});

describe("prompt·response 배치", () => {
  const source = book(
    concept([
      "도입 문장입니다.",
      "",
      ...dialogue("서울 여행 1박 2일 일정을 추천해줘.", [
        "DAY 1",
        "",
        "- 경복궁 : 서울 대표 궁궐",
        "- 북촌한옥마을 : 한옥 골목 산책",
      ]),
      "",
      "마무리 문장입니다.",
    ]),
  );

  it("원본과 같은 자리에 알약형 프롬프트 상자와 둥근 응답 상자를 놓는다", () => {
    const [page] = layoutOf(source);
    const boxes = dialogueBoxes(page?.elements ?? []);
    const [pill, response] = boxes;

    expect(boxes).toHaveLength(2);
    // 두 상자 모두 카드·표와 같은 전체 단 너비이고 채움은 지면 배경색이다.
    for (const box of boxes) {
      expect(box.left).toBe(PAGE.marginX);
      expect(box.width).toBe(CONTENT_WIDTH);
      expect(box.paths[0]?.fill.color).toBe(coalaTheme.colors.pageBackground);
      expect(box.paths[0]?.stroke?.weight).toBe(PROMPT_BOX.strokeWeight);
    }
    // 프롬프트 상자는 한 줄 글 + 위아래 여백. 원본은 114px.
    expect(pill?.height).toBeGreaterThanOrEqual(110);
    expect(pill?.height).toBeLessThanOrEqual(120);
    // 알약형: 반지름이 높이의 절반이다.
    expect(pill?.paths[0]?.d).toContain(`A ${(pill?.height ?? 0) / 2}`);
    // 응답 상자는 프롬프트 상자 아래 정해진 간격에 놓인다.
    expect(response?.top).toBe(
      (pill?.top ?? 0) + (pill?.height ?? 0) + GAP.promptToResponse,
    );
    expect(response?.paths[0]?.d).toContain(`A ${PROMPT_BOX.responseRadius}`);
  });

  it("상자 안의 글은 본문과 같은 28pt이고 안쪽 여백만큼 들여쓴다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [pill, response] = dialogueBoxes(elements);
    const prompt = findText(elements, "서울 여행 1박 2일 일정을 추천해줘.");
    const day = findText(elements, "DAY 1");
    const item = findText(elements, "경복궁 : 서울 대표 궁궐");

    expect(prompt.fontSizePt).toBe(TYPOGRAPHY.body);
    expect(day.fontSizePt).toBe(TYPOGRAPHY.body);
    expect(item.fontSizePt).toBe(TYPOGRAPHY.body);
    expect(prompt.left).toBe(PAGE.marginX + PROMPT_BOX.paddingX);
    // Canva에서 잰 대로 글을 조금 내려 상자 가운데에 맞춘다.
    expect(prompt.top).toBe(
      (pill?.top ?? 0) + PROMPT_BOX.paddingY + PROMPT_BOX.textOffsetY,
    );
    expect(day.left).toBe(PAGE.marginX + PROMPT_BOX.paddingX);
    expect(day.top).toBe((response?.top ?? 0) + PROMPT_BOX.responsePaddingY);
    // 목록 항목은 응답 상자 안에서 다시 들여쓴다.
    expect(item.left).toBeGreaterThan(day.left);
    // 마지막 글줄이 상자 안에 있다.
    expect(item.top).toBeLessThan(
      (response?.top ?? 0) + (response?.height ?? 0),
    );
  });

  it("이어지는 문단은 응답 상자 아래 정해진 간격에 놓인다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [, response] = dialogueBoxes(elements);
    const after = findText(elements, "마무리 문장입니다.");

    expect(after.top).toBe(
      (response?.top ?? 0) + (response?.height ?? 0) + GAP.afterResponse,
    );
  });

  it("긴 응답은 글자를 줄이지 않고 문단 경계에서 상자를 나눠 다음 페이지로 넘긴다", () => {
    const paragraphs = Array.from(
      { length: 24 },
      (_, index) =>
        `${index + 1}번째 문단입니다. 생성형 AI는 사용자의 요청에 따라 새로운 결과물을 만드는 인공지능입니다.`,
    );
    const pages = layoutOf(
      book(
        concept(
          dialogue(
            "길게 설명해줘.",
            paragraphs.flatMap((p) => [p, ""]),
          ),
        ),
      ),
    );

    expect(pages.length).toBeGreaterThan(1);
    const boxes = pages.flatMap((page) => dialogueBoxes(page.elements));
    // 프롬프트 상자 하나 + 응답 상자 여러 개.
    expect(boxes.length).toBeGreaterThan(2);
    for (const page of pages) {
      for (const box of dialogueBoxes(page.elements)) {
        expect(box.top).toBeGreaterThanOrEqual(PAGE.safeTop);
        expect(box.top + box.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
      const sizes = textElements(page.elements)
        .filter((text) => text.text.includes("번째 문단"))
        .map((text) => text.fontSizePt);
      expect(sizes).toEqual(sizes.map(() => TYPOGRAPHY.body));
    }
    // 문단이 하나도 사라지지 않는다.
    const all = pages.flatMap((page) => textElements(page.elements));
    for (const paragraph of paragraphs) {
      expect(all.some((text) => text.text.includes(paragraph))).toBe(true);
    }
  });

  it("프롬프트 상자는 페이지 하단에 홀로 남지 않는다", () => {
    const filler = Array.from(
      { length: 12 },
      (_, index) =>
        `${index + 1}번째 채움 문단입니다. 생성형 AI는 사용자의 요청에 따라 새로운 결과물을 만드는 인공지능입니다.`,
    );
    const pages = layoutOf(
      book(
        concept([
          ...filler.flatMap((p) => [p, ""]),
          ...dialogue("질문입니다.", [
            "첫 문단입니다.",
            "",
            "둘째 문단입니다.",
            "",
            "셋째 문단입니다.",
          ]),
        ]),
      ),
    );

    const pageWithPill = pages.find((page) =>
      textElements(page.elements).some((text) => text.text === "질문입니다."),
    );
    expect(pageWithPill).toBeDefined();
    expect(
      textElements(pageWithPill?.elements ?? []).some(
        (text) => text.text === "첫 문단입니다.",
      ),
    ).toBe(true);
  });

  it("프롬프트·응답이 없는 원고의 배치는 이전과 같다", () => {
    const plain = book(
      concept([
        "도입 문장입니다.",
        "",
        "- 항목 하나",
        "- 항목 둘",
        "",
        "마무리.",
      ]),
    );
    const [page] = layoutOf(plain);

    expect(dialogueBoxes(page?.elements ?? [])).toHaveLength(0);
    expect(findText(page?.elements ?? [], "마무리.").top).toBeGreaterThan(0);
  });
});
