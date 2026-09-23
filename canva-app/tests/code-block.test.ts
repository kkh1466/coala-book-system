import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import type { FontRef } from "@canva/asset";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { highlightCode, languageLabel } from "../src/layout/code-block";
import { lineHeight } from "../src/layout/measure";
import { parseBlocks } from "../src/parser/blocks";
import {
  findCodeResultProblems,
  RESULT_LABEL,
} from "../src/parser/code-result";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import type { ResolvedBookFonts } from "../src/theme/font-resolver";
import { buildFontCandidates } from "../src/theme/font-resolver";
import {
  CODE_BOX,
  CONTENT_WIDTH,
  GAP,
  PAGE,
  TEXT_WIDTH,
} from "../src/theme/page-layout";
import { LINE_HEIGHT, TYPOGRAPHY } from "../src/theme/typography";
import type { ConceptPage } from "../src/types/book-spec";
import { validateBookSpec } from "../src/types/book-spec";
import { wantedSans } from "./helpers/fake-canva";
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

const CODE = [
  "```python",
  "# 인사말을 보여 줍니다",
  'name = "코알라"',
  "if name:",
  "\tprint(name)",
  "```",
];
const OUTPUT = ["```output", "코알라", "```"];
const RESULT_IMAGE =
  '::image{src="assets/code/window.png" alt="인사말이 보이는 실행 창" ratio="16:9" role="result"}';
const PLAIN_IMAGE =
  '::image{src="assets/code/plain.png" alt="설명 그림" ratio="16:9"}';

const ROW = lineHeight(TYPOGRAPHY.body, LINE_HEIGHT.global);

const errorsOf = (source: string) =>
  checkBookMarkdown(source)
    .issues.filter((issue) => issue.severity === "error")
    .map((issue) => `${issue.line}: ${issue.message}`);

const monoFonts: ResolvedBookFonts = {
  ...wantedSansFonts,
  code: {
    familyName: "JetBrains Mono",
    fontRef: "jetbrains-mono-ref" as FontRef,
    regularWeight: "normal",
    boldWeight: "bold",
  },
};

const layoutOf = (source: string, fonts = monoFonts) => {
  const spec = parseBookMarkdown(source);
  return layoutBook(spec, planBook(spec).pages, fonts);
};

type Shape = Extract<ElementAtPoint, { type: "shape" }> & {
  width: number;
  height: number;
};

const shapes = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter((element): element is Shape => element.type === "shape");
const codeBoxes = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter(
    (shape) => shape.paths[0]?.fill.color === coalaTheme.colors.codeFill,
  );
/** 상자 밖의 파란 "실행 결과" 라벨. */
const resultLabels = (elements: readonly ElementAtPoint[]) =>
  textElements(elements).filter(
    (text) =>
      text.text.startsWith(RESULT_LABEL) &&
      text.color === coalaTheme.colors.primary,
  );
const dropTargets = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter((shape) =>
    shape.paths.some((shapePath) => shapePath.fill.dropTarget === true),
  );
const monoTexts = (elements: readonly ElementAtPoint[]) =>
  textElements(elements).filter(
    (text) => text.fontRef === "jetbrains-mono-ref",
  );

describe("코드와 실행 결과 읽기", () => {
  it("코드와 output이 하나의 블록으로 짝지어지고 출력의 공백·줄바꿈이 보존된다", () => {
    const blocks = parseBlocks(
      [
        "문단",
        "",
        "```Python",
        "def f():",
        "    return 1",
        "```",
        "",
        "```output",
        "",
        "첫 줄",
        "  들여쓴 둘째 줄",
        "",
        "넷째 줄  ",
        "",
        "```",
        "",
        "뒤",
      ].join("\n"),
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "code",
      "paragraph",
    ]);
    expect(blocks[1]).toEqual({
      kind: "code",
      language: "python",
      code: "def f():\n    return 1",
      result: { kind: "text", text: "첫 줄\n  들여쓴 둘째 줄\n\n넷째 줄" },
    });
  });

  it("코드와 role=result 이미지가 하나의 블록으로 짝지어진다", () => {
    const blocks = parseBlocks([...CODE, "", RESULT_IMAGE].join("\n"));

    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block?.kind).toBe("code");
    expect(block?.kind === "code" && block.result?.kind).toBe("image");
    expect(
      block?.kind === "code" &&
        block.result?.kind === "image" &&
        block.result.image.role,
    ).toBe("result");
  });

  it("role이 없는 이미지는 일반 이미지 블록으로 남는다", () => {
    const blocks = parseBlocks(
      [...CODE, "", ...OUTPUT, "", PLAIN_IMAGE].join("\n"),
    );

    expect(blocks.map((block) => block.kind)).toEqual(["code", "image"]);
    expect(blocks[1]?.kind === "image" && blocks[1].image.role).toBeUndefined();
  });

  it("언어 이름이 없는 펜스도 코드 블록이다", () => {
    const [block] = parseBlocks(
      "```\n이름: 코알라\n```\n\n```output\n이름: 코알라\n```",
    );

    expect(block?.kind === "code" && block.language).toBe("");
    expect(languageLabel("")).toBe("코드");
    expect(languageLabel("py")).toBe("Python");
    expect(languageLabel("rust")).toBe("rust");
  });
});

