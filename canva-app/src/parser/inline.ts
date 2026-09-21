/**
 * 문장 안의 `**강조**` 표기를 구간으로 나눈다.
 *
 * 문장 전체가 아니라 `** **` 안의 구절만 강조해야 하므로, 한 텍스트 요소
 * 안에서 일부 구간만 다른 서식을 갖는 형태로 표현한다. `@canva/design`
 * 2.13.0의 `RichtextRange.formatText(bounds, InlineFormatting)`이 정확히 그
 * 기능이며, `InlineFormatting`에는 `fontSize`가 없다. 따라서 강조를 입혀도
 * 글자 크기는 문단 서식(28pt)이 그대로 유지된다.
 */
export type InlineSegment = {
  text: string;
  /** `**...**` 안에 있던 구간인가. */
  emphasis: boolean;
};

const EMPHASIS = /\*\*([\s\S]+?)\*\*/g;

/**
 * `**강조**`를 구간으로 나눈다.
 *
 * 짝이 맞지 않는 `**`는 강조가 아니라 표기 실수다. 독자에게 별표가 그대로
 * 보이면 안 되므로 남은 `**`는 제거한다.
 */
export function parseInline(raw: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;
  EMPHASIS.lastIndex = 0;

  for (
    let match = EMPHASIS.exec(raw);
    match != null;
    match = EMPHASIS.exec(raw)
  ) {
    const body = match[1];
    if (body === undefined) {
      continue;
    }
    if (match.index > cursor) {
      push(segments, raw.slice(cursor, match.index), false);
    }
    push(segments, body, true);
    cursor = match.index + match[0].length;
  }
  if (cursor < raw.length) {
    push(segments, raw.slice(cursor), false);
  }
  if (segments.length === 0) {
    return [{ text: stripMarkers(raw), emphasis: false }];
  }
  return segments;
}

function push(
  segments: InlineSegment[],
  text: string,
  emphasis: boolean,
): void {
  const cleaned = stripMarkers(text);
  if (cleaned.length === 0) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last && last.emphasis === emphasis) {
    last.text += cleaned;
    return;
  }
  segments.push({ text: cleaned, emphasis });
}

/** 짝이 맞지 않아 남은 강조 기호를 지운다. */
function stripMarkers(text: string): string {
  return text.replace(/\*\*/g, "");
}

/** 구간을 다시 평문으로 합친다. 줄 수를 셀 때 쓴다. */
export function plainText(segments: readonly InlineSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}

/** 강조 구간이 하나라도 있는가. */
export function hasEmphasis(segments: readonly InlineSegment[]): boolean {
  return segments.some((segment) => segment.emphasis);
}
