import type { PageId, PageMetadata } from "@canva/design";
import type { FailureClassification } from "./canva-errors";
import { classifyFailure } from "./canva-errors";
import type { PageCreationPolicy } from "./retry-policy";
import {
  PAGE_CREATION_POLICY,
  computeRetryDelayMs,
  extractRetryAfterMs,
  sleep as defaultSleep,
} from "./retry-policy";
import type { PreparedPage } from "./create-page";

/**
 * 페이지를 **한 번에 하나씩** Canva에 쓴다.
 *
 * 규칙은 세 가지다.
 * 1. addPage() 요청은 절대 겹치지 않는다. 앞 요청이 끝나야 다음 요청을 보낸다.
 * 2. 요청 사이에는 항상 간격을 둔다(`interPageDelayMs`).
 * 3. 속도 제한과 일시적 서버 오류만 지수 백오프로 재시도하고, 그 밖의 오류는
 *    즉시 멈춘다.
 *
 * 그리고 무엇보다, **이미 추가된 페이지를 다시 보내지 않는다.** 요청이
 * 실패해도 페이지가 실제로 만들어졌을 수 있으므로, 재시도 전에 디자인의 페이지
 * 수로 그 사실을 확인한다.
 */

/** 페이지 하나가 거치는 상태. */
export type PageWriteStatus =
  /** 대기 */
  | "pending"
  /** 페이지 추가 중 */
  | "adding"
  /** 페이지 추가 완료 */
  | "added"
  /** 요소 배치 중 */
  | "placing"
  /** 생성 완료 */
  | "done"
  /** 재시도 대기 */
  | "retry-wait"
  /** 최종 실패 */
  | "failed";

export type PageTask = {
  /** 생성 계획 안에서의 순서(0부터). */
  index: number;
  /** 사용자에게 보여 줄 원고 페이지 번호(1부터). */
  manuscriptPageNumber: number;
  /** chapter-opening, concept 같은 페이지 유형. */
  pageType: string;
};

export type PageWriteRecord = PageTask & {
  status: PageWriteStatus;
  /** 이 페이지에 대해 보낸 addPage() 호출 횟수(최초 시도 포함). */
  attempts: number;
  /** 재시도 횟수(최초 시도 제외). */
  retries: number;
  /** Canva가 돌려준 페이지 id. surface가 제공하지 않으면 undefined. */
  pageId?: PageId;
  /** Canva에 페이지가 실제로 추가됐는가. 재시도 중복 판단의 근거. */
  pageAdded: boolean;
  failure?: FailureClassification;
};

export type PageWriteEvent =
  | { type: "attempt"; record: PageWriteRecord; attempt: number }
  | { type: "added"; record: PageWriteRecord }
  | { type: "done"; record: PageWriteRecord }
  | {
      type: "retry-wait";
      record: PageWriteRecord;
      delayMs: number;
      failure: FailureClassification;
    }
  | { type: "failed"; record: PageWriteRecord };

/** 한 페이지의 생성이 최종 실패했을 때 던진다. 상태 기록을 그대로 싣는다. */
export class PageWriteFailedError extends Error {
  readonly record: PageWriteRecord;
  /** Canva가 던진 원래 오류. 가공 없이 보존한다. */
  readonly cause: unknown;

  constructor(record: PageWriteRecord, cause?: unknown) {
    const failure = record.failure;
    super(
      failure
        ? `${failure.summary} (Canva 오류: ${
            failure.code ? `[${failure.code}] ` : ""
          }${failure.message})`
        : "페이지를 생성하지 못했습니다.",
    );
    this.name = "PageWriteFailedError";
    this.record = record;
    this.cause = cause;
  }
}

/** 호출부가 순차 처리를 어겼을 때 던진다. 동시 실행은 버그이지 재시도 대상이 아니다. */
export class ConcurrentPageWriteError extends Error {
  constructor() {
    super(
      "이전 addPage() 요청이 끝나기 전에 다음 페이지 생성이 시작됐습니다. 페이지는 한 번에 하나씩만 추가해야 합니다.",
    );
    this.name = "ConcurrentPageWriteError";
  }
}

