import type { ElementAtPoint } from "@canva/design";
import type { ContentBlock } from "../parser/blocks";
import { RESULT_LABEL } from "../parser/code-result";
import { coalaTheme } from "../theme/coala-theme";
import { CODE_BOX, CONTENT_WIDTH, GAP, PAGE } from "../theme/page-layout";
import { LINE_HEIGHT, TYPOGRAPHY, toCanvaFontSize } from "../theme/typography";
import type { TextHighlight } from "../builder/element-factory";
import { createRichText, createVectorShape } from "../builder/element-factory";
import { roundedRectPath } from "../utils/geometry";
import type { FlowStyle } from "./content-flow";
import { carriedHeadingReserve, textItem } from "./content-flow";
import type { FlowItem } from "./flow";
import { imagePlaceholderItem } from "./image-placeholder";
import { lineHeight, measureText } from "./measure";

/**
 * 코드 상자.
 *
 * 원본 교재에 코드 페이지 예시가 없어 앱이 정한 모양이다. 강조 박스와 같은
 * 안쪽 여백·모서리의 옅은 회색 상자 위에 언어 라벨을 놓고, 그 아래에 코드를
 * 본문과 같은 28pt·줄 간격 2로 놓는다. 글꼴은 조회된 고정폭 글꼴이고, 없으면
 * 본문 글꼴이다. 주석은 회색, 키워드는 교재 파란색 굵게로 구분한다.
 *
 * 텍스트 실행 결과(```` ```output ````)는 코드 상자 아래에 **별도의** 같은 회색
 * 상자로 놓인다. 두 상자 사이, 상자 밖에 교재 파란색 "실행 결과" 라벨이 있다.
 * 결과 상자 안은 색 구분 없는 고정폭 글이다. GUI 실행 결과(`role="result"`
 * 이미지)는 같은 파란 라벨이 붙은 이미지 자리로 놓인다.
 *
 * 긴 코드와 출력은 **글자를 줄이지 않고** 줄 경계에서 상자를 나눠 다음 상자로
 * 넘긴다. 이어지는 상자는 라벨로 코드의 계속인지 결과의 계속인지 밝힌다.
 * 들여쓰기는 원고의 공백을 그대로 보존하고 탭은 네 칸으로 바꾼다.
 */
const { colors } = coalaTheme;

type CodeBlock = Extract<ContentBlock, { kind: "code" }>;

const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  py: "Python",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  bash: "Shell",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  cs: "C#",
  text: "코드",
  txt: "코드",
  "": "코드",
};

/** 라벨에 쓸 이름. 모르는 언어는 적힌 이름을 그대로 쓴다. */
export function languageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language;
}

const PYTHON_KEYWORDS = [
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
];
const JS_KEYWORDS = [
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "let",
  "new",
  "null",
  "of",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "while",
];

type Syntax = { comment: string; keywords: ReadonlySet<string> };

const SYNTAX: Record<string, Syntax> = {
  python: { comment: "#", keywords: new Set(PYTHON_KEYWORDS) },
  py: { comment: "#", keywords: new Set(PYTHON_KEYWORDS) },
  bash: { comment: "#", keywords: new Set() },
  sh: { comment: "#", keywords: new Set() },
  shell: { comment: "#", keywords: new Set() },
  yaml: { comment: "#", keywords: new Set() },
  yml: { comment: "#", keywords: new Set() },
  javascript: { comment: "//", keywords: new Set(JS_KEYWORDS) },
  js: { comment: "//", keywords: new Set(JS_KEYWORDS) },
  typescript: { comment: "//", keywords: new Set(JS_KEYWORDS) },
  ts: { comment: "//", keywords: new Set(JS_KEYWORDS) },
  java: { comment: "//", keywords: new Set(JS_KEYWORDS) },
  c: { comment: "//", keywords: new Set(JS_KEYWORDS) },
  cpp: { comment: "//", keywords: new Set(JS_KEYWORDS) },
};

/**
 * 주석과 키워드 구간을 찾는다. 인덱스는 이어 붙인 문자열 기준이다.
 *
 * 문자열 리터럴 안의 `#`까지 가려내지는 않는다. 교재 예제 코드에서는 드물고,
 * 잘못 칠해도 색만 달라질 뿐 글자는 그대로다.
 */
