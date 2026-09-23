import { parse as parseYaml } from "yaml";
import type {
  BookPage,
  BookSpec,
  Callout,
  ComparisonPage,
  ConceptPage,
  ContentSection,
  FlowchartConnection,
  FlowchartNode,
  PracticeChecklistPage,
  PracticeOpeningPage,
} from "../types/book-spec";
import {
  BookSpecValidationError,
  validateBookPage,
  validateBookSpec,
} from "../types/book-spec";
import {
  ImageDirectiveError,
  isImageDirectiveLine,
  parseImageDirective,
} from "./image-directive";
import type { ManuscriptIssue } from "./manuscript-lint";
import { lintPageBody } from "./manuscript-lint";

export type { ManuscriptIssue } from "./manuscript-lint";

type RawPage = {
  attributes: Record<string, string>;
  body: string;
  /** 다듬지 않은 본문 줄. `startLine + 1 + index`가 원고의 실제 행 번호다. */
  bodyLines: string[];
  startLine: number;
};

export class MarkdownBookParseError extends Error {
  /** 찾은 오류 전부. 첫 항목이 `message`의 출처다. */
  readonly issues: ManuscriptIssue[];

  constructor(message: string, line?: number, issues?: ManuscriptIssue[]) {
    super(line ? `${line}행: ${message}` : message);
    this.name = "MarkdownBookParseError";
    this.issues = issues ?? [{ severity: "error", message, line }];
  }
}

export type ManuscriptCheck = {
  /** 오류가 하나도 없을 때만 있다. */
  spec?: BookSpec;
  /** 원고 행 순서로 정렬된 오류와 경고. */
  issues: ManuscriptIssue[];
};

