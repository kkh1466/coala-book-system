import type { PageId } from "@canva/design";
import type { BookSpec } from "../types/book-spec";
import type { BookProgressEvent } from "./create-book";
import { BookGenerationFailedError } from "./create-book";
import { classifyFailure, isManuscriptError } from "./canva-errors";

/**
 * 생성 화면의 상태 계산.
 *
 * React에 묶이지 않은 순수 함수로 둔다. 버튼 비활성화, 진행 문구, 실패 보고,
 * 재실행 시 중복 처리 판단을 여기서 모두 결정하고 테스트한다.
 */

export type GenerationPhase =
  /** 아직 시작하지 않음 */
  | "idle"
  /** 원고를 읽는 중 */
  | "reading"
  /** 페이지 생성 중 */
  | "generating"
  /** 사용자의 확인을 기다리는 중(중복 위험) */
  | "awaiting-confirmation"
  | "done"
  | "failed";

/** 생성 버튼을 눌러도 되는가. App이 이 값을 그대로 disabled에 쓴다. */
export function isGenerateDisabled(state: {
  canAddPage: boolean;
  hasBookSpec: boolean;
  phase: GenerationPhase;
}): boolean {
  if (!state.canAddPage || !state.hasBookSpec) {
    return true;
  }
  // 생성 중에는 다시 누를 수 없다. 두 번째 실행이 첫 실행과 겹쳐 페이지가
  // 중복되거나 속도 제한을 더 세게 맞는 것을 막는다.
  return state.phase === "generating" || state.phase === "reading";
}

const secondsText = (milliseconds: number): string => {
  const seconds = milliseconds / 1_000;
  const rounded = seconds >= 1 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  return `${rounded}초`;
};

/** 진행 상황 한 줄. 앱 패널에 그대로 표시한다. */
export function describeProgress(event: BookProgressEvent): string {
  switch (event.type) {
    case "page-start":
      return `전체 ${event.total}페이지 중 ${event.current}페이지 생성 중`;
    case "page-done":
      return `전체 ${event.total}페이지 중 ${event.completed}페이지 생성 완료`;
    case "retry-wait": {
      const reason =
        event.failure.category === "rate-limit"
          ? "Canva 요청 제한으로"
          : "Canva 일시 오류로";
      return `${reason} ${secondsText(event.delayMs)} 후 다시 시도합니다 (${event.current}페이지 · 재시도 ${event.attempt}/${event.maxRetries})`;
    }
    case "completed":
      return `${event.completed}개 Canva 페이지를 생성했습니다.`;
    default:
      return "";
  }
}

/** 성공 문구. 이어서 생성한 경우 건너뛴 페이지를 숨기지 않고 함께 알린다. */
export function describeCompletion(result: {
  pageCount: number;
  createdPageCount: number;
  skippedPageCount: number;
}): string {
  if (result.skippedPageCount === 0) {
    return `${result.createdPageCount}개 Canva 페이지를 생성했습니다.`;
  }
  return `${result.createdPageCount}개 Canva 페이지를 이어서 생성했습니다. 이전 실행에서 만든 ${result.skippedPageCount}페이지를 합쳐 전체 ${result.pageCount}페이지가 준비됐습니다.`;
}

export type ReportLine = { label: string; value: string };

export type FailureReport = {
  /** 원고 검증 단계의 실패인가, 실제 Canva 생성 실패인가. */
  kind: "manuscript" | "generation";
  title: string;
  lines: ReportLine[];
  /** 생성이 중간에 멈췄다면 어디까지 만들어졌는지. */
  progressNote?: string;
};

/**
 * 실패를 화면에 그대로 옮길 수 있는 형태로 정리한다.
 *
 * 원고 검증 오류와 Canva 생성 오류를 구분하고, 생성 오류에는 Canva가 준 실제
 * 코드와 메시지를 반드시 남긴다.
 */