describe("코드와 실행 결과 원고 검사", () => {
  it("output 결과와 GUI 결과는 각각 통과한다", () => {
    for (const result of [OUTPUT, [RESULT_IMAGE]]) {
      const { spec, issues } = checkBookMarkdown(
        book(concept([...CODE, "", ...result])),
      );
      expect(issues).toEqual([]);
      expect(spec?.pages).toHaveLength(1);
    }
  });

  it.each([
    [
      "결과 없는 코드",
      [...CODE, "", "다음 문단"],
      '11: 코드 블록 뒤에 실행 결과가 없습니다. 텍스트 결과는 output 블록으로, GUI 결과는 role="result" 이미지로 작성해 주세요.',
    ],
    [
      "고아 output",
      ["문단", "", ...OUTPUT],
      "13: output 블록 앞에는 실행할 코드 블록이 있어야 합니다.",
    ],
    [
      "고아 GUI 결과 이미지",
      ["문단", "", RESULT_IMAGE],
      "13: GUI 실행 결과 이미지는 코드 블록 바로 뒤에 작성해 주세요.",
    ],
    [
      "빈 output",
      [...CODE, "", "```output", "", "```"],
      "18: output 블록이 비어 있습니다. 실행 결과를 적거나 블록을 지워 주세요.",
    ],
    [
      "코드와 결과 사이의 문단",
      [...CODE, "", "사이 문단", "", ...OUTPUT],
      "18: 코드 블록과 실행 결과 사이에는 다른 내용을 둘 수 없습니다. 빈 줄만 두고 바로 이어서 작성해 주세요.",
    ],
    [
      "output과 GUI 결과가 함께",
      [...CODE, "", ...OUTPUT, "", RESULT_IMAGE],
      "22: 하나의 코드 블록에는 실행 결과를 하나만 작성할 수 있습니다.",
    ],
    [
      "결과 둘",
      [...CODE, "", ...OUTPUT, "", ...OUTPUT],
      "22: 하나의 코드 블록에는 실행 결과를 하나만 작성할 수 있습니다.",
    ],
    [
      "output 안의 제목",
      [...CODE, "", "```output", "## 제목처럼 보이는 줄", "```"],
      "19: output 블록 안에는 실행 결과 글만 적을 수 있습니다. 제목·목록·이미지 지시문·펜스는 쓸 수 없습니다.",
    ],
  ])("%s을(를) 행 번호와 함께 거절한다", (_name, body, expected) => {
    expect(errorsOf(book(concept(body)))).toEqual([expected]);
  });

  it("prompt·response와 flowchart는 코드·결과 규칙의 영향을 받지 않는다", () => {
    const dialogue = book(
      concept(["```prompt", "질문", "```", "", "```response", "답", "```"]),
    );
    expect(errorsOf(dialogue)).toEqual([]);

    const flowchart = book([
      ':::page{type="flowchart" id="f1"}',
      "# 순서도",
      "",
      "```flowchart",
      "nodes:",
      "  - id: a",
      "    role: input",
      "    text: 입력",
      "connections:",
      "  - from: a",
      "    to: a",
      "```",
      ":::",
    ]);
    expect(errorsOf(flowchart)).toEqual([]);
  });

  it("빈 코드 블록, ~~~ 펜스, 닫히지 않은 펜스를 거절한다", () => {
    expect(
      errorsOf(book(concept(["```python", "", "```", "", ...OUTPUT]))),
    ).toEqual([expect.stringContaining("코드 블록이 비어 있습니다")]);
    expect(errorsOf(book(concept(["~~~python", "x = 1", "~~~"])))).toEqual([
      expect.stringContaining("```로 여닫아야"),
    ]);
    expect(errorsOf(book(concept(["```python", "x = 1"])))).toEqual([
      expect.stringContaining("닫는 ``` 줄이 없습니다"),
    ]);
  });

  it("카드, 강조 박스, 다른 페이지 형식에서는 거절한다", () => {
    expect(
      errorsOf(book(concept([...CODE, "", ...OUTPUT], ' layout="cards"'))),
    ).toEqual([expect.stringContaining('layout="basic"에서만')]);
    expect(
      errorsOf(
        book(
          concept(["본문", "", "> [!TIP]", "> ```python", "> x = 1", "> ```"]),
        ),
      ),
    ).toEqual([expect.stringContaining("강조 박스 안에는 코드 블록")]);
    expect(
      errorsOf(
        book([
          ':::page{type="chapter-opening" id="c1" chapter="1"}',
          "# 제목",
          "## 부제목",
          "",
          "### 학습 목표",
          "",
          "- 목표",
          "",
          "### 개념",
          "",
          "본문",
          "",
          RESULT_IMAGE,
          ":::",
        ]),
      ),
    ).toEqual([
      expect.stringContaining("chapter-opening 페이지에는 실행 결과 이미지"),
    ]);
  });

  it("BookSpec 검증도 같은 판별로 짝을 확인한다", () => {
    const spec = parseBookMarkdown(book(concept([...CODE, "", ...OUTPUT])));
    const page = spec.pages[0] as ConceptPage;
    const broken = {
      ...spec,
      pages: [
        {
          ...page,
          sections: page.sections.map((section) => ({
            ...section,
            content: CODE.join("\n"),
          })),
        },
      ],
    };

    expect(() => validateBookSpec(spec)).not.toThrow();
    expect(() => validateBookSpec(broken)).toThrow(
      "pages[0].sections[0]: 코드 블록 뒤에 실행 결과가 없습니다.",
    );
    expect(findCodeResultProblems(CODE)).toHaveLength(1);
    expect(findCodeResultProblems([...CODE, "", ...OUTPUT])).toEqual([]);
  });
});

