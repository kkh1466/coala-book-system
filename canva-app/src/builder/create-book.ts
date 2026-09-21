import type { PageId } from "@canva/design";
import type { BookSpec } from "../types/book-spec";
import { validateBookSpec } from "../types/book-spec";
import type { FailureClassification } from "./canva-errors";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { FontApplicationOutcome } from "./font-application";
import {
  applyFirstWorkingFont,
  discoverFontCandidates,
  NonFontFailure,
} from "./font-application";
import { planBook } from "./plan-book";
import type { LaidOutPage } from "./layout-book";
import {
  collectPendingFlowcharts,
  collectPendingImages,
  layoutBook,
} from "./layout-book";
import type { PendingFlowchartReport } from "../types/pending-flowchart";
import type { PendingImageReport } from "../types/pending-image";
import type { PreparedPage } from "./create-page";
import { createPage, preparePage } from "./create-page";
import type {
  PageTask,
  PageWriteRecord,
  WritePageFn,
} from "./page-writer";
import { PageWriteFailedError, SequentialPageWriter } from "./page-writer";
import { countDesignPages } from "./design-pages";
import { openDesign, setCurrentPageBackground } from "@canva/design";
import type { BlankFirstPageReuse } from "./blank-first-page";
import { tryFillBlankFirstPage } from "./blank-first-page";

import type { PageCreationPolicy } from "./retry-policy";
import { PAGE_CREATION_POLICY, sleep } from "./retry-policy";

/** 이미 만들어진 페이지. 다시 누를 때 중복 생성을 피하는 데 쓴다. */
export type CreatedPageRef = {
  /** 생성 계획 안에서의 순서(0부터). */
  index: number;
  manuscriptPageNumber: number;
  pageType: string;
  pageId?: PageId;
};

export type CreateBookResult = {
  /** 원고 전체 페이지 수. */
  pageCount: number;
  /** 이번 실행에서 생성을 끝낸 페이지 수. */
  createdPageCount: number;
  /** 이전 실행에서 이미 만들어져 건너뛴 페이지 수. */
  skippedPageCount: number;
  /** 이번 실행에서 만든 페이지들. 다음 실행의 이어서 생성에 쓴다. */
  createdPages: CreatedPageRef[];
  /** 페이지별 최종 상태 기록. */
  records: PageWriteRecord[];
  /** 실제로 적용된 글꼴과 그 판정 근거. 앱 화면이 그대로 보여 준다. */
  font: FontApplicationOutcome;
  /**
   * 자리만 비워 둔 이미지 목록(책 전체, 지면 순서). Canva에서 각 자리에
   * 이미지를 끌어다 놓으면 끝난다. 이미지가 없는 원고에서는 빈 배열.
   */
  pendingImages: PendingImageReport[];
  /**
   * 자리만 비워 둔 순서도 목록(책 전체, 지면 순서). 앱은 순서도를 그리지
   * 않는다. 사용자가 Canva에서 지정된 요소로 직접 만들어야 한다.
   */
  pendingFlowcharts: PendingFlowchartReport[];
  /**
   * 새 디자인의 빈 첫 페이지를 교재 첫 장으로 썼는지. 첫 장을 만들지 않은
   * 실행(이어서 생성 등)에서는 undefined.
   */
  blankFirstPage?: BlankFirstPageReuse;
};

export type BookProgressEvent =
  | {
      type: "page-start";
      /** 지금 만들고 있는 원고 페이지 번호(1부터). */
      current: number;
      total: number;
      completed: number;
      pageType: string;
      attempt: number;
    }
  | { type: "page-done"; current: number; total: number; completed: number }
  | {
      type: "retry-wait";
      current: number;
      total: number;
      completed: number;
      delayMs: number;
      /** 몇 번째 재시도인지(1부터). */
      attempt: number;
      maxRetries: number;
      failure: FailureClassification;
    }
  | { type: "completed"; total: number; completed: number };

export type CreateBookDeps = {
  discoverFontCandidates: typeof discoverFontCandidates;
  writePage: WritePageFn;
  /**
   * 새 디자인의 빈 첫 페이지에 첫 장을 그려 넣는다. 쓸 수 없으면 아무것도
   * 바꾸지 않고 `reused: false`를 돌려주며, 그때는 `writePage`가 쓰인다.
   */
  fillBlankFirstPage: (
    page: PreparedPage,
    getDesignPageCount: () => Promise<number | undefined>,
  ) => Promise<BlankFirstPageReuse>;
  getDesignPageCount: () => Promise<number | undefined>;

  sleep: (milliseconds: number) => Promise<void>;
  random: () => number;
  policy: PageCreationPolicy;
};