export function buildFailureReport(error: unknown): FailureReport {
  if (error instanceof BookGenerationFailedError) {
    const failure = error.failedPage.failure;
    const lines: ReportLine[] = [
      { label: "전체 페이지 수", value: `${error.totalPages}페이지` },
      {
        label: "정상 생성된 페이지 수",
        value:
          error.skippedPageCount > 0
            ? `${error.createdPageCount}페이지 (이전 실행에서 만든 ${error.skippedPageCount}페이지 제외)`
            : `${error.createdPageCount}페이지`,
      },
      {
        label: "실패한 원고 페이지 번호",
        value: `${error.failedPage.manuscriptPageNumber}번째 페이지`,
      },
      { label: "실패한 페이지 유형", value: error.failedPage.pageType },
      { label: "재시도 횟수", value: `${error.failedPage.retries}회` },
      {
        label: "Canva 오류 코드",
        value: failure?.code ?? "(코드 없음)",
      },
      {
        label: "Canva 오류 메시지",
        value: failure?.message ?? error.message,
      },
    ];
    if (error.pagesAddedToDesign !== error.createdPageCount) {
      lines.push({
        label: "요소 배치를 끝내지 못한 페이지",
        value: `${error.pagesAddedToDesign - error.createdPageCount}페이지 (Canva에는 추가돼 있습니다)`,
      });
    }
    const totalReady = error.createdPageCount + error.skippedPageCount;
    return {
      kind: failure?.category === "manuscript" ? "manuscript" : "generation",
      title: failure?.summary ?? "Canva 페이지 생성을 마치지 못했습니다.",
      lines,
      progressNote: `전체 ${error.totalPages}페이지 중 ${totalReady}페이지까지 생성됐습니다. 이미 만들어진 페이지는 Canva에 그대로 남아 있습니다.`,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  if (isManuscriptError(error)) {
    return {
      kind: "manuscript",
      title: "원고 내용이 현재 템플릿 규칙을 만족하지 않습니다.",
      lines: [{ label: "원인", value: message }],
    };
  }

  const failure = classifyFailure(error);
  if (failure.code) {
    return {
      kind: "generation",
      title: failure.summary,
      lines: [
        { label: "Canva 오류 코드", value: failure.code },
        { label: "Canva 오류 메시지", value: failure.message },
      ],
    };
  }

  return {
    kind: "manuscript",
    title: "Canva 페이지를 생성하지 못했습니다.",
    lines: [{ label: "원인", value: message }],
  };
}

/** 같은 원고인지 판단하기 위한 지문. */
export function bookFingerprint(spec: BookSpec): string {
  const source = JSON.stringify(spec);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${source.length}`;
}

/** 직전 실행의 결과. 앱 세션이 살아 있는 동안만 유지된다. */
export type PreviousRun = {
  fingerprint: string;
  totalPages: number;
  /** 이미 만들어진 페이지의 계획 순서(0부터). */
  createdIndexes: number[];
  /** 그 페이지들의 Canva 페이지 id. surface가 주지 않으면 비어 있다. */
  createdPageIds: PageId[];
};

/**
 * 이전에 만든 페이지가 아직 디자인에 남아 있는지에 대한 안내.
 *
 * 사용자가 그 페이지를 직접 지웠을 수 있다. 그때 "이어서 생성"을 고르면 지운
 * 페이지는 다시 만들어지지 않으므로, 사실을 그대로 알려 사용자가 고르게 한다.
 */
export function describeCreatedPageCheck(check: {
  checked: boolean;
  missing: readonly PageId[];
}): string | undefined {
  if (!check.checked) {
    return "현재 디자인에서 이전에 만든 페이지를 확인할 수 없었습니다(이 디자인 유형은 페이지 id를 제공하지 않습니다). 중복 여부는 Canva 편집기에서 직접 확인해 주세요.";
  }
  if (check.missing.length === 0) {
    return undefined;
  }
  return `이전에 만든 ${check.missing.length}페이지가 현재 디자인에 없습니다(삭제된 것으로 보입니다). 이어서 생성하면 그 페이지는 다시 만들어지지 않습니다.`;
}

export type RerunDecision =
  /** 새 원고이거나 처음 실행이다. 그대로 생성한다. */
  | { kind: "start-fresh" }
  /** 같은 원고가 일부만 생성돼 있다. 이어서 만들지 되물어야 한다. */
  | {
      kind: "confirm-resume";
      createdCount: number;
      remainingCount: number;
      totalPages: number;
      message: string;
    }
  /** 같은 원고가 이미 전부 생성돼 있다. 다시 만들면 중복된다. */
  | {
      kind: "confirm-duplicate";
      totalPages: number;
      message: string;
    };

/**
 * 생성 버튼을 다시 눌렀을 때 무엇을 할지 정한다.
 *
 * 설치된 @canva/design 2.13.0에는 **페이지를 삭제하는 API가 없다.** 이미 추가한
 * 페이지를 앱이 되돌릴 수 없으므로, 자동으로 다시 만들지 않고 사용자가
 * 고르게 한다. 이어서 생성은 이번 앱 세션이 기억하고 있는 생성 기록을 쓴다.
 */
export function decideRerun(
  previous: PreviousRun | undefined,
  fingerprint: string,
): RerunDecision {
  if (!previous || previous.fingerprint !== fingerprint) {
    return { kind: "start-fresh" };
  }
  const createdCount = previous.createdIndexes.length;
  if (createdCount === 0) {
    return { kind: "start-fresh" };
  }
  if (createdCount >= previous.totalPages) {
    return {
      kind: "confirm-duplicate",
      totalPages: previous.totalPages,
      message: `이 원고의 ${previous.totalPages}페이지는 이미 모두 생성했습니다. 지금 다시 생성하면 같은 페이지가 한 번 더 추가됩니다. Canva Apps SDK에는 앱이 추가한 페이지를 지우는 기능이 없어 앱이 되돌릴 수 없습니다.`,
    };
  }
  return {
    kind: "confirm-resume",
    createdCount,
    remainingCount: previous.totalPages - createdCount,
    totalPages: previous.totalPages,
    message: `이 원고는 직전 실행에서 ${previous.totalPages}페이지 중 ${createdCount}페이지까지 생성됐습니다. 남은 ${previous.totalPages - createdCount}페이지만 이어서 만들 수 있습니다. 처음부터 다시 만들면 이미 있는 ${createdCount}페이지와 중복됩니다.`,
  };
}
