import type { ErrorCode } from "@canva/error";
import { BookSpecValidationError } from "../types/book-spec";
import { PageContentTooDenseError } from "../page-types/shared";
import { FlowchartLibraryAssetUnavailableError } from "../page-types/flowchart";

/**
 * Canva가 돌려준 오류를 "다시 시도할 가치가 있는 오류"와 "즉시 멈춰야 하는
 * 오류"로 가른다.
 *
 * 분류 기준은 설치된 `@canva/error` 2.2.1의 `ErrorCode` 타입 정의다. 존재하지
 * 않는 코드를 지어내지 않는다. 사용자에게는 한국어 설명을 보여 주되, 원래
 * 코드와 메시지는 디버깅을 위해 그대로 보존한다.
 */

export type FailureCategory =
  /** 속도 제한. 기다렸다가 다시 시도하면 대개 성공한다. */
  | "rate-limit"
  /** 일시적인 서버/네트워크 오류. 제한된 횟수만 재시도한다. */
  | "transient"
  /** 권한 문제. 재시도해도 달라지지 않는다. */
  | "permission"
  /** 지원하지 않는 디자인/페이지 유형. 재시도해도 달라지지 않는다. */
  | "unsupported"
  /** 원고(입력) 문제. Canva 호출 이전 단계에서 걸러진 오류다. */
  | "manuscript"
  /** 위 어디에도 들어가지 않는 오류. 안전하게 즉시 중단한다. */
  | "unknown";

export type FailureClassification = {
  /** 제한된 횟수로 자동 재시도해도 되는가. */
  retryable: boolean;
  category: FailureCategory;
  /** Canva API가 돌려준 실제 오류 코드. 없으면 undefined. */
  code?: ErrorCode;
  /** Canva API가 돌려준 실제 오류 메시지(가공하지 않은 원문). */
  message: string;
  /** 사용자에게 보여 줄 한국어 설명. */
  summary: string;
};

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  "bad_external_service_response",
  "bad_request",
  "failed_precondition",
  "internal_error",
  "not_found",
  "not_allowed",
  "permission_denied",
  "missing_permission",
  "quota_exceeded",
  "rate_limited",
  "timeout",
  "unsupported_surface",
  "unsupported_page_type",
  "user_offline",
]);

/**
 * 오류에서 Canva 오류 코드를 꺼낸다.
 *
 * `CanvaError`는 `code` 필드를 가지고 있다. 테스트/페이크 환경이나 중간에서
 * 한 번 감싸인 오류처럼 필드가 사라진 경우를 대비해 `[rate_limited]: ...`
 * 형태의 메시지도 함께 살핀다.
 */
export function extractCanvaErrorCode(error: unknown): ErrorCode | undefined {
  if (typeof error === "object" && error != null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && ERROR_CODES.has(code)) {
      return code as ErrorCode;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      const match = /\[([a-z_]+)\]/.exec(message);
      if (match && ERROR_CODES.has(match[1] as string)) {
        return match[1] as ErrorCode;
      }
    }
  }
  return undefined;
}

export function describeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

const SUMMARIES: Record<ErrorCode, string> = {
  rate_limited:
    "Canva가 짧은 시간에 들어온 페이지 추가 요청을 제한했습니다(요청 속도 제한).",
  internal_error: "Canva 내부 오류로 페이지 추가가 실패했습니다.",
  timeout: "Canva 응답이 제한 시간 안에 오지 않았습니다.",
  bad_external_service_response:
    "Canva가 외부 서비스에서 비정상 응답을 받았습니다.",
  quota_exceeded: "Canva 사용량 한도를 초과했습니다.",
  bad_request: "Canva가 페이지 추가 요청을 거부했습니다(요청 내용 오류).",
  failed_precondition: "페이지를 추가할 수 있는 조건이 갖춰지지 않았습니다.",
  not_found: "Canva가 대상 리소스를 찾지 못했습니다.",
  not_allowed: "이 앱은 해당 작업을 수행할 수 없습니다.",
  permission_denied:
    "앱 권한이 승인되지 않아 페이지를 추가할 수 없습니다(디자인 콘텐츠 쓰기 권한).",
  missing_permission:
    "앱 설정에 필요한 권한이 선언되어 있지 않아 페이지를 추가할 수 없습니다.",
  unsupported_surface:
    "현재 디자인 유형에서는 페이지 추가를 지원하지 않습니다.",
  unsupported_page_type:
    "현재 페이지 유형에서는 페이지 추가를 지원하지 않습니다.",
  user_offline: "네트워크 연결이 끊겨 Canva에 요청을 보내지 못했습니다.",
};

/**
 * 재시도해도 되는 코드.
 *
 * - `rate_limited`: 속도 제한. 기다리면 풀린다.
 * - `internal_error`, `timeout`: 일시적인 서버 오류.
 *
 * `quota_exceeded`(한도 소진)나 `user_offline`(연결 끊김)은 몇 초 기다린다고
 * 해결되지 않으므로 재시도하지 않고 원인을 그대로 알린다.
 */
const RETRYABLE_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "rate_limited",
  "internal_error",
  "timeout",
]);

const CATEGORY_BY_CODE: Partial<Record<ErrorCode, FailureCategory>> = {
  rate_limited: "rate-limit",
  internal_error: "transient",
  timeout: "transient",
  permission_denied: "permission",
  missing_permission: "permission",
  not_allowed: "permission",
  unsupported_surface: "unsupported",
  unsupported_page_type: "unsupported",
};

/** 원고(입력) 단계의 오류인가. Canva 호출 실패와 구분해서 보여 준다. */
export function isManuscriptError(error: unknown): boolean {
  return (
    error instanceof BookSpecValidationError ||
    error instanceof PageContentTooDenseError ||
    error instanceof FlowchartLibraryAssetUnavailableError
  );
}

export function classifyFailure(error: unknown): FailureClassification {
  const message = describeErrorMessage(error);
  const code = extractCanvaErrorCode(error);

  if (code) {
    return {
      retryable: RETRYABLE_CODES.has(code),
      category: CATEGORY_BY_CODE[code] ?? "unknown",
      code,
      message,
      summary: SUMMARIES[code],
    };
  }

  if (isManuscriptError(error)) {
    return {
      retryable: false,
      category: "manuscript",
      message,
      summary: "원고 내용이 현재 템플릿 규칙을 만족하지 않습니다.",
    };
  }

  return {
    retryable: false,
    category: "unknown",
    message,
    summary: "Canva 페이지 생성 중 알 수 없는 오류가 발생했습니다.",
  };
}

/** 화면과 로그에 함께 쓰는 한 줄 표기. 원래 코드와 메시지를 모두 남긴다. */
export function formatFailure(failure: FailureClassification): string {
  const code = failure.code ? `[${failure.code}] ` : "";
  return `${failure.summary} (Canva 오류: ${code}${failure.message})`;
}