describe("텍스트 실행 결과 배치", () => {
  const source = book(
    concept([
      "도입 문장입니다.",
      "",
      ...CODE,
      "",
      "```output",
      "코알라",
      "  둘째 줄",
      "```",
      "",
      "마무리 문장입니다.",
    ]),
  );

  it("코드 상자, 파란 실행 결과 라벨, 결과 상자를 위에서 아래로 놓는다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [codeBox, outputBox] = codeBoxes(elements);
    const language = findText(elements, "Python");
    const code = findText(
      elements,
      '# 인사말을 보여 줍니다\nname = "코알라"\nif name:\n    print(name)',
    );
    const [label] = resultLabels(elements);
    const output = findText(elements, "코알라\n  둘째 줄");

    expect(codeBoxes(elements)).toHaveLength(2);
    expect(resultLabels(elements)).toHaveLength(1);
    for (const box of [codeBox, outputBox]) {
      expect(box?.left).toBe(PAGE.marginX);
      expect(box?.width).toBe(CONTENT_WIDTH);
      expect(box?.paths[0]?.d).toContain(`A ${CODE_BOX.radius}`);
    }
    // 코드 상자: 언어 라벨은 회색, 코드는 그 아래.
    expect(language.top).toBe((codeBox?.top ?? 0) + CODE_BOX.paddingTop);
    expect(language.color).toBe(coalaTheme.colors.secondaryText);
    expect(code.top).toBeGreaterThan(language.top);
    expect(code.top + 4 * ROW + CODE_BOX.paddingBottom).toBe(
      (codeBox?.top ?? 0) + (codeBox?.height ?? 0),
    );
    // 라벨은 상자 밖, 파란색 굵게, 코드 상자 아래 정해진 간격.
    expect(label?.text).toBe(RESULT_LABEL);
    expect(label?.fontWeight).toBe("bold");
    expect(label?.fontRef).toBe("wanted-sans-ref");
    expect(label?.top).toBe(
      (codeBox?.top ?? 0) + (codeBox?.height ?? 0) + CODE_BOX.beforeResultLabel,
    );
    // 결과 상자는 라벨 바로 아래, 안에는 출력만.
    expect(outputBox?.top).toBe(
      (label?.top ?? 0) + ROW + CODE_BOX.afterResultLabel,
    );
    expect(output.top).toBe((outputBox?.top ?? 0) + CODE_BOX.paddingTop);
    expect(output.top + 2 * ROW + CODE_BOX.paddingBottom).toBe(
      (outputBox?.top ?? 0) + (outputBox?.height ?? 0),
    );
    expect(
      textElements(elements).filter(
        (text) =>
          text.top > (outputBox?.top ?? 0) &&
          text.top < (outputBox?.top ?? 0) + (outputBox?.height ?? 0),
      ),
    ).toHaveLength(1);
  });

  it("출력은 코드와 같은 고정폭 글꼴·28pt·줄 간격 2이고 색 구분이 없다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const code = monoTexts(elements).find((text) =>
      text.text.startsWith("# 인사말"),
    );
    const output = monoTexts(elements).find((text) =>
      text.text.startsWith("코알라"),
    );

    for (const text of [code, output]) {
      expect(text?.fontSizePt).toBe(TYPOGRAPHY.body);
      expect(text?.lineHeightEm).toBe(LINE_HEIGHT.global);
      expect(text?.fontRef).toBe("jetbrains-mono-ref");
    }
    expect(output?.inline).toEqual([]);
    expect(output?.text).toBe("코알라\n  둘째 줄");
    // 코드 쪽 주석·키워드 색은 그대로다.
    const painted = (code?.inline ?? []).map((range) => ({
      text: code?.text.slice(range.index, range.index + range.length),
      color: range.formatting.color,
      weight: range.formatting.fontWeight,
    }));
    expect(painted).toEqual([
      {
        text: "# 인사말을 보여 줍니다",
        color: coalaTheme.colors.secondaryText,
        weight: undefined,
      },
      { text: "if", color: coalaTheme.colors.primary, weight: "bold" },
    ]);
    expect(code?.text).toContain("\n    print(name)");
  });

  it("고정폭 글꼴이 없으면 코드와 출력을 본문 글꼴로 그린다", () => {
    const [page] = layoutOf(source, wantedSansFonts);
    const texts = textElements(page?.elements ?? []).filter(
      (text) =>
        text.text.startsWith("# 인사말") || text.text.startsWith("코알라"),
    );

    expect(texts).toHaveLength(2);
    for (const text of texts) {
      expect(text.fontRef).toBe("wanted-sans-ref");
      expect(text.fontSizePt).toBe(TYPOGRAPHY.body);
    }
  });

  it("언어 이름이 없으면 라벨은 '코드'이고 색 구분이 없다", () => {
    const [page] = layoutOf(
      book(concept(["```", "이름: 코알라 # 주석 아님", "```", "", ...OUTPUT])),
    );
    const elements = page?.elements ?? [];
    const code = monoTexts(elements).find((text) =>
      text.text.startsWith("이름:"),
    );

    expect(findText(elements, "코드").text).toBe("코드");
    expect(code?.inline).toEqual([]);
    expect(highlightCode(["x = 1"], "", "bold")).toEqual([]);
  });

  it("앞뒤 글과의 간격이 정해진 값이다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [codeBox, outputBox] = codeBoxes(elements);
    const before = findText(elements, "도입 문장입니다.");
    const after = findText(elements, "마무리 문장입니다.");

    expect(codeBox?.top).toBe(before.top + ROW + GAP.beforeCode);
    expect(after.top).toBe(
      (outputBox?.top ?? 0) + (outputBox?.height ?? 0) + GAP.afterCode,
    );
  });

  it("긴 코드와 긴 출력은 줄 경계에서 여러 페이지로 나뉘고 모든 줄이 한 번씩 남는다", () => {
    const codeLines = Array.from(
      { length: 40 },
      (_, i) => `code_${i + 1} = ${i + 1}`,
    );
    const outputLines = Array.from({ length: 40 }, (_, i) => `out_${i + 1}`);
    const pages = layoutOf(
      book(
        concept([
          "```python",
          ...codeLines,
          "```",
          "",
          "```output",
          ...outputLines,
          "```",
        ]),
      ),
    );

    expect(pages.length).toBeGreaterThan(2);
    const boxes = pages.flatMap((page) => codeBoxes(page.elements));
    expect(boxes.length).toBeGreaterThan(2);
    for (const page of pages) {
      for (const box of codeBoxes(page.elements)) {
        expect(box.top).toBeGreaterThanOrEqual(PAGE.safeTop);
        expect(box.top + box.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
      for (const text of textElements(page.elements)) {
        expect(text.fontSizePt).toBeGreaterThanOrEqual(TYPOGRAPHY.body);
      }
    }
    // 모든 줄이 정확히 한 번씩, 원고 순서대로 있다.
    const mono = pages.flatMap((page) => monoTexts(page.elements));
    const joined = mono
      .map((text) => text.text)
      .join("\n")
      .split("\n");
    expect(joined).toEqual([...codeLines, ...outputLines]);
    // 라벨이 무엇의 계속인지 밝힌다.
    const labels = pages.flatMap((page) =>
      textElements(page.elements)
        .map((text) => text.text)
        .filter((text) => /^(Python|실행 결과)/.test(text)),
    );
    expect(labels[0]).toBe("Python");
    expect(labels).toContain("Python (계속)");
    expect(labels).toContain(RESULT_LABEL);
    expect(labels).toContain(`${RESULT_LABEL} (계속)`);
    // 파란 라벨은 결과 상자마다 하나씩, 그 상자 바로 위에 있다.
    for (const page of pages) {
      for (const label of resultLabels(page.elements)) {
        const below = codeBoxes(page.elements).find(
          (box) => box.top === label.top + ROW + CODE_BOX.afterResultLabel,
        );
        expect(below).toBeDefined();
      }
    }
    // 연속 페이지 제목 아래에 상자가 놓인다.
    expect(pages[1]?.title).toBe("제목(계속)");
    const heading = findText(pages[1]?.elements ?? [], "제목(계속)");
    expect(codeBoxes(pages[1]?.elements ?? [])[0]?.top).toBeGreaterThan(
      heading.top,
    );
  });
});