export function highlightCode(
  lines: readonly string[],
  language: string,
  boldWeight: TextHighlight["fontWeight"],
): TextHighlight[] {
  const syntax = SYNTAX[language];
  if (!syntax) {
    return [];
  }
  const highlights: TextHighlight[] = [];
  let offset = 0;
  for (const line of lines) {
    const commentAt = line.indexOf(syntax.comment);
    const codePart = commentAt < 0 ? line : line.slice(0, commentAt);
    if (commentAt >= 0) {
      highlights.push({
        index: offset + commentAt,
        length: line.length - commentAt,
        color: colors.secondaryText,
      });
    }
    if (syntax.keywords.size > 0) {
      const word = /[A-Za-z_][A-Za-z0-9_]*/g;
      let match: RegExpExecArray | null;
      while ((match = word.exec(codePart)) != null) {
        if (syntax.keywords.has(match[0])) {
          highlights.push({
            index: offset + match.index,
            length: match[0].length,
            color: colors.primary,
            fontWeight: boldWeight,
          });
        }
      }
    }
    offset += line.length + 1;
  }
  return highlights;
}

/** 전각으로 취급할 문자(한글·한자·가나·전각 기호). 고정폭에서 두 칸을 쓴다. */
const FULL_WIDTH = new RegExp(
  "[\\u1100-\\u11ff\\u2e80-\\u9fff\\uac00-\\ud7af\\uff00-\\uffef]",
);

/** 고정폭 기준으로 한 줄이 상자 폭에서 몇 줄로 접히는지 센다. */
function wrappedLineCount(line: string, innerWidth: number): number {
  const em = toCanvaFontSize(TYPOGRAPHY.body);
  const width = Array.from(line).reduce(
    (sum, character) => sum + (FULL_WIDTH.test(character) ? 1 : 0.6) * em,
    0,
  );
  return Math.max(1, Math.ceil(width / Math.max(1, innerWidth)));
}

/** 상자의 왼쪽과 너비. 본문이 지면 여백에서 시작하면 강조 박스와 같은 전체 단 너비다. */
function boxFrame(style: FlowStyle): { left: number; width: number } {
  return style.left === PAGE.marginX
    ? { left: PAGE.marginX, width: CONTENT_WIDTH }
    : { left: style.left, width: style.width };
}

/** 연속 페이지 `제목(계속)`의 몫. 이미지 자리와 같은 계산이다. */
function continuationReserve(): number {
  return (
    lineHeight(TYPOGRAPHY.sectionTitle, LINE_HEIGHT.global) * 2 +
    GAP.afterHeading
  );
}

/** 상자 안의 한 줄. */
type Row = { text: string; height: number };

/** 줄 경계에서만 나눠, 상자 하나에 들어가는 만큼씩 묶는다. */
export function packRows(rows: readonly Row[], maxHeight: number): Row[][] {
  const groups: Row[][] = [];
  let group: Row[] = [];
  let used = 0;
  for (const row of rows) {
    if (group.length > 0 && used + row.height > maxHeight) {
      groups.push(group);
      group = [];
      used = 0;
    }
    group.push(row);
    used += row.height;
  }
  if (group.length > 0) {
    groups.push(group);
  }
  return groups;
}

function expandTabs(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\t/g, " ".repeat(CODE_BOX.tabWidth)));
}

/**
 * 코드 하나를 상자 조각 목록으로 만든다. 보통 하나, 길면 여럿. GUI 실행 결과가
 * 있으면 마지막에 그 이미지 자리가 붙는다.
 */