/**
 * addPage()로 페이지를 실제로 보내는 함수. 테스트에서 갈아끼운다.
 *
 * 돌려주는 PageMetadata는 "페이지가 실제로 추가됐다"는 증거다. 메타데이터를
 * 돌려주지 않는 구현(테스트용 이중체 등)은 undefined를 돌려주면 된다.
 */
export type WritePageFn = (
  page: PreparedPage,
) => Promise<PageMetadata | undefined>;

export type SequentialPageWriterDeps = {
  writePage: WritePageFn;
  /** 현재 디자인의 페이지 수. 실패한 요청이 페이지를 남겼는지 확인하는 데 쓴다. */
  getDesignPageCount?: () => Promise<number | undefined>;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  policy?: PageCreationPolicy;
  onEvent?: (event: PageWriteEvent) => void;
};

export class SequentialPageWriter {
  private readonly deps: SequentialPageWriterDeps;
  private readonly policy: PageCreationPolicy;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private inFlight = false;
  private requestsSent = 0;
  /** 지금까지 앱이 만든 페이지까지 반영한 예상 페이지 수. 모르면 undefined. */
  private expectedPageCount: number | undefined;

  constructor(deps: SequentialPageWriterDeps) {
    this.deps = deps;
    this.policy = deps.policy ?? PAGE_CREATION_POLICY;
    this.sleep = deps.sleep ?? defaultSleep;
    this.random = deps.random ?? Math.random;
  }

  /** 생성 시작 전 기준 페이지 수를 읽어 둔다. 실패해도 생성을 막지 않는다. */
  async start(): Promise<void> {
    this.expectedPageCount = await this.readPageCount();
  }

  /** 지금까지 보낸 addPage() 호출 수. 진단용. */
  get sentRequestCount(): number {
    return this.requestsSent;
  }

  async write(task: PageTask, prepared: PreparedPage): Promise<PageWriteRecord> {
    if (this.inFlight) {
      throw new ConcurrentPageWriteError();
    }

    const record: PageWriteRecord = {
      ...task,
      status: "pending",
      attempts: 0,
      retries: 0,
      pageAdded: false,
    };

    for (;;) {
      // 첫 요청이 아니라면 요청 사이 간격을 둔다. 재시도 지연은 아래에서 이미
      // 기다렸으므로 여기서 또 기다리지 않는다.
      if (record.attempts === 0 && this.requestsSent > 0) {
        await this.sleep(this.policy.interPageDelayMs);
      }

      record.status = "adding";
      record.attempts += 1;
      this.requestsSent += 1;
      this.emit({ type: "attempt", record: { ...record }, attempt: record.attempts });

      let metadata: PageMetadata | undefined;
      this.inFlight = true;
      try {
        metadata = await this.deps.writePage(prepared);
      } catch (error) {
        const failure = classifyFailure(error);
        const landed = await this.didPageLand();

        if (landed === true) {
          // 요청은 실패했지만 페이지는 남았다. 다시 보내면 중복이 된다.
          record.pageAdded = true;
          return this.fail(
            record,
            {
              ...failure,
              summary: `${failure.summary} 요청은 실패했지만 Canva에는 페이지가 추가된 상태여서, 중복을 막기 위해 이 페이지를 다시 만들지 않았습니다.`,
            },
            error,
          );
        }

        if (!failure.retryable) {
          return this.fail(record, failure, error);
        }

        if (failure.category !== "rate-limit" && landed === undefined) {
          // 속도 제한은 요청이 거부된 것이라 페이지가 남지 않는다. 그 밖의
          // 일시적 오류는 페이지가 남았는지 확인하지 못하면 재시도가 중복을
          // 만들 수 있으므로 멈춘다.
          return this.fail(
            record,
            {
              ...failure,
              summary: `${failure.summary} 페이지가 실제로 추가됐는지 확인할 수 없어, 중복 생성을 막기 위해 재시도하지 않고 중단했습니다.`,
            },
            error,
          );
        }

        if (record.retries >= this.policy.maxRetriesPerPage) {
          return this.fail(record, failure, error);
        }

        record.retries += 1;
        const delayMs = computeRetryDelayMs({
          attempt: record.retries,
          retryAfterMs: extractRetryAfterMs(error),
          policy: this.policy,
          random: this.random,
        });
        record.status = "retry-wait";
        record.failure = failure;
        this.emit({
          type: "retry-wait",
          record: { ...record },
          delayMs,
          failure,
        });
        await this.sleep(delayMs);
        continue;
      } finally {
        this.inFlight = false;
      }

      // 여기부터는 페이지가 실제로 추가된 뒤다. 무슨 일이 있어도 이 페이지에
      // 대해 addPage()를 다시 보내지 않는다.
      record.pageAdded = true;
      record.failure = undefined;
      record.status = "added";
      if (this.expectedPageCount !== undefined) {
        this.expectedPageCount += 1;
      }
      if (metadata && metadata.type === "absolute") {
        record.pageId = metadata.id;
      }
      this.emit({ type: "added", record: { ...record } });

      record.status = "placing";
      const placementFailure = verifyPlacement(metadata);
      if (placementFailure) {
        return this.fail(record, placementFailure);
      }

      record.status = "done";
      this.emit({ type: "done", record: { ...record } });
      return { ...record };
    }
  }

