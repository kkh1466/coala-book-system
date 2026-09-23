import type { BookProgressEvent } from "../src/builder/create-book";
import {
  BookGenerationFailedError,
  createBook,
} from "../src/builder/create-book";
import {
  buildFailureReport,
  describeProgress,
} from "../src/builder/generation-state";
import {
  ConcurrentPageWriteError,
  SequentialPageWriter,
} from "../src/builder/page-writer";
import { PAGE_CREATION_POLICY } from "../src/builder/retry-policy";
import { layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { installRecordingRichtext, wantedSansFonts } from "./helpers/richtext";
import {
  canvaError,
  createFakeCanva,
  notoSansKr,
  rateLimitError,
  twelvePageBook,
  wantedSans,
} from "./helpers/fake-canva";

/**
 * 12쪽 원고가 실제로 만드는 물리 페이지 수.
 *
 * 줄 간격 2(스킬 확정값)로 배치하면 분량이 많은 원고 페이지가 여러 장으로
 * 나뉜다. 이 파일은 순차 생성·재시도를 검증하는 곳이므로 페이지 수는
 * 배치 결과에서 읽고, 리터럴로 박지 않는다.
 */
let TOTAL = 0;
let ORDINALS: number[] = [];
let NUMBERS: number[] = [];

beforeAll(() => {
  // 배치는 richtext 대역이 설치된 뒤에만 돌릴 수 있다.
  installRecordingRichtext();
  const spec = twelvePageBook();
  TOTAL = layoutBook(spec, planBook(spec).pages, wantedSansFonts).length;
  ORDINALS = Array.from({ length: TOTAL }, (_, index) => index);
  NUMBERS = ORDINALS.map((index) => index + 1);
});

const collectProgress = () => {
  const events: BookProgressEvent[] = [];
  return {
    events,
    onProgress: (event: BookProgressEvent) => events.push(event),
  };
};

describe("한 번에 한 페이지씩 순차 생성", () => {
  it("12쪽 원고가 만드는 모든 물리 페이지를 원고 순서대로 하나씩 만든다", async () => {
    const canva = createFakeCanva();

    const result = await createBook(twelvePageBook(), canva.deps);

    expect(result.pageCount).toBe(TOTAL);
    expect(result.createdPageCount).toBe(TOTAL);
    expect(canva.writes).toHaveLength(TOTAL);
    expect(canva.writes.map((write) => write.ordinal)).toEqual(ORDINALS);
    // 각 페이지는 정확히 한 번씩만 만들어진다.
    expect(new Set(canva.createdKeys).size).toBe(TOTAL);
  });

  it("addPage 요청이 동시에 두 개 이상 실행되지 않는다", async () => {
    const canva = createFakeCanva();

    await createBook(twelvePageBook(), canva.deps);

    expect(canva.maxConcurrentWrites()).toBe(1);
  });

  it("페이지 추가 요청 사이에 최소 간격을 둔다", async () => {
    const canva = createFakeCanva();

    await createBook(twelvePageBook(), canva.deps);

    const gaps = canva.writes
      .slice(1)
      .map((write, index) => write.at - (canva.writes[index]?.at ?? 0));
    expect(gaps).toHaveLength(TOTAL - 1);
    gaps.forEach((gap) => {
      expect(gap).toBeGreaterThanOrEqual(PAGE_CREATION_POLICY.interPageDelayMs);
    });
  });

  it("이전 요청이 끝나기 전에 다음 요청을 보내면 즉시 막는다", async () => {
    let release: (() => void) | undefined;
    const writer = new SequentialPageWriter({
      writePage: () =>
        new Promise((resolve) => {
          release = () => resolve(undefined);
        }),
      sleep: async () => {},
    });
    const task = { index: 0, manuscriptPageNumber: 1, pageType: "concept" };
    const prepared = { title: "첫 페이지", key: "첫 페이지", elements: [] };

    const first = writer.write(task, prepared);
    await Promise.resolve();

    await expect(
      writer.write(
        { index: 1, manuscriptPageNumber: 2, pageType: "concept" },
        { title: "둘째 페이지", key: "둘째 페이지", elements: [] },
      ),
    ).rejects.toBeInstanceOf(ConcurrentPageWriteError);

    release?.();
    await first;
  });
});

describe("rate_limited 자동 재시도", () => {
  it("속도 제한을 맞은 페이지를 다시 시도해 결국 성공한다", async () => {
    const canva = createFakeCanva({
      failures: {
        2: [{ error: rateLimitError() }, { error: rateLimitError() }],
      },
    });
    const progress = collectProgress();

    const result = await createBook(twelvePageBook(), canva.deps, {
      onProgress: progress.onProgress,
    });

    expect(result.createdPageCount).toBe(TOTAL);
    // 3번째 페이지만 세 번 호출됐고, 나머지는 한 번씩이다.
    const attemptsByOrdinal = canva.writes.reduce<Record<number, number>>(
      (acc, write) => ({
        ...acc,
        [write.ordinal]: (acc[write.ordinal] ?? 0) + 1,
      }),
      {},
    );
    expect(attemptsByOrdinal[2]).toBe(3);
    expect(canva.writes).toHaveLength(TOTAL + 2);
    expect(result.records[2]?.retries).toBe(2);
    expect(result.records[2]?.attempts).toBe(3);

    const retryEvents = progress.events.filter(
      (event) => event.type === "retry-wait",
    );
    expect(retryEvents).toHaveLength(2);
    expect(retryEvents.map((event) => event.delayMs)).toEqual([1_000, 2_000]);
    const [firstRetry] = retryEvents;
    expect(firstRetry && describeProgress(firstRetry)).toBe(
      "Canva 요청 제한으로 1초 후 다시 시도합니다 (3페이지 · 재시도 1/5)",
    );
  });

  it("재시도 지연이 1초 → 2초 → 4초로 늘어난다", async () => {
    const canva = createFakeCanva({
      failures: {
        0: [
          { error: rateLimitError() },
          { error: rateLimitError() },
          { error: rateLimitError() },
        ],
      },
    });
    const progress = collectProgress();

    await createBook(twelvePageBook(), canva.deps, {
      onProgress: progress.onProgress,
    });

    const delays = progress.events
      .filter((event) => event.type === "retry-wait")
      .map((event) => event.delayMs);
    expect(delays).toEqual([1_000, 2_000, 4_000]);
  });

  it("재시도마다 무작위 지연을 더한다", async () => {
    const canva = createFakeCanva({
      failures: { 0: [{ error: rateLimitError() }] },
      random: () => 1,
    });
    const progress = collectProgress();

    await createBook(twelvePageBook(), canva.deps, {
      onProgress: progress.onProgress,
    });

    const [retry] = progress.events.filter(
      (event) => event.type === "retry-wait",
    );
    // 1초 + 지터 25%
    expect(retry?.type === "retry-wait" && retry.delayMs).toBe(1_250);
  });

  it("Canva가 재시도 시각을 알려 주면 그 값을 먼저 쓴다", async () => {
    const withRetryAfter = Object.assign(rateLimitError(), {
      retryAfterSeconds: 3,
    });
    const canva = createFakeCanva({
      failures: { 0: [{ error: withRetryAfter }] },
    });
    const progress = collectProgress();

    await createBook(twelvePageBook(), canva.deps, {
      onProgress: progress.onProgress,
    });

    const [retry] = progress.events.filter(
      (event) => event.type === "retry-wait",
    );
    expect(retry?.type === "retry-wait" && retry.delayMs).toBe(3_000);
  });

  it("재시도해도 앞에서 만든 페이지를 다시 만들지 않는다", async () => {
    const canva = createFakeCanva({
      failures: {
        3: [{ error: rateLimitError() }, { error: rateLimitError() }],
        7: [{ error: rateLimitError() }],
      },
    });

    const result = await createBook(twelvePageBook(), canva.deps);

    expect(result.createdPageCount).toBe(TOTAL);
    expect(canva.createdKeys).toHaveLength(TOTAL);
    expect(new Set(canva.createdKeys).size).toBe(TOTAL);
  });

  it("첫 페이지의 속도 제한을 글꼴 실패로 오해하지 않는다", async () => {
    // rate_limited는 글꼴과 무관하다. 여기서 대체 글꼴로 넘어가면 Wanted Sans를
    // 엉뚱하게 포기하게 된다.
    const canva = createFakeCanva({
      failures: { 0: [{ error: rateLimitError() }] },
      listedFonts: [wantedSans, notoSansKr],
    });

    const result = await createBook(twelvePageBook(), canva.deps);

    expect(result.font.usedWantedSans).toBe(true);
    expect(result.font.attempts).toEqual([]);
    // 재시도는 같은 요소를 다시 보낸다. 페이지마다 한 번씩만 구성된다.
    expect(canva.fontRefsUsed().filter(Boolean)).toEqual(
      Array(TOTAL).fill(wantedSans.ref),
    );
  });
});

describe("최대 재시도 횟수", () => {
  it("한도를 넘기면 무한 재시도하지 않고 정확히 멈춘다", async () => {
    const canva = createFakeCanva({
      policy: { maxRetriesPerPage: 3 },
      failures: {
        2: Array.from({ length: 10 }, () => ({ error: rateLimitError() })),
      },
    });

    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(BookGenerationFailedError);
    const failure = error as BookGenerationFailedError;
    expect(failure.totalPages).toBe(TOTAL);
    expect(failure.createdPageCount).toBe(2);
    expect(failure.failedPage.manuscriptPageNumber).toBe(3);
    expect(failure.failedPage.pageType).toBe("concept");
    expect(failure.failedPage.retries).toBe(3);
    expect(failure.failedPage.status).toBe("failed");
    expect(failure.failedPage.pageAdded).toBe(false);
    expect(failure.failedPage.failure?.code).toBe("rate_limited");
    expect(failure.failedPage.failure?.message).toContain(
      "Add page rate limit exceeded.",
    );
    // 최초 1회 + 재시도 3회 = 4회. 그 뒤로는 호출하지 않는다.
    expect(canva.writes.filter((write) => write.ordinal === 2)).toHaveLength(4);
    expect(canva.writes.filter((write) => write.ordinal > 2)).toHaveLength(0);
  });

  it("실패 보고에 필요한 모든 항목을 담는다", async () => {
    const canva = createFakeCanva({
      policy: { maxRetriesPerPage: 2 },
      failures: {
        1: Array.from({ length: 5 }, () => ({ error: rateLimitError() })),
      },
    });

    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );
    const report = buildFailureReport(error);

    expect(report.kind).toBe("generation");
    expect(report.progressNote).toBe(
      `전체 ${TOTAL}페이지 중 1페이지까지 생성됐습니다. 이미 만들어진 페이지는 Canva에 그대로 남아 있습니다.`,
    );
    const values = Object.fromEntries(
      report.lines.map((line) => [line.label, line.value]),
    );
    expect(values["전체 페이지 수"]).toBe(`${TOTAL}페이지`);
    expect(values["정상 생성된 페이지 수"]).toBe("1페이지");
    expect(values["실패한 원고 페이지 번호"]).toBe("2번째 페이지");
    expect(values["실패한 페이지 유형"]).toBe("concept");
    expect(values["재시도 횟수"]).toBe("2회");
    expect(values["Canva 오류 코드"]).toBe("rate_limited");
    expect(values["Canva 오류 메시지"]).toContain(
      "Add page rate limit exceeded.",
    );
  });
});

