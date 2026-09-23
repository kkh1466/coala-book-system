import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import {
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";
import { coalaTheme } from "../src/theme/coala-theme";
import { CONTENT_WIDTH, PAGE, STEP_CARD } from "../src/theme/page-layout";
import { TYPOGRAPHY } from "../src/theme/typography";
import type { StepProcessPage } from "../src/types/book-spec";
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

const step = (title: string, ...body: string[]): string[] => [
  `## ${title}`,
  "",
  ...body,
  "",
];

const processPage = (body: string[], id = "p1"): string[] => [
  `:::page{type="step-process" id="${id}"}`,
  "# BMI 앱 설계 예시",
  "",
  "지금까지 학습한 내용으로 설계해 봅시다.",
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

const threeSteps = book(
  processPage([
    ...step(
      "입력 데이터 정하기",
      "사용자는 어떤 정보를 입력해야 할까요?",
      "",
      "입력 데이터",
      "",
      "- 키(cm)",
      "- 몸무게(kg)",
      "- 성별",
    ),
    ...step("버튼 정하기", "필요한 버튼은 무엇일까요?", "", "- BMI 계산하기"),
    ...step("결과 정하기", "앱은 어떤 결과를 보여줄까요?", "", "- BMI 수치"),
  ]),
);

describe("step-process 원고 읽기", () => {
  it("## 하나가 단계 하나이고 문단과 목록을 순서대로 남긴다", () => {
    const page = parseBookMarkdown(threeSteps).pages[0] as StepProcessPage;

    expect(page.type).toBe("step-process");
    expect(page.introduction).toBe("지금까지 학습한 내용으로 설계해 봅시다.");
    expect(page.steps.map((item) => item.title)).toEqual([
      "입력 데이터 정하기",
      "버튼 정하기",
      "결과 정하기",
    ]);
    expect(page.steps[0]?.content).toBe(
      "사용자는 어떤 정보를 입력해야 할까요?\n\n입력 데이터\n\n- 키(cm)\n- 몸무게(kg)\n- 성별",
    );
  });

  it("내용 없는 단계를 그 단계의 행 번호로 거절한다", () => {
    const errors = errorsOf(
      book(
        processPage([
          ...step("첫 단계", "내용"),
          ...step("빈 단계"),
          ...step("셋째", "내용"),
        ]),
      ),
    );

    expect(errors).toEqual([
      "15: 단계 '빈 단계'에 내용이 없습니다. 이 단계에서 할 일이나 설명을 문장 또는 목록으로 작성해 주세요.",
    ]);
  });

  it("이미지 자리, 직접 적은 STEP 번호, 강조 박스를 거절한다", () => {
    expect(
      errorsOf(
        book(
          processPage([
            ...step(
              "첫 단계",
              "내용",
              "",
              '::image{src="assets/a.png" alt="화면" ratio="16:9"}',
            ),
          ]),
        ),
      ),
    ).toEqual([expect.stringContaining("screenshot-guide 페이지를 쓰세요")]);

    expect(
      errorsOf(book(processPage([...step("STEP 1. 첫 단계", "내용")]))),
    ).toEqual([expect.stringContaining("단계 번호(STEP 1.)는 앱이")]);

    expect(
      errorsOf(
        book(processPage([...step("첫 단계", "내용", "", "> [!TIP]", "> 팁")])),
      ),
    ).toEqual([expect.stringContaining("step-process 페이지에는 강조 박스")]);
  });

  it("BookSpec 검증도 같은 판별로 이미지와 빈 내용을 거절한다", () => {
    const spec = parseBookMarkdown(threeSteps);
    const page = spec.pages[0] as StepProcessPage;
    const withImage = {
      ...spec,
      pages: [
        {
          ...page,
          steps: [
            {
              title: "x",
              content: '::image{src="assets/a.png" alt="a" ratio="16:9"}',
            },
          ],
        },
      ],
    };

    expect(() => validateBookSpec(spec)).not.toThrow();
    expect(() => validateBookSpec(withImage)).toThrow(
      "must not contain an image",
    );
  });
});

describe("step-process 배치", () => {
  it("단계마다 흰 카드에 번호 붙은 제목·문단·목록을 놓고 카드 사이에 화살표를 둔다", () => {
    const [page] = layoutOf(threeSteps);
    const elements = page?.elements ?? [];
    const [first, second, third] = cards(elements);

    expect(cards(elements)).toHaveLength(3);
    expect(arrows(elements)).toHaveLength(2);
    for (const card of [first, second, third]) {
      expect(card?.left).toBe(PAGE.marginX);
      expect(card?.width).toBe(CONTENT_WIDTH);
      expect(card?.paths[0]?.d).toContain(`A ${STEP_CARD.radius}`);
    }
    const title1 = findText(elements, "STEP 1. 입력 데이터 정하기");
    expect(title1.fontSizePt).toBe(TYPOGRAPHY.subsectionTitle);
    expect(title1.fontWeight).toBe("bold");
    expect(title1.top).toBe((first?.top ?? 0) + STEP_CARD.paddingTop);
    expect(findText(elements, "STEP 3. 결과 정하기").top).toBe(
      (third?.top ?? 0) + STEP_CARD.paddingTop,
    );
    const question = findText(
      elements,
      "사용자는 어떤 정보를 입력해야 할까요?",
    );
    const bullet = findText(elements, "몸무게(kg)");
    expect(question.fontSizePt).toBe(TYPOGRAPHY.body);
    expect(bullet.top).toBeGreaterThan(question.top);
    expect(bullet.top).toBeLessThan((first?.top ?? 0) + (first?.height ?? 0));
    expect(second?.top).toBe(
      (first?.top ?? 0) + (first?.height ?? 0) + STEP_CARD.gap,
    );
    expect(page?.pendingImages).toBeUndefined();
  });

  it("단계가 많으면 카드를 자르지 않고 다음 페이지로 넘기며 번호와 화살표가 이어진다", () => {
    const pages = layoutOf(
      book(
        processPage(
          Array.from({ length: 9 }, (_, index) =>
            step(
              `${index + 1}번째 할 일`,
              "설명 문장입니다.",
              "",
              "- 항목 하나",
              "- 항목 둘",
            ),
          ).flat(),
        ),
      ),
    );

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1]?.title).toBe("BMI 앱 설계 예시(계속)");
    for (const page of pages) {
      for (const card of cards(page.elements)) {
        expect(card.top).toBeGreaterThanOrEqual(PAGE.safeTop);
        expect(card.top + card.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
    const titles = pages.flatMap((page) =>
      textElements(page.elements)
        .map((text) => text.text)
        .filter((text) => /^STEP \d+\./.test(text)),
    );
    expect(titles).toEqual(
      Array.from(
        { length: 9 },
        (_, index) => `STEP ${index + 1}. ${index + 1}번째 할 일`,
      ),
    );
    expect(arrows(pages[1]?.elements ?? []).length).toBeGreaterThan(0);
  });

  it("글이 너무 길어 한 카드에 들어가지 않으면 원고 오류로 멈춘다", () => {
    const long = Array.from(
      { length: 40 },
      (_, index) =>
        `${index + 1}번째 문장입니다. 생성형 AI는 사용자의 요청에 따라 새로운 결과물을 만드는 인공지능입니다.`,
    ).join(" ");

    expect(() =>
      layoutOf(book(processPage([...step("긴 단계", long)]))),
    ).toThrow("지시문을 줄이거나 단계를 나눠 주세요");
  });
});

describe("보관된 단계별 진행 원고", () => {
  it("step-process.md가 통과하고 카드가 모두 안전 영역 안에 놓인다", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/step-process.md"),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);
    const pages = layoutOf(source);

    expect(issues).toEqual([]);
    expect(spec?.pages.map((page) => page.type)).toEqual([
      "step-process",
      "step-process",
    ]);
    for (const page of pages) {
      for (const card of cards(page.elements)) {
        expect(card.top + card.height).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
  });

  it.each(
    fs
      .readdirSync(path.resolve(process.cwd(), "../test-input/invalid"))
      .filter((file) => file.startsWith("process-")),
  )("invalid/%s: 오류로 거절된다", (file) => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/invalid", file),
      "utf8",
    );

    const { spec, issues } = checkBookMarkdown(source);

    expect(source).toContain(':::page{type="step-process"');
    expect(spec).toBeUndefined();
    expect(
      issues.filter((issue) => issue.severity === "error" && issue.pageId),
    ).toHaveLength(1);
  });
});