  private fail(
    record: PageWriteRecord,
    failure: FailureClassification,
    cause?: unknown,
  ): never {
    record.status = "failed";
    record.failure = failure;
    this.emit({ type: "failed", record: { ...record } });
    throw new PageWriteFailedError({ ...record }, cause);
  }

  private emit(event: PageWriteEvent): void {
    this.deps.onEvent?.(event);
  }

  private async readPageCount(): Promise<number | undefined> {
    if (!this.deps.getDesignPageCount) {
      return undefined;
    }
    try {
      return await this.deps.getDesignPageCount();
    } catch {
      return undefined;
    }
  }

  /**
   * 실패한 요청이 페이지를 남겼는지 확인한다.
   *
   * true = 남았다(재시도 금지), false = 남지 않았다(재시도 가능),
   * undefined = 확인할 수 없다.
   */
  private async didPageLand(): Promise<boolean | undefined> {
    if (this.expectedPageCount === undefined) {
      return undefined;
    }
    const actual = await this.readPageCount();
    if (actual === undefined) {
      return undefined;
    }
    if (actual > this.expectedPageCount) {
      this.expectedPageCount = actual;
      return true;
    }
    return false;
  }
}

/**
 * 요소 배치 확인.
 *
 * 설치된 @canva/design 2.13.0에서 페이지 추가와 요소 배치는 `addPage()` 한 번의
 * 호출로 함께 일어난다. 요소만 따로 실패시키거나 따로 재시도하는 공개 API는
 * 없다. 따라서 이 단계는 "돌려받은 페이지 메타데이터가 우리가 그린 절대 좌표
 * 레이아웃을 담을 수 있는 페이지인가"를 확인한다.
 */
function verifyPlacement(
  metadata: PageMetadata | undefined,
): FailureClassification | undefined {
  if (!metadata) {
    // 메타데이터를 돌려주지 않는 주입 구현(테스트 등). 확인할 것이 없다.
    return undefined;
  }
  if (metadata.type !== "absolute") {
    return {
      retryable: false,
      category: "unsupported",
      message: `addPage()가 '${metadata.type}' 페이지 메타데이터를 돌려줬습니다.`,
      summary:
        "페이지는 추가됐지만 이 디자인 유형은 고정 크기 페이지가 아니어서 교재 레이아웃을 배치할 수 없습니다. 고정 크기 디자인에서 다시 실행해 주세요.",
    };
  }
  return undefined;
}