/** 문제 하나를 한 줄로 적는다. 앱과 검증 명령이 같은 표기를 쓴다. */
export function formatManuscriptIssue(issue: ManuscriptIssue): string {
  const where = [
    issue.line ? `${issue.line}행` : undefined,
    issue.pageId ? `page "${issue.pageId}"` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return where ? `${where}: ${issue.message}` : issue.message;
}

/**
 * 원고를 읽는다. 오류가 있으면 첫 오류를 메시지로 던지고, 찾은 오류 전부를
 * `issues`에 담는다.
 */
export function parseBookMarkdown(source: string): BookSpec {
  const { spec, issues } = checkBookMarkdown(source);
  const errors = issues.filter((issue) => issue.severity === "error");
  const first = errors[0];
  if (!spec || first) {
    const rest = errors.length > 1 ? ` (외 ${errors.length - 1}건)` : "";
    throw new MarkdownBookParseError(
      `${first?.message ?? "원고를 읽을 수 없습니다."}${rest}`,
      first?.line,
      errors,
    );
  }
  return spec;
}

/**
 * 원고를 검사해 문제를 **모두** 모은다.
 *
 * 첫 오류에서 멈추면 오타 다섯 개를 고치는 데 다섯 번 왕복해야 한다. Front
 * Matter와 page 구역 경계가 깨진 경우만 그 자리에서 멈추고(뒤의 행 번호를 믿을
 * 수 없다), 그 밖에는 페이지마다 따로 검사해 한 페이지의 실패가 다른 페이지의
 * 검사를 막지 않게 한다.
 */
export function checkBookMarkdown(source: string): ManuscriptCheck {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const issues: ManuscriptIssue[] = [];
  const collect = (error: unknown, fallback: Partial<ManuscriptIssue>) => {
    if (error instanceof MarkdownBookParseError) {
      issues.push(
        ...error.issues.map((issue) => ({
          ...issue,
          line: issue.line ?? fallback.line,
          pageId: issue.pageId ?? fallback.pageId,
        })),
      );
      return;
    }
    if (error instanceof BookSpecValidationError) {
      // 행 번호와 page id를 따로 적으므로 `pages[3].` 머리말은 뗀다.
      const message = error.message.replace(/^pages\[\d+\]\./, "");
      issues.push({ severity: "error", message, ...fallback });
      return;
    }
    throw error;
  };

  let metadata: Record<string, unknown>;
  let rawPages: RawPage[];
  try {
    const frontMatter = parseFrontMatter(normalized);
    metadata = frontMatter.metadata;
    rawPages = extractPages(frontMatter.body, frontMatter.bodyStartLine);
  } catch (error) {
    collect(error, {});
    return { issues };
  }

  const field = <T>(
    key: string,
    read: (value: unknown) => T,
  ): T | undefined => {
    try {
      return read(metadata[key]);
    } catch (error) {
      collect(error, { line: frontMatterLine(normalized, key) });
      return undefined;
    }
  };
  const header = {
    schemaVersion: field("schema_version", (value) =>
      numberValue(value, "schema_version"),
    ) as 1 | undefined,
    title: field("title", (value) => stringValue(value, "title")),
    subtitle: optionalString(metadata.subtitle),
    learnerLevel: optionalString(metadata.learner_level),
    language: field("language", (value) =>
      enumValue(value ?? "ko", ["ko"], "language"),
    ),
    canvas: field("canvas", (value) =>
      enumValue(value ?? "coala-portrait", ["coala-portrait"], "canvas"),
    ),
    numbering: field("numbering", (value) =>
      enumValue(value ?? "auto", ["auto", "none"], "numbering"),
    ),
    toc: field("toc", (value) =>
      enumValue(value ?? "none", ["auto", "none"], "toc"),
    ),
    institution: optionalString(metadata.institution),
    assetsDir: optionalString(metadata.assets_dir),
  };

  const pages: BookPage[] = [];
  const firstUse = new Map<string, number>();
  rawPages.forEach((rawPage, index) => {
    const pageId = rawPage.attributes.id || undefined;
    const before = issues.length;
    issues.push(
      ...lintPageBody(
        rawPage.attributes.type ?? "",
        rawPage.bodyLines,
        rawPage.startLine + 1,
        rawPage.attributes.layout,
      ).map((issue) => ({ ...issue, pageId })),
    );
    if (pageId) {
      const usedAt = firstUse.get(pageId);
      if (usedAt !== undefined) {
        issues.push({
          severity: "error",
          message: `중복된 page id입니다: ${pageId} (${usedAt}행에서 이미 사용)`,
          line: rawPage.startLine,
          pageId,
        });
      } else {
        firstUse.set(pageId, rawPage.startLine);
      }
    }
    try {
      const page = parsePage(rawPage);
      // 문법 오류가 있는 페이지는 내용이 어긋나 있어 같은 원인을 다른 말로 한 번
      // 더 지적하게 된다. 문법을 고친 뒤에 검증한다.
      if (!issues.slice(before).some((issue) => issue.severity === "error")) {
        validateBookPage(page, index);
      }
      pages.push(page);
    } catch (error) {
      collect(error, { line: rawPage.startLine, pageId });
    }
  });

  issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  if (issues.some((issue) => issue.severity === "error")) {
    return { issues };
  }

  const spec = { ...header, pages } as BookSpec;
  try {
    validateBookSpec(spec);
  } catch (error) {
    collect(error, {});
    return { issues };
  }
  // 페이지 번호는 여기서 정하지 않는다. 분할과 구조 페이지 삽입이 끝난 뒤
  // builder/plan-book.ts의 planBook()이 확정한다.
  return { spec, issues };
}

/** Front Matter에서 `key:`가 적힌 행. 없으면 Front Matter의 첫 행. */
function frontMatterLine(source: string, key: string): number {
  const lines = source.split("\n");
  const closing = lines.indexOf("---", 1);
  const index = lines.findIndex(
    (line, at) => at < closing && new RegExp(`^${key}\\s*:`).test(line),
  );
  return index < 0 ? 2 : index + 1;
}

function parseFrontMatter(source: string): {
  metadata: Record<string, unknown>;
  body: string;
  bodyStartLine: number;
} {
  if (!source.startsWith("---\n")) {
    throw new MarkdownBookParseError(
      "문서 맨 앞에 YAML Front Matter가 필요합니다.",
      1,
    );
  }
  const closingIndex = source.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new MarkdownBookParseError(
      "YAML Front Matter가 닫히지 않았습니다.",
      1,
    );
  }
  const yamlSource = source.slice(4, closingIndex);
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlSource);
  } catch (error) {
    throw new MarkdownBookParseError(
      `YAML을 읽을 수 없습니다: ${errorMessage(error)}`,
      2,
    );
  }
  if (!isRecord(parsed)) {
    throw new MarkdownBookParseError(
      "Front Matter는 키-값 형식이어야 합니다.",
      2,
    );
  }
  const bodyStartLine = source.slice(0, closingIndex + 5).split("\n").length;
  return {
    metadata: parsed,
    body: source.slice(closingIndex + 5),
    bodyStartLine,
  };
}