describe("재시도할 오류와 즉시 멈출 오류", () => {
  it("권한 오류는 재시도하지 않고 즉시 멈춘다", async () => {
    const canva = createFakeCanva({
      failures: {
        1: Array.from({ length: 5 }, () => ({
          error: canvaError(
            "permission_denied",
            "Missing content write scope.",
          ),
        })),
      },
    });

    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );

    const failure = error as BookGenerationFailedError;
    expect(failure.failedPage.retries).toBe(0);
    expect(failure.failedPage.attempts).toBe(1);
    expect(failure.failedPage.failure?.code).toBe("permission_denied");
    expect(canva.writes.filter((write) => write.ordinal === 1)).toHaveLength(1);
  });

  it("지원하지 않는 디자인 유형도 즉시 멈춘다", async () => {
    const canva = createFakeCanva({
      failures: {
        0: [
          {
            error: canvaError(
              "unsupported_page_type",
              "Adding pages is not supported on this page type.",
            ),
          },
        ],
      },
    });

    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );

    const failure = error as BookGenerationFailedError;
    expect(failure.failedPage.failure?.code).toBe("unsupported_page_type");
    expect(failure.createdPageCount).toBe(0);
    expect(canva.writes).toHaveLength(1);
  });

  it("일시적인 서버 오류는 제한된 횟수만 재시도한다", async () => {
    const canva = createFakeCanva({
      failures: {
        0: [{ error: canvaError("internal_error", "Server error.") }],
      },
    });

    const result = await createBook(twelvePageBook(), canva.deps);

    expect(result.createdPageCount).toBe(TOTAL);
    expect(result.records[0]?.retries).toBe(1);
  });

  it("원고 검증 오류는 Canva 호출 없이 원고 오류로 구분된다", async () => {
    const canva = createFakeCanva();
    const spec = twelvePageBook();
    // 자동 목차는 아직 지원하지 않는 원고 설정이다.
    const invalid = { ...spec, toc: "auto" as const };

    const error = await createBook(invalid, canva.deps).catch(
      (thrown: unknown) => thrown,
    );
    const report = buildFailureReport(error);

    expect(canva.writes).toHaveLength(0);
    expect(report.kind).toBe("manuscript");
    expect(report.lines[0]?.value).toContain("자동 목차");
  });
});