describe("GUI 실행 결과 배치", () => {
  const source = book(
    concept([
      "도입 문장입니다.",
      "",
      ...CODE,
      "",
      RESULT_IMAGE,
      "",
      "마무리 문장입니다.",
    ]),
  );

  it("코드 상자 다음에 '실행 결과' 라벨이 붙은 끌어다 놓기 자리를 놓는다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [box] = codeBoxes(elements);
    const [target] = dropTargets(elements);
    const label = findText(elements, RESULT_LABEL);
    const after = findText(elements, "마무리 문장입니다.");

    expect(codeBoxes(elements)).toHaveLength(1);
    expect(label.top).toBe(
      (box?.top ?? 0) + (box?.height ?? 0) + CODE_BOX.beforeResultLabel,
    );
    expect(label.fontRef).toBe("wanted-sans-ref");
    expect(label.color).toBe(coalaTheme.colors.primary);
    expect(label.fontWeight).toBe("bold");
    expect(target?.top).toBeGreaterThan(label.top);
    expect(target?.top).toBeLessThan(label.top + ROW + 20);
    // 본문 흐름의 이미지 자리는 기존 규칙대로 본문 너비(`text`)다.
    expect(target?.width).toBe(TEXT_WIDTH);
    expect(
      Math.round(((target?.width ?? 0) / (target?.height ?? 1)) * 10),
    ).toBe(Math.round((16 / 9) * 10));
    expect(after.top).toBe(
      (target?.top ?? 0) + (target?.height ?? 0) + GAP.afterImage,
    );
  });

  it("생성 후 목록에 실행 결과 역할과 함께 보고되고 일반 이미지와 구분된다", () => {
    const pages = layoutOf(
      book(concept([...CODE, "", RESULT_IMAGE, "", PLAIN_IMAGE])),
    );
    const pending = pages.flatMap((page) => page.pendingImages ?? []);

    expect(pending.map((image) => [image.src, image.role])).toEqual([
      ["assets/code/window.png", "result"],
      ["assets/code/plain.png", undefined],
    ]);
    // 일반 이미지 위에는 라벨이 없다.
    expect(
      pages.flatMap((page) =>
        textElements(page.elements).filter(
          (text) => text.text === RESULT_LABEL,
        ),
      ),
    ).toHaveLength(1);
  });

  it("비율·폭·캡션은 기존 이미지 규칙을 따르고 캡션은 라벨 아래 자리 밑에 놓인다", () => {
    const [page] = layoutOf(
      book(
        concept([
          ...CODE,
          "",
          '::image{src="assets/code/w.png" alt="창" ratio="4:3" width="half" role="result" caption="그림 1 실행 화면"}',
        ]),
      ),
    );
    const elements = page?.elements ?? [];
    const [target] = dropTargets(elements);
    const caption = findText(elements, "그림 1 실행 화면");
    const label = findText(elements, RESULT_LABEL);

    expect(target?.width).toBe(Math.round(TEXT_WIDTH / 2));
    expect(
      Math.round(((target?.width ?? 0) / (target?.height ?? 1)) * 10),
    ).toBe(Math.round((4 / 3) * 10));
    expect(label.top).toBeLessThan(target?.top ?? 0);
    expect(caption.top).toBeGreaterThan(
      (target?.top ?? 0) + (target?.height ?? 0),
    );
  });

  it("공간이 부족하면 자리를 다음 페이지 안전 영역 안에 놓되 읽기 순서는 코드 바로 다음이다", () => {
    const codeLines = Array.from(
      { length: 16 },
      (_, i) => `line_${i + 1} = ${i + 1}`,
    );
    const pages = layoutOf(
      book(
        concept([
          "```python",
          ...codeLines,
          "```",
          "",
          RESULT_IMAGE,
          "",
          "마무리.",
        ]),
      ),
    );

    expect(pages.length).toBe(2);
    expect(dropTargets(pages[0]?.elements ?? [])).toHaveLength(0);
    const [target] = dropTargets(pages[1]?.elements ?? []);
    const label = findText(pages[1]?.elements ?? [], RESULT_LABEL);
    expect(target?.top).toBeGreaterThan(label.top);
    expect((target?.top ?? 0) + (target?.height ?? 0)).toBeLessThanOrEqual(
      PAGE.safeBottom,
    );
    expect(findText(pages[1]?.elements ?? [], "마무리.").top).toBeGreaterThan(
      target?.top ?? 0,
    );
    expect(pages[1]?.pendingImages?.[0]?.role).toBe("result");
  });
});

