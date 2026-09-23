import {
  findCodeResultProblems,
  isResultImageLine,
  scanResultsAfter,
} from "./code-result";
import { parseFlowLines } from "./flow-strip";
import { isImageDirectiveLine } from "./image-directive";

/**
 * 원고에서 찾은 문제 하나.
 *
 * `error`는 생성을 막는다. `warning`은 오탐 가능성이 있어 막지는 않고 알리기만
 * 한다.
 */
export type ManuscriptIssue = {
  severity: "error" | "warning";
  message: string;
  /** 원고의 실제 행 번호(1부터). 알 수 없으면 비운다. */
  line?: number;
  /** 문제가 있는 page 구역의 id. */
  pageId?: string;
};

/**
 * 지원하지 않는 Markdown 문법을 찾아낸다.
 *
 * 페이지 파서는 아는 문법만 골라 읽고 나머지는 본문 글자로 넘긴다. 그래서
 * 코드 블록, 표, `> [!CAUTION]` 같은 문법이 오류 없이 통과한 뒤 Canva에
 * `` ```python `` 같은 기호째로 찍히거나 조용히 사라졌다. 여기서는 반대로
 * "아는 문법이 아니면 거절"한다. 한 페이지의 문제를 모두 모아 돌려주므로
 * 호출부가 한 번에 보여 줄 수 있다.
 *
 * 구조 검증(필수 제목, 표 유무 등)과 image 지시문 검증은 페이지 파서가 맡는다.
 */
