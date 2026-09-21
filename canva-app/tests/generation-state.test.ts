import type { PageId } from "@canva/design";
import {
  bookFingerprint,
  describeCreatedPageCheck,
  buildFailureReport,
  decideRerun,
  describeCompletion,
  describeProgress,
  isGenerateDisabled,
} from "../src/builder/generation-state";
import { createFakeCanva, fivePageBook, rateLimitError, twelvePageBook } from "./helpers/fake-canva";
import { createBook } from "../src/builder/create-book";

describe("생성 버튼 활성화", () => {
  const base = { canAddPage: true, hasBookSpec: true } as const;

  it("생성 중에는 다시 누를 수 없다", () => {
    expect(isGenerateDisabled({ ...base, phase: "generating" })).toBe(true);
  });

  it("원고를 읽는 중에도 누를 수 없다", () => {
    expect(isGenerateDisabled({ ...base, phase: "reading" })).toBe(true);
  });

  it("원고가 준비되면 누를 수 있다", () => {
    expect(isGenerateDisabled({ ...base, phase: "idle" })).toBe(false);
    expect(isGenerateDisabled({ ...base, phase: "done" })).toBe(false);
    expect(isGenerateDisabled({ ...base, phase: "failed" })).toBe(false);
  });

  it("원고가 없거나 페이지 추가를 지원하지 않으면 누를 수 없다", () => {
    expect(
      isGenerateDisabled({ canAddPage: true, hasBookSpec: false, phase: "idle" }),
    ).toBe(true);
    expect(
      isGenerateDisabled({ canAddPage: false, hasBookSpec: true, phase: "idle" }),
    ).toBe(true);
  });
});

describe("진행 문구", () => {
  it("생성 중 페이지 번호를 보여 준다", () => {
    expect(
      describeProgress({
        type: "page-start",
        current: 4,
        total: 12,
        completed: 3,
        pageType: "concept",
        attempt: 1,
      }),
    ).toBe("전체 12페이지 중 4페이지 생성 중");
  });

  it("속도 제한 대기를 초 단위로 알려 준다", () => {
    expect(
      describeProgress({
        type: "retry-wait",
        current: 4,
        total: 12,
        completed: 3,
        delayMs: 2_000,
        attempt: 2,
        maxRetries: 5,
        failure: {
          retryable: true,
          category: "rate-limit",
          code: "rate_limited",
          message: "Add page rate limit exceeded.",
          summary: "요청 속도 제한",
        },
      }),
    ).toBe("Canva 요청 제한으로 2초 후 다시 시도합니다 (4페이지 · 재시도 2/5)");
  });

  it("일시적 서버 오류의 대기는 속도 제한과 다르게 표시한다", () => {
    expect(
      describeProgress({
        type: "retry-wait",
        current: 1,
        total: 12,
        completed: 0,
        delayMs: 1_000,
        attempt: 1,
        maxRetries: 5,
        failure: {
          retryable: true,
          category: "transient",
          code: "internal_error",
          message: "Server error.",
          summary: "Canva 내부 오류",
        },
      }),
    ).toBe("Canva 일시 오류로 1초 후 다시 시도합니다 (1페이지 · 재시도 1/5)");
  });

  it("완료 문구는 만들어진 페이지 수를 그대로 말한다", () => {
    expect(
      describeProgress({ type: "completed", total: 12, completed: 12 }),
    ).toBe("12개 Canva 페이지를 생성했습니다.");
    expect(
      describeCompletion({
        pageCount: 12,
        createdPageCount: 12,
        skippedPageCount: 0,
      }),
    ).toBe("12개 Canva 페이지를 생성했습니다.");
  });

  it("이어서 생성했다면 건너뛴 페이지를 숨기지 않는다", () => {
    expect(
      describeCompletion({
        pageCount: 12,
        createdPageCount: 8,
        skippedPageCount: 4,
      }),
    ).toBe(
      "8개 Canva 페이지를 이어서 생성했습니다. 이전 실행에서 만든 4페이지를 합쳐 전체 12페이지가 준비됐습니다.",
    );
  });
});

