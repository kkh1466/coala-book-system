import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { parseBlocks } from "../src/parser/blocks";
import { parseFlowLines } from "../src/parser/flow-strip";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import {
  CALLOUT_PADDING,
  CONTENT_WIDTH,
  FLOW_STRIP,
  GAP,
  PAGE,
} from "../src/theme/page-layout";
import { LINE_HEIGHT, TYPOGRAPHY } from "../src/theme/typography";
import type { ConceptPage } from "../src/types/book-spec";
import { validateBookSpec } from "../src/types/book-spec";
import { lineHeight } from "../src/layout/measure";
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

const FLOW = [
  "```flow",
  "정보 입력 | Field",
  "버튼 클릭 | Button",
  "처리 | 기능 실행",
  "결과 확인 | Text",
  "```",
];

const ROW = lineHeight(TYPOGRAPHY.body, LINE_HEIGHT.global);

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

const shapes = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter((element): element is Shape => element.type === "shape");
const cards = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter(
    (shape) => shape.paths[0]?.fill.color === coalaTheme.colors.cardFill,
  );
const connectors = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter(
    (shape) => shape.paths[0]?.fill.color === coalaTheme.colors.flowConnector,
  );

describe("flow 블록 읽기", () => {
  it("줄 하나가 카드 하나이고 '제목 | 부제'로 나뉜다", () => {
    const blocks = parseBlocks(["문단", "", ...FLOW, "", "뒤"].join("\n"));

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "flow",
      "paragraph",
    ]);
    expect(blocks[1]).toEqual({
      kind: "flow",
      steps: [
        { title: "정보 입력", subtitle: "Field" },
        { title: "버튼 클릭", subtitle: "Button" },
        { title: "처리", subtitle: "기능 실행" },
        { title: "결과 확인", subtitle: "Text" },
      ],
    });
    expect(parseFlowLines(["질문하기", "", "답 받기"]).steps).toEqual([
      { title: "질문하기" },
      { title: "답 받기" },
    ]);
  });

  it("flow 블록은 코드가 아니므로 실행 결과를 요구하지 않는다", () => {
    expect(errorsOf(book(concept(FLOW)))).toEqual([]);
  });
});

describe("flow 블록 원고 검사", () => {
  it.each([
    [
      "카드 하나",
      ["```flow", "정보 입력 | Field", "```"],
      "11: flow 블록에는 카드를 2개에서 5개까지 둘 수 있습니다. 지금은 1개입니다.",
    ],
    [
      "카드 여섯",
      ["```flow", "1", "2", "3", "4", "5", "6", "```"],
      "11: flow 블록에는 카드를 2개에서 5개까지 둘 수 있습니다. 지금은 6개입니다.",
    ],
    [
      "'|'가 둘",
      ["```flow", "입력 | Field | 추가", "출력 | Text", "```"],
      "12: flow 블록의 줄에는 '|'를 한 번만 쓸 수 있습니다: '제목 | 부제'.",
    ],
    [
      "제목 없음",
      ["```flow", "| Field", "출력 | Text", "```"],
      "12: flow 블록의 카드에는 제목이 있어야 합니다: '제목 | 부제'.",
    ],
    [
      "목록 줄",
      ["```flow", "- 입력", "출력 | Text", "```"],
      "12: flow 블록의 줄은 '제목 | 부제' 형식이어야 합니다. 제목·목록·이미지·펜스는 쓸 수 없습니다.",
    ],
  ])("%s을(를) 행 번호와 함께 거절한다", (_name, body, expected) => {
    expect(errorsOf(book(concept(body)))).toEqual([expected]);
  });

  it("카드 배치와 다른 페이지 형식에서는 거절한다", () => {
    expect(
      errorsOf(
        book(
          concept([...FLOW, "", "## 둘째 카드", "", "내용"], ' layout="cards"'),
        ),
      ),
    ).toEqual([
      expect.stringContaining('flow 블록은 concept layout="basic"에서만'),
    ]);
    expect(
      errorsOf(
        book([
          ':::page{type="practice-checklist" id="c1"}',
          "# 목표",
          "",
          "- [ ] 항목",
          "",
          ...FLOW,
          ":::",
        ]),
      ),
    ).toEqual([
      expect.stringContaining("practice-checklist 페이지에는 flow 블록"),
    ]);
  });

  it("BookSpec 검증도 같은 판별로 줄 문제를 거절한다", () => {
    const spec = parseBookMarkdown(book(concept(FLOW)));
    const page = spec.pages[0] as ConceptPage;
    const broken = {
      ...spec,
      pages: [
        {
          ...page,
          sections: page.sections.map((section) => ({
            ...section,
            content: "```flow\n하나\n```",
          })),
        },
      ],
    };

    expect(() => validateBookSpec(spec)).not.toThrow();
    expect(() => validateBookSpec(broken)).toThrow("카드를 2개에서 5개까지");
  });
});

