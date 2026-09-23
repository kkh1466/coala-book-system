import { isImageDirectiveLine } from "./image-directive";

/**
 * 코드 블록과 실행 결과의 짝.
 *
 * 교재에 코드만 있고 실행 결과가 빠지는 일을 막기 위해, 일반 코드 블록은 바로
 * 뒤에 실행 결과를 **정확히 하나** 가져야 한다. 텍스트 결과는 ```` ```output ````
 * 블록, GUI 결과는 `role="result"` 이미지 자리다. 코드와 결과 사이에는 빈 줄만
 * 올 수 있다.
 *
 * 이 파일은 그 짝을 찾는 **유일한** 논리다. 블록 파서(`blocks.ts`), 원고 검사
 * (`manuscript-lint.ts`), BookSpec 검증(`book-spec.ts`)이 모두 여기를 부르므로
 * 세 곳이 서로 다른 답을 낼 수 없다.
 */

/** GUI 실행 결과 자리 위에 놓이는 영구 라벨. 텍스트 결과 구분선 아래 라벨과 같다. */
export const RESULT_LABEL = "실행 결과";

const FENCE_START = /^```\s*([A-Za-z0-9_+#.-]*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;

/** 코드 상자가 아니라 다른 뜻을 가진 펜스 이름. */
const SPECIAL_FENCES: ReadonlySet<string> = new Set([
  "prompt",
  "response",
  "flowchart",
  "output",
  "flow",
]);

export function fenceLanguage(line: string): string | undefined {
  const match = line.trim().match(FENCE_START);
  return match ? (match[1] ?? "").toLowerCase() : undefined;
}

export function isOutputFenceLine(line: string): boolean {
  return fenceLanguage(line) === "output";
}

/** 일반 코드 펜스(대화·순서도·결과가 아닌 것)의 시작 줄인가. */
export function isCodeFenceLine(line: string): boolean {
  const language = fenceLanguage(line);
  return language !== undefined && !SPECIAL_FENCES.has(language);
}

/** `role="result"`가 붙은 이미지 지시문 줄인가. */
export function isResultImageLine(line: string): boolean {
  return (
    isImageDirectiveLine(line.trim()) && /\brole\s*=\s*"result"/.test(line)
  );
}

/** `from`부터 짝이 되는 닫는 펜스 줄. 없으면 -1. */
export function findFenceClose(lines: readonly string[], from: number): number {
  for (let index = from; index < lines.length; index += 1) {
    if (FENCE_CLOSE.test((lines[index] ?? "").trim())) {
      return index;
    }
  }
  return -1;
}

export type CodeResultScan =
  | {
      kind: "output";
      /** ```output 줄. */
      line: number;
      /** 닫는 ``` 줄. 없으면 -1. */
      close: number;
      /** 펜스 안의 줄. 앞뒤 빈 줄은 뺀다. */
      inner: string[];
    }
  | { kind: "image"; line: number };

export type ResultLookup = {
  /** 코드 바로 뒤(빈 줄만 사이에 두고) 이어진 결과들. 하나여야 정상이다. */
  results: CodeResultScan[];
  /** 결과를 모두 지나간 다음 줄. 결과가 없으면 `from`. */
  next: number;
  /**
   * 바로 뒤에는 결과가 없지만, 다른 내용을 사이에 두고 뒤에 결과가 있을 때
   * 그 사이 내용의 첫 줄과 그 결과. "빈 줄만 허용" 규칙을 안내하기 위한 것이다.
   */
  intervening?: { line: number; result: CodeResultScan };
};

function scanOne(
  lines: readonly string[],
  index: number,
): CodeResultScan | undefined {
  const line = lines[index] ?? "";
  if (isOutputFenceLine(line)) {
    const close = findFenceClose(lines, index + 1);
    const inner = lines.slice(index + 1, close < 0 ? lines.length : close);
    return { kind: "output", line: index, close, inner: trimBlank(inner) };
  }
  if (isResultImageLine(line)) {
    return { kind: "image", line: index };
  }
  return undefined;
}

function trimBlank(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start] ?? "").trim().length === 0) {
    start += 1;
  }
  while (end > start && (lines[end - 1] ?? "").trim().length === 0) {
    end -= 1;
  }
  return lines.slice(start, end).map((line) => line.replace(/\s+$/, ""));
}

/**
 * 코드 블록의 닫는 줄 다음(`from`)부터 실행 결과를 찾는다.
 *
 * 빈 줄만 건너뛰고, 결과가 연달아 있으면 모두 모은다(둘 이상이면 호출부가
 * 거절한다). 결과가 바로 없으면 다음 코드 펜스 전까지 뒤늦은 결과가 있는지
 * 살펴 `intervening`으로 알린다.
 */
