import type { ImageDirective } from "./image-directive";
import {
  isImageDirectiveLine,
  tryParseImageDirective,
} from "./image-directive";
import type { InlineSegment } from "./inline";
import { parseInline } from "./inline";
import { findFenceClose, scanResultsAfter } from "./code-result";

/**
 * 원고의 Markdown 구조를 그대로 담은 블록.
 *
 * 이전 구현은 `paragraphText()`가 모든 줄을 공백으로 이어 붙여 하나의 긴
 * 문자열로 만들었다. 빈 줄도 목록도 사라져서 Canva에는 줄글 한 덩어리만
 * 남았다. 여기서는 빈 줄을 문단 경계로, `- `/`1. `를 목록으로 보존한다.
 */
export type ContentBlock =
  | { kind: "paragraph"; segments: InlineSegment[] }
  | {
      kind: "list";
      ordered: boolean;
      items: InlineSegment[][];
    }
  /** 이미지 자리표시자. 자리만 비워 두고 이미지는 나중에 Canva에서 넣는다. */
  | { kind: "image"; image: ImageDirective }
  /** 사용자가 AI에게 보낸 프롬프트. 줄바꿈이 보존된 평문이다. */
  | { kind: "prompt"; text: string }
  /**
   * AI의 응답. 문단과 목록을 담은 Markdown 원문이다. 렌더러가 `parseBlocks`로
   * 다시 읽는다. 원고 검사가 프롬프트 바로 다음에만 오도록 보장한다.
   */
  | { kind: "response"; markdown: string }
  /**
   * 코드. 줄과 들여쓰기가 그대로 보존된 평문이다. `language`는 펜스에 적은
   * 이름(소문자)이고, 적지 않았으면 빈 문자열이다. `result`는 바로 뒤에 붙은
   * 실행 결과다. 원고 검사가 정확히 하나를 보장하므로 없는 경우는 검사를 거치지
   * 않은 원고뿐이다.
   */
  | { kind: "code"; language: string; code: string; result?: CodeResult };

/** 코드 블록의 실행 결과. 텍스트 출력이거나 GUI 화면 자리다. */
export type CodeResult =
  | { kind: "text"; text: string }
  | { kind: "image"; image: ImageDirective };

/** `prompt`·`response` 코드 블록의 시작 줄. 그 밖의 펜스는 본문으로 남는다. */
/**
 * 코드 펜스의 시작 줄. `prompt`·`response`는 대화 상자, 그 밖의 이름(또는
 * 이름 없음)은 코드 상자가 된다. `flowchart`는 flowchart 페이지 파서가 먼저
 * 걷어 가므로 여기에 오지 않는다.
 */
const FENCE = /^```\s*([A-Za-z0-9_+#.-]*)\s*$/;

const UNORDERED = /^\s*[-*+]\s+(?!\[[ xX]\])(.+)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.+)$/;
const CHECKBOX = /^\s*[-*+]\s*\[[ xX]\]\s+(.+)$/;
const HEADING = /^\s*#{1,6}\s+/;

/**
 * 구조를 보존한 Markdown 본문을 블록 목록으로 바꾼다.
 *
 * 규칙:
 * - 빈 줄은 문단을 끊는다.
 * - 이어진 `- ` 줄은 하나의 순서 없는 목록이 된다.
 * - 이어진 `1. ` 줄은 하나의 순서 있는 목록이 된다.
 * - 목록이 아닌 줄이 이어지면 한 문단으로 합친다(Markdown의 soft break).
 * - 제목 줄(`#`)은 상위에서 따로 처리하므로 여기서는 무시한다.
 * - `::image{...}` 한 줄은 이미지 자리표시자 블록이 된다. 형식 검증은
 *   `markdown-book.ts`가 Canva 쓰기 전에 끝내므로 여기서는 던지지 않는다.
 * - ```` ```prompt ````·```` ```response ```` 블록은 닫는 ```` ``` ```` 줄까지가
 *   한 블록이다. 짝과 위치의 검증도 원고 검사가 맡는다.
 */
export function parseBlocks(markdown: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;
  const lines = markdown.split("\n");

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push({
      kind: "paragraph",
      segments: parseInline(paragraph.join(" ")),
    });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    if (HEADING.test(line)) {
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const language = (fence[1] ?? "").toLowerCase();
      const close = findFenceClose(lines, index + 1);
      let end = close < 0 ? lines.length : close;
      const innerLines = lines.slice(index + 1, end);
      flushParagraph();
      flushList();
      if (language === "prompt") {
        blocks.push({ kind: "prompt", text: innerLines.join("\n").trim() });
      } else if (language === "response") {
        blocks.push({
          kind: "response",
          markdown: innerLines.join("\n").trim(),
        });
      } else if (language === "output") {
        // 앞선 코드가 소비하지 못한 output. 원고 검사가 거절하므로 버린다.
      } else {
        // 코드는 앞뒤 빈 줄만 걷어 내고 들여쓰기는 그대로 둔다. 실행 결과는
        // 원고 검사와 같은 논리(`scanResultsAfter`)로 바로 뒤에서 찾는다.
        const block: Extract<ContentBlock, { kind: "code" }> = {
          kind: "code",
          language,
          code: trimBlankLines(innerLines).join("\n"),
        };
        if (close >= 0) {
          const lookup = scanResultsAfter(lines, close + 1);
          const [first] = lookup.results;
          if (first?.kind === "output") {
            block.result = { kind: "text", text: first.inner.join("\n") };
          } else if (first?.kind === "image") {
            const image = tryParseImageDirective(
              (lines[first.line] ?? "").trim(),
            );
            if (image) {
              block.result = { kind: "image", image };
            }
          }
          if (lookup.results.length > 0) {
            // 결과(들)를 소비한다. 둘 이상은 원고 검사가 거절한다.
            end = lookup.next - 1;
          }
        }
        blocks.push(block);
      }
      index = end;
      continue;
    }

    if (isImageDirectiveLine(line)) {
      const image = tryParseImageDirective(line);
      if (image) {
        flushParagraph();
        flushList();
        blocks.push({ kind: "image", image });
        continue;
      }
    }

    const checkbox = line.match(CHECKBOX);
    if (checkbox?.[1]) {
      // 체크리스트는 전용 렌더러가 따로 그린다. 본문 흐름에는 넣지 않는다.
      continue;
    }

    const unordered = line.match(UNORDERED);
    if (unordered?.[1]) {
      flushParagraph();
      if (list && list.ordered) {
        flushList();
      }
      list ??= { ordered: false, items: [] };
      list.items.push(unordered[1].trim());
      continue;
    }

    const ordered = line.match(ORDERED);
    if (ordered?.[2]) {
      flushParagraph();
      if (list && !list.ordered) {
        flushList();
      }
      list ??= { ordered: true, items: [] };
      list.items.push(ordered[2].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** 앞뒤의 빈 줄을 걷어 낸다. 줄 안의 공백(들여쓰기)은 건드리지 않는다. */
function trimBlankLines(lines: readonly string[]): string[] {
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

/** 블록이 하나도 없는가. */
export function isEmptyContent(markdown: string): boolean {
  return parseBlocks(markdown).length === 0;
}