export function lintPageBody(
  type: string,
  bodyLines: readonly string[],
  /** `bodyLines[0]`의 원고 행 번호. */
  firstLine: number,
  /** `layout` 페이지 속성. concept 페이지에서만 뜻이 있다. */
  layout?: string,
): ManuscriptIssue[] {
  const rules = PAGE_RULES[type];
  if (!rules) {
    // 지원하지 않는 페이지 형식은 parsePage가 이름을 들어 거절한다.
    return [];
  }
  // 카드 안에는 상자를 넣을 자리가 없다.
  const dialogueAllowed = rules.dialogue && (layout ?? "basic") === "basic";
  const codeAllowed = rules.code && (layout ?? "basic") === "basic";
  const flowAllowed = rules.flow && (layout ?? "basic") === "basic";
  const codeForbiddenMessage = rules.code
    ? '코드 블록은 concept layout="basic"에서만 쓸 수 있습니다. 카드 안에는 코드 상자를 둘 수 없습니다.'
    : `${type} 페이지에는 코드 블록을 넣을 수 없습니다. concept 페이지로 옮겨 주세요.`;

  const issues: ManuscriptIssue[] = [];
  const report = (
    index: number,
    message: string,
    severity: ManuscriptIssue["severity"] = "error",
  ) => {
    issues.push({ severity, message, line: firstLine + index });
  };

  // 코드와 실행 결과의 짝은 파서·검증기와 같은 논리로 한 번에 검사한다.
  if (codeAllowed) {
    for (const problem of findCodeResultProblems(bodyLines)) {
      report(problem.line, problem.message);
    }
  }

  const headingCounts = new Map<number, number>();
  // 제목이 아예 없는 페이지는 페이지 파서가 그 사유로 거절한다. 그때 모든 줄을
  // "제목 위의 글"로 다시 지적하지 않는다.
  let titleSeen = !bodyLines.some((candidate) => /^#\s+/.test(candidate));
  let inCallout = false;
  let flowchartFenceSeen = false;
  /** 아직 response가 따라오지 않은 prompt 블록의 시작 줄. */
  let openPrompt: number | undefined;
  /** 강조 박스 안에서 열린 펜스. 닫는 줄에서 같은 오류를 되풀이하지 않는다. */
  let calloutFenceOpen = false;
  /** chapter-opening: 제목 → 학습 목표 → 본문 순서로 나아간다. */
  let chapterZone: "head" | "objectives" | "body" = "head";
  /** comparison: 표 앞 → 표 → 표 뒤. */
  let tableZone: "before" | "inside" | "after" = "before";

  for (let index = 0; index < bodyLines.length; index += 1) {
    const raw = bodyLines[index] ?? "";
    const line = raw.trim();

    if (line.length === 0) {
      inCallout = false;
      calloutFenceOpen = false;
      if (tableZone === "inside") {
        tableZone = "after";
      }
      continue;
    }

    // 코드 펜스. 안쪽 줄은 본문이 아니므로 닫는 줄까지 건너뛴다.
    const fence = line.match(/^(```+|~~~+)\s*(\S*)/);
    if (fence) {
      const marker = fence[1] ?? "```";
      const language = fence[2] ?? "";
      const close = bodyLines.findIndex(
        (candidate, at) => at > index && candidate.trim() === marker,
      );
      const isFlowchartFence =
        type === "flowchart" && language === "flowchart" && !flowchartFenceSeen;
      const isDialogueFence =
        marker === "```" && (language === "prompt" || language === "response");
      const isOutputFence = marker === "```" && language === "output";
      const isFlowFence = marker === "```" && language === "flow";

      if (isFlowchartFence) {
        flowchartFenceSeen = true;
      } else if (isDialogueFence && !dialogueAllowed) {
        report(
          index,
          rules.dialogue
            ? `${language} 블록은 concept layout="basic"에서만 쓸 수 있습니다. 카드 안에는 상자를 둘 수 없습니다.`
            : `${type} 페이지에는 ${language} 블록을 넣을 수 없습니다. concept 페이지로 옮겨 주세요.`,
        );
      } else if (isDialogueFence) {
        if (language === "prompt") {
          if (openPrompt !== undefined) {
            report(
              openPrompt,
              "prompt 블록 다음에는 response 블록이 와야 합니다.",
            );
          }
          openPrompt = index;
        } else if (openPrompt === undefined) {
          report(index, "response 블록 앞에는 prompt 블록이 있어야 합니다.");
        } else {
          openPrompt = undefined;
        }
        lintDialogueBody(
          language,
          bodyLines.slice(index + 1, close < 0 ? bodyLines.length : close),
          (offset, message, severity) =>
            report(index + 1 + offset, message, severity),
        );
      } else if (marker !== "```") {
        report(
          index,
          "코드 블록은 ```로 여닫아야 합니다. ~~~는 지원하지 않습니다.",
        );
      } else if (type === "flowchart") {
        report(
          index,
          "flowchart 페이지에는 ```flowchart 블록 하나만 둘 수 있습니다.",
        );
      } else if (isFlowFence && !flowAllowed) {
        report(
          index,
          rules.flow
            ? 'flow 블록은 concept layout="basic"에서만 쓸 수 있습니다. 카드 안에는 가로 흐름을 둘 수 없습니다.'
            : `${type} 페이지에는 flow 블록을 넣을 수 없습니다. concept 페이지로 옮겨 주세요.`,
        );
      } else if (isFlowFence) {
        const inner = bodyLines.slice(
          index + 1,
          close < 0 ? bodyLines.length : close,
        );
        for (const problem of parseFlowLines(inner).problems) {
          report(index + 1 + problem.offset, problem.message);
        }
      } else if (!codeAllowed) {
        report(index, codeForbiddenMessage);
      } else if (isOutputFence) {
        // 짝과 내용은 findCodeResultProblems가 이미 검사했다.
      } else if (
        bodyLines
          .slice(index + 1, close < 0 ? bodyLines.length : close)
          .every((inner) => inner.trim().length === 0)
      ) {
        report(index, "코드 블록이 비어 있습니다.");
      }
      if (close < 0) {
        report(index, `이 블록을 닫는 ${marker} 줄이 없습니다.`);
      }
      index = close < 0 ? bodyLines.length : close;
      // 일반 코드 뒤에 붙은 실행 결과는 코드와 한 덩어리다. 그 줄들은 본문
      // 문법 검사 대상이 아니므로 건너뛴다.
      const isPlainCode =
        marker === "```" &&
        !isFlowchartFence &&
        !isDialogueFence &&
        !isOutputFence &&
        !isFlowFence &&
        type !== "flowchart";
      if (isPlainCode && close >= 0) {
        const lookup = scanResultsAfter(bodyLines, close + 1);
        if (lookup.results.length > 0) {
          index = lookup.next - 1;
        }
      }
      inCallout = false;
      continue;
    }

    if (openPrompt !== undefined) {
      report(
        index,
        "prompt 블록과 response 블록 사이에는 다른 내용을 둘 수 없습니다.",
      );
      openPrompt = undefined;
    }

    // image 지시문은 validateImageDirectives가 위치와 형식을 모두 검증한다.
    if (isImageDirectiveLine(line)) {
      if (isResultImageLine(line) && !codeAllowed) {
        report(
          index,
          `${type} 페이지에는 실행 결과 이미지를 넣을 수 없습니다. concept 페이지의 코드 블록 바로 뒤에 작성해 주세요.`,
        );
      }
      inCallout = false;
      continue;
    }

    if (line.startsWith(">")) {
      if (inCallout && /^>\s*(```|~~~)/.test(line)) {
        if (!calloutFenceOpen) {
          report(
            index,
            "강조 박스 안에는 코드 블록이나 prompt·response 블록을 넣을 수 없습니다.",
          );
        }
        calloutFenceOpen = !calloutFenceOpen;
        continue;
      }
      inCallout = lintQuoteLine(type, rules, raw, inCallout, (message) =>
        report(index, message),
      );
      lintInline(line.replace(/^>\s?/, ""), (message, severity) =>
        report(index, message, severity),
      );
      continue;
    }
    inCallout = false;

    const heading = raw.match(/^(\s*)(#{1,6})\s+/);
    if (heading) {
      const level = (heading[2] ?? "").length;
      const marker = "#".repeat(level);
      const allowed = rules.headings[level] ?? 0;
      const count = (headingCounts.get(level) ?? 0) + 1;
      headingCounts.set(level, count);
      if ((heading[1] ?? "").length > 0) {
        report(index, "제목(#)은 줄 맨 앞에서 시작해야 합니다.");
      } else if (allowed === 0) {
        report(
          index,
          `${type} 페이지에서는 '${marker}' 제목을 쓸 수 없습니다. 그대로 두면 제목이 사라집니다.`,
        );
      } else if (count > allowed) {
        report(
          index,
          `${type} 페이지에는 '${marker}' 제목을 ${allowed}개까지만 쓸 수 있습니다.`,
        );
      }
      if (level === 1) {
        titleSeen = true;
      }
      if (
        (type === "screenshot-guide" || type === "step-process") &&
        level === 2 &&
        /^STEP\s*\d/i.test(line.replace(/^##\s+/, ""))
      ) {
        report(
          index,
          "단계 번호(STEP 1.)는 앱이 순서대로 붙입니다. 제목에는 동작만 적어 주세요.",
        );
      }
      if (type === "chapter-opening" && level === 3) {
        chapterZone = chapterZone === "head" ? "objectives" : "body";
      }
      lintInline(line, (message, severity) => report(index, message, severity));
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.replace(/\s+/g, ""))) {
      report(
        index,
        "수평선(---)은 지원하지 않습니다. 페이지를 나누려면 page 구역을 새로 여세요.",
      );
      continue;
    }

    const isTableLine = /^\|.*\|$/.test(line);
    if (isTableLine) {
      if (!rules.table) {
        report(
          index,
          `${type} 페이지에는 표를 넣을 수 없습니다. 표는 comparison 페이지에 작성해 주세요.`,
        );
        // 표 한 덩어리에 오류 하나면 충분하다.
        while (/^\|.*\|$/.test((bodyLines[index + 1] ?? "").trim())) {
          index += 1;
        }
        continue;
      }
      if (tableZone === "after") {
        report(index, "comparison 페이지에는 표를 하나만 넣을 수 있습니다.");
        continue;
      }
      tableZone = "inside";
      lintInline(line, (message, severity) => report(index, message, severity));
      continue;
    }
    if (tableZone === "inside") {
      tableZone = "after";
    }

    if (!titleSeen) {
      report(
        index,
        "페이지 제목(#) 위의 글은 지면에 나오지 않습니다. 제목 아래로 옮겨 주세요.",
      );
      continue;
    }

    if (rules.table && tableZone === "after") {
      report(
        index,
        "표 아래의 글은 지면에 나오지 않습니다. 표 위로 옮기거나 강조 박스로 적어 주세요.",
      );
      continue;
    }

    const checkbox = raw.match(/^\s*([-*+])\s*\[[ xX]\]/);
    if (checkbox) {
      if (!rules.checklist) {
        report(
          index,
          `${type} 페이지에는 체크리스트(- [ ])를 넣을 수 없습니다. practice-checklist 페이지에 작성해 주세요.`,
        );
      } else if (checkbox[1] !== "-") {
        report(index, "체크리스트 항목은 '- [ ]'로 시작해야 합니다.");
      }
      lintInline(line, (message, severity) => report(index, message, severity));
      continue;
    }

    const isListItem = /^([-*+]|\d+[.)])\s+/.test(line);
    if (isListItem && /^(\s{2,}|\t)/.test(raw)) {
      report(
        index,
        "중첩 목록은 지원하지 않습니다. 들여쓰기를 없애거나 항목을 나눠 주세요.",
      );
    }
    if (isListItem && rules.table && tableZone === "before") {
      report(
        index,
        "comparison 페이지의 도입문에는 목록을 쓸 수 없습니다. 문장으로 적어 주세요.",
      );
    }

    if (type === "chapter-opening") {
      if (chapterZone === "head") {
        report(
          index,
          "chapter-opening에서 '### 학습 목표' 위의 글은 지면에 나오지 않습니다.",
        );
        continue;
      }
      if (chapterZone === "objectives" && !/^-\s+/.test(line)) {
        report(
          index,
          "학습 목표는 '- '로 시작하는 목록으로만 적을 수 있습니다.",
        );
        continue;
      }
    }

    lintInline(line, (message, severity) => report(index, message, severity));
  }

  if (openPrompt !== undefined) {
    report(openPrompt, "prompt 블록 다음에는 response 블록이 와야 합니다.");
  }

  return issues;
}

/**
 * prompt·response 블록 안의 글을 검사한다.
 *
 * prompt는 문단만, response는 문단과 한 단계 목록만 담을 수 있다. 상자 안에는
 * 제목·표·강조 박스·이미지 자리를 놓을 자리가 없다.
 */
function lintDialogueBody(
  language: string,
  innerLines: readonly string[],
  report: (
    offset: number,
    message: string,
    severity?: ManuscriptIssue["severity"],
  ) => void,
): void {
  const label = language === "prompt" ? "prompt" : "response";
  if (innerLines.every((line) => line.trim().length === 0)) {
    report(-1, `${label} 블록이 비어 있습니다.`);
    return;
  }
  innerLines.forEach((raw, offset) => {
    const line = raw.trim();
    if (line.length === 0) {
      return;
    }
    if (
      /^#{1,6}\s+/.test(line) ||
      /^\|.*\|$/.test(line) ||
      line.startsWith(">") ||
      /^(```+|~~~+)/.test(line) ||
      isImageDirectiveLine(line) ||
      /^\s*[-*+]\s*\[[ xX]\]/.test(raw) ||
      /^(-{3,}|\*{3,}|_{3,})$/.test(line.replace(/\s+/g, ""))
    ) {
      report(
        offset,
        language === "prompt"
          ? "prompt 블록 안에는 문장만 적을 수 있습니다."
          : "response 블록 안에는 문단과 목록만 적을 수 있습니다.",
      );
      return;
    }
    const isListItem = /^([-*+]|\d+[.)])\s+/.test(line);
    if (isListItem && language === "prompt") {
      report(offset, "prompt 블록 안에는 문장만 적을 수 있습니다.");
      return;
    }
    if (isListItem && /^(\s{2,}|\t)/.test(raw)) {
      report(
        offset,
        "중첩 목록은 지원하지 않습니다. 들여쓰기를 없애거나 항목을 나눠 주세요.",
      );
    }
    lintInline(line, (message, severity) => report(offset, message, severity));
  });
}

type PageRules = {
  /** 제목 수준별 허용 개수. 없는 수준은 쓸 수 없다. */
  headings: Record<number, number>;
  /** 강조 박스(`> [!TIP]`, `> [!KEY_POINT]`)를 놓을 자리가 있는가. */
  callout: boolean;
  table: boolean;
  checklist: boolean;
  /** AI 프롬프트·응답 상자(```` ```prompt ````·```` ```response ````)를 놓을 수 있는가. */
  dialogue: boolean;
  /** 코드 상자(```` ```python ```` 등)를 놓을 수 있는가. */
  code: boolean;
  /** 가로 흐름(```` ```flow ````)을 놓을 수 있는가. */
  flow: boolean;
};

const PAGE_RULES: Record<string, PageRules> = {
  "chapter-opening": {
    // `### 학습 목표`와 개념 소제목 하나.
    headings: { 1: 1, 2: 1, 3: 2 },
    callout: false,
    table: false,
    checklist: false,
    dialogue: false,
    code: false,
    flow: false,
  },
  concept: {
    headings: { 1: 1, 2: Number.POSITIVE_INFINITY },
    callout: true,
    table: false,
    checklist: false,
    dialogue: true,
    code: true,
    flow: true,
  },
  comparison: {
    headings: { 1: 1 },
    callout: true,
    table: true,
    checklist: false,
    dialogue: false,
    code: false,
    flow: false,
  },
  "practice-opening": {
    headings: { 1: 1 },
    callout: true,
    table: false,
    checklist: true,
    dialogue: false,
    code: false,
    flow: false,
  },
  "practice-checklist": {
    headings: { 1: 1 },
    callout: true,
    table: false,
    checklist: true,
    dialogue: false,
    code: false,
    flow: false,
  },
  "screenshot-guide": {
    headings: { 1: 1, 2: Number.POSITIVE_INFINITY },
    callout: false,
    table: false,
    checklist: false,
    dialogue: false,
    code: false,
    flow: false,
  },
  "step-process": {
    headings: { 1: 1, 2: Number.POSITIVE_INFINITY },
    callout: false,
    table: false,
    checklist: false,
    dialogue: false,
    code: false,
    flow: false,
  },
  flowchart: {
    headings: { 1: 1 },
    // 파서가 "다음 concept 페이지로 옮겨 주세요"라고 직접 거절한다.
    callout: true,
    table: false,
    checklist: false,
    dialogue: false,
    code: false,
    flow: false,
  },
};

const SUPPORTED_CALLOUTS = new Set(["TIP", "KEY_POINT"]);

/**
 * `>`로 시작하는 줄 하나를 검사하고, 이 줄 다음에도 강조 박스 안인지 돌려준다.
 *
 * 페이지 파서는 `> [!TIP]` 또는 `> [!KEY_POINT]`만 있는 줄에서 강조 박스를
 * 시작하고, 바로 이어지는 `>` 줄을 그 내용으로 읽는다. 그 밖의 `>` 줄은 모두
 * 기호째로 본문에 찍힌다.
 */
function lintQuoteLine(
  type: string,
  rules: PageRules,
  raw: string,
  inCallout: boolean,
  report: (message: string) => void,
): boolean {
  const marker = raw.trim().match(/^>\s*\[!([A-Za-z_-]+)\]\s*(.*)$/);
  if (!marker) {
    if (!inCallout) {
      report(
        "인용문(>)은 지원하지 않습니다. 강조 박스는 '> [!TIP]' 또는 '> [!KEY_POINT]' 줄로 시작해야 합니다.",
      );
    }
    return inCallout;
  }

  const kind = (marker[1] ?? "").toUpperCase();
  if (!SUPPORTED_CALLOUTS.has(kind)) {
    report(
      `지원하지 않는 강조 박스입니다: [!${marker[1]}] (TIP, KEY_POINT만 쓸 수 있습니다)`,
    );
    // 이어지는 `>` 줄마다 같은 오류를 되풀이하지 않는다.
    return true;
  }
  if (/^\s/.test(raw)) {
    report("강조 박스는 줄 맨 앞에서 '>'로 시작해야 합니다.");
  } else if ((marker[2] ?? "").length > 0) {
    report(
      `'> [!${kind}]' 줄에는 글을 함께 적을 수 없습니다. 다음 줄에 '> '로 시작해 적어 주세요.`,
    );
  } else if (!rules.callout) {
    report(
      `${type} 페이지에는 강조 박스를 넣을 수 없습니다. 다음 concept 페이지로 옮겨 주세요.`,
    );
  }
  return true;
}

/** 표준 HTML 태그만 잡는다. `<Button-1>` 같은 tkinter 이벤트 표기는 본문이다. */
const HTML_TAG =
  /<\/?(?:br|hr|p|div|span|a|b|i|u|s|em|strong|code|pre|img|sub|sup|mark|small|center|font|table|thead|tbody|tr|td|th|ul|ol|li|h[1-6]|blockquote|details|summary)(?:\s[^<>]*)?\/?>/i;

/**
 * 문장 안의 서식을 검사한다. 지원하는 인라인 서식은 `**강조**` 하나뿐이다.
 */
function lintInline(
  text: string,
  report: (message: string, severity?: ManuscriptIssue["severity"]) => void,
): void {
  if (/!\[[^\]]*\]\([^)]*\)/.test(text)) {
    report(
      'Markdown 이미지(![]())는 지원하지 않습니다. ::image{src="..." alt="..."} 한 줄로 적어 주세요.',
    );
  } else if (/\[[^\]]+\]\([^)\s]+[^)]*\)/.test(text)) {
    report("링크([글](주소))는 지원하지 않습니다. 주소를 그대로 적어 주세요.");
  }
  if (/`[^`]+`/.test(text)) {
    report("인라인 코드(`...`)는 지원하지 않습니다. 백틱을 빼고 적어 주세요.");
  }
  if (/~~[^~]+~~/.test(text)) {
    report("취소선(~~...~~)은 지원하지 않습니다.");
  }
  if (HTML_TAG.test(text)) {
    report(
      "HTML 태그는 지원하지 않습니다. 그대로 두면 태그째로 본문에 찍힙니다.",
    );
  }
  // `2 * 3 * 4`나 `**강조**`는 걸리지 않는다. 그래도 별표를 글자로 쓰려는
  // 문장일 수 있으므로 막지 않고 알리기만 한다.
  if (/(?<![*\w])\*(?![\s*])[^*\n]*?(?<![\s*])\*(?![*\w])/.test(text)) {
    report(
      "기울임(*...*)은 지원하지 않아 별표가 그대로 찍힙니다. 강조는 **...**로 적어 주세요.",
      "warning",
    );
  }
}
