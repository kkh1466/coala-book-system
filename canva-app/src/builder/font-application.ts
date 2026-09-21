import type { Font, FontRef } from "@canva/asset";
import { findFonts } from "@canva/asset";
import type {
  FontCandidate,
  FontDiscoveryReport,
  FontSource,
  ResolvedBookFonts,
} from "../theme/font-resolver";
import {
  BOOK_FONT_FAMILY,
  buildFontCandidates,
  matchFontName,
} from "../theme/font-resolver";
import { scanDesignFonts } from "../theme/design-fonts";

/**
 * 글꼴 적용 판정.
 *
 * 규칙은 하나다. **목록 조회 결과로 판정하지 않고, 실제 Canva 생성 호출로
 * 판정한다.** findFonts()는 Canva 글꼴의 일부만 돌려주므로 "목록에 없음"은
 * "쓸 수 없음"이 아니다. 그래서 사전 검사로 생성을 막지 않고, 후보를 순서대로
 * 실제로 적용해 보며 처음 성공한 글꼴을 책 전체에 쓴다.
 *
 * 대체 글꼴은 실제 적용 호출이 실패했을 때만 사용한다.
 */

/** 실패한 시도 하나의 기록. 화면에 그대로 보여 준다. */
export type FontAttemptFailure = {
  familyName: string;
  fontRef?: FontRef;
  source: FontSource;
  /** 실패한 Canva API/SDK 호출. */
  call: string;
  /** 그 호출이 돌려준 오류 메시지. */
  errorMessage: string;
};

export type FontApplicationOutcome = {
  /** 실제로 적용된 글꼴. 모든 페이지가 이 값을 쓴다. */
  applied: ResolvedBookFonts;
  /** Wanted Sans 적용에 성공했는지. */
  usedWantedSans: boolean;
  /** Wanted Sans가 아니라면, 대체된 정확한 사유. */
  fallbackReason?: string;
  /** 실패한 시도 전부. 성공했다면 비어 있다. */
  attempts: FontAttemptFailure[];
  /** 글꼴을 어디서 어떻게 찾았는지. */
  discovery: FontDiscoveryReport;
};

/**
 * 글꼴과 무관한 실패. 대체 글꼴로 바꿔도 해결되지 않으므로 사다리를 멈추고
 * 원래 오류를 그대로 올려보낸다. (예: 페이지 내용 과밀)
 */
export class NonFontFailure extends Error {
  readonly reason: unknown;

  constructor(reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));
    this.name = "NonFontFailure";
    this.reason = reason;
  }
}

export class FontApplicationFailedError extends Error {
  readonly attempts: FontAttemptFailure[];
  readonly discovery: FontDiscoveryReport;