function extractPages(body: string, bodyStartLine: number): RawPage[] {
  const lines = body.split("\n");
  const pages: RawPage[] = [];
  let current:
    | { attributes: Record<string, string>; lines: string[]; startLine: number }
    | undefined;

  lines.forEach((line, index) => {
    const absoluteLine = bodyStartLine + index;
    const opening = line.match(/^:::page\{(.*)\}\s*$/);
    if (opening) {
      if (current) {
        throw new MarkdownBookParseError(
          "page 구역 안에 다른 page 구역을 시작할 수 없습니다.",
          absoluteLine,
        );
      }
      current = {
        attributes: parseAttributes(opening[1] ?? "", absoluteLine),
        lines: [],
        startLine: absoluteLine,
      };
      return;
    }
    if (line.trim() === ":::") {
      if (!current) {
        throw new MarkdownBookParseError(
          "시작되지 않은 page 구역의 닫기 표시입니다.",
          absoluteLine,
        );
      }
      pages.push({
        attributes: current.attributes,
        body: current.lines.join("\n").trim(),
        bodyLines: current.lines,
        startLine: current.startLine,
      });
      current = undefined;
      return;
    }
    if (current) {
      current.lines.push(line);
    } else if (line.trim().length > 0) {
      throw new MarkdownBookParseError(
        "모든 본문은 :::page{...} 구역 안에 있어야 합니다.",
        absoluteLine,
      );
    }
  });

  if (current) {
    throw new MarkdownBookParseError(
      "page 구역이 ::: 표시로 닫히지 않았습니다.",
      current.startLine,
    );
  }
  if (pages.length === 0) {
    throw new MarkdownBookParseError("page 구역이 하나 이상 필요합니다.");
  }
  return pages;
}

function parseAttributes(source: string, line: number): Record<string, string> {
  const attributes: Record<string, string> = {};
  const expression = /([a-z][a-z0-9-]*)="([^"]*)"/gi;
  let match: RegExpExecArray | null;
  let consumed = "";
  while ((match = expression.exec(source)) != null) {
    const key = match[1];
    const value = match[2];
    if (!key || value === undefined) {
      continue;
    }
    if (attributes[key] !== undefined) {
      throw new MarkdownBookParseError(`중복된 page 속성입니다: ${key}`, line);
    }
    attributes[key] = value;
    consumed += match[0];
  }
  const compactSource = source.replace(/\s+/g, "");
  const compactConsumed = consumed.replace(/\s+/g, "");
  if (compactSource !== compactConsumed) {
    throw new MarkdownBookParseError(
      'page 속성은 key="value" 형식으로 작성해야 합니다.',
      line,
    );
  }
  return attributes;
}

function parsePage(rawPage: RawPage): BookPage {
  const type = requiredAttribute(rawPage, "type");
  const id = requiredAttribute(rawPage, "id");
  validateImageDirectives(rawPage, type);
  switch (type) {
    case "chapter-opening":
      return parseChapterOpening(rawPage, id);
    case "concept":
      return parseConcept(rawPage, id);
    case "comparison":
      return parseComparison(rawPage, id);
    case "practice-opening":
      return parsePracticeOpening(rawPage, id);
    case "practice-checklist":
      return parsePracticeChecklist(rawPage, id);
    case "flowchart":
      return parseFlowchart(rawPage, id);
    default:
      throw new MarkdownBookParseError(
        `지원하지 않는 페이지 형식입니다: ${type}`,
        rawPage.startLine,
      );
  }
}

/**
 * 이미지 자리표시자(`::image{...}`)를 Canva에 쓰기 전에 모두 검증한다.
 *
 * 자리표시자는 본문이 세로로 흐르는 곳에만 둘 수 있다. 그 밖의 자리에서는
 * 조용히 사라지거나 글자로 새어 나오므로, 원고 행 번호와 함께 거절한다.
 *
 * - concept(`layout="basic"`): 페이지 제목 아래 어디든
 * - chapter-opening: 학습 목표 다음 개념 소제목 아래
 */
