import type { ElementAtPoint } from "@canva/design";
import { layoutPage } from "../src/builder/create-page";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import type { ChapterOpeningPage, ConceptPage } from "../src/types/book-spec";
import {
  CANVA_PX_PER_PT,
  FontSizeReducedError,
  guardFontSize,
  toEditorPoints,
  TYPOGRAPHY,
} from "../src/theme/typography";
import {
  fallbackFonts,
  findText,
  findTexts,
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

/**
 * 이 파일은 상수가 아니라 **Canva SDK에 실제로 전달된 값**을 검사한다.
 *
 * SDK `fontSize`는 디자인 px이고 Canva 편집기는 그것을 96/72로 나눈 pt로
 * 보여 준다(원본 PNG 측정 근거는 `theme/typography.ts` 참고). 그래서
 * `fontSizePt`(편집기 표시값)를 검사하고, 변환 계수 자체는 별도 테스트로 고정한다.
 */

const chapterPage: ChapterOpeningPage = {
  type: "chapter-opening",
  id: "chapter-01",
  chapterNumber: 1,
  chapterTitle: "AI 디지털 리터러시",
  chapterSubtitle: "AI와 함께하는 디지털 시대",
  learningObjectives: [
    "생성형 AI의 작동 방식을 설명할 수 있다.",
    "일상과 학습 속 AI 활용 사례를 찾을 수 있다.",
    "AI가 제공한 정보의 신뢰성을 검토할 수 있다.",
    "목적에 맞게 프롬프트를 구체화할 수 있다.",
  ],
  subsectionTitle: "생성형 AI란 무엇일까?",
  body: "생성형 AI는 사용자의 요청을 받아 새로운 결과물을 만들어내는 인공지능입니다.",
};

const firstPage = (
  page: Parameters<typeof layoutPage>[0],
  fonts = wantedSansFonts,
): ElementAtPoint[] => layoutPage(page, fonts)[0]?.elements ?? [];

beforeEach(() => {
  installRecordingRichtext();
});

describe("고정 활자 크기", () => {
  it("챕터 메인 제목을 정확히 50pt로 만든다", () => {
    const elements = firstPage(chapterPage);

    expect(findText(elements, "AI 디지털 리터러시").fontSizePt).toBe(50);
    expect(TYPOGRAPHY.chapterTitle).toBe(50);
  });

  it("챕터 부제목을 정확히 30pt로 만든다", () => {
    const elements = firstPage(chapterPage);

    expect(findText(elements, "AI와 함께하는 디지털 시대").fontSizePt).toBe(30);
  });

  it("'학습 목표' 섹션 제목을 정확히 30pt로 만든다", () => {
    const elements = firstPage(chapterPage);

    expect(findText(elements, "학습 목표").fontSizePt).toBe(30);
  });

  it("모든 섹션 제목을 30pt로 만든다", () => {
    const elements = firstPage(chapterPage);

    expect(findText(elements, "생성형 AI란 무엇일까?").fontSizePt).toBe(30);
  });

  it("학습 목표 안내문과 목록 항목을 28pt로 만든다", () => {
    const elements = firstPage(chapterPage);

    expect(
      findText(elements, "이 장을 학습한 후, 여러분은 다음을 할 수 있습니다.")
        .fontSizePt,
    ).toBe(28);
    for (const objective of chapterPage.learningObjectives) {
      expect(findText(elements, objective).fontSizePt).toBe(28);
    }
  });

  it("일반 본문을 28pt로 만든다", () => {
    const elements = firstPage(chapterPage);

    expect(findText(elements, chapterPage.body).fontSizePt).toBe(28);
  });

  it("목록 항목과 그 기호를 같은 28pt로 만든다", () => {
    const page: ConceptPage = {
      type: "concept",
      id: "concept-1",
      layout: "basic",
      title: "생성형 AI는 어떻게 답을 만들까?",
      sections: [
        {
          title: "1단계 · 입력 이해하기",
          content:
            "다음을 확인합니다.\n\n- 질문의 핵심 주제를 파악합니다\n- 요청의 형식을 확인합니다",
        },
      ],
    };

    const elements = firstPage(page);

    expect(findText(elements, "질문의 핵심 주제를 파악합니다").fontSizePt).toBe(
      28,
    );
    // 기호도 같은 크기여야 본문 줄과 나란히 선다.
    for (const marker of findTexts(elements, (text) => text === "•")) {
      expect(marker.fontSizePt).toBe(28);
    }
  });

  it("굵은 강조 구절도 28pt를 유지한다", () => {
    const page: ConceptPage = {
      type: "concept",
      id: "concept-2",
      layout: "basic",
      title: "핵심 정의",
      sections: [
        {
          title: "정의",
          content:
            "생성형 AI는 **학습한 내용을 바탕으로 새 문장을 만드는** 인공지능입니다.",
        },
      ],
    };

    const elements = firstPage(page);
    const paragraph = textElements(elements).find((element) =>
      element.text.includes("인공지능입니다"),
    );

    expect(paragraph?.fontSizePt).toBe(28);
    // 강조는 굵기와 색만 바꾼다. InlineFormatting에는 fontSize가 없으므로
    // 크기를 되돌릴 방법 자체가 없다.
    expect(paragraph?.inline).toHaveLength(1);
    expect(paragraph?.inline[0]?.formatting).toEqual({
      fontWeight: "bold",
      color: "#1800AD",
    });
    expect(Object.keys(paragraph?.inline[0]?.formatting ?? {})).not.toContain(
      "fontSize",
    );
    // 원고의 ** 기호가 독자에게 보이면 안 된다.
    expect(paragraph?.text).not.toContain("*");
  });

  it("대체 글꼴로 내려가도 글자 크기가 그대로다", () => {
    const withWantedSans = textElements(
      firstPage(chapterPage, wantedSansFonts),
    );
    const withFallback = textElements(firstPage(chapterPage, fallbackFonts));

    expect(withFallback.map((element) => element.fontSizePt)).toEqual(
      withWantedSans.map((element) => element.fontSizePt),
    );
    // 대체 경로에서는 fontRef를 지정하지 않는다. 크기는 그대로다.
    expect(withFallback.every((element) => element.fontRef === undefined)).toBe(
      true,
    );
    expect(
      findText(firstPage(chapterPage, fallbackFonts), "AI 디지털 리터러시")
        .fontSizePt,
    ).toBe(50);
  });

  it("어떤 페이지 유형에서도 본문이 28pt 아래로 내려가지 않는다", () => {
    const elements = firstPage(chapterPage);

    for (const element of textElements(elements)) {
      if (element.fontSizePt === TYPOGRAPHY.pageNumber) {
        continue;
      }
      expect(element.fontSizePt).toBeGreaterThanOrEqual(28);
    }
  });

  it("쪽번호가 본문보다 작되 지나치게 작지는 않다", () => {
    expect(TYPOGRAPHY.pageNumber).toBeLessThan(TYPOGRAPHY.body);
    expect(TYPOGRAPHY.pageNumber / TYPOGRAPHY.body).toBeGreaterThan(0.75);
  });
});

describe("Markdown 원고에서 끝까지", () => {
  it("원고의 **강조**가 파란색 굵은 구절로만 반영된다", () => {
    const spec = parseBookMarkdown(
      [
        "---",
        "schema_version: 1",
        "title: 강조 시험",
        "---",
        "",
        ':::page{type="concept" id="c1" layout="basic"}',
        "# 생성형 AI란 무엇일까?",
        "",
        "## 핵심 정의",
        "",
        "생성형 AI는 **새로운 결과물을 만들어내는** 인공지능입니다.",
        "",
        "예를 들어,",
        "",
        "- 챗GPT에게 질문하기",
        "- 번역기 사용하기",
        ":::",
      ].join("\n"),
    );
    const laid = layoutBook(spec, planBook(spec).pages, wantedSansFonts);
    const elements = laid[0]?.elements ?? [];

    const sentence = findText(
      elements,
      "생성형 AI는 새로운 결과물을 만들어내는 인공지능입니다.",
    );
    expect(sentence.fontSizePt).toBe(28);
    // 문장 전체가 아니라 ** ** 안의 구절만 강조된다.
    expect(sentence.inline).toEqual([
      {
        index: "생성형 AI는 ".length,
        length: "새로운 결과물을 만들어내는".length,
        formatting: { fontWeight: "bold", color: "#1800AD" },
      },
    ]);
    // 강조되지 않은 나머지는 검정 그대로다.
    expect(sentence.color).toBe("#000000");
    expect(sentence.fontWeight).toBe("normal");

    // 도입 문장과 목록이 따로 남는다.
    expect(findText(elements, "예를 들어,").fontSizePt).toBe(28);
    expect(findText(elements, "챗GPT에게 질문하기").fontSizePt).toBe(28);
  });
});

describe("축소 금지 장치", () => {
  it("본문을 28pt 아래로 만들려고 하면 즉시 막는다", () => {
    expect(() => guardFontSize("body", 24)).toThrow(FontSizeReducedError);
    expect(() => guardFontSize("body", 24)).toThrow(
      "글자를 줄이지 말고 페이지를 나눠야",
    );
  });

  it("제목 계열의 하한도 막는다", () => {
    expect(() => guardFontSize("chapterTitle", 44)).toThrow(
      FontSizeReducedError,
    );
    expect(() => guardFontSize("sectionTitle", 28)).toThrow(
      FontSizeReducedError,
    );
    expect(() => guardFontSize("chapterTitle", 50)).not.toThrow();
    expect(() => guardFontSize("sectionTitle", 30)).not.toThrow();
    // 쪽번호는 보조 활자라 이 규칙에서 제외된다.
    expect(() => guardFontSize("pageNumber", 22)).not.toThrow();
  });
});

describe("편집기 pt ↔ SDK px 변환", () => {
  it("툴바에 50pt가 찍히도록 SDK에는 66.67px를 보낸다", () => {
    const elements = firstPage(chapterPage);
    const title = findText(elements, "AI 디지털 리터러시");

    // 원본 1587×2245 PNG 측정: 28pt·줄 간격 2 본문의 줄 간격 74px → em 37px,
    // 37/28 = 1.32 ≈ 96/72. 이 계수는 여기 한 곳에서만 곱한다.
    expect(CANVA_PX_PER_PT).toBeCloseTo(4 / 3, 10);
    expect(title.fontSize).toBeCloseTo(50 * (4 / 3), 10);
    expect(toEditorPoints(title.fontSize ?? 0)).toBeCloseTo(50, 10);
    expect(findText(elements, chapterPage.body).fontSize).toBeCloseTo(
      28 * (4 / 3),
      10,
    );
  });

  it("스킬 확정값대로 줄 간격 2, 자간 0을 보낸다", () => {
    const elements = firstPage(chapterPage);
    const body = findText(elements, chapterPage.body);

    expect(body.lineHeightEm).toBe(2);
    expect(body.paragraph[0]?.letterSpacingEm).toBe(0);
    expect(findText(elements, "학습 목표").lineHeightEm).toBe(2);
  });
});
