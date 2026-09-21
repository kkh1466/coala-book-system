import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import { createBook } from "../src/builder/create-book";
import {
  collectPendingFlowcharts,
  layoutBook,
} from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import {
  estimateFlowchartHeight,
  longestPathLength,
} from "../src/layout/flowchart-placeholder";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import { CONTENT_WIDTH, PAGE } from "../src/theme/page-layout";
import type { FlowchartPage } from "../src/types/book-spec";
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

const layoutFixture = (name = "flowchart-placeholder.md") => {
  const spec = parseBookMarkdown(readFixture(name));
  return layoutBook(spec, planBook(spec).pages, wantedSansFonts);
};

type Shape = Extract<ElementAtPoint, { type: "shape" }> & {
  width: number;
  height: number;
};

const shapes = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter((element): element is Shape => element.type === "shape");

const flowchartSource = (body: string, attributes = ""): string =>
  [
    "---",
    "schema_version: 1",
    "title: 시험",
    "language: ko",
    "canvas: coala-portrait",
    "numbering: auto",
    "toc: none",
    "---",
    "",
    `:::page{type="flowchart" id="f1"${attributes}}`,
    "# 순서도",
    "",
    body,
    ":::",
    "",
  ].join("\n");

const SMALL_GRAPH = [
  "```flowchart",
  "nodes:",
  "  - id: a",
  "    role: input",
  "    text: 입력",
  "  - id: b",
  "    role: output",
  "    text: 출력",
  "connections:",
  "  - from: a",
  "    to: b",
  "```",
].join("\n");

const flowchartPageOf = (source: string): FlowchartPage => {
  const page = parseBookMarkdown(source).pages[0];
  if (!page || page.type !== "flowchart") {
    throw new Error("flowchart 페이지가 아닙니다.");
  }
  return page;
};

describe("flowchart manuscript", () => {
  it("keeps the text below the flowchart instead of dropping it", () => {
    const page = flowchartPageOf(
      flowchartSource(
        `도입 첫 문단.\n\n도입 둘째 문단.\n\n${SMALL_GRAPH}\n\n마무리 문단입니다.`,
      ),
    );

    expect(page.introduction).toBe("도입 첫 문단.\n\n도입 둘째 문단.");
    expect(page.conclusion).toBe("마무리 문단입니다.");
  });

  it("refuses a callout, which has no place on a flowchart page", () => {
    expect(() =>
      parseBookMarkdown(
        flowchartSource(`${SMALL_GRAPH}\n\n> [!TIP]\n> 참고하세요.`),
      ),
    ).toThrow("강조 박스를 넣을 수 없습니다");
  });

  it("reads a declared placeholder height", () => {
    const page = flowchartPageOf(flowchartSource(SMALL_GRAPH, ' height="900"'));

    expect(page.placeholderHeight).toBe(900);
  });

  it.each([
    ["tall", "정수여야"],
    ["120", "between 300 and 1800"],
    ["5000", "between 300 and 1800"],
  ])("rejects height=%s", (height, reason) => {
    expect(() =>
      parseBookMarkdown(flowchartSource(SMALL_GRAPH, ` height="${height}"`)),
    ).toThrow(reason);
  });
});

describe("flowchart height estimate", () => {
  const node = (id: string) => ({ id, role: "process" as const, text: id });

  it("counts the nodes on the longest route from top to bottom", () => {
    const nodes = ["a", "b", "c", "d"].map(node);
    const connections = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "b", to: "d" },
    ];

    expect(longestPathLength(nodes, connections)).toBe(3);
  });

  it("does not run forever on a loop that connects back", () => {
    const nodes = ["a", "b", "c"].map(node);
    const connections = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "b" },
    ];

    expect(longestPathLength(nodes, connections)).toBe(3);
  });

  it("grows with the number of stacked nodes", () => {
    const chain = (length: number) => {
      const nodes = Array.from({ length }, (_, index) => node(`n${index}`));
      const connections = nodes
        .slice(1)
        .map((target, index) => ({ from: `n${index}`, to: target.id }));
      return estimateFlowchartHeight(nodes, connections);
    };

    expect(chain(3)).toBeLessThan(chain(5));
    expect(chain(1)).toBeGreaterThanOrEqual(600);
  });
});

