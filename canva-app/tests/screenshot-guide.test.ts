import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import { collectPendingImages, layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import { CONTENT_WIDTH, PAGE, STEP_CARD } from "../src/theme/page-layout";
import { TYPOGRAPHY } from "../src/theme/typography";
import type { ScreenshotGuidePage } from "../src/types/book-spec";
import { validateBookSpec } from "../src/types/book-spec";
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

const image = (name: string, extra = "") =>
  `::image{src="assets/g/${name}.png" alt="${name} 화면" ratio="16:9"${extra}}`;
/** 카드 두 장이 한 페이지에 들어가도록 반 너비로 줄인 캡처. */
const smallImage = (name: string) => image(name, ' width="half"');

const step = (title: string, ...body: string[]): string[] => [
  `## ${title}`,
  "",
  ...body,
  "",
];

const guide = (body: string[], id = "g1"): string[] => [
  `:::page{type="screenshot-guide" id="${id}"}`,
  "# 새 프로젝트 만들기",
  "",
  "순서대로 따라 합니다.",
  "",
  ...body,
  ":::",
  "",
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

const shapes = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter((element): element is Shape => element.type === "shape");

const cards = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter(
    (shape) => shape.paths[0]?.fill.color === coalaTheme.colors.cardFill,
  );

const arrows = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter(
    (shape) =>
      shape.paths[0]?.fill.color === coalaTheme.colors.connector &&
      shape.width === STEP_CARD.arrow.width,
  );

const dropTargets = (elements: readonly ElementAtPoint[]): Shape[] =>
  shapes(elements).filter((shape) =>
    shape.paths.some((shapePath) => shapePath.fill.dropTarget === true),
  );

const twoSteps = book(
  guide([
    ...step(
      "만들기 버튼 누르기",
      "오른쪽 위 버튼을 누릅니다.",
      "",
      image("s1"),
    ),
    ...step("이름 정하기", image("s2"), "", "- 한글 가능", "- 밑줄 사용"),
  ]),
);

describe("screenshot-guide 원고 읽기", () => {
  it("## 하나가 단계 하나이고 캡처 자리와 지시문을 순서대로 남긴다", () => {
    const [page] = parseBookMarkdown(twoSteps).pages;
    const guidePage = page as ScreenshotGuidePage;

    expect(guidePage.type).toBe("screenshot-guide");
    expect(guidePage.introduction).toBe("순서대로 따라 합니다.");
    expect(guidePage.steps.map((item) => item.title)).toEqual([
      "만들기 버튼 누르기",
      "이름 정하기",
    ]);
    expect(guidePage.steps[0]?.content).toBe(
      `오른쪽 위 버튼을 누릅니다.\n\n${image("s1")}`,
    );
    expect(guidePage.steps[1]?.content.startsWith(image("s2"))).toBe(true);
  });

  it("캡처 자리가 없는 단계를 그 단계의 행 번호로 거절한다", () => {
    const errors = errorsOf(
      book(
        guide([
          ...step("첫 단계", "첫 화면을 엽니다.", "", image("s1")),
          ...step("캡처 없는 단계", "지시문만 있습니다."),
        ]),
      ),
    );

    expect(errors).toEqual([
      expect.stringMatching(/^17: 단계 '캡처 없는 단계'에 화면 캡처 자리/),
    ]);
  });

  it("캡처 자리가 둘인 단계를 두 번째 자리의 행 번호로 거절한다", () => {
    const errors = errorsOf(
      book(
        guide([
          ...step(
            "두 동작",
            "메뉴를 엽니다.",
            "",
            image("s1"),
            "",
            image("s2"),
          ),
        ]),
      ),
    );

    expect(errors).toEqual([
      expect.stringMatching(/^17: 단계 '두 동작'에 화면 캡처 자리가 2개/),
    ]);
  });

  it("단계 없는 페이지, 단계 위의 캡처, 직접 적은 STEP 번호를 거절한다", () => {
    expect(errorsOf(book(guide([image("s0")])))).toEqual([
      expect.stringContaining("하나 이상의 '## 단계 제목'"),
    ]);

    expect(
      errorsOf(
        book(
          guide([
            image("s0"),
            "",
            ...step("첫 단계", "엽니다.", "", image("s1")),
          ]),
        ),
      ),
    ).toEqual([expect.stringContaining("단계 제목(##) 아래에")]);

    expect(
      errorsOf(
        book(
          guide([...step("STEP 1. 버튼 누르기", "누릅니다.", "", image("s1"))]),
        ),
      ),
    ).toEqual([expect.stringContaining("단계 번호(STEP 1.)는 앱이")]);
  });

  describe("단계마다 이미지와 별개인 설명이 있어야 한다", () => {
    const rejected = (body: string[]) =>
      errorsOf(book(guide([...step("템플릿 고르기", ...body)])));
    const message =
      "11: 단계 '템플릿 고르기'에 설명이 없습니다. 이미지와 함께 수행할 행동이나 화면 설명을 문장 또는 목록으로 작성해 주세요.";

    it("이미지만 있는 단계를 단계 제목의 행 번호로 거절한다", () => {
      expect(rejected([image("s1")])).toEqual([message]);
    });

    it("alt가 길어도 설명으로 치지 않는다", () => {
      expect(
        rejected([
          '::image{src="assets/g/s1.png" alt="템플릿 목록에서 빈 프로젝트를 고르고 다음 단추를 누르는 화면" ratio="16:9"}',
        ]),
      ).toEqual([message]);
    });

    it("caption이 있어도 설명으로 치지 않는다", () => {
      expect(
        rejected([image("s1", ' caption="그림 3 빈 프로젝트를 고른 모습"')]),
      ).toEqual([message]);
    });

    it.each([
      ["이미지 앞의 문단", ["**빈 프로젝트**를 고릅니다.", "", image("s1")]],
      ["이미지 뒤의 문단", [image("s1"), "", "**빈 프로젝트**를 고릅니다."]],
      [
        "이미지와 목록",
        [image("s1"), "", "- 빈 프로젝트를 고릅니다.", "- 다음을 누릅니다."],
      ],
      [
        "이미지와 순서 목록",
        ["1. 목록을 봅니다.", "2. 고릅니다.", "", image("s1")],
      ],
    ])("%s이면 통과한다", (_name, body) => {
      const { spec, issues } = checkBookMarkdown(
        book(guide([...step("템플릿 고르기", ...body)])),
      );

      expect(issues).toEqual([]);
      expect((spec?.pages[0] as ScreenshotGuidePage).steps[0]?.title).toBe(
        "템플릿 고르기",
      );
    });

    it("BookSpec 검증도 같은 판별로 설명 없는 단계를 거절한다", () => {
      const page = parseBookMarkdown(twoSteps).pages[0] as ScreenshotGuidePage;
      const withImageOnly = {
        ...page,
        steps: [{ title: "템플릿 고르기", content: image("s1") }],
      };
      const spec = { ...parseBookMarkdown(twoSteps), pages: [withImageOnly] };

      expect(() => validateBookSpec(spec)).toThrow(
        "pages[0].steps[0] needs a paragraph or list besides the image.",
      );
      expect(() =>
        validateBookSpec({
          ...spec,
          pages: [
            {
              ...withImageOnly,
              steps: [
                {
                  title: "템플릿 고르기",
                  content: `${image("s1")}\n\n고릅니다.`,
                },
              ],
            },
          ],
        }),
      ).not.toThrow();
    });
  });

  it("보관된 원고가 문제 없이 통과한다", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/screenshot-guide.md"),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);

    expect(issues).toEqual([]);
    expect((spec?.pages[0] as ScreenshotGuidePage).steps).toHaveLength(4);
  });
});

describe("보관된 따라하기 원고", () => {
  const inputDir = path.resolve(process.cwd(), "../test-input");
  const guideFiles = fs
    .readdirSync(inputDir)
    .filter((file) => /^guide-.*\.md$/.test(file));
  const invalidFiles = fs
    .readdirSync(path.join(inputDir, "invalid"))
    .filter((file) => /^guide-.*\.md$/.test(file));

  it.each(guideFiles)(
    "%s: 캡처 자리와 카드가 모두 안전 영역 안에 놓이고 자리 수가 원고와 같다",
    (file) => {
      const source = fs.readFileSync(path.join(inputDir, file), "utf8");
      const declared = (source.match(/^::image\{/gm) ?? []).length;

      const pages = layoutOf(source);
      const reported = pages.flatMap((page) => page.pendingImages ?? []);

      expect(reported).toHaveLength(declared);
      for (const page of pages) {
        for (const shape of [
          ...cards(page.elements),
          ...dropTargets(page.elements),
        ]) {
          expect(shape.top).toBeGreaterThanOrEqual(PAGE.safeTop);
          expect(shape.top + shape.height).toBeLessThanOrEqual(PAGE.safeBottom);
        }
      }
    },
  );

  it.each(invalidFiles)("invalid/%s: 오류로 거절된다", (file) => {
    const source = fs.readFileSync(
      path.join(inputDir, "invalid", file),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);

    // 빈 파일이나 깨진 Front Matter도 "거절"이므로, 원고가 실제로 따라하기
    // 페이지를 담고 있고 그 페이지에서 오류가 났는지까지 확인한다.
    expect(source).toContain(':::page{type="screenshot-guide"');
    expect(spec).toBeUndefined();
    expect(
      issues.filter(
        (issue) => issue.severity === "error" && issue.pageId !== undefined,
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe("screenshot-guide 배치", () => {
  it("단계마다 원본 치수의 흰 카드 하나를 놓고 번호를 붙인다", () => {
    const pages = layoutOf(twoSteps);
    // 카드 안쪽 너비의 16:9 캡처는 640px이라 카드 두 장이 한 페이지에 들어가지
    // 않는다. 단계마다 한 페이지가 되고 카드는 잘리지 않는다.
    expect(pages).toHaveLength(2);
    const [first] = cards(pages[0]?.elements ?? []);
    const [second] = cards(pages[1]?.elements ?? []);

    expect(cards(pages[0]?.elements ?? [])).toHaveLength(1);
    expect(cards(pages[1]?.elements ?? [])).toHaveLength(1);
    for (const card of [first, second]) {
      expect(card?.left).toBe(PAGE.marginX);
      expect(card?.width).toBe(CONTENT_WIDTH);
      expect(card?.paths[0]?.stroke).toBeUndefined();
      expect(card?.paths[0]?.d).toContain(`A ${STEP_CARD.radius}`);
      expect((card?.top ?? 0) + (card?.height ?? 0)).toBeLessThanOrEqual(
        PAGE.safeBottom,
      );
    }
    const title1 = findText(
      pages[0]?.elements ?? [],
      "STEP 1. 만들기 버튼 누르기",
    );
    const title2 = findText(pages[1]?.elements ?? [], "STEP 2. 이름 정하기");
    expect(title1.fontSizePt).toBe(TYPOGRAPHY.subsectionTitle);
    expect(title1.fontWeight).toBe("bold");
    expect(title1.left).toBe(PAGE.marginX + STEP_CARD.paddingX);
    expect(title1.top).toBe((first?.top ?? 0) + STEP_CARD.paddingTop);
    expect(title2.top).toBe((second?.top ?? 0) + STEP_CARD.paddingTop);
    expect(
      findText(pages[0]?.elements ?? [], "오른쪽 위 버튼을 누릅니다.")
        .fontSizePt,
    ).toBe(TYPOGRAPHY.body);
    // 첫 카드는 페이지 제목·도입문과 같은 페이지에 있다.
    expect(
      findText(pages[0]?.elements ?? [], "순서대로 따라 합니다.").top,
    ).toBeLessThan(first?.top ?? 0);
    expect(pages[1]?.title).toBe("새 프로젝트 만들기(계속)");
  });

  it("캡처 자리는 카드 안쪽 너비로 카드 안에 놓이고 생성 후 목록에 보고된다", () => {
    const pages = layoutOf(twoSteps);
    const [first] = cards(pages[0]?.elements ?? []);
    const [second] = cards(pages[1]?.elements ?? []);
    const [image1] = dropTargets(pages[0]?.elements ?? []);
    const [image2] = dropTargets(pages[1]?.elements ?? []);

    expect(image1?.width).toBe(CONTENT_WIDTH - STEP_CARD.paddingX * 2);
    expect(image1?.left).toBe(PAGE.marginX + STEP_CARD.paddingX);
    expect(image1?.top).toBeGreaterThan(first?.top ?? 0);
    expect((image1?.top ?? 0) + (image1?.height ?? 0)).toBeLessThan(
      (first?.top ?? 0) + (first?.height ?? 0),
    );
    // 두 번째 단계는 캡처가 지시문보다 위에 있다. 순서가 보존된다.
    const bullet = findText(pages[1]?.elements ?? [], "한글 가능");
    expect(image2?.top).toBeLessThan(bullet.top);
    expect(bullet.top).toBeLessThan((second?.top ?? 0) + (second?.height ?? 0));

    const spec = parseBookMarkdown(twoSteps);
    const report = collectPendingImages(
      layoutBook(spec, planBook(spec).pages, wantedSansFonts),
    );
    expect(report.map((item) => [item.src, item.pageNumber])).toEqual([
      ["assets/g/s1.png", "1"],
      ["assets/g/s2.png", "2"],
    ]);
  });

  it("같은 페이지의 카드 사이 간격 가운데에 아래쪽 화살표를 놓는다", () => {
    const [page] = layoutOf(
      book(
        guide([
          ...step("첫 동작", "설명입니다.", "", smallImage("s1")),
          ...step("둘째 동작", "설명입니다.", "", smallImage("s2")),
        ]),
      ),
    );
    const elements = page?.elements ?? [];
    const [first, second] = cards(elements);
    const [arrow] = arrows(elements);

    expect(cards(elements)).toHaveLength(2);
    expect(arrows(elements)).toHaveLength(1);
    expect(second?.top).toBe(
      (first?.top ?? 0) + (first?.height ?? 0) + STEP_CARD.gap,
    );
    expect(arrow?.left).toBe(
      PAGE.marginX + Math.round((CONTENT_WIDTH - STEP_CARD.arrow.width) / 2),
    );
    expect(arrow?.top).toBeGreaterThan(
      (first?.top ?? 0) + (first?.height ?? 0),
    );
    expect((arrow?.top ?? 0) + (arrow?.height ?? 0)).toBeLessThan(
      second?.top ?? 0,
    );
  });

  it("단계가 많으면 카드를 자르지 않고 다음 페이지로 넘기며 글자 크기는 그대로다", () => {
    const pages = layoutOf(
      book(
        guide(
          Array.from({ length: 6 }, (_, index) =>
            step(
              `${index + 1}번째 동작`,
              "설명입니다.",
              "",
              image(`s${index + 1}`),
            ),
          ).flat(),
        ),
      ),
    );

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1]?.title).toBe("새 프로젝트 만들기(계속)");
    for (const page of pages) {
      for (const card of cards(page.elements)) {
        expect(card.top).toBeGreaterThanOrEqual(PAGE.safeTop);
        expect(card.top + card.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
      for (const target of dropTargets(page.elements)) {
        expect(target.top + target.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
    const titles = pages.flatMap((page) =>
      textElements(page.elements)
        .filter((text) => /^STEP \d+\./.test(text.text))
        .map((text) => [text.text, text.fontSizePt] as const),
    );
    expect(titles.map(([text]) => text)).toEqual(
      Array.from(
        { length: 6 },
        (_, index) => `STEP ${index + 1}. ${index + 1}번째 동작`,
      ),
    );
    expect(titles.map(([, size]) => size)).toEqual(
      titles.map(() => TYPOGRAPHY.subsectionTitle),
    );
    // 넘어간 단계 위에도 화살표가 있어 앞 단계에서 이어짐을 보인다.
    expect(arrows(pages[1]?.elements ?? []).length).toBeGreaterThan(0);
    expect(pages.flatMap((page) => page.pendingImages ?? [])).toHaveLength(6);
  });

  it("세로로 긴 캡처는 비율을 지킨 채 줄어 제목·도입문과 같은 페이지에 들어간다", () => {
    const pages = layoutOf(
      book(
        guide([
          ...step(
            "긴 화면",
            "설명입니다.",
            "",
            image("tall").replace('ratio="16:9"', 'ratio="9:16"'),
          ),
        ]),
      ),
    );
    const [page] = pages;
    const [card] = cards(page?.elements ?? []);
    const [target] = dropTargets(page?.elements ?? []);

    expect(pages).toHaveLength(1);
    expect(card?.top).toBeGreaterThanOrEqual(PAGE.safeTop);
    expect((card?.top ?? 0) + (card?.height ?? 0)).toBeLessThanOrEqual(
      PAGE.safeBottom,
    );
    expect(
      Math.round(((target?.width ?? 0) / (target?.height ?? 1)) * 100),
    ).toBe(Math.round((9 / 16) * 100));
    expect(page?.pendingImages?.[0]?.scaledToFit).toBe(true);
  });

  it("글이 너무 길어 캡처와 함께 한 카드에 들어가지 않으면 원고 오류로 멈춘다", () => {
    const long = Array.from(
      { length: 30 },
      (_, index) =>
        `${index + 1}번째 문장입니다. 생성형 AI는 사용자의 요청에 따라 새로운 결과물을 만드는 인공지능입니다.`,
    ).join(" ");

    expect(() =>
      layoutOf(book(guide([...step("긴 지시문", long, "", image("s1"))]))),
    ).toThrow("지시문을 줄이거나 단계를 나눠 주세요");
  });
});