function validateImageDirectives(rawPage: RawPage, type: string): void {
  const lines = rawPage.bodyLines;
  const lineOf = (index: number) => rawPage.startLine + 1 + index;
  const fail = (index: number, message: string): never => {
    throw new MarkdownBookParseError(message, lineOf(index));
  };

  const directives: number[] = [];
  lines.forEach((line, index) => {
    if (
      /^\s*>/.test(line) &&
      isImageDirectiveLine(line.replace(/^\s*>\s?/, ""))
    ) {
      fail(index, "강조 박스(>) 안에는 image를 넣을 수 없습니다.");
    }
    if (isImageDirectiveLine(line)) {
      directives.push(index);
    }
  });
  if (directives.length === 0) {
    return;
  }

  const first = directives[0] ?? 0;
  let allowedAfter: number;
  switch (type) {
    case "concept": {
      if ((rawPage.attributes.layout ?? "basic") !== "basic") {
        fail(
          first,
          'image는 concept layout="basic"에서만 쓸 수 있습니다. 카드 안에는 이미지 자리를 둘 수 없습니다.',
        );
      }
      allowedAfter = lines.findIndex((line) => /^#\s+/.test(line));
      break;
    }
    case "chapter-opening": {
      const objectives = headingIndex(lines, 3, "학습 목표");
      allowedAfter =
        objectives < 0 ? -1 : nextHeadingIndex(lines, objectives + 1, 3);
      break;
    }
    case "comparison":
    case "practice-opening":
    case "practice-checklist":
    case "flowchart":
      return fail(
        first,
        `${type} 페이지에는 image를 넣을 수 없습니다. concept 페이지나 chapter-opening 본문으로 옮겨 주세요.`,
      );
    default:
      // 지원하지 않는 페이지 형식은 parsePage가 이름을 들어 거절한다.
      return;
  }
  if (allowedAfter < 0) {
    // 필수 제목이 없는 원고다. 페이지 파서가 그 사유로 거절한다.
    return;
  }

  for (const index of directives) {
    if (index < allowedAfter) {
      fail(
        index,
        type === "concept"
          ? "image는 페이지 제목(#) 아래에 두어야 합니다."
          : "chapter-opening의 image는 학습 목표 다음 개념 소제목(###) 아래에 두어야 합니다.",
      );
    }
    try {
      parseImageDirective(lines[index] ?? "");
    } catch (error) {
      if (error instanceof ImageDirectiveError) {
        fail(index, error.message);
      }
      throw error;
    }
  }
}

function parseChapterOpening(rawPage: RawPage, id: string): BookPage {
  const lines = rawPage.body.split("\n");
  const title = firstHeading(lines, 1, rawPage, "챕터 제목");
  const subtitle = firstHeading(lines, 2, rawPage, "챕터 부제목");
  const objectiveIndex = headingIndex(lines, 3, "학습 목표");
  if (objectiveIndex < 0) {
    throw new MarkdownBookParseError(
      "chapter-opening에 '### 학습 목표'가 필요합니다.",
      rawPage.startLine,
    );
  }
  const nextHeading = nextHeadingIndex(lines, objectiveIndex + 1, 3);
  if (nextHeading < 0) {
    throw new MarkdownBookParseError(
      "학습 목표 다음에 개념 소제목이 필요합니다.",
      rawPage.startLine,
    );
  }
  const objectives = bulletItems(lines.slice(objectiveIndex + 1, nextHeading));
  const subsectionTitle = headingText(lines[nextHeading] ?? "", 3);
  const body = blockText(lines.slice(nextHeading + 1));
  const chapterNumber = Number(requiredAttribute(rawPage, "chapter"));

  return {
    type: "chapter-opening",
    id,
    chapterNumber,
    chapterTitle: title,
    chapterSubtitle: subtitle,
    learningObjectives: objectives,
    subsectionTitle,
    body,
  };
}

function parseConcept(rawPage: RawPage, id: string): ConceptPage {
  const lines = rawPage.body.split("\n");
  const titleIndex = firstHeadingIndex(lines, 1, rawPage, "페이지 제목");
  const calloutResult = extractCallout(lines);
  const contentLines = calloutResult.lines;
  const sectionStarts = contentLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^##\s+/.test(line));
  if (sectionStarts.length === 0) {
    throw new MarkdownBookParseError(
      "concept 페이지에는 하나 이상의 '## 소제목'이 필요합니다.",
      rawPage.startLine,
    );
  }
  const sections: ContentSection[] = sectionStarts.map(
    ({ line, index }, position) => {
      const end = sectionStarts[position + 1]?.index ?? contentLines.length;
      const sectionLines = contentLines.slice(index + 1, end);
      const body = paragraphText(
        sectionLines.filter((item) => !/^\s*-\s+/.test(item)),
      );
      const bullets = bulletItems(sectionLines);
      return {
        title: headingText(line, 2),
        // 원문을 그대로 남긴다. 렌더러는 이 값에서 문단과 목록을 복원한다.
        content: blockText(sectionLines) || undefined,
        body: body || undefined,
        bullets: bullets.length > 0 ? bullets : undefined,
      };
    },
  );
  const introduction = blockText(
    contentLines.slice(
      titleIndex + 1,
      sectionStarts[0]?.index ?? contentLines.length,
    ),
  );
  const layout = optionalAttribute(rawPage, "layout") ?? "basic";
  if (layout !== "basic" && layout !== "cards") {
    throw new MarkdownBookParseError(
      `concept layout은 basic 또는 cards여야 합니다: ${layout}`,
      rawPage.startLine,
    );
  }
  return {
    type: "concept",
    id,
    layout,
    title: headingText(contentLines[titleIndex] ?? "", 1),
    introduction: introduction || undefined,
    sections,
    callout: calloutResult.callout,
  };
}

function parseComparison(rawPage: RawPage, id: string): ComparisonPage {
  const lines = rawPage.body.split("\n");
  const titleIndex = firstHeadingIndex(lines, 1, rawPage, "페이지 제목");
  const calloutResult = extractCallout(lines);
  const tableStart = calloutResult.lines.findIndex((line) =>
    /^\s*\|.*\|\s*$/.test(line),
  );
  if (
    tableStart < 0 ||
    !isTableSeparator(calloutResult.lines[tableStart + 1] ?? "")
  ) {
    throw new MarkdownBookParseError(
      "comparison 페이지에는 Markdown 표가 필요합니다.",
      rawPage.startLine,
    );
  }
  const tableLines = takeWhile(calloutResult.lines.slice(tableStart), (line) =>
    /^\s*\|.*\|\s*$/.test(line),
  );
  const columns = tableCells(tableLines[0] ?? "");
  const rows = tableLines.slice(2).map(tableCells);
  return {
    type: "comparison",
    id,
    title: headingText(calloutResult.lines[titleIndex] ?? "", 1),
    introduction:
      paragraphText(calloutResult.lines.slice(titleIndex + 1, tableStart)) ||
      undefined,
    columns,
    rows,
    callout: calloutResult.callout,
  };
}

function parsePracticeOpening(
  rawPage: RawPage,
  id: string,
): PracticeOpeningPage {
  const lines = rawPage.body.split("\n");
  const titleIndex = firstHeadingIndex(lines, 1, rawPage, "실습 제목");
  const calloutResult = extractCallout(lines);
  const checklist = checkboxItems(calloutResult.lines);
  if (calloutResult.callout && checklist.length > 0) {
    throw new MarkdownBookParseError(
      "practice-opening 하단에는 Tip 또는 실습 목표 중 하나만 넣을 수 있습니다.",
      rawPage.startLine,
    );
  }
  const description = blockText(
    calloutResult.lines
      .slice(titleIndex + 1)
      .filter((line) => !/^\s*-\s*\[[ xX]\]\s+/.test(line)),
  );
  const support = calloutResult.callout
    ? { type: "tip" as const, text: calloutResult.callout.text }
    : checklist.length > 0
      ? { type: "objectives" as const, items: checklist }
      : undefined;
  return {
    type: "practice-opening",
    id,
    practiceId: requiredAttribute(rawPage, "practice"),
    practiceKind: requiredAttribute(rawPage, "practice-kind"),
    platform: requiredAttribute(rawPage, "platform"),
    title: headingText(calloutResult.lines[titleIndex] ?? "", 1),
    description,
    support,
  };
}

function parsePracticeChecklist(
  rawPage: RawPage,
  id: string,
): PracticeChecklistPage {
  const lines = rawPage.body.split("\n");
  const titleIndex = firstHeadingIndex(lines, 1, rawPage, "실습 목표 제목");
  const calloutResult = extractCallout(lines);
  const items = checkboxItems(calloutResult.lines);
  return {
    type: "practice-checklist",
    id,
    title: headingText(calloutResult.lines[titleIndex] ?? "", 1),
    introduction:
      blockText(
        calloutResult.lines
          .slice(titleIndex + 1)
          .filter((line) => !/^\s*-\s*\[[ xX]\]\s+/.test(line)),
      ) || undefined,
    items,
    tip: calloutResult.callout?.text,
  };
}

function parseFlowchart(rawPage: RawPage, id: string): BookPage {
  const lines = rawPage.body.split("\n");
  const titleIndex = firstHeadingIndex(lines, 1, rawPage, "순서도 제목");
  const fenceStart = lines.findIndex((line) => line.trim() === "```flowchart");
  const fenceEnd = lines.findIndex(
    (line, index) => index > fenceStart && line.trim() === "```",
  );
  if (fenceStart < 0 || fenceEnd < 0) {
    throw new MarkdownBookParseError(
      "flowchart 페이지에는 ```flowchart 코드 블록이 필요합니다.",
      rawPage.startLine,
    );
  }
  let graph: unknown;
  try {
    graph = parseYaml(lines.slice(fenceStart + 1, fenceEnd).join("\n"));
  } catch (error) {
    throw new MarkdownBookParseError(
      `flowchart YAML을 읽을 수 없습니다: ${errorMessage(error)}`,
      rawPage.startLine + fenceStart,
    );
  }
  if (!isRecord(graph)) {
    throw new MarkdownBookParseError(
      "flowchart 데이터는 키-값 형식이어야 합니다.",
      rawPage.startLine + fenceStart,
    );
  }
  const nodes = arrayValue(graph.nodes, "nodes").map((item, index) =>
    flowchartNode(item, index),
  );
  const connections = arrayValue(graph.connections, "connections").map(
    (item, index) => flowchartConnection(item, index),
  );
  const controlStructure = optionalString(graph.control_structure);
  // 강조 박스를 놓을 자리가 없다. 그대로 두면 `> [!TIP]`이 본문 글자로 나간다.
  const calloutLine = lines.findIndex((line) =>
    /^>\s*\[!(TIP|KEY_POINT)\]\s*$/i.test(line),
  );
  if (calloutLine >= 0) {
    throw new MarkdownBookParseError(
      "flowchart 페이지에는 강조 박스를 넣을 수 없습니다. 다음 concept 페이지로 옮겨 주세요.",
      rawPage.startLine,
    );
  }
  const height = optionalAttribute(rawPage, "height");
  if (height !== undefined && !/^\d+$/.test(height)) {
    throw new MarkdownBookParseError(
      `flowchart height는 픽셀 단위의 정수여야 합니다: ${height}`,
      rawPage.startLine,
    );
  }
  return {
    type: "flowchart",
    id,
    title: headingText(lines[titleIndex] ?? "", 1),
    // 문단 경계를 보존한다. 원본 순서도 페이지는 도입문이 두 문단이다.
    introduction:
      blockText(lines.slice(titleIndex + 1, fenceStart)) || undefined,
    // 코드 블록 아래의 글은 순서도 자리 아래에 놓인다.
    conclusion: blockText(lines.slice(fenceEnd + 1)) || undefined,
    placeholderHeight: height === undefined ? undefined : Number(height),
    controlStructure: controlStructure as
      | "linear"
      | "if-else"
      | "if-else-if"
      | "loop"
      | undefined,
    nodes,
    connections,
  };
}

function flowchartNode(value: unknown, index: number): FlowchartNode {
  if (!isRecord(value)) {
    throw new MarkdownBookParseError(
      `flowchart nodes[${index}]가 잘못되었습니다.`,
    );
  }
  return {
    id: stringValue(value.id, `nodes[${index}].id`),
    role: stringValue(
      value.role,
      `nodes[${index}].role`,
    ) as FlowchartNode["role"],
    text: stringValue(value.text, `nodes[${index}].text`),
  };
}

function flowchartConnection(
  value: unknown,
  index: number,
): FlowchartConnection {
  if (!isRecord(value)) {
    throw new MarkdownBookParseError(
      `flowchart connections[${index}]가 잘못되었습니다.`,
    );
  }
  const label = optionalString(value.label);
  return {
    from: stringValue(value.from, `connections[${index}].from`),
    to: stringValue(value.to, `connections[${index}].to`),
    label: label as "YES" | "NO" | undefined,
  };
}

function extractCallout(lines: string[]): {
  lines: string[];
  callout?: Callout;
} {
  const output: string[] = [];
  let callout: Callout | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const marker = lines[index]?.match(/^>\s*\[!(TIP|KEY_POINT)\]\s*$/i);
    if (!marker) {
      output.push(lines[index] ?? "");
      continue;
    }
    if (callout) {
      throw new MarkdownBookParseError(
        "페이지에는 강조 박스를 하나만 넣을 수 있습니다.",
      );
    }
    const textLines: string[] = [];
    while (index + 1 < lines.length && /^>/.test(lines[index + 1] ?? "")) {
      index += 1;
      textLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
    }
    callout = {
      type: marker[1]?.toUpperCase() === "TIP" ? "tip" : "key-point",
      text: blockText(textLines),
    };
  }
  return { lines: output, callout };
}