export type CreateBookOptions = {
  onProgress?: (event: BookProgressEvent) => void;
  /**
   * 이전 실행에서 이미 만들어진 페이지의 계획 순서. 여기에 있는 페이지는
   * 다시 만들지 않는다.
   */
  alreadyCreatedIndexes?: readonly number[];
};

const defaultDeps: CreateBookDeps = {
  discoverFontCandidates,
  writePage: (page: PreparedPage) => createPage(page),
  fillBlankFirstPage: (page, getDesignPageCount) =>
    tryFillBlankFirstPage(page, {
      openDesign,
      setCurrentPageBackground,
      getDesignPageCount,
    }),
  getDesignPageCount: countDesignPages,

  sleep,
  random: Math.random,
  policy: PAGE_CREATION_POLICY,
};

/** 한 권의 생성이 중간에 멈췄을 때 던진다. 어디까지 만들어졌는지 그대로 싣는다. */
export class BookGenerationFailedError extends Error {
  /** 원고 전체 페이지 수. */
  readonly totalPages: number;
  /** 이번 실행에서 생성을 끝낸 페이지 수. */
  readonly createdPageCount: number;
  /**
   * 이번 실행에서 Canva 디자인에 실제로 추가된 페이지 수.
   * 요소 배치까지 끝내지 못한 페이지도 포함한다. 되돌릴 수 없으므로
   * 사용자에게 숨기지 않는다.
   */
  readonly pagesAddedToDesign: number;
  /** 이전 실행에서 이미 만들어져 건너뛴 페이지 수. */
  readonly skippedPageCount: number;
  /** 실패한 페이지의 상태 기록(원고 페이지 번호, 유형, 재시도 횟수, 오류). */
  readonly failedPage: PageWriteRecord;
  /** 이번 실행에서 만든 페이지들. 이어서 생성에 쓴다. */
  readonly createdPages: CreatedPageRef[];
  readonly records: PageWriteRecord[];
  readonly font?: FontApplicationOutcome;

  constructor(options: {
    totalPages: number;
    createdPageCount: number;
    pagesAddedToDesign: number;
    skippedPageCount: number;
    failedPage: PageWriteRecord;
    createdPages: CreatedPageRef[];
    records: PageWriteRecord[];
    font?: FontApplicationOutcome;
    message: string;
  }) {
    super(options.message);
    this.name = "BookGenerationFailedError";
    this.totalPages = options.totalPages;
    this.createdPageCount = options.createdPageCount;
    this.pagesAddedToDesign = options.pagesAddedToDesign;
    this.skippedPageCount = options.skippedPageCount;
    this.failedPage = options.failedPage;
    this.createdPages = options.createdPages;
    this.records = options.records;
    this.font = options.font;
  }
}

/**
 * 글꼴을 바꾸면 해결될 수 있는 실패인가.
 *
 * 속도 제한, 권한, 지원하지 않는 디자인 유형은 글꼴과 무관하다. 이런 실패에서
 * 대체 글꼴 사다리를 타면 원인을 감추고 Wanted Sans를 엉뚱하게 포기하게 된다.
 */
function isFontRelatedFailure(failure: FailureClassification): boolean {
  return failure.category === "unknown" || failure.code === "bad_request";
}

function toTask(page: LaidOutPage, index: number): PageTask {
  return {
    index,
    manuscriptPageNumber: index + 1,
    pageType: page.pageType,
  };
}

function toCreatedRef(record: PageWriteRecord): CreatedPageRef {
  return {
    index: record.index,
    manuscriptPageNumber: record.manuscriptPageNumber,
    pageType: record.pageType,
    pageId: record.pageId,
  };
}