describe("중복 페이지 방지", () => {
  it("요청은 실패했지만 페이지가 남았다면 다시 만들지 않는다", async () => {
    const canva = createFakeCanva({
      baselinePages: 3,
      failures: {
        1: [
          { error: canvaError("internal_error", "Server error."), lands: true },
        ],
      },
    });

    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );

    const failure = error as BookGenerationFailedError;
    expect(failure.failedPage.pageAdded).toBe(true);
    expect(failure.failedPage.retries).toBe(0);
    expect(failure.pagesAddedToDesign).toBe(2);
    expect(failure.createdPageCount).toBe(1);
    // 같은 페이지로 addPage()를 다시 보내지 않았다.
    expect(canva.writes.filter((write) => write.ordinal === 1)).toHaveLength(1);
    expect(new Set(canva.createdTitles).size).toBe(canva.createdTitles.length);
    expect(failure.failedPage.failure?.summary).toContain("중복을 막기 위해");
  });

  it("페이지가 남았는지 확인할 수 없으면 속도 제한만 재시도한다", async () => {
    const canva = createFakeCanva({
      pageCountUnavailable: true,
      failures: {
        1: [{ error: canvaError("timeout", "Request timed out.") }],
      },
    });

    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );

    const failure = error as BookGenerationFailedError;
    expect(failure.failedPage.retries).toBe(0);
    expect(failure.failedPage.failure?.summary).toContain(
      "중복 생성을 막기 위해",
    );
    expect(canva.writes.filter((write) => write.ordinal === 1)).toHaveLength(1);
  });

  it("이어서 생성하면 이미 만든 페이지를 건너뛴다", async () => {
    const firstRun = createFakeCanva({
      policy: { maxRetriesPerPage: 1 },
      failures: {
        4: [{ error: rateLimitError() }, { error: rateLimitError() }],
      },
    });

    const error = await createBook(twelvePageBook(), firstRun.deps).catch(
      (thrown: unknown) => thrown,
    );
    const failure = error as BookGenerationFailedError;
    const createdIndexes = failure.createdPages.map((page) => page.index);
    expect(createdIndexes).toEqual([0, 1, 2, 3]);

    const secondRun = createFakeCanva();
    const result = await createBook(twelvePageBook(), secondRun.deps, {
      alreadyCreatedIndexes: createdIndexes,
    });

    expect(result.skippedPageCount).toBe(4);
    expect(result.createdPageCount).toBe(TOTAL - 4);
    expect(secondRun.writes.map((write) => write.ordinal)).toEqual(
      ORDINALS.slice(0, TOTAL - 4),
    );
    // 두 실행에서 만들어진 페이지가 겹치지 않는다.
    const allKeys = [...firstRun.createdKeys, ...secondRun.createdKeys];
    expect(new Set(allKeys).size).toBe(TOTAL);
  });

  it("이미 만든 페이지의 id를 기록해 둔다", async () => {
    const canva = createFakeCanva();

    const result = await createBook(twelvePageBook(), canva.deps);

    expect(result.createdPages).toHaveLength(TOTAL);
    expect(result.createdPages[0]?.pageId).toBe("page-1");
    expect(result.createdPages[TOTAL - 1]?.pageId).toBe(`page-${TOTAL}`);
  });
});