function firstHeading(
  lines: string[],
  level: number,
  rawPage: RawPage,
  label: string,
): string {
  return headingText(
    lines[firstHeadingIndex(lines, level, rawPage, label)] ?? "",
    level,
  );
}

function firstHeadingIndex(
  lines: string[],
  level: number,
  rawPage: RawPage,
  label: string,
): number {
  const marker = "#".repeat(level);
  const index = lines.findIndex((line) =>
    new RegExp(`^${marker}\\s+`).test(line),
  );
  if (index < 0) {
    throw new MarkdownBookParseError(
      `${label}에 ${marker} 제목 형식이 필요합니다.`,
      rawPage.startLine,
    );
  }
  return index;
}

function headingIndex(lines: string[], level: number, text: string): number {
  return lines.findIndex((line) => headingText(line, level).trim() === text);
}

function nextHeadingIndex(
  lines: string[],
  start: number,
  level: number,
): number {
  const marker = "#".repeat(level);
  const relative = lines
    .slice(start)
    .findIndex((line) => new RegExp(`^${marker}\\s+`).test(line));
  return relative < 0 ? -1 : start + relative;
}

function headingText(line: string, level: number): string {
  return line.replace(new RegExp(`^#{${level}}\\s+`), "").trim();
}

/**
 * 여러 줄을 한 문단의 평문으로 합친다.
 *
 * 구조가 필요 없는 자리(표의 도입문 등)에만 쓴다. 본문에는 쓰지 않는다.
 */