describe("flow 블록 배치", () => {
  const source = book(
    concept(["도입 문장입니다.", "", ...FLOW, "", "마무리 문장입니다."]),
  );

  it("흰 카드 네 개를 전체 단 너비에 같은 간격으로 놓고 사이를 선으로 잇는다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const flowCards = cards(elements);
    const lines = connectors(elements);
    const expectedWidth = Math.floor((CONTENT_WIDTH - FLOW_STRIP.gap * 3) / 4);

    expect(flowCards).toHaveLength(4);
    expect(lines).toHaveLength(3);
    flowCards.forEach((card, index) => {
      expect(card.width).toBe(expectedWidth);
      expect(card.left).toBe(
        PAGE.marginX + index * (expectedWidth + FLOW_STRIP.gap),
      );
      expect(card.top).toBe(flowCards[0]?.top);
      expect(card.height).toBe(flowCards[0]?.height);
      expect(card.paths[0]?.d).toContain(`A ${FLOW_STRIP.radius}`);
    });
    // 두 줄(제목·부제) + 위아래 여백. 원본은 183px.
    expect(flowCards[0]?.height).toBe(FLOW_STRIP.paddingY * 2 + ROW * 2);
    lines.forEach((line, index) => {
      const left = flowCards[index];
      const right = flowCards[index + 1];
      expect(line.left).toBe(
        (left?.left ?? 0) + (left?.width ?? 0) + FLOW_STRIP.connector.inset,
      );
      expect(line.left + line.width).toBe(
        (right?.left ?? 0) - FLOW_STRIP.connector.inset,
      );
      expect(line.height).toBe(FLOW_STRIP.connector.weight);
      expect(line.top).toBeGreaterThan(left?.top ?? 0);
      expect(line.top).toBeLessThan((left?.top ?? 0) + (left?.height ?? 0));
    });
  });

  it("제목은 굵은 검정, 부제는 파란색이며 둘 다 28pt 가운데 정렬이다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [card] = cards(elements);
    const title = findText(elements, "정보 입력");
    const subtitle = findText(elements, "Field");

    expect(title.fontWeight).toBe("bold");
    expect(title.color).toBe(coalaTheme.colors.text);
    expect(subtitle.fontWeight).toBe("normal");
    expect(subtitle.color).toBe(coalaTheme.colors.primary);
    for (const text of [title, subtitle]) {
      expect(text.fontSizePt).toBe(TYPOGRAPHY.body);
      expect(text.paragraph[0]?.textAlign).toBe("center");
      expect(text.left).toBe((card?.left ?? 0) + FLOW_STRIP.paddingX);
      expect(text.width).toBe((card?.width ?? 0) - FLOW_STRIP.paddingX * 2);
    }
    expect(subtitle.top).toBe(title.top + ROW);
    expect(title.top).toBe((card?.top ?? 0) + FLOW_STRIP.paddingY);
  });

  it("부제가 없거나 제목이 접히면 카드 높이가 그에 맞춰 모두 같다", () => {
    const [page] = layoutOf(
      book(
        concept([
          "```flow",
          "질문하기",
          "답 받기",
          "```",
          "",
          "```flow",
          "사용자 정보 입력받기 | Field",
          "계산 | Button",
          "계산 결과를 화면에 문장으로 보여주기 | Text",
          "```",
        ]),
      ),
    );
    const elements = page?.elements ?? [];
    const flowCards = cards(elements);

    expect(flowCards).toHaveLength(5);
    expect(flowCards[0]?.height).toBe(FLOW_STRIP.paddingY * 2 + ROW);
    expect(
      textElements(elements).filter((text) => text.text === "질문하기"),
    ).toHaveLength(1);
    const tall = flowCards.slice(2);
    expect(tall.every((card) => card.height === tall[0]?.height)).toBe(true);
    expect(tall[0]?.height).toBeGreaterThan(FLOW_STRIP.paddingY * 2 + ROW * 2);
  });

  it("앞뒤 글과의 간격이 정해진 값이고 흐름은 통째로 다음 페이지로 넘어간다", () => {
    const [page] = layoutOf(source);
    const elements = page?.elements ?? [];
    const [card] = cards(elements);
    const before = findText(elements, "도입 문장입니다.");
    const after = findText(elements, "마무리 문장입니다.");

    expect(card?.top).toBe(before.top + ROW + GAP.beforeFlow);
    expect(after.top).toBe(
      (card?.top ?? 0) + (card?.height ?? 0) + GAP.afterFlow,
    );

    const filler = Array.from(
      { length: 14 },
      (_, index) =>
        `${index + 1}번째 채움 문단입니다. 생성형 AI는 사용자의 요청에 따라 새로운 결과물을 만드는 인공지능입니다.`,
    );
    const pages = layoutOf(
      book(concept([...filler.flatMap((p) => [p, ""]), ...FLOW])),
    );
    const withFlow = pages.find((item) => cards(item.elements).length > 0);
    expect(pages.length).toBeGreaterThan(1);
    expect(cards(withFlow?.elements ?? [])).toHaveLength(4);
    for (const card of cards(withFlow?.elements ?? [])) {
      expect(card.top + card.height).toBeLessThanOrEqual(PAGE.safeBottom);
    }
  });
});

