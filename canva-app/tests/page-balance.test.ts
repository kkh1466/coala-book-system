import fs from "node:fs";
import {
  balanceSparsePages,
  flowIntoPages,
  totalHeight,
} from "../src/layout/flow";
import type { FlowItem } from "../src/layout/flow";
import { prepareMath } from "../src/builder/prepare-math";
import { layoutPage } from "../src/builder/create-page";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import { PAGE } from "../src/theme/page-layout";
import { measureText } from "../src/layout/measure";
import {
  findText,
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

beforeEach(() => installRecordingRichtext());

const item = (
  height: number,
  gapAfter = 0,
  extra: Partial<FlowItem> = {},
): FlowItem => ({
  height,
  gapAfter,
  render: () => [],
  ...extra,
});
const area = { top: 100, bottom: 1100 };
const flatten = (pages: ReturnType<typeof flowIntoPages>) =>
  pages.flatMap((page) => page.map((placed) => placed.item));

describe("내용이 적은 연속 페이지의 분량 재배분", () => {
  const items = () => [
    item(80, 20, { keepWithNext: 100 }),
    item(560, 20),
    item(60, 20, { startsSection: true, keepWithNext: 100 }),
    item(180, 56),
    item(120),
  ];

  it("마지막 설명만 넘쳤을 때 소제목·수식·설명을 함께 다음 페이지로 보낸다", () => {
    const content = items();
    const greedy = flowIntoPages(content, area, { continuationInset: 100 });
    expect(greedy[1]?.map(({ item: block }) => block)).toEqual(
      content.slice(-1),
    );
    const result = balanceSparsePages(greedy, area, 100);
    expect(result).toHaveLength(2);
    expect(result[0]?.map(({ item: block }) => block)).toEqual(
      content.slice(0, 2),
    );
    expect(result[1]?.map(({ item: block }) => block)).toEqual(
      content.slice(2),
    );
    expect(flatten(result)).toEqual(content);
    expect(greedy[1]).toHaveLength(1); // 입력 배치를 바꾸지 않는다.
  });

  it("블록의 크기와 수식 뒤 여백을 유지하고 연속 제목 자리까지 확보한다", () => {
    const content = items();
    const result = balanceSparsePages(flowIntoPages(content, area), area, 100);
    for (const [index, page] of result.entries()) {
      const blocks = page.map(({ item: block }) => block);
      expect(totalHeight(blocks)).toBeGreaterThanOrEqual(900 * 0.35);
      for (const placed of page) {
        expect(
          placed.top + placed.item.height + (index > 0 ? 100 : 0),
        ).toBeLessThanOrEqual(area.bottom);
      }
      const pairs = page
        .slice(0, -1)
        .map((placed, position) => ({ placed, next: page[position + 1] }));
      for (const { placed, next } of pairs) {
        expect(
          (next?.top ?? NaN) - placed.top - placed.item.height,
        ).toBeCloseTo(placed.item.gapAfter);
      }
    }
    expect(flatten(result)).toEqual(content);
    expect(content[3]?.gapAfter).toBe(56);
  });

  it("소제목 경계를 쓸 수 없으면 본문 블록 경계에서 분량을 고른다", () => {
    const content = [
      item(80, 20, { keepWithNext: 100 }),
      item(400, 20),
      item(350, 20),
      item(180),
    ];
    const result = balanceSparsePages(flowIntoPages(content, area), area, 100);
    expect(result[1]?.map(({ item: block }) => block)).toEqual(
      content.slice(2),
    );
    expect(flatten(result)).toEqual(content);
  });

  it("제목과 본문을 떼거나 큰 이미지·수식을 축소해서 억지로 채우지 않는다", () => {
    const content = [item(80, 20, { keepWithNext: 100 }), item(850), item(120)];
    const greedy = flowIntoPages(content, area);
    expect(balanceSparsePages(greedy, area, 100)).toEqual(greedy);
  });

  it("내용이 충분한 연속 페이지와 한 장짜리 페이지는 다시 배분하지 않는다", () => {
    const enough = flowIntoPages([item(700), item(450)], area);
    expect(balanceSparsePages(enough, area, 100)).toEqual(enough);
    const single = flowIntoPages(items().slice(0, 2), area);
    expect(balanceSparsePages(single, area, 100)).toEqual(single);
  });

  it("재배분을 호출하지 않은 기존 분할 경로는 동일하다", () => {
    const content = items();
    const first = flowIntoPages(content, area);
    balanceSparsePages(first, area, 100);
    expect(flowIntoPages(content, area)).toEqual(first);
  });
});

it("실제 4단원의 짧은 마지막 장에 데이터 계산 섹션 전체를 배치한다", async () => {
  const spec = parseBookMarkdown(
    fs.readFileSync("../coala-book-md/ai-math4/book.md", "utf8"),
  );
  const page = spec.pages.find(
    (candidate) => candidate.id === "ch04-conditional",
  );
  if (!page) throw new Error("Missing conditional probability page");
  const { math } = await prepareMath(spec);
  const result = layoutPage(page, { ...wantedSansFonts, math });
  expect(result).toHaveLength(2);
  const first = result[0]?.elements ?? [];
  const last = result[1]?.elements ?? [];
  expect(findText(last, "데이터로 계산하기")).toBeDefined();
  expect(
    findText(
      last,
      "먹구름이 있는 날은 40일이고, 그중 비가 온 날은 24일입니다.",
    ),
  ).toBeDefined();
  expect(last.filter((element) => element.type === "image")).toHaveLength(1);
  expect(
    textElements(first).some((element) => element.text === "데이터로 계산하기"),
  ).toBe(false);
  expect(
    textElements(last).some((element) =>
      element.text.startsWith("분자와 분모를 모두 100"),
    ),
  ).toBe(true);
  expect(
    textElements(first).some((element) => element.text.startsWith("단, P(B)")),
  ).toBe(true);

  const bottoms = last.map((element) => {
    if (element.type === "image") return element.top + Number(element.height);
    return element.top;
  });
  for (const text of textElements(last)) {
    expect(text.fontSizePt).toBeGreaterThanOrEqual(28);
    const bottom =
      text.top +
      measureText(text.text, {
        fontSize: text.fontSizePt ?? 28,
        width: text.width,
        lineHeightEm: text.lineHeightEm ?? 2,
      });
    expect(bottom).toBeLessThanOrEqual(PAGE.safeBottom);
    bottoms.push(bottom);
  }
  expect(Math.max(...bottoms) - PAGE.safeTop).toBeGreaterThan(
    (PAGE.safeBottom - PAGE.safeTop) * 0.35,
  );
});