function paragraphText(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s+/.test(line))
    .join(" ")
    .trim();
}

/**
 * 본문의 Markdown 구조를 **그대로** 보존한다.
 *
 * 빈 줄(문단 경계)과 `- `, `1. ` 목록 줄을 지우지 않는다. 제목 줄만 걷어내고
 * 위아래의 빈 줄을 정리한다. 렌더러는 이 문자열을 `parser/blocks.ts`로
 * 다시 읽어 문단과 목록을 각각 별개의 Canva 요소로 그린다.
 *
 * 이전 구현(`paragraphText`)은 모든 줄을 공백으로 이어 붙여 목록과 문단
 * 경계를 없앴고, 그 결과 페이지마다 줄글 한 덩어리만 남았다.
 */
function blockText(lines: string[]): string {
  const kept = lines
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => !/^\s*#{1,6}\s+/.test(line));
  let start = 0;
  let end = kept.length;
  while (start < end && (kept[start] ?? "").trim().length === 0) {
    start += 1;
  }
  while (end > start && (kept[end - 1] ?? "").trim().length === 0) {
    end -= 1;
  }
  return kept.slice(start, end).join("\n");
}

function bulletItems(lines: string[]): string[] {
  return lines
    .map((line) => line.match(/^\s*-\s+(?!\[[ xX]\])(.+)$/)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

function checkboxItems(lines: string[]): string[] {
  return lines
    .map((line) => line.match(/^\s*-\s*\[[ xX]\]\s+(.+)$/)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function requiredAttribute(rawPage: RawPage, name: string): string {
  const value = rawPage.attributes[name];
  if (!value) {
    throw new MarkdownBookParseError(
      `page 속성 '${name}'이 필요합니다.`,
      rawPage.startLine,
    );
  }
  return value;
}

function optionalAttribute(rawPage: RawPage, name: string): string | undefined {
  return rawPage.attributes[name] || undefined;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MarkdownBookParseError(`${field} 값이 필요합니다.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MarkdownBookParseError(`${field}는 숫자여야 합니다.`);
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new MarkdownBookParseError(
      `${field}는 다음 중 하나여야 합니다: ${allowed.join(", ")}`,
    );
  }
  return value as T;
}

function arrayValue(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new MarkdownBookParseError(`${field}는 목록이어야 합니다.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function takeWhile<T>(items: T[], predicate: (value: T) => boolean): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (!predicate(item)) {
      break;
    }
    result.push(item);
  }
  return result;
}
