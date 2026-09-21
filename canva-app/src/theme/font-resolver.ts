import type { Font, FontRef, FontWeight, FontWeightName } from "@canva/asset";
import { findFonts } from "@canva/asset";

/**
 * 글꼴 해석.
 *
 * 중요한 사실 하나가 이 파일의 설계를 결정한다. `@canva/asset`의 findFonts는
 * 타입 정의에 이렇게 적혀 있다.
 *
 *   "Retrieves a list of fonts. @remarks Only a subset of Canva's fonts are
 *    returned."
 *
 * 즉 findFonts()가 돌려주는 목록은 Canva 편집기에서 쓸 수 있는 글꼴 전체가
 * 아니다. 편집기에서 Wanted Sans가 보이고 선택도 되는데 findFonts() 결과에는
 * 없을 수 있다. 그래서 "목록에 없음"을 "사용 불가"로 판단해 생성을 막으면
 * 오탐이 된다.
 *
 * 이 파일은 그래서 아무것도 막지 않는다. 쓸 수 있는 후보를 순서대로 모아
 * 줄 뿐이고, 실제 사용 가능 여부는 builder/font-application.ts가 진짜 Canva
 * 생성 호출로 판정한다.
 */

/** 교재 기본 글꼴. 어떤 경우에도 1순위다. */
export const BOOK_FONT_FAMILY = "Wanted Sans";

/** 실제 적용 실패가 확인됐을 때의 1순위 대체 글꼴. */
export const FALLBACK_FONT_FAMILY = "Noto Sans KR";

export type FontSource =
  /** findFonts()가 돌려준 목록에서 찾음. */
  | "findFonts"
  /** 현재 디자인이 이미 쓰고 있는 글꼴에서 찾음. */
  | "design-scan"
  /** 글꼴을 지정하지 않고 Canva 디자인 기본 글꼴에 맡김. */
  | "canva-default";

export type ResolvedBookFonts = {
  familyName: string;
  /**
   * undefined이면 fontRef를 지정하지 않는다. RichtextFormatting.fontRef는
   * 선택 항목이라, 생략하면 Canva가 디자인 기본 글꼴을 쓴다.
   */
  fontRef?: FontRef;
  regularWeight: FontWeightName;
  boldWeight: FontWeightName;
  source: FontSource;
};

/* -------------------------------------------------------------------------
 * 글꼴 이름 비교
 * ---------------------------------------------------------------------- */

/**
 * 이름 끝에 붙는 스타일/굵기/포맷 단어. Canva가 "Wanted Sans"로 주든
 * "Wanted Sans Regular"로 주든 같은 패밀리로 봐야 한다.
 */
const STYLE_WORDS: ReadonlySet<string> = new Set([
  // CamelCase를 나눌 때 생기는 조각들("SemiBold" -> "semi" + "bold").
  "semi",
  "demi",
  "extra",
  "ultra",
  "regular",
  "normal",
  "book",
  "roman",
  "italic",
  "oblique",
  "thin",
  "extralight",
  "ultralight",
  "light",
  "medium",
  "semibold",
  "demibold",
  "bold",
  "extrabold",
  "ultrabold",
  "black",
  "heavy",
  "variable",
  "vf",
  "otf",
  "ttf",
  "woff",
  "woff2",
]);

/**
 * 이름을 비교 가능한 단어 배열로 바꾼다.
 *
 * 앞뒤 공백, 연속 공백, 대소문자, 하이픈/언더스코어, 붙여 쓴 CamelCase,
 * 유니코드 정규화 차이를 모두 흡수한다.
 */
export function fontNameWords(name: string): string[] {
  return name
    .normalize("NFKC")
    .replace(/[_\-–—]+/g, " ")
    // "WantedSans" 같은 내부 이름을 "Wanted Sans"로 되돌린다.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLocaleLowerCase("en")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((word) => word.length > 0);
}

