/**
 * 교재 활자의 **유일한** 출처.
 *
 * 여기 적힌 크기는 권장값이 아니라 고정 규칙이다. 페이지 유형도, 분량도,
 * 대체 글꼴 여부도 이 값을 바꾸지 못한다. 내용이 넘치면 글자를 줄이는 대신
 * 페이지를 나눈다(`src/layout/flow.ts`).
 *
 * 단위는 **Canva 편집기 툴바에 보이는 pt**다. 아래 `toCanvaFontSize()`가
 * SDK에 넘길 px로 바꾼다. 그 근거는 그 함수 주석에 있다.
 */
export const TYPOGRAPHY = {
  /** 챕터 메인 제목 (예: "AI 디지털 리터러시") */
  chapterTitle: 50,
  /** 챕터 부제목 (예: "AI와 함께하는 디지털 시대") */
  chapterSubtitle: 30,
  /** 섹션 제목 (예: "학습 목표", "생성형 AI란 무엇일까?") */
  sectionTitle: 30,
  /** 섹션 안의 소제목. 섹션 제목과 같은 크기를 쓴다. */
  subsectionTitle: 30,
  /** 일반 본문 */
  body: 28,
  /** 일반 목록과 예시 목록 */
  bullet: 28,
  /** 학습 목표 안내문과 목록 */
  learningObjective: 28,
  /** 강조 문장. 크기는 본문과 같고 굵기와 색만 달라진다. */
  emphasis: 28,
  /** 표의 머리글과 칸 */
  tableCell: 28,
  /** Tip / 핵심 정리 박스의 제목 */
  calloutTitle: 30,
  /** Tip / 핵심 정리 박스의 본문 */
  calloutBody: 28,
  /** 실습 배지("실습 001-1" 등) */
  badge: 28,
  /** 장 번호 원 안의 숫자 */
  chapterMarker: 30,
  /**
   * 페이지 번호(쪽번호).
   *
   * 기존 규칙(본문보다 작은 보조 활자)은 그대로 두되, 1587px 폭 지면에서
   * 18은 본문의 0.64배로 지나치게 작아 읽기 어려웠다. 본문 대비 0.79배인
   * 22로 올린다. 본문·제목 규칙과 달리 이 값만 조정 대상이다.
   */
  pageNumber: 22,
} as const;

export type TypographyRole = keyof typeof TYPOGRAPHY;

/**
 * Canva 편집기 pt 1 = 디자인 px 4/3.
 *
 * `@canva/design` 2.13.0의 `RichtextFormatting.fontSize` 주석은 "in pixels …
 * shown as points"라고만 적혀 있어 1:1처럼 읽히지만, 실제 결과는 다르다.
 * 스킬(`references/style-guide.md`)이 지시한 방법대로 1587×2245 원본 PNG
 * export(`assets/page-examples/`)를 직접 재면:
 *
 * - 툴바 28pt·줄 간격 2인 본문의 줄 간격(pitch)이 74px이다
 *   (chapter-opening.png 학습 목표 574→648→722…, practice-opening1.png
 *   본문 496→571→644…). 줄 간격 2 = em × 2이므로 em = 37px.
 * - 같은 글줄의 한글 잉크 높이가 33px로, em이 28px이면 불가능한 값이다.
 *
 * 37 / 28 = 1.32 ≈ 96 / 72 = 1.333. 즉 Canva는 96dpi 디자인 px를 72dpi pt로
 * 나눠 보여 준다. 그래서 `fontSize: 28`을 그대로 넘기면 툴바에는 21pt가
 * 찍힌다 — 그것이 "지정보다 훨씬 작게 나온다"의 실제 원인이었다.
 *
 * 이 계수는 추정이 아니라 측정값이며, 표준 pt/px 관계와 일치한다. 어디에도
 * 이 함수 밖에서 배율을 곱하지 않는다.
 */
export const CANVA_PX_PER_PT = 96 / 72;

/** 편집기 pt → SDK `fontSize`(px). 반올림하지 않아 툴바에 정확히 pt가 찍힌다. */
export function toCanvaFontSize(pt: number): number {
  return pt * CANVA_PX_PER_PT;
}

/** SDK `fontSize`(px) → 편집기 pt. 검증과 보고에 쓴다. */
export function toEditorPoints(px: number): number {
  return px / CANVA_PX_PER_PT;
}

/**
 * 줄 간격(em).
 *
 * 스킬이 확정한 전역값은 **2**(자간 0)다. 원본 PNG에서 잰 본문 줄 간격
 * 74px = 37.3px em × 2로 확인된다. `RichtextFormatting.lineHeightEm`
 * (허용 0.5~2.5)에 그대로 넘긴다.
 *
 * 예외는 챕터 제목 영역뿐이다. 원본에서 테두리 높이가 170px인데 50pt·30pt
 * 두 줄을 2배 간격으로 놓으면 213px이 되어 들어가지 않는다. 원본 제목 영역은
 * 더 촘촘한 간격을 쓰고 있으므로 그 값만 따로 둔다.
 */
export const LINE_HEIGHT = {
  /** 전역 확정값. 본문, 목록, 제목, 표, 강조 박스 모두 이 값이다. */
  global: 2,
  /** 챕터 메인 제목(테두리 안). */
  chapterTitle: 1.2,
  /** 챕터 부제목(테두리 안). */
  chapterSubtitle: 1.3,
  /** 배지·장 번호·쪽번호처럼 도형 안에 한 줄로 놓는 글. 세로 중앙 계산용. */
  single: 1.4,
} as const;

/** 전역 자간. 스킬 확정값 0. */
export const LETTER_SPACING_EM = 0;

/**
 * 글자 크기의 하한.
 *
 * 레이아웃이 어떤 이유로든 이 아래로 내려가면 버그다. `guardFontSize()`가
 * 즉시 막는다. "공간이 부족해서 줄였다"는 경로를 코드에 남기지 않기 위한
 * 장치다.
 */
export const MINIMUM_FONT_SIZE = {
  chapterTitle: TYPOGRAPHY.chapterTitle,
  sectionTitle: TYPOGRAPHY.sectionTitle,
  body: TYPOGRAPHY.body,
} as const;

export class FontSizeReducedError extends Error {
  constructor(role: string, requested: number, minimum: number) {
    super(
      `'${role}'의 글자 크기를 ${minimum}보다 작은 ${requested}(으)로 만들려 했습니다. ` +
        "내용이 넘칠 때는 글자를 줄이지 말고 페이지를 나눠야 합니다.",
    );
    this.name = "FontSizeReducedError";
  }
}

/** 본문·제목 계열 크기가 하한 아래로 내려가지 않았는지 확인한다. */
export function guardFontSize(role: string, fontSize: number): number {
  const minimum =
    role === "chapterTitle"
      ? MINIMUM_FONT_SIZE.chapterTitle
      : role === "sectionTitle" ||
          role === "subsectionTitle" ||
          role === "calloutTitle" ||
          role === "chapterSubtitle" ||
          role === "chapterMarker"
        ? MINIMUM_FONT_SIZE.sectionTitle
        : role === "pageNumber"
          ? 0
          : MINIMUM_FONT_SIZE.body;
  if (fontSize < minimum) {
    throw new FontSizeReducedError(role, fontSize, minimum);
  }
  return fontSize;
}
