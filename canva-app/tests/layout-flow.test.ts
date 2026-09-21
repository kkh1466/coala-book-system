import type { ElementAtPoint } from "@canva/design";
import { layoutPage } from "../src/builder/create-page";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import { parseBlocks } from "../src/parser/blocks";
import { PAGE } from "../src/theme/page-layout";
import { LINE_HEIGHT, toCanvaFontSize } from "../src/theme/typography";
import type { ChapterOpeningPage, ConceptPage } from "../src/types/book-spec";
import {
  findText,
  findTexts,
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

const baseChapter = (
  objectives: string[],
  body = "생성형 AI는 요청을 받아 새 결과물을 만들어내는 인공지능입니다.",
): ChapterOpeningPage => ({
  type: "chapter-opening",
  id: "chapter-01",
  chapterNumber: 1,
  chapterTitle: "AI 디지털 리터러시",
  chapterSubtitle: "AI와 함께하는 디지털 시대",
  learningObjectives: objectives,
  subsectionTitle: "생성형 AI란 무엇일까?",
  body,
});

const parts = (page: Parameters<typeof layoutPage>[0]) =>
  layoutPage(page, wantedSansFonts);

/** 텍스트 요소가 안전 영역 안에서 시작하는가. */
const withinSafeArea = (elements: readonly ElementAtPoint[]): boolean =>
  elements.every(
    (element) =>
      element.type !== "richtext" ||
      (element.top >= 0 && element.top <= PAGE.safeBottom),
  );

beforeEach(() => {
  installRecordingRichtext();
});

describe("학습 목표 영역", () => {
  it("목표 수에 따라 다음 섹션 위치가 달라진다", () => {
    const short = parts(baseChapter(["첫 번째 목표입니다."]))[0]?.elements ?? [];
    const long =
      parts(
        baseChapter([
          "첫 번째 목표입니다.",
          "두 번째 목표입니다.",
          "세 번째 목표입니다.",
          "네 번째 목표입니다.",
          "다섯 번째 목표입니다.",
        ]),
      )[0]?.elements ?? [];

    const shortHeading = findText(short, "생성형 AI란 무엇일까?").top;
    const longHeading = findText(long, "생성형 AI란 무엇일까?").top;

    // 고정 좌표였다면 두 값이 같았을 것이다.
    expect(longHeading).toBeGreaterThan(shortHeading);
  });

  it("학습 목표가 끝난 자리에 큰 빈 공간을 남기지 않는다", () => {
    const elements =
      parts(
        baseChapter([
          "생성형 AI의 작동 방식을 설명할 수 있다.",
          "일상과 학습 속 AI 활용 사례를 찾을 수 있다.",
          "AI가 제공한 정보의 신뢰성을 검토할 수 있다.",
          "목적에 맞게 프롬프트를 구체화할 수 있다.",
        ]),
      )[0]?.elements ?? [];

    const lastObjective = findText(
      elements,
      "목적에 맞게 프롬프트를 구체화할 수 있다.",
    );
    const nextHeading = findText(elements, "생성형 AI란 무엇일까?");
    const gap = nextHeading.top - lastObjective.top;

    // 이전 구현은 목표 목록을 555에 두고 소제목을 1125에 고정해 570px을
    // 비워 뒀다. 원본 PNG는 마지막 항목 잉크 944 → 다음 제목 잉크 1128,
    // 즉 184px이다. 한 줄 높이(75) + 섹션 여백(110) 수준이어야 한다.
    expect(gap).toBeLessThan(200);
    expect(gap).toBeGreaterThan(150);
  });

  it("원고의 학습 목표를 하나도 빠뜨리지 않고 항목마다 따로 그린다", () => {
    const objectives = [
      "첫 번째 목표입니다.",
      "두 번째 목표입니다.",
      "세 번째 목표입니다.",
    ];
    const elements = parts(baseChapter(objectives))[0]?.elements ?? [];

    for (const objective of objectives) {
      expect(findText(elements, objective)).toBeDefined();
    }
    // 목록 기호와 본문 사이 간격은 모든 항목에서 같다.
    const markers = findTexts(elements, (text) => text === "•");
    expect(markers.length).toBeGreaterThanOrEqual(objectives.length);
    const indents = new Set(markers.map((marker) => marker.left));
    expect(indents.size).toBe(1);
  });
});

describe("Markdown 구조 보존", () => {
  it("도입 문장과 목록을 한 덩어리로 합치지 않는다", () => {
    const blocks = parseBlocks(
      [
        "여러분은 이미 다양한 AI 서비스를 사용하고 있을지도 모릅니다.",
        "",
        "예를 들어,",
        "",
        "- 챗GPT에게 질문하기",
        "- 유튜브 알고리즘 추천 영상 보기",
        "- 번역기 사용하기",
      ].join("\n"),
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.kind).toBe("paragraph");
    expect(blocks[1]?.kind).toBe("paragraph");
    expect(blocks[2]).toMatchObject({
      kind: "list",
      ordered: false,
      items: [
        [{ text: "챗GPT에게 질문하기", emphasis: false }],
        [{ text: "유튜브 알고리즘 추천 영상 보기", emphasis: false }],
        [{ text: "번역기 사용하기", emphasis: false }],
      ],
    });
  });

  it("문단과 목록 항목이 각각 별개의 Canva 요소가 된다", () => {
    const page: ConceptPage = {
      type: "concept",
      id: "concept-1",
      layout: "basic",
      title: "AI 서비스 둘러보기",
      sections: [
        {
          title: "이미 쓰고 있는 AI",
          content: [
            "여러분은 이미 다양한 AI 서비스를 사용하고 있을지도 모릅니다.",
            "",
            "예를 들어,",
            "",
            "- 챗GPT에게 질문하기",
            "- 유튜브 알고리즘 추천 영상 보기",
            "- 번역기 사용하기",
          ].join("\n"),
        },
      ],
    };

    const elements = parts(page)[0]?.elements ?? [];

    expect(findText(elements, "예를 들어,")).toBeDefined();
    expect(findText(elements, "챗GPT에게 질문하기")).toBeDefined();
    expect(findText(elements, "번역기 사용하기")).toBeDefined();
    // 줄글 한 덩어리로 합쳐진 요소가 없어야 한다.
    expect(
      textElements(elements).some(
        (element) =>
          element.text.includes("예를 들어") &&
          element.text.includes("번역기 사용하기"),
      ),
    ).toBe(false);
  });
});

describe("페이지 분할", () => {
  const longBody = Array.from(
    { length: 40 },
    (_, index) =>
      `이것은 ${index + 1}번째 설명 문장입니다. 생성형 AI는 학습한 내용을 바탕으로 문장을 새로 구성하므로 같은 질문에도 표현이 달라질 수 있습니다.`,
  ).join(" ");

  it("내용이 많으면 글자를 줄이지 않고 새 페이지를 만든다", () => {
    const laid = parts(baseChapter(["목표 하나입니다."], longBody));

    expect(laid.length).toBeGreaterThan(1);
    for (const part of laid) {
      for (const element of textElements(part.elements)) {
        expect(element.fontSizePt).toBeGreaterThanOrEqual(28);
      }
    }
  });

  it("연속 페이지 제목에 (계속)이 붙고 본문 크기는 그대로다", () => {
    const laid = parts(baseChapter(["목표 하나입니다."], longBody));
    const continuation = laid[1];

    expect(continuation?.title).toContain("(계속)");
    const heading = findText(
      continuation?.elements ?? [],
      "생성형 AI란 무엇일까?(계속)",
    );
    expect(heading.fontSizePt).toBe(30);
    expect(heading.top).toBe(PAGE.safeTop);
  });

  it("긴 문단과 목록이 페이지 하단을 침범하지 않는다", () => {
    const laid = parts(baseChapter(["목표 하나입니다."], longBody));

    for (const part of laid) {
      expect(withinSafeArea(part.elements)).toBe(true);
      for (const element of textElements(part.elements)) {
        // 쪽번호는 아직 붙지 않았으므로 모든 요소가 안전 영역 안이어야 한다.
        expect(element.top).toBeLessThanOrEqual(PAGE.safeBottom);
      }
    }
  });

  it("섹션 제목만 페이지 하단에 홀로 남기지 않는다", () => {
    const laid = parts(baseChapter(["목표 하나입니다."], longBody));
    const headingLine = Math.ceil(toCanvaFontSize(30) * LINE_HEIGHT.global);
    const twoBodyLines = Math.ceil(toCanvaFontSize(28) * LINE_HEIGHT.global) * 2;

    for (const part of laid) {
      for (const heading of findTexts(part.elements, (text) =>
        text.startsWith("생성형 AI란 무엇일까?"),
      )) {
        // 제목 아래에 본문 두 줄이 들어갈 자리가 남아 있어야 한다.
        expect(heading.top + headingLine + twoBodyLines).toBeLessThanOrEqual(
          PAGE.safeBottom,
        );
        // 그리고 실제로 그 자리에 본문이 있어야 한다.
        expect(
          textElements(part.elements).some(
            (element) => element.top > heading.top,
          ),
        ).toBe(true);
      }
    }
  });
});

describe("책 전체 배치", () => {
  it("분할된 뒤에 쪽번호를 매긴다", () => {
    const spec = parseBookMarkdown(
      [
        "---",
        "schema_version: 1",
        "title: 분할 시험",
        "---",
        "",
        ':::page{type="chapter-opening" id="c1" chapter="1"}',
        "# AI 디지털 리터러시",
        "## AI와 함께하는 디지털 시대",
        "",
        "### 학습 목표",
        "",
        "- 목표 하나입니다.",
        "",
        "### 생성형 AI란 무엇일까?",
        "",
        Array.from(
          { length: 40 },
          (_, index) =>
            `${index + 1}번째 문장입니다. 생성형 AI는 학습한 내용을 바탕으로 문장을 새로 구성합니다.`,
        ).join(" "),
        ":::",
      ].join("\n"),
    );
    const plan = planBook(spec);

    const laid = layoutBook(spec, plan.pages, wantedSansFonts);

    expect(laid.length).toBeGreaterThan(1);
    // 한 원고 페이지가 여러 장이 되어도 번호가 이어진다.
    expect(laid.map((page) => page.pageNumber)).toEqual(
      laid.map((_, index) => String(index + 1)),
    );
    expect(laid[1]?.title).toContain("(계속)");
  });
});
