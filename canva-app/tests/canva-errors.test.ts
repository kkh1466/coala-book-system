import { BookSpecValidationError } from "../src/types/book-spec";
import { PageContentTooDenseError } from "../src/page-types/shared";
import {
  classifyFailure,
  extractCanvaErrorCode,
  formatFailure,
  isManuscriptError,
} from "../src/builder/canva-errors";
import { canvaError, rateLimitError } from "./helpers/fake-canva";

describe("재시도할 오류와 즉시 멈출 오류 구분", () => {
  it.each(["rate_limited", "internal_error", "timeout"] as const)(
    "%s는 재시도한다",
    (code) => {
      expect(classifyFailure(canvaError(code, "temporary")).retryable).toBe(true);
    },
  );

  it.each([
    "permission_denied",
    "missing_permission",
    "not_allowed",
    "unsupported_surface",
    "unsupported_page_type",
    "bad_request",
    "quota_exceeded",
    "user_offline",
  ] as const)("%s는 재시도하지 않는다", (code) => {
    expect(classifyFailure(canvaError(code, "fatal")).retryable).toBe(false);
  });

  it("속도 제한은 rate-limit 범주로 분류한다", () => {
    const failure = classifyFailure(rateLimitError());
    expect(failure.category).toBe("rate-limit");
    expect(failure.code).toBe("rate_limited");
    expect(failure.summary).toContain("요청 속도 제한");
  });

  it("권한과 미지원 디자인 유형을 각각 구분한다", () => {
    expect(classifyFailure(canvaError("permission_denied", "x")).category).toBe(
      "permission",
    );
    expect(
      classifyFailure(canvaError("unsupported_page_type", "x")).category,
    ).toBe("unsupported");
  });

  it("원고 검증 오류는 Canva 오류와 다르게 분류한다", () => {
    const failure = classifyFailure(
      new BookSpecValidationError("pages must not be empty."),
    );
    expect(failure.category).toBe("manuscript");
    expect(failure.retryable).toBe(false);
    expect(failure.code).toBeUndefined();
    expect(isManuscriptError(new PageContentTooDenseError("p1", "줄여 주세요."))).toBe(
      true,
    );
    expect(isManuscriptError(rateLimitError())).toBe(false);
  });
});

describe("원래 코드와 메시지 보존", () => {
  it("한국어 설명과 함께 Canva 원문을 남긴다", () => {
    const failure = classifyFailure(rateLimitError());
    expect(failure.message).toContain(
      "Encountered an error while adding page: Add page rate limit exceeded.",
    );
    expect(formatFailure(failure)).toContain("[rate_limited]");
    expect(formatFailure(failure)).toContain("Add page rate limit exceeded.");
  });

  it("code 필드가 없어도 메시지에 적힌 코드를 읽는다", () => {
    const wrapped = new Error(
      "[rate_limited]: Encountered an error while adding page: Add page rate limit exceeded.",
    );
    expect(extractCanvaErrorCode(wrapped)).toBe("rate_limited");
    expect(classifyFailure(wrapped).retryable).toBe(true);
  });

  it("알 수 없는 오류는 재시도하지 않는다", () => {
    const failure = classifyFailure(new Error("무언가 잘못됐습니다."));
    expect(failure.category).toBe("unknown");
    expect(failure.retryable).toBe(false);
    expect(failure.message).toBe("무언가 잘못됐습니다.");
  });
});
