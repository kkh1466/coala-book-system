/**
 * 페이지 추가 요청의 속도 제한(rate limit) 대응 정책.
 *
 * Canva Apps SDK의 `addPage()`는 짧은 시간에 여러 번 호출하면
 * `[rate_limited]: Add page rate limit exceeded.` 오류를 돌려준다. 이 파일은
 * "요청을 얼마나 천천히 보낼지"와 "몇 번까지 다시 시도할지"를 한곳에 모아
 * 둔다. 수치 조정은 이 상수만 고치면 된다.
 */

export type PageCreationPolicy = {
  interPageDelayMs: number;
  retryBaseDelayMs: number;
  retryBackoffFactor: number;
  retryMaxDelayMs: number;
  maxRetriesPerPage: number;
  retryJitterRatio: number;
  maxHonoredRetryAfterMs: number;
};

export const PAGE_CREATION_POLICY: PageCreationPolicy = {
  /**
   * 페이지 추가 요청 사이의 기본 간격(ms).
   *
   * Canva는 addPage()의 정확한 허용 속도를 공개하지 않는다. 12페이지 원고가
   * 한 번에 통과하는 것을 기준으로 잡은 보수적인 기본값이며, 재시도가 잦다면
   * 이 값을 먼저 올린다.
   */
  interPageDelayMs: 1_200,

  /** 1차 재시도까지 기다리는 시간(ms). 이후 backoffFactor배로 늘어난다. */
  retryBaseDelayMs: 1_000,

  /** 지수 백오프 배수. 1초 → 2초 → 4초 → 8초 … */
  retryBackoffFactor: 2,

  /** 지수 백오프의 상한(ms). 이 값을 넘게 기다리지 않는다. */
  retryMaxDelayMs: 16_000,

  /**
   * 페이지 하나당 최대 재시도 횟수(최초 시도는 포함하지 않는다).
   * 이 횟수를 넘기면 무한 재시도 대신 실패로 확정하고 진행 상황을 보고한다.
   */
  maxRetriesPerPage: 5,

  /**
   * 재시도 지연에 더하는 무작위 비율(0 이상 이 값 이하). 여러 재시도가 정확히
   * 같은 시점에 몰리지 않게 한다. 0.25면 계산된 지연의 0~25%를 더한다.
   */
  retryJitterRatio: 0.25,

  /**
   * Canva가 알려 준 재시도 대기 시간을 그대로 따르는 상한(ms).
   * 비정상적으로 큰 값이 와도 앱이 무한정 멈추지 않게 한다.
   */
  maxHonoredRetryAfterMs: 60_000,
};

/**
 * 오류에 담긴 "이만큼 뒤에 다시 시도하라"는 값을 ms로 꺼낸다.
 *
 * 설치된 `@canva/error` 2.2.1의 `CanvaError`는 `code`와 `message`만 선언한다.
 * 즉 Retry-After에 해당하는 **타입이 보장된 필드는 없다.** 그래서 이 함수는
 * 추측한 API를 호출하지 않고, 런타임 객체에 그런 값이 실제로 실려 오는
 * 경우에만 방어적으로 읽는다. 없으면 undefined를 돌려주고 호출부는 지수
 * 백오프 기본값을 쓴다.
 */
export function extractRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error == null) {
    return undefined;
  }
  const candidate = error as Record<string, unknown>;

  const asMilliseconds = [candidate.retryAfterMs, candidate.retry_after_ms];
  for (const value of asMilliseconds) {
    const parsed = toPositiveNumber(value);
    if (parsed !== undefined) {
      return clampRetryAfter(parsed);
    }
  }

  const asSeconds = [
    candidate.retryAfter,
    candidate.retryAfterSeconds,
    candidate.retry_after,
    candidate.retry_after_seconds,
  ];
  for (const value of asSeconds) {
    const parsed = toPositiveNumber(value);
    if (parsed !== undefined) {
      return clampRetryAfter(parsed * 1_000);
    }
  }

  const message = typeof candidate.message === "string" ? candidate.message : "";
  const match = /retry[-\s_]?after\D{0,12}?(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?)?/i.exec(
    message,
  );
  if (match) {
    const amount = Number(match[1]);
    if (Number.isFinite(amount) && amount > 0) {
      const unit = (match[2] ?? "s").toLowerCase();
      const isMilliseconds = unit === "ms" || unit.startsWith("milli");
      return clampRetryAfter(isMilliseconds ? amount : amount * 1_000);
    }
  }

  return undefined;
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function clampRetryAfter(milliseconds: number): number {
  return Math.min(
    Math.round(milliseconds),
    PAGE_CREATION_POLICY.maxHonoredRetryAfterMs,
  );
}

/**
 * 다음 재시도까지 기다릴 시간.
 *
 * - Canva가 알려 준 대기 시간이 있으면 그 값을 우선 쓴다.
 * - 없으면 1초 → 2초 → 4초 … 지수 백오프를 쓰고 상한에서 멈춘다.
 * - 어느 경우든 약간의 무작위 지연을 더해 재시도 시점이 겹치지 않게 한다.
 *
 * @param attempt 1부터 세는 재시도 번호(1차 재시도가 1).
 */
export function computeRetryDelayMs(options: {
  attempt: number;
  retryAfterMs?: number;
  policy?: PageCreationPolicy;
  random?: () => number;
}): number {
  const policy = options.policy ?? PAGE_CREATION_POLICY;
  const random = options.random ?? Math.random;
  const attempt = Math.max(1, Math.floor(options.attempt));

  const base =
    options.retryAfterMs !== undefined
      ? Math.min(options.retryAfterMs, policy.maxHonoredRetryAfterMs)
      : Math.min(
          policy.retryBaseDelayMs *
            policy.retryBackoffFactor ** (attempt - 1),
          policy.retryMaxDelayMs,
        );

  const jitter = base * policy.retryJitterRatio * clampUnit(random());
  return Math.round(base + jitter);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

/** 테스트에서 갈아끼울 수 있도록 분리한 대기 함수. */
export function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
