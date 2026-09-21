import type { ImageDirective } from "./image-directive";
import {
  isImageDirectiveLine,
  tryParseImageDirective,
} from "./image-directive";
import type { InlineSegment } from "./inline";
import { parseInline } from "./inline";

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
  | { kind: "image"; image: ImageDirective };

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
 */
export function parseBlocks(markdown: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;

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

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    if (HEADING.test(line)) {
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

/** 블록이 하나도 없는가. */
export function isEmptyContent(markdown: string): boolean {
  return parseBlocks(markdown).length === 0;
}