  constructor(attempts: FontAttemptFailure[], discovery: FontDiscoveryReport) {
    const detail = attempts
      .map(
        (attempt) =>
          `- ${attempt.familyName} (${attempt.source}): ${attempt.call} 실패 — ${attempt.errorMessage}`,
      )
      .join("\n");
    super(
      `글꼴 후보를 모두 실제로 적용해 봤지만 Canva 페이지를 만들지 못했습니다.\n${detail}`,
    );
    this.name = "FontApplicationFailedError";
    this.attempts = attempts;
    this.discovery = discovery;
  }
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isWantedSans = (familyName: string): boolean =>
  matchFontName(familyName, BOOK_FONT_FAMILY) !== "none";

/**
 * 시도 순서를 만든다. 아무것도 던지지 않으며, 조회에 실패해도 최소한
 * "글꼴 미지정" 후보는 남는다.
 */
export async function discoverFontCandidates(
  deps: {
    findFonts?: typeof findFonts;
    scanDesignFonts?: typeof scanDesignFonts;
  } = {},
): Promise<{ candidates: FontCandidate[]; report: FontDiscoveryReport }> {
  const findFontsImpl = deps.findFonts ?? findFonts;
  const scanDesignFontsImpl = deps.scanDesignFonts ?? scanDesignFonts;

  let listedFonts: readonly Font[] = [];
  let findFontsError: string | undefined;
  try {
    const response = await findFontsImpl();
    listedFonts = response.fonts;
  } catch (error) {
    findFontsError = describeError(error);
  }

  const designScan = await scanDesignFontsImpl();

  return buildFontCandidates({
    listedFonts,
    designFonts: designScan.fonts,
    findFontsError,
    designScanError: designScan.error,
  });
}

function explainFallback(
  applied: ResolvedBookFonts,
  attempts: FontAttemptFailure[],
  discovery: FontDiscoveryReport,
): string | undefined {
  if (isWantedSans(applied.familyName)) {
    return undefined;
  }

  const wantedSansAttempts = attempts.filter((attempt) =>
    isWantedSans(attempt.familyName),
  );

  if (wantedSansAttempts.length > 0) {
    const reasons = wantedSansAttempts
      .map(
        (attempt) => `${attempt.call} 실패 — ${attempt.errorMessage}`,
      )
      .join(" / ");
    return `${BOOK_FONT_FAMILY} 적용을 ${wantedSansAttempts.length}번 실제로 시도했지만 모두 실패해 대체했습니다. ${reasons}`;
  }

  const sources: string[] = [];
  if (!discovery.wantedSansInList) {
    sources.push(
      `findFonts()가 돌려준 ${discovery.listedFontCount}개 글꼴 목록에 없었습니다(이 API는 Canva 글꼴의 일부만 돌려줍니다)`,
    );
  }
  if (!discovery.wantedSansInDesign) {
    sources.push("현재 디자인이 사용 중인 글꼴에도 없었습니다");
  }
  if (discovery.findFontsError) {
    sources.push(`findFonts() 호출 실패 — ${discovery.findFontsError}`);
  }
  if (discovery.designScanError) {
    sources.push(`디자인 글꼴 조회 실패 — ${discovery.designScanError}`);
  }
  return `${BOOK_FONT_FAMILY}의 fontRef를 얻지 못해 적용 자체를 시도할 수 없었습니다. ${sources.join(", ")}.`;
}

/**
 * 후보를 순서대로 실제 적용해 보고, 처음 성공한 글꼴을 확정한다.
 *
 * @param attempt 실제 Canva 생성 호출. 이 호출의 실패만 글꼴 실패로 본다.
 */
export async function applyFirstWorkingFont<T>(options: {
  candidates: readonly FontCandidate[];
  discovery: FontDiscoveryReport;
  attempt: (fonts: ResolvedBookFonts) => Promise<T>;
  /** 화면에 표시할 호출 이름. */
  call?: string;
}): Promise<{ outcome: FontApplicationOutcome; value: T }> {
  const call = options.call ?? "@canva/design addPage()";
  const attempts: FontAttemptFailure[] = [];

  for (const candidate of options.candidates) {
    const applied: ResolvedBookFonts = {
      familyName: candidate.familyName,
      fontRef: candidate.fontRef,
      regularWeight: candidate.regularWeight,
      boldWeight: candidate.boldWeight,
      source: candidate.source,
    };
    try {
      const value = await options.attempt(applied);
      return {
        value,
        outcome: {
          applied,
          usedWantedSans: isWantedSans(applied.familyName),
          fallbackReason: explainFallback(applied, attempts, options.discovery),
          attempts,
          discovery: options.discovery,
        },
      };
    } catch (error) {
      if (error instanceof NonFontFailure) {
        // 글꼴을 바꿔도 해결되지 않는 실패다. 대체를 시도하지 않는다.
        throw error.reason;
      }
      attempts.push({
        familyName: candidate.familyName,
        fontRef: candidate.fontRef,
        source: candidate.source,
        call,
        errorMessage: describeError(error),
      });
    }
  }

  throw new FontApplicationFailedError(attempts, options.discovery);
}