export async function createBook(
  spec: BookSpec,
  overrides: Partial<CreateBookDeps> = {},
  options: CreateBookOptions = {},
): Promise<CreateBookResult> {
  const deps: CreateBookDeps = { ...defaultDeps, ...overrides };
  validateBookSpec(spec);

  // 파싱 → 구조 페이지 삽입 → 분량 분할 → 번호 확정. 페이지 번호는 분할이
  // 끝난 뒤에만 존재하므로 한 원고 페이지가 여러 장이 되어도 번호가 어긋나지
  // 않는다.
  const plan = planBook(spec);

  // 순서도 페이지는 생성을 막지 않는다. 앱은 순서도를 그리지 않고 자리만 비워
  // 두며(`page-types/flowchart.ts`), 그 목록을 결과에 실어 사용자에게 알린다.

  // 글꼴 후보를 먼저 찾는다. 배치 자체는 글꼴과 무관하지만(크기와 폭은
  // TYPOGRAPHY가 고정한다) 요소를 만들려면 글꼴이 필요하다.
  const { candidates, report } = await deps.discoverFontCandidates();
  const firstCandidate = candidates[0];
  if (!firstCandidate) {
    throw new Error("적용할 글꼴 후보를 하나도 만들지 못했습니다.");
  }

  const layoutWith = (fonts: ResolvedBookFonts): LaidOutPage[] =>
    layoutBook(spec, plan.pages, fonts);

  // 분할 결과는 글꼴에 따라 달라지지 않으므로 페이지 수를 미리 확정할 수 있다.
  let laidOut = layoutWith(firstCandidate);

  const total = laidOut.length;
  const skipped = new Set(options.alreadyCreatedIndexes ?? []);
  const remainingIndexes = laidOut
    .map((_, index) => index)
    .filter((index) => !skipped.has(index));

  if (remainingIndexes.length === 0) {
    throw new Error(
      skipped.size > 0
        ? "이 원고의 모든 페이지가 이미 생성되어 있습니다. 새로 만들 페이지가 없습니다."
        : "생성할 페이지가 없습니다.",
    );
  }

  const records: PageWriteRecord[] = [];
  const createdPages: CreatedPageRef[] = [];
  let completed = skipped.size;

  const writer = new SequentialPageWriter({
    writePage: deps.writePage,
    getDesignPageCount: deps.getDesignPageCount,
    sleep: deps.sleep,
    random: deps.random,
    policy: deps.policy,
    onEvent: (event) => {
      const { record } = event;
      switch (event.type) {
        case "attempt":
          options.onProgress?.({
            type: "page-start",
            current: record.manuscriptPageNumber,
            total,
            completed,
            pageType: record.pageType,
            attempt: event.attempt,
          });
          break;
        case "retry-wait":
          options.onProgress?.({
            type: "retry-wait",
            current: record.manuscriptPageNumber,
            total,
            completed,
            delayMs: event.delayMs,
            attempt: record.retries,
            maxRetries: deps.policy.maxRetriesPerPage,
            failure: event.failure,
          });
          break;
        case "done":
          completed += 1;
          options.onProgress?.({
            type: "page-done",
            current: record.manuscriptPageNumber,
            total,
            completed,
          });
          break;
        default:
          break;
      }
    },
  });

  await writer.start();

  const [firstIndex, ...restIndexes] = remainingIndexes;
  if (firstIndex === undefined) {
    throw new Error("생성할 페이지가 없습니다.");
  }

  let font: FontApplicationOutcome | undefined;
  let blankFirstPage: BlankFirstPageReuse | undefined;


  /**
   * 생성을 멈춘다. 이미 만들어진 페이지는 숨기지 않고 그대로 보고한다.
   * 페이지가 남은 채 실패했다면 이어서 생성할 때 다시 만들지 않도록
   * 생성 목록에도 넣는다.
   */
  const failNow = (record: PageWriteRecord, message: string): never => {
    const allRecords = records.some((item) => item.index === record.index)
      ? [...records]
      : [...records, record];
    const created = [...createdPages];
    if (
      record.pageAdded &&
      !created.some((item) => item.index === record.index)
    ) {
      created.push(toCreatedRef(record));
    }
    throw new BookGenerationFailedError({
      totalPages: total,
      createdPageCount: allRecords.filter((item) => item.status === "done")
        .length,
      pagesAddedToDesign: allRecords.filter((item) => item.pageAdded).length,
      skippedPageCount: skipped.size,
      failedPage: record,
      createdPages: created,
      records: allRecords,
      font,
      message,
    });
  };

  // 글꼴은 조회 결과가 아니라 실제 생성 호출로 판정한다. 아직 만들지 않은 첫
  // 페이지를 실제로 만들어 보면서 Wanted Sans부터 순서대로 시도하고, 처음
  // 성공한 글꼴을 나머지 모든 페이지에 그대로 쓴다.
  let firstRecord: PageWriteRecord;
  try {
    const applied = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt: async (fonts) => {
        let prepared: PreparedPage;
        let task: PageTask;
        try {
          // 후보 글꼴로 책 전체를 다시 배치한다. 배치는 순수 계산이라 몇 번을
          // 해도 안전하고, 글자 크기는 후보와 무관하게 같다.
          laidOut = layoutWith(fonts);
          const page = laidOut[firstIndex];
          if (!page) {
            throw new Error("첫 페이지를 배치하지 못했습니다.");
          }
          task = toTask(page, firstIndex);
          prepared = preparePage(page, fonts, page.pageNumber);
        } catch (error) {
          // 요소 구성 실패는 글꼴 문제가 아니다. 대체 글꼴로 재시도하지 않는다.
          throw new NonFontFailure(error);
        }
        // 새 디자인은 빈 페이지 한 장으로 시작하고, addPage()는 그 뒤에만
        // 붙는다. 교재 첫 장을 처음부터 만드는 실행이면 그 빈 페이지에 먼저
        // 그려 넣어 본다. 쓸 수 없으면 디자인은 그대로이고, 아래의 예전 경로
        // (addPage)가 그대로 이어진다.
        if (firstIndex === 0 && skipped.size === 0) {
          blankFirstPage = await deps.fillBlankFirstPage(
            prepared,
            deps.getDesignPageCount,
          );
          if (blankFirstPage.reused) {
            options.onProgress?.({
              type: "page-start",
              current: task.manuscriptPageNumber,
              total,
              completed,
              pageType: task.pageType,
              attempt: 1,
            });
            completed += 1;
            options.onProgress?.({
              type: "page-done",
              current: task.manuscriptPageNumber,
              total,
              completed,
            });
            const reusedRecord: PageWriteRecord = {
              ...task,
              status: "done",
              attempts: 1,
              retries: 0,
              pageAdded: true,
              pageId: blankFirstPage.pageId,
            };
            return reusedRecord;
          }
        }
        try {
          return await writer.write(task, prepared);
        } catch (error) {
          if (error instanceof PageWriteFailedError) {
            const failure = error.record.failure;
            // 페이지가 이미 추가됐다면 다른 글꼴로 다시 만들 수 없다. 그렇게
            // 하면 같은 페이지가 두 번 생긴다.
            if (
              error.record.pageAdded ||
              !failure ||
              !isFontRelatedFailure(failure)
            ) {
              throw new NonFontFailure(error);
            }
            // 글꼴 사다리에는 Canva가 준 원래 오류를 그대로 넘긴다.
            // 실패 기록에 가공된 문장이 아니라 실제 메시지가 남아야 한다.
            throw error.cause ?? error;
          }
          throw error;
        }
      },
    });
    font = applied.outcome;
    firstRecord = applied.value;
  } catch (error) {
    if (error instanceof PageWriteFailedError) {
      return failNow(error.record, error.message);
    }
    throw error;
  }

  records.push(firstRecord);
  createdPages.push(toCreatedRef(firstRecord));

  // 확정된 글꼴 하나를 모든 페이지 유형이 공유한다. 페이지 유형마다 다른
  // 글꼴로 갈라지는 경로가 없어야 한다.
  for (const index of restIndexes) {
    const page = laidOut[index];
    if (!page) {
      throw new Error(`배치 결과에 ${index}번 페이지가 없습니다.`);
    }
    const task = toTask(page, index);
    let prepared: PreparedPage;
    try {
      prepared = preparePage(page, font.applied, page.pageNumber);
    } catch (error) {
      // 원고/레이아웃 문제다. 이미 만든 페이지는 그대로 두고 멈춘다.
      const record: PageWriteRecord = {
        ...task,
        status: "failed",
        attempts: 0,
        retries: 0,
        pageAdded: false,
        failure: {
          retryable: false,
          category: "manuscript",
          message: error instanceof Error ? error.message : String(error),
          summary: "원고 내용으로 페이지 요소를 구성하지 못했습니다.",
        },
      };
      return failNow(record, record.failure?.message ?? "페이지 구성 실패");
    }

    try {
      const record = await writer.write(task, prepared);
      records.push(record);
      createdPages.push(toCreatedRef(record));
    } catch (error) {
      if (error instanceof PageWriteFailedError) {
        return failNow(error.record, error.message);
      }
      throw error;
    }
  }

  options.onProgress?.({ type: "completed", total, completed });

  return {
    pageCount: total,
    createdPageCount: records.filter((record) => record.status === "done")
      .length,
    skippedPageCount: skipped.size,
    createdPages,
    records,
    font,
    pendingImages: collectPendingImages(laidOut),
    pendingFlowcharts: collectPendingFlowcharts(laidOut),
    ...(blankFirstPage ? { blankFirstPage } : {}),
  };
}