describe("flowchart placeholder page", () => {
  it("draws one neutral box and never a lookalike flowchart shape", () => {
    const laid = layoutFixture();
    const flowchartPages = laid.filter((page) => page.pageType === "flowchart");
    const roleColors = [
      "declarationFill",
      "inputFill",
      "processFill",
      "decisionFill",
      "outputFill",
      "loopFill",
      "ifElseContainerFill",
      "connector",
    ].map((key) => coalaTheme.colors[key as keyof typeof coalaTheme.colors]);

    expect(flowchartPages.length).toBeGreaterThanOrEqual(4);
    for (const page of flowchartPages) {
      const drawn = shapes(page.elements);
      // 자리가 놓인 장에는 도형이 정확히 하나, 그 밖의 연속 장에는 없다.
      expect(drawn).toHaveLength(page.pendingFlowcharts ? 1 : 0);
      for (const shape of drawn) {
        expect(shape.paths).toHaveLength(1);
        expect(shape.paths[0]?.fill).toEqual({
          dropTarget: false,
          color: coalaTheme.colors.placeholderFill,
        });
        expect(shape.paths[0]?.stroke).toBeUndefined();
        expect(roleColors).not.toContain(shape.paths[0]?.fill.color);
      }
    }
  });

  it("tells the user every node and connection of the manuscript", () => {
    const laid = layoutFixture();
    const ageCheck = laid.find((page) => page.sourcePageId === "age-check");
    const guide = textElements(ageCheck?.elements ?? []).find((element) =>
      element.text.includes("순서도 자리"),
    );

    expect(guide?.text.split("\n")).toEqual([
      "🔀 순서도 자리 · Canva에서 직접 만들어 주세요",
      "구조: 조건문(if/else)",
      "1. [입력] 나이 입력",
      "2. [조건] 나이가 20세 이상인가?",
      "3. [출력] 성인입니다.",
      "4. [출력] 미성년자입니다.",
      "연결: 1 → 2 · 2 —YES→ 3 · 2 —NO→ 4",
    ]);
  });

  it("names the exact Canva element required for each node", () => {
    const pending = collectPendingFlowcharts(layoutFixture());
    const loop = pending.find((item) => item.title === "1부터 5까지 출력하기");

    expect(pending.map((item) => item.title)).toEqual([
      "순서도로 이해하기",
      "수면 시간에 따른 건강 상태 안내",
      "1부터 5까지 출력하기",
      "주문 처리 전체 과정",
    ]);
    expect(
      loop?.nodes.map(({ roleLabel, elementName, elementId }) => ({
        roleLabel,
        elementName,
        elementId,
      })),
    ).toEqual([
      {
        roleLabel: "선언",
        elementName: "Arrow block convex",
        elementId: "MAE7lCxHi8M",
      },
      {
        roleLabel: "조건",
        elementName: "Flowchart Decision",
        elementId: "MAGpWETGMb4",
      },
      {
        roleLabel: "출력",
        elementName: "Flowchart Document",
        elementId: "MAGpWDtQbCc",
      },
      {
        roleLabel: "처리",
        elementName: "Flowchart Process",
        elementId: "MAGpWHT7x4M",
      },
    ]);
    expect(loop?.structureLabel).toBe("반복문");
    expect(loop?.structureHint).toContain("굵기 10");
    expect(loop?.connections).toContainEqual({ from: 4, to: 2 });
  });

  it("follows a declared height and estimates the rest", () => {
    const pending = collectPendingFlowcharts(layoutFixture());
    const byTitle = Object.fromEntries(
      pending.map((item) => [item.title, item]),
    );

    expect(byTitle["1부터 5까지 출력하기"]).toMatchObject({
      height: 900,
      heightDeclared: true,
      width: CONTENT_WIDTH,
    });
    expect(byTitle["순서도로 이해하기"]?.heightDeclared).toBe(false);
    expect(byTitle["순서도로 이해하기"]?.height).toBeGreaterThanOrEqual(
      estimateFlowchartHeight(
        [
          { id: "a", role: "input", text: "" },
          { id: "b", role: "decision", text: "" },
          { id: "c", role: "output", text: "" },
        ],
        [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
        ],
      ),
    );
  });

  it("keeps the placeholder inside the safe area and puts the conclusion under it", () => {
    const laid = layoutFixture();

    for (const page of laid.filter((item) => item.pendingFlowcharts)) {
      const [box] = shapes(page.elements);
      if (!box) {
        throw new Error("자리 도형이 없습니다.");
      }
      expect(box.top).toBeGreaterThanOrEqual(PAGE.safeTop);
      expect(box.top + box.height).toBeLessThanOrEqual(PAGE.safeBottom);
      expect(box.left).toBe(PAGE.marginX);

      // 자리 안의 글은 안내 글 하나뿐이다.
      const inside = textElements(page.elements).filter(
        (text) => text.top >= box.top && text.top < box.top + box.height,
      );
      expect(inside).toHaveLength(1);
    }

    const ageCheck = laid.find((page) => page.sourcePageId === "age-check");
    const [box] = shapes(ageCheck?.elements ?? []);
    const conclusion = textElements(ageCheck?.elements ?? []).find((element) =>
      element.text.startsWith("이처럼 조건에 따라"),
    );
    expect(conclusion?.top).toBeGreaterThanOrEqual(
      (box?.top ?? 0) + (box?.height ?? 0),
    );
  });

  it("grows the estimated box until a twelve-node guide fits in full", () => {
    const laid = layoutFixture();
    const long = laid.filter((page) => page.sourcePageId === "long-order");
    const guide = long
      .flatMap((page) => textElements(page.elements))
      .find((element) => element.text.includes("순서도 자리"));

    expect(guide?.fontSizePt).toBe(28);
    expect(guide?.text).toContain("12. [처리] 창고에 출고 요청을 보낸다");
    expect(guide?.text).toContain("연결: 1 → 2");
  });

  it("shortens the guide, never the type size, when the declared box is small", () => {
    const nodes = Array.from({ length: 12 }, (_, index) =>
      [
        `  - id: n${index}`,
        "    role: process",
        `    text: ${index}번째 처리`,
      ].join("\n"),
    ).join("\n");
    const connections = Array.from({ length: 11 }, (_, index) =>
      [`  - from: n${index}`, `    to: n${index + 1}`].join("\n"),
    ).join("\n");
    const graph = `\`\`\`flowchart\ncontrol_structure: linear\nnodes:\n${nodes}\nconnections:\n${connections}\n\`\`\``;
    const spec = parseBookMarkdown(flowchartSource(graph, ' height="300"'));

    const laid = layoutBook(spec, planBook(spec).pages, wantedSansFonts);
    const guide = laid
      .flatMap((page) => textElements(page.elements))
      .find((element) => element.text.includes("순서도 자리"));
    const [box] = shapes(laid[0]?.elements ?? []);

    expect(box?.height).toBe(300);
    expect(guide?.fontSizePt).toBe(28);
    expect(guide?.text.split("\n")).toEqual([
      "🔀 순서도 자리 · Canva에서 직접 만들어 주세요",
      "구조: 순차",
      "도형 12개 · 연결 11개",
    ]);
    // 자리에 다 적지 못해도 보고 목록에는 전부 남는다.
    expect(collectPendingFlowcharts(laid)[0]?.nodes).toHaveLength(12);
  });

  it("generates a book that contains flowcharts and reports them", async () => {
    const canva = createFakeCanva();
    installRecordingRichtext();
    const spec = parseBookMarkdown(readFixture("flowchart-placeholder.md"));

    const result = await createBook(spec, canva.deps);

    expect(result.createdPageCount).toBe(result.pageCount);
    expect(result.pendingFlowcharts).toHaveLength(4);
    const pageNumbers = result.pendingFlowcharts.map((item) =>
      Number(item.pageNumber),
    );
    expect(pageNumbers).toEqual([...pageNumbers].sort((a, b) => a - b));
  });
});

describe("manuscripts without flowcharts are unaffected", () => {
  it.each([
    "prototype-book.md",
    "prototype-book-v2.md",
    "image-placeholder.md",
  ])("%s reports no pending flowchart", (fixture) => {
    const laid = layoutFixture(fixture);

    expect(collectPendingFlowcharts(laid)).toEqual([]);
    laid.forEach((page) => {
      expect(page).not.toHaveProperty("pendingFlowcharts");
    });
  });
});