describe("보관된 원고", () => {
  it("flow-strip.md가 통과하고 핵심정리 라벨이 원본 표기다", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/flow-strip.md"),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);
    const pages = layoutOf(source);

    expect(issues).toEqual([]);
    expect(spec?.pages).toHaveLength(2);
    const elements = pages[0]?.elements ?? [];
    const label = textElements(elements).find((text) =>
      text.text.endsWith("핵심정리"),
    );
    expect(label?.text).toBe("📑  핵심정리");
    // 강조 박스의 글은 안쪽 너비보다 여유를 두고 흐른다(대체 글꼴 초과 흡수).
    const body = textElements(elements).find((text) =>
      text.text.startsWith("GUI는 입력"),
    );
    expect(body?.width).toBe(
      CONTENT_WIDTH - CALLOUT_PADDING.x * 2 - CALLOUT_PADDING.textSlack,
    );
    expect(label?.width).toBe(body?.width);
    for (const page of pages) {
      for (const card of cards(page.elements)) {
        expect(card.top + card.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
  });

  it.each(
    fs
      .readdirSync(path.resolve(process.cwd(), "../test-input/invalid"))
      .filter((file) => file.startsWith("flow-")),
  )("invalid/%s: 오류로 거절된다", (file) => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/invalid", file),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);

    expect(source).toContain("```flow");
    expect(spec).toBeUndefined();
    expect(
      issues.some((issue) => issue.severity === "error" && issue.pageId),
    ).toBe(true);
  });
});