function stripTrailingStyleWords(words: string[]): string[] {
  const kept = [...words];
  while (kept.length > 1) {
    const last = kept[kept.length - 1];
    if (last === undefined || !STYLE_WORDS.has(last)) {
      break;
    }
    kept.pop();
  }
  return kept;
}

export type FontNameMatch =
  /** 스타일 단어를 뗀 뒤 완전히 같다. "Wanted Sans", "Wanted Sans Regular" */
  | "exact"
  /** 대상 이름으로 시작하는 같은 패밀리. "Wanted Sans Variable" */
  | "family"
  /** 띄어쓰기만 다른 내부 이름. "wantedsans" */
  | "compact"
  | "none";

const MATCH_RANK: Record<Exclude<FontNameMatch, "none">, number> = {
  exact: 0,
  family: 1,
  compact: 2,
};

export function matchFontName(
  candidateName: string,
  targetName: string,
): FontNameMatch {
  const candidate = stripTrailingStyleWords(fontNameWords(candidateName));
  const target = stripTrailingStyleWords(fontNameWords(targetName));
  if (target.length === 0 || candidate.length === 0) {
    return "none";
  }
  const startsWithTarget = target.every((word, index) => candidate[index] === word);
  if (startsWithTarget) {
    return candidate.length === target.length ? "exact" : "family";
  }
  if (candidate.join("") === target.join("")) {
    return "compact";
  }
  return "none";
}

/**
 * 이름이 target과 같은 패밀리인 글꼴을, 더 정확히 일치하는 것부터 돌려준다.
 */
export function findFontsByName(
  fonts: readonly Font[],
  targetName: string,
): Font[] {
  const scored: { font: Font; rank: number }[] = [];
  for (const font of fonts) {
    const match = matchFontName(font.name, targetName);
    if (match !== "none") {
      scored.push({ font, rank: MATCH_RANK[match] });
    }
  }
  return scored
    .sort((left, right) => left.rank - right.rank)
    .map(({ font }) => font);
}

/* -------------------------------------------------------------------------
 * 굵기 선택
 * ---------------------------------------------------------------------- */

const REGULAR_PREFERENCE: readonly FontWeightName[] = [
  "normal",
  "medium",
  "light",
  "semibold",
  "extralight",
  "thin",
  "bold",
  "ultrabold",
  "heavy",
];

const BOLD_PREFERENCE: readonly FontWeightName[] = [
  "bold",
  "semibold",
  "heavy",
  "ultrabold",
  "medium",
  "normal",
  "light",
  "extralight",
  "thin",
];

/**
 * 쓸 수 있는 굵기 중에서 본문용과 강조용을 고른다.
 *
 * 예전 코드는 normal과 bold가 둘 다 없으면 생성을 막았다. Canva가 같은
 * 패밀리를 다른 굵기 이름으로 노출하는 경우가 있어 이것도 오탐의 원인이었다.
 * 굵기가 하나뿐이면 그 하나를 양쪽에 쓴다. 글꼴 자체를 포기하지는 않는다.
 */
export function pickWeights(weights?: readonly FontWeight[]): {
  regularWeight: FontWeightName;
  boldWeight: FontWeightName;
} {
  const available = new Set((weights ?? []).map(({ weight }) => weight));
  if (available.size === 0) {
    return { regularWeight: "normal", boldWeight: "bold" };
  }
  const regularWeight =
    REGULAR_PREFERENCE.find((weight) => available.has(weight)) ?? "normal";
  const boldWeight =
    BOLD_PREFERENCE.find((weight) => available.has(weight)) ?? regularWeight;
  return { regularWeight, boldWeight };
}

/* -------------------------------------------------------------------------
 * 한글 글꼴 판별
 * ---------------------------------------------------------------------- */

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿]/;

/**
 * Canva의 Font에는 지원 문자나 언어 정보가 없다(ref, name, weights,
 * previewUrl뿐). 그래서 한글 글꼴 판별은 이름 기반 추정일 수밖에 없다.
 * 이 목록은 최종 판단 기준이 아니라 마지막 대체 후보의 우선순위를 정할
 * 때만 쓰이며, 실제 사용 가능 여부는 생성 호출로 확인한다.
 */
