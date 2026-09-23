/**
 * 텍스트가 실제로 차지하는 높이를 추정한다.
 *
 * Canva는 richtext 요소의 높이를 알려주지 않는다(`RichtextElementAtPoint`는
 * width만 받고 높이는 편집기가 계산한다). 그래서 "다음 요소는 이전 요소가
 * 끝난 자리에서 시작한다"를 구현하려면 우리 쪽에서 줄 수를 세야 한다.
 *
 * 정확한 글꼴 메트릭은 앱에서 읽을 수 없으므로, 글자 종류별 평균 폭(em)으로
 * 추정한다. 한글 폭은 원본 PNG의 실제 글줄에서 역산한 값(0.83em)에 약간의
 * 여유를 더해 쓰고, 라틴 문자는 보수적으로 넓게 잡아 **실제보다 줄 수를 적게
 * 세는 일이 없도록** 한다. 과소 추정은
 * 글자가 지면을 넘게 만들지만 과대 추정은 여백이 조금 넓어질 뿐이다.
 */

import { toCanvaFontSize } from "../theme/typography";

/**
 * 이 파일의 `fontSize` 인자는 모두 **편집기 pt**다(TYPOGRAPHY 값 그대로).
 * 내부에서 `toCanvaFontSize()`로 px로 바꿔 잰다. 호출부가 단위를 신경 쓰지
 * 않게 하려는 것이며, SDK에 넘기는 값과 같은 변환을 거친다.
 */

/** 전각으로 취급할 문자(한글, 한자, 가나, 전각 기호). */
const FULL_WIDTH = /[ᄀ-ᇿ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** 좁은 구두점. */
const NARROW_PUNCTUATION = /[.,;:!?'’‘"“”()[\]{}/\\|]/;

/**
 * 글자 하나의 가로 폭(글자 크기에 대한 비율).
 *
 * 이모지는 전각 한 칸으로 센다. 서로게이트 쌍은 `Array.from`으로 나눠
 * 들어오므로 길이가 1보다 긴 코드포인트도 한 칸으로 계산된다.
 */
export function advanceEm(character: string): number {
  if (character === " " || character === "\t") {
    return 0.32;
  }
  if (character.length > 1) {
    // 서로게이트 쌍(이모지 등).
    return 1;
  }
  if (FULL_WIDTH.test(character)) {
    // 한글은 정사각 한 칸(1em)을 다 쓰지 않지만, 잉크 폭만 재면 글자 좌우
    // 여백(side bearing)이 빠져 너무 작게 나온다. 원본 PNG의 잉크 폭은 0.83em,
    // 실제로 생성한 표에서 한 줄에 들어간 글자 수로 역산한 **전진 폭**은 약
    // 0.93em이었다(Wanted Sans 28pt). 1em은 줄 수를 과대 추정해 상자 아래에
    // 빈 줄이 남고, 0.85em은 과소 추정해 글이 칸을 넘친다. 0.95는 전진 폭에
    // 2% 남짓의 여유를 더한 값이다.
    return 0.95;
  }
  if (NARROW_PUNCTUATION.test(character)) {
    return 0.32;
  }
  if (/[0-9]/.test(character)) {
    return 0.56;
  }
  if (/[A-Z]/.test(character)) {
    return 0.66;
  }
  if (/[a-z]/.test(character)) {
    return 0.54;
  }
  if (/[-–—•✓]/.test(character)) {
    return 0.5;
  }
  return 0.6;
}

/**
 * 줄바꿈 단위.
 *
 * 한글·한자는 어디서든 줄이 바뀔 수 있으므로 글자 하나가 한 단위다.
 * 라틴 문자와 숫자는 단어 중간에서 끊기지 않으므로 이어진 덩어리가 한 단위다.
 * 공백은 줄 끝에서 사라지므로 별도로 취급한다.
 */
type Token = { width: number; isSpace: boolean };

function tokenize(text: string, fontSize: number): Token[] {
  const tokens: Token[] = [];
  let latinWidth = 0;

  const flushLatin = () => {
    if (latinWidth > 0) {
      tokens.push({ width: latinWidth, isSpace: false });
      latinWidth = 0;
    }
  };

  for (const character of Array.from(text)) {
    const width = advanceEm(character) * fontSize;
    if (character === " " || character === "\t") {
      flushLatin();
      tokens.push({ width, isSpace: true });
      continue;
    }
    if (character.length > 1 || FULL_WIDTH.test(character)) {
      flushLatin();
      tokens.push({ width, isSpace: false });
      continue;
    }
    latinWidth += width;
  }
  flushLatin();
  return tokens;
}

/** 한 문단(줄바꿈 없는 텍스트)이 주어진 폭에서 몇 줄이 되는지 센다. */
function countWrappedLines(
  text: string,
  fontSize: number,
  width: number,
): number {
  if (width <= 0) {
    return 1;
  }
  const tokens = tokenize(text, toCanvaFontSize(fontSize));
  let lines = 1;
  let used = 0;

  for (const token of tokens) {
    if (token.isSpace) {
      // 줄 끝의 공백은 다음 줄로 넘기지 않는다.
      if (used > 0) {
        used += token.width;
      }
      continue;
    }
    if (used + token.width <= width) {
      used += token.width;
      continue;
    }
    lines += 1;
    // 한 단위가 폭보다 넓으면(아주 긴 영문 단어) 강제로 잘려 들어간다.
    used = token.width > width ? width : token.width;
  }
  return lines;
}

/** 줄바꿈(`\n`)을 포함한 텍스트 전체의 줄 수. */
export function countLines(
  text: string,
  options: { fontSize: number; width: number },
): number {
  return text
    .split("\n")
    .reduce(
      (total, paragraph) =>
        total +
        (paragraph.trim().length === 0
          ? 1
          : countWrappedLines(paragraph, options.fontSize, options.width)),
      0,
    );
}

/**
 * 텍스트가 차지하는 높이(px).
 *
 * Canva가 richtext 요소에 잡는 높이는 `줄 수 × 글자 크기 × lineHeightEm`이다.
 */
export function measureText(
  text: string,
  options: { fontSize: number; width: number; lineHeightEm: number },
): number {
  const lines = countLines(text, options);
  return Math.ceil(
    lines * toCanvaFontSize(options.fontSize) * options.lineHeightEm,
  );
}

/** 한 줄의 높이(px). 과부/고아 줄 규칙에서 "2줄 이상"을 계산할 때 쓴다. */
export function lineHeight(fontSize: number, lineHeightEm: number): number {
  return Math.ceil(toCanvaFontSize(fontSize) * lineHeightEm);
}

/** 줄바꿈 없이 한 줄로 놓았을 때의 가로 폭(px). 배지 같은 요소에 쓴다. */
export function measureLineWidth(text: string, fontSize: number): number {
  return Math.ceil(
    Array.from(text).reduce(
      (sum, character) =>
        sum + advanceEm(character) * toCanvaFontSize(fontSize),
      0,
    ),
  );
}