describe("진행 상황 표시", () => {
  it("페이지마다 진행 문구가 정확히 갱신된다", async () => {
    const canva = createFakeCanva();
    const progress = collectProgress();

    await createBook(twelvePageBook(), canva.deps, {
      onProgress: progress.onProgress,
    });

    const messages = progress.events.map(describeProgress);
    expect(messages[0]).toBe(`전체 ${TOTAL}페이지 중 1페이지 생성 중`);
    expect(messages).toContain(`전체 ${TOTAL}페이지 중 4페이지 생성 중`);
    expect(messages).toContain(
      `전체 ${TOTAL}페이지 중 ${TOTAL}페이지 생성 완료`,
    );
    expect(messages[messages.length - 1]).toBe(
      `${TOTAL}개 Canva 페이지를 생성했습니다.`,
    );

    const starts = progress.events.filter(
      (event) => event.type === "page-start",
    );
    expect(starts.map((event) => event.current)).toEqual(NUMBERS);
    const dones = progress.events.filter((event) => event.type === "page-done");
    expect(dones.map((event) => event.completed)).toEqual(NUMBERS);
  });

  it("이어서 생성할 때도 완료 수를 이미 만든 페이지부터 센다", async () => {
    const canva = createFakeCanva();
    const progress = collectProgress();

    await createBook(twelvePageBook(), canva.deps, {
      alreadyCreatedIndexes: [0, 1, 2],
      onProgress: progress.onProgress,
    });

    const dones = progress.events.filter((event) => event.type === "page-done");
    expect(dones[0]?.completed).toBe(4);
    expect(dones[dones.length - 1]?.completed).toBe(TOTAL);
  });
});