export function codeItems(
  block: CodeBlock,
  style: FlowStyle,
  options: { gapAfter: number; maxHeight: number },
): FlowItem[] {
  const frame = boxFrame(style);
  const innerWidth = frame.width - CODE_BOX.paddingX * 2;
  const rowHeight = lineHeight(TYPOGRAPHY.body, LINE_HEIGHT.global);
  const measureLabel = (text: string) =>
    measureText(text, {
      fontSize: TYPOGRAPHY.body,
      width: innerWidth,
      lineHeightEm: LINE_HEIGHT.global,
    });
  const toRows = (text: string): Row[] =>
    expandTabs(text).map((line) => ({
      text: line,
      height: wrappedLineCount(line, innerWidth) * rowHeight,
    }));
  const sum = (list: readonly Row[]) =>
    list.reduce((total, row) => total + row.height, 0);
  // 지면 하나에 가깝게 커질 수 있는 상자는 연속 제목과 함께 넘어오는 소제목의
  // 몫을 미리 뺀다.
  const pageBudget =
    options.maxHeight - continuationReserve() - carriedHeadingReserve();

  const fonts = style.fonts;
  const codeFont = fonts.code;
  const monoStyle = {
    fontRef: codeFont?.fontRef ?? fonts.fontRef,
    fontSize: TYPOGRAPHY.body,
    role: "body",
    fontWeight: codeFont?.regularWeight ?? fonts.regularWeight,
    color: colors.text,
    lineHeightEm: LINE_HEIGHT.global,
  } as const;
  const boldWeight = codeFont?.boldWeight ?? fonts.boldWeight;
  const labelStyle: FlowStyle = {
    ...style,
    left: frame.left,
    width: frame.width,
  };

  const box = (
    height: number,
    top: number,
    children: ElementAtPoint[],
  ): ElementAtPoint[] => [
    createVectorShape({
      left: frame.left,
      top,
      width: frame.width,
      height,
      path: roundedRectPath(frame.width, height, CODE_BOX.radius),
      fill: colors.codeFill,
    }),
    ...children,
  ];

  // ---- 코드 상자: 언어 라벨 + 코드 ----
  const language = languageLabel(block.language);
  const languageLabelHeight = measureLabel(language);
  const codeChrome =
    CODE_BOX.paddingTop +
    languageLabelHeight +
    CODE_BOX.afterLabel +
    CODE_BOX.paddingBottom;
  const codeGroups = packRows(
    toRows(block.code),
    Math.max(rowHeight, Math.floor(pageBudget - codeChrome)),
  );
  const codeBoxes = codeGroups.map((group, index): FlowItem => {
    const height = codeChrome + sum(group);
    const lines = group.map((row) => row.text);
    return {
      height,
      gapAfter: GAP.afterCode,
      reservesContinuation: true,
      render: (top) =>
        box(height, top, [
          createRichText({
            left: frame.left + CODE_BOX.paddingX,
            top: top + CODE_BOX.paddingTop,
            width: innerWidth,
            text: index === 0 ? language : `${language} (계속)`,
            fontRef: fonts.fontRef,
            fontSize: TYPOGRAPHY.body,
            role: "body",
            fontWeight: fonts.boldWeight,
            color: colors.secondaryText,
            lineHeightEm: LINE_HEIGHT.global,
          }),
          createRichText({
            left: frame.left + CODE_BOX.paddingX,
            top:
              top +
              CODE_BOX.paddingTop +
              languageLabelHeight +
              CODE_BOX.afterLabel,
            width: innerWidth,
            text: lines.join("\n"),
            ...monoStyle,
            highlights: highlightCode(lines, block.language, boldWeight),
          }),
        ]),
    };
  });

  const items: FlowItem[] = [...codeBoxes];
  const setGapAfterLast = (gap: number) => {
    const last = items[items.length - 1];
    if (last) {
      last.gapAfter = gap;
    }
  };

  // 상자 밖의 파란 "실행 결과" 라벨. 아래 상자와 같은 페이지에 있어야 한다.
  const resultLabel = (text: string): FlowItem =>
    textItem(text, labelStyle, {
      fontSize: TYPOGRAPHY.body,
      role: "body",
      gapAfter: CODE_BOX.afterResultLabel,
      bold: true,
      color: colors.primary,
      keepWithNext: rowHeight,
    });

  if (block.result?.kind === "text") {
    // ---- 결과 상자: 라벨은 밖에, 안에는 색 구분 없는 출력만 ----
    const outputChrome = CODE_BOX.paddingTop + CODE_BOX.paddingBottom;
    const labelShare = measureLabel(RESULT_LABEL) + CODE_BOX.afterResultLabel;
    const outputGroups = packRows(
      toRows(block.result.text),
      Math.max(rowHeight, Math.floor(pageBudget - labelShare - outputChrome)),
    );
    setGapAfterLast(CODE_BOX.beforeResultLabel);
    outputGroups.forEach((group, index) => {
      const height = outputChrome + sum(group);
      const isLast = index === outputGroups.length - 1;
      items.push(
        resultLabel(index === 0 ? RESULT_LABEL : `${RESULT_LABEL} (계속)`),
        {
          height,
          gapAfter: isLast ? options.gapAfter : GAP.afterCode,
          reservesContinuation: true,
          render: (top) =>
            box(height, top, [
              createRichText({
                left: frame.left + CODE_BOX.paddingX,
                top: top + CODE_BOX.paddingTop,
                width: innerWidth,
                text: group.map((row) => row.text).join("\n"),
                ...monoStyle,
              }),
            ]),
        },
      );
    });
    return items;
  }

  if (block.result?.kind === "image") {
    // GUI 실행 결과는 같은 파란 라벨이 붙은 이미지 자리로 놓인다. 라벨은
    // 자리와 함께 그려지므로(image-placeholder.ts) 여기서는 간격만 맞춘다.
    setGapAfterLast(CODE_BOX.beforeResultLabel);
    items.push(
      imagePlaceholderItem(block.result.image, style, {
        gapAfter: options.gapAfter,
        maxHeight: options.maxHeight,
      }),
    );
    return items;
  }

  setGapAfterLast(options.gapAfter);
  return items;
}