describe("보관된 원고", () => {
  it("code-block.md가 통과하고 모든 상자와 자리가 안전 영역 안에 놓인다", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/code-block.md"),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);
    const pages = layoutOf(source);

    expect(issues).toEqual([]);
    expect(spec?.pages).toHaveLength(6);
    for (const page of pages) {
      for (const shape of [
        ...codeBoxes(page.elements),
        ...dropTargets(page.elements),
      ]) {
        expect(shape.top).toBeGreaterThanOrEqual(PAGE.safeTop);
        expect(shape.top + shape.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
    const results = pages.flatMap((page) => page.pendingImages ?? []);
    expect(results.map((image) => image.role)).toEqual(["result", "result"]);
  });

  it.each(
    fs
      .readdirSync(path.resolve(process.cwd(), "../test-input/invalid"))
      .filter((file) => file.startsWith("code-")),
  )("invalid/%s: 코드·결과 오류로 거절된다", (file) => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/invalid", file),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);

    expect(source).toContain(':::page{type="concept"');
    expect(spec).toBeUndefined();
    expect(
      issues.filter((issue) => issue.severity === "error" && issue.pageId),
    ).toHaveLength(1);
  });
});

describe("코드 글꼴 조회", () => {
  it("조회된 글꼴에서 고정폭 글꼴을 골라 모든 후보에 붙인다", () => {
    const mono = {
      name: "Roboto Mono",
      ref: "roboto-mono-ref" as FontRef,
      weights: [{ weight: "normal" as const, styles: ["normal" as const] }],
    };
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans, mono],
    });

    expect(report.codeFontName).toBe("Roboto Mono");
    expect(
      candidates.every(
        (candidate) => candidate.code?.fontRef === "roboto-mono-ref",
      ),
    ).toBe(true);
  });

  it("고정폭 글꼴이 없으면 code를 비워 둔다", () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans],
    });

    expect(report.codeFontName).toBeUndefined();
    expect(candidates.every((candidate) => candidate.code === undefined)).toBe(
      true,
    );
  });
});
