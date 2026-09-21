import {
  PAGE_CREATION_POLICY,
  computeRetryDelayMs,
  extractRetryAfterMs,
} from "../src/builder/retry-policy";

describe("재시도 지연 계산", () => {
  const noJitter = () => 0;

  it("지수 백오프로 1초 → 2초 → 4초 → 8초로 늘어난다", () => {
    const delays = [1, 2, 3, 4].map((attempt) =>
      computeRetryDelayMs({ attempt, random: noJitter }),
    );
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it("최대 지연 시간을 넘지 않는다", () => {
    const delay = computeRetryDelayMs({ attempt: 12, random: noJitter });
    expect(delay).toBe(PAGE_CREATION_POLICY.retryMaxDelayMs);
  });

  it("무작위 지연은 0 이상 지터 비율 이하로만 더한다", () => {
    const base = 1_000;
    const lowest = computeRetryDelayMs({ attempt: 1, random: () => 0 });
    const highest = computeRetryDelayMs({ attempt: 1, random: () => 1 });
    expect(lowest).toBe(base);
    expect(highest).toBe(base * (1 + PAGE_CREATION_POLICY.retryJitterRatio));
    const mid = computeRetryDelayMs({ attempt: 1, random: () => 0.5 });
    expect(mid).toBeGreaterThan(lowest);
    expect(mid).toBeLessThan(highest);
  });

  it("Canva가 알려 준 대기 시간을 지수 백오프보다 먼저 쓴다", () => {
    const delay = computeRetryDelayMs({
      attempt: 1,
      retryAfterMs: 7_500,
      random: noJitter,
    });
    expect(delay).toBe(7_500);
  });

  it("알려 준 대기 시간이 비정상적으로 커도 상한에서 멈춘다", () => {
    const delay = computeRetryDelayMs({
      attempt: 1,
      retryAfterMs: 10 * 60 * 1_000,
      random: noJitter,
    });
    expect(delay).toBe(PAGE_CREATION_POLICY.maxHonoredRetryAfterMs);
  });
});

describe("재시도 가능 시각 추출", () => {
  it("설치된 CanvaError에는 Retry-After 필드가 없으므로 기본값으로 떨어진다", () => {
    const error = Object.assign(new Error("[rate_limited]: too fast"), {
      code: "rate_limited",
    });
    expect(extractRetryAfterMs(error)).toBeUndefined();
  });

  it("밀리초 필드가 실려 오면 그대로 읽는다", () => {
    expect(
      extractRetryAfterMs(Object.assign(new Error("x"), { retryAfterMs: 2_500 })),
    ).toBe(2_500);
  });

  it("초 단위 필드는 밀리초로 바꾼다", () => {
    expect(
      extractRetryAfterMs(Object.assign(new Error("x"), { retryAfter: 3 })),
    ).toBe(3_000);
    expect(
      extractRetryAfterMs(
        Object.assign(new Error("x"), { retryAfterSeconds: "1.5" }),
      ),
    ).toBe(1_500);
  });

  it("메시지에 적힌 재시도 시각도 읽는다", () => {
    expect(extractRetryAfterMs(new Error("Retry after 4 seconds"))).toBe(4_000);
    expect(extractRetryAfterMs(new Error("retry-after: 250ms"))).toBe(250);
  });

  it("값이 없으면 undefined를 돌려준다", () => {
    expect(extractRetryAfterMs(new Error("Add page rate limit exceeded."))).toBeUndefined();
    expect(extractRetryAfterMs(undefined)).toBeUndefined();
  });
});

describe("정책 상수", () => {
  it("요청 간격과 재시도 한도가 조정 가능한 상수로 분리되어 있다", () => {
    expect(PAGE_CREATION_POLICY.interPageDelayMs).toBeGreaterThan(0);
    expect(PAGE_CREATION_POLICY.maxRetriesPerPage).toBeGreaterThan(0);
    expect(PAGE_CREATION_POLICY.maxRetriesPerPage).toBeLessThan(10);
    expect(PAGE_CREATION_POLICY.retryBackoffFactor).toBe(2);
  });
});