const KOREAN_FAMILY_KEYWORDS: readonly string[] = [
  "wanted sans",
  "noto sans kr",
  "noto serif kr",
  "ibm plex sans kr",
  "nanum",
  "pretendard",
  "spoqa",
  "gothic a1",
  "black han sans",
  "do hyeon",
  "jua",
  "sunflower",
  "gasoek",
  "hakgyoansim",
  "song myung",
  "poor story",
  "kirang haerang",
  "cute font",
  "gaegu",
  "dokdo",
  "yeon sung",
  "single day",
  "gugi",
  "hi melody",
  "gmarket",
  "paperlogy",
  "freesentation",
];

export function looksKorean(name: string): boolean {
  if (HANGUL.test(name)) {
    return true;
  }
  const lower = name.toLocaleLowerCase("en");
  if (/(^|[^a-z])(kr|kor|korea|korean|hangul)([^a-z]|$)/.test(lower)) {
    return true;
  }
  return KOREAN_FAMILY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/* -------------------------------------------------------------------------
 * 후보 구성
 * ---------------------------------------------------------------------- */

export type FontCandidate = ResolvedBookFonts & {
  /** 왜 이 순서에 있는지. 화면과 로그에 그대로 쓴다. */
  rationale: string;
};

export type FontDiscoveryReport = {
  /** findFonts()가 돌려준 글꼴 수. Canva는 전체가 아닌 일부만 돌려준다. */
  listedFontCount: number;
  /** findFonts() 목록에 Wanted Sans가 있었는지. */
  wantedSansInList: boolean;
  /** 현재 디자인이 이미 쓰고 있는 글꼴에서 Wanted Sans를 찾았는지. */
  wantedSansInDesign: boolean;
  findFontsError?: string;
  designScanError?: string;
};

const toCandidate = (
  font: Font,
  source: FontSource,
  rationale: string,
): FontCandidate => ({
  familyName: font.name,
  fontRef: font.ref,
  ...pickWeights(font.weights),
  source,
  rationale,
});

/** 글꼴을 지정하지 않는 마지막 후보. 생성 자체가 막히는 일은 없어야 한다. */
export const CANVA_DEFAULT_CANDIDATE: FontCandidate = {
  familyName: "Canva 디자인 기본 글꼴",
  fontRef: undefined,
  regularWeight: "normal",
  boldWeight: "bold",
  source: "canva-default",
  rationale:
    "Wanted Sans와 대체 글꼴을 모두 실제로 적용하지 못했을 때, 생성을 멈추는 대신 글꼴을 지정하지 않고 Canva 기본 글꼴로 생성합니다.",
};

/**
 * 시도 순서를 만든다. 순서는 사용자 확정 정책이다.
 *
 *   1. Wanted Sans (findFonts 목록)
 *   2. Wanted Sans (현재 디자인이 실제로 쓰고 있는 글꼴)
 *   3. Noto Sans KR
 *   4. 그 밖에 실제로 조회된 한글 글꼴
 *   5. 글꼴 미지정 (Canva 기본)
 *
 * 이 함수는 순수 함수이고 아무것도 던지지 않는다.
 */
export function buildFontCandidates(input: {
  listedFonts: readonly Font[];
  designFonts?: readonly Font[];
  findFontsError?: string;
  designScanError?: string;
}): { candidates: FontCandidate[]; report: FontDiscoveryReport } {
  const { listedFonts, designFonts = [] } = input;

  const wantedFromList = findFontsByName(listedFonts, BOOK_FONT_FAMILY);
  const wantedFromDesign = findFontsByName(designFonts, BOOK_FONT_FAMILY);
  const notoFromList = findFontsByName(listedFonts, FALLBACK_FONT_FAMILY);
  const notoFromDesign = findFontsByName(designFonts, FALLBACK_FONT_FAMILY);

  const candidates: FontCandidate[] = [];
  const seenRefs = new Set<string>();
  const push = (candidate: FontCandidate) => {
    const key = candidate.fontRef ?? "";
    if (key && seenRefs.has(key)) {
      return;
    }
    if (key) {
      seenRefs.add(key);
    }
    candidates.push(candidate);
  };

  for (const font of wantedFromList) {
    push(
      toCandidate(
        font,
        "findFonts",
        `findFonts() 목록에서 ${BOOK_FONT_FAMILY}를 찾았습니다.`,
      ),
    );
  }
  for (const font of wantedFromDesign) {
    push(
      toCandidate(
        font,
        "design-scan",
        `현재 디자인이 이미 사용 중인 글꼴에서 ${BOOK_FONT_FAMILY}를 찾았습니다.`,
      ),
    );
  }
  for (const font of notoFromList) {
    push(
      toCandidate(
        font,
        "findFonts",
        `대체 1순위 ${FALLBACK_FONT_FAMILY}입니다.`,
      ),
    );
  }
  for (const font of notoFromDesign) {
    push(
      toCandidate(
        font,
        "design-scan",
        `현재 디자인이 사용 중인 ${FALLBACK_FONT_FAMILY}입니다.`,
      ),
    );
  }
  for (const font of listedFonts) {
    if (looksKorean(font.name)) {
      push(
        toCandidate(
          font,
          "findFonts",
          "대체 2순위입니다. Canva SDK가 실제로 돌려준 한글 글꼴입니다.",
        ),
      );
    }
  }
  for (const font of designFonts) {
    if (looksKorean(font.name)) {
      push(
        toCandidate(
          font,
          "design-scan",
          "대체 2순위입니다. 현재 디자인이 실제로 쓰고 있는 한글 글꼴입니다.",
        ),
      );
    }
  }
  push(CANVA_DEFAULT_CANDIDATE);

  return {
    candidates,
    report: {
      listedFontCount: listedFonts.length,
      wantedSansInList: wantedFromList.length > 0,
      wantedSansInDesign: wantedFromDesign.length > 0,
      findFontsError: input.findFontsError,
      designScanError: input.designScanError,
    },
  };
}

/* -------------------------------------------------------------------------
 * 순서도 전용 글꼴
 * ---------------------------------------------------------------------- */

export type ResolvedFlowchartFont = {
  familyName: "Hakgyoansim Chilpanjiugae OTF";
  fontRef: FontRef;
  availableWeights: FontWeightName[];
};

export class FlowchartFontNotFoundError extends Error {
  constructor(
    message = "Canva에서 Hakgyoansim Chilpanjiugae OTF 글꼴을 찾지 못했습니다.",
  ) {
    super(message);
    this.name = "FlowchartFontNotFoundError";
  }
}

type FindFonts = typeof findFonts;

/**
 * 순서도 내부 글꼴은 대체가 허용되지 않는 별도 규칙이라 그대로 둔다.
 * 순서도 페이지는 필수 Canva 라이브러리 요소를 삽입할 수 없어 어차피 이
 * 함수에 도달하기 전에 중단된다.
 */
export async function resolveFlowchartFont(
  findFontsImpl: FindFonts = findFonts,
): Promise<ResolvedFlowchartFont> {
  const { fonts } = await findFontsImpl();
  const flowchartFont = findFontsByName(
    fonts,
    "Hakgyoansim Chilpanjiugae OTF",
  )[0];

  if (!flowchartFont) {
    throw new FlowchartFontNotFoundError(
      "Canva에서 Hakgyoansim Chilpanjiugae OTF를 찾지 못했습니다. 다른 글꼴로 대체하지 말고 계정의 글꼴 접근 권한을 확인해 주세요.",
    );
  }

  return {
    familyName: "Hakgyoansim Chilpanjiugae OTF",
    fontRef: flowchartFont.ref,
    availableWeights: flowchartFont.weights.map(({ weight }) => weight),
  };
}