describe("실패 보고 구분", () => {
  it("원고 검증 오류와 Canva 생성 오류를 다르게 분류한다", async () => {
    const manuscript = buildFailureReport(
      new Error("페이지 'p1'의 내용이 현재 템플릿 용량을 초과합니다."),
    );
    expect(manuscript.kind).toBe("manuscript");

    const canva = createFakeCanva({
      policy: { maxRetriesPerPage: 1 },
      failures: {
        0: [{ error: rateLimitError() }, { error: rateLimitError() }],
      },
    });
    const error = await createBook(twelvePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );
    const report = buildFailureReport(error);
    expect(report.kind).toBe("generation");
    expect(report.lines.some((line) => line.value === "rate_limited")).toBe(true);
  });

  it("한 페이지도 못 만들었을 때도 몇 페이지까지 만들었는지 정확히 말한다", async () => {
    const canva = createFakeCanva({
      policy: { maxRetriesPerPage: 0 },
      failures: { 0: [{ error: rateLimitError() }] },
    });
    const error = await createBook(fivePageBook(), canva.deps).catch(
      (thrown: unknown) => thrown,
    );
    const report = buildFailureReport(error);
    expect(report.progressNote).toContain("전체 5페이지 중 0페이지까지");
  });
});

describe("같은 원고로 다시 눌렀을 때", () => {
  const fingerprint = bookFingerprint(fivePageBook());

  it("같은 원고는 같은 지문을, 다른 원고는 다른 지문을 가진다", () => {
    expect(bookFingerprint(fivePageBook())).toBe(fingerprint);
    expect(bookFingerprint(twelvePageBook())).not.toBe(fingerprint);
  });

  it("처음 실행이거나 원고가 바뀌었으면 그대로 생성한다", () => {
    expect(decideRerun(undefined, fingerprint)).toEqual({ kind: "start-fresh" });
    expect(
      decideRerun(
        {
          fingerprint: "다른-원고",
          totalPages: 5,
          createdIndexes: [0, 1],
          createdPageIds: [],
        },
        fingerprint,
      ),
    ).toEqual({ kind: "start-fresh" });
  });

  it("일부만 만들어졌으면 이어서 만들지 되묻는다", () => {
    const decision = decideRerun(
      { fingerprint, totalPages: 5, createdIndexes: [0, 1, 2], createdPageIds: [] },
      fingerprint,
    );
    expect(decision.kind).toBe("confirm-resume");
    expect(decision.kind === "confirm-resume" && decision.remainingCount).toBe(2);
    expect(decision.kind === "confirm-resume" && decision.message).toContain(
      "3페이지까지 생성됐습니다",
    );
  });

  it("이미 전부 만들어졌으면 중복 경고를 띄운다", () => {
    const decision = decideRerun(
      {
        fingerprint,
        totalPages: 5,
        createdIndexes: [0, 1, 2, 3, 4],
        createdPageIds: [],
      },
      fingerprint,
    );
    expect(decision.kind).toBe("confirm-duplicate");
    expect(decision.kind === "confirm-duplicate" && decision.message).toContain(
      "한 번 더 추가됩니다",
    );
  });
});

describe("이전에 만든 페이지 확인", () => {
  it("모두 남아 있으면 따로 안내하지 않는다", () => {
    expect(describeCreatedPageCheck({ checked: true, missing: [] })).toBeUndefined();
  });

  it("사라진 페이지가 있으면 그대로 알린다", () => {
    expect(
      describeCreatedPageCheck({
        checked: true,
        missing: ["page-2" as PageId, "page-3" as PageId],
      }),
    ).toContain("2페이지가 현재 디자인에 없습니다");
  });

  it("확인할 수 없으면 확인할 수 없다고 말한다", () => {
    expect(describeCreatedPageCheck({ checked: false, missing: [] })).toContain(
      "확인할 수 없었습니다",
    );
  });
});