export function scanResultsAfter(
  lines: readonly string[],
  from: number,
): ResultLookup {
  const results: CodeResultScan[] = [];
  let index = from;
  for (;;) {
    while (index < lines.length && (lines[index] ?? "").trim().length === 0) {
      index += 1;
    }
    const found = index < lines.length ? scanOne(lines, index) : undefined;
    if (!found) {
      break;
    }
    results.push(found);
    index =
      found.kind === "output"
        ? found.close < 0
          ? lines.length
          : found.close + 1
        : found.line + 1;
  }
  if (results.length > 0) {
    return { results, next: index };
  }

  // 바로 뒤에는 없다. 다른 내용 뒤에 결과가 오는지 본다.
  let firstContent: number | undefined;
  for (let at = from; at < lines.length; at += 1) {
    const line = lines[at] ?? "";
    if (line.trim().length === 0) {
      continue;
    }
    const late = scanOne(lines, at);
    if (late && firstContent !== undefined) {
      return {
        results,
        next: from,
        intervening: { line: firstContent, result: late },
      };
    }
    if (isCodeFenceLine(line) || fenceLanguage(line) !== undefined) {
      break;
    }
    firstContent ??= at;
  }
  return { results, next: from };
}

export type CodeResultProblem = { line: number; message: string };

const OUTPUT_FORBIDDEN =
  /^\s*(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|```|~~~|::image\{)/;

/**
 * 줄 목록에서 코드·결과 짝의 문제를 모두 찾는다. 인덱스는 `lines` 기준이다.
 *
 * 페이지 종류에 따른 허용 여부는 보지 않는다. 그것은 원고 검사가 맡는다.
 */
export function findCodeResultProblems(
  lines: readonly string[],
): CodeResultProblem[] {
  const problems: CodeResultProblem[] = [];
  const consumed = new Set<number>();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const language = fenceLanguage(line);

    if (language !== undefined && SPECIAL_FENCES.has(language)) {
      if (language === "output" && !consumed.has(index)) {
        problems.push({
          line: index,
          message: "output 블록 앞에는 실행할 코드 블록이 있어야 합니다.",
        });
      }
      const close = findFenceClose(lines, index + 1);
      index = close < 0 ? lines.length : close + 1;
      continue;
    }

    if (language !== undefined) {
      const close = findFenceClose(lines, index + 1);
      if (close < 0) {
        // 닫히지 않은 펜스는 원고 검사가 따로 거절한다.
        break;
      }
      const lookup = scanResultsAfter(lines, close + 1);
      const [first, ...extra] = lookup.results;
      if (!first) {
        if (lookup.intervening) {
          problems.push({
            line: lookup.intervening.line,
            message:
              "코드 블록과 실행 결과 사이에는 다른 내용을 둘 수 없습니다. 빈 줄만 두고 바로 이어서 작성해 주세요.",
          });
          consumed.add(lookup.intervening.result.line);
        } else {
          problems.push({
            line: index,
            message:
              '코드 블록 뒤에 실행 결과가 없습니다. 텍스트 결과는 output 블록으로, GUI 결과는 role="result" 이미지로 작성해 주세요.',
          });
        }
        index = close + 1;
        continue;
      }
      if (first.kind === "output") {
        if (first.close < 0) {
          problems.push({
            line: first.line,
            message: "output 블록을 닫는 ``` 줄이 없습니다.",
          });
        } else if (first.inner.length === 0) {
          problems.push({
            line: first.line,
            message:
              "output 블록이 비어 있습니다. 실행 결과를 적거나 블록을 지워 주세요.",
          });
        } else {
          const bad = first.inner.findIndex((inner) =>
            OUTPUT_FORBIDDEN.test(inner),
          );
          if (bad >= 0) {
            problems.push({
              line: first.line + 1 + bad,
              message:
                "output 블록 안에는 실행 결과 글만 적을 수 있습니다. 제목·목록·이미지 지시문·펜스는 쓸 수 없습니다.",
            });
          }
        }
      }
      for (const result of extra) {
        problems.push({
          line: result.line,
          message:
            "하나의 코드 블록에는 실행 결과를 하나만 작성할 수 있습니다.",
        });
      }
      index = lookup.next;
      continue;
    }

    if (isResultImageLine(line) && !consumed.has(index)) {
      problems.push({
        line: index,
        message: "GUI 실행 결과 이미지는 코드 블록 바로 뒤에 작성해 주세요.",
      });
    }
    index += 1;
  }
  return problems.sort((a, b) => a.line - b.line);
}
