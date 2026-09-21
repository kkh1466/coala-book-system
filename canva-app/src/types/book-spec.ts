export type BookSpec = {
  schemaVersion: 1;
  title: string;
  subtitle?: string;
  learnerLevel?: string;
  language: "ko";
  canvas: "coala-portrait";
  numbering: "auto" | "none";
  toc: "auto" | "none";
  institution?: string;
  assetsDir?: string;
  pages: BookPage[];
};

// 페이지 번호는 의도적으로 여기에 없다. 번호는 분할과 구조 페이지 삽입이
// 모두 끝난 뒤 builder/plan-book.ts가 PlannedPage에 확정한다.
// 참고: skill/references/page-types.md > "Pagination and contents"
type PageBase = {
  id: string;
};

export type BookPage =
  | ChapterOpeningPage
  | ConceptPage
  | ComparisonPage
  | PracticeOpeningPage
  | PracticeChecklistPage
  | FlowchartPage;

export type ChapterOpeningPage = PageBase & {
  type: "chapter-opening";
  chapterNumber: number;
  chapterTitle: string;
  chapterSubtitle: string;
  learningObjectives: string[];
  subsectionTitle: string;
  body: string;
};

export type ContentSection = {
  title: string;
  /**
   * 섹션 본문의 Markdown 원문. 빈 줄과 목록 구조가 그대로 들어 있다.
   * Markdown 원고에서 온 페이지에만 있다. 렌더러는 이 값이 있으면 이 값에서
   * 문단과 목록을 복원하고, 없으면 `body`/`bullets`로 되돌아간다.
   */
  content?: string;
  body?: string;
  bullets?: string[];
};

export type Callout = {
  type: "tip" | "key-point";
  text: string;
};

export type ConceptPage = PageBase & {
  type: "concept";
  layout: "basic" | "cards";
  title: string;
  introduction?: string;
  sections: ContentSection[];
  callout?: Callout;
};

export type ComparisonPage = PageBase & {
  type: "comparison";
  title: string;
  introduction?: string;
  columns: string[];
  rows: string[][];
  callout?: Callout;
};

export type PracticeOpeningPage = PageBase & {
  type: "practice-opening";
  practiceId: string;
  practiceKind: string;
  platform: string;
  title: string;
  description: string;
  support?:
    | { type: "tip"; text: string }
    | { type: "objectives"; items: string[] };
};

export type PracticeChecklistPage = PageBase & {
  type: "practice-checklist";
  title: string;
  introduction?: string;
  items: string[];
  tip?: string;
};

export type FlowchartNode = {
  id: string;
  role: "declaration" | "input" | "output" | "process" | "decision";
  text: string;
};

export type FlowchartConnection = {
  from: string;
  to: string;
  label?: "YES" | "NO";
};

export type FlowchartPage = PageBase & {
  type: "flowchart";
  controlStructure?: "linear" | "if-else" | "if-else-if" | "loop";
  title: string;
  introduction?: string;
  /** 순서도 아래에 놓이는 마무리 글(Markdown). */
  conclusion?: string;
  /**
   * 비워 둘 순서도 자리의 높이(px). 적지 않으면 노드 수로 추정한다.
   * 앱은 순서도를 그리지 않고 자리만 비워 둔다.
   */
  placeholderHeight?: number;
  nodes: FlowchartNode[];
  connections: FlowchartConnection[];
};

/** 원고가 적을 수 있는 순서도 자리 높이의 범위(px). */
export const FLOWCHART_PLACEHOLDER_HEIGHT = { min: 300, max: 1800 } as const;

export class BookSpecValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookSpecValidationError";
  }
}

function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BookSpecValidationError(`${field} is required.`);
  }
}

function requireTextArray(
  value: unknown,
  field: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BookSpecValidationError(`${field} must not be empty.`);
  }
  value.forEach((item, index) => requireText(item, `${field}[${index}]`));
}

export function validateBookSpec(spec: BookSpec): void {
  if (spec.schemaVersion !== 1) {
    throw new BookSpecValidationError("schemaVersion must be 1.");
  }
  requireText(spec.title, "title");
  if (spec.language !== "ko") {
    throw new BookSpecValidationError("language must be ko.");
  }
  if (spec.canvas !== "coala-portrait") {
    throw new BookSpecValidationError("canvas must be coala-portrait.");
  }
  if (!Array.isArray(spec.pages) || spec.pages.length === 0) {
    throw new BookSpecValidationError("pages must contain at least one page.");
  }

  const pageIds = new Set<string>();
  spec.pages.forEach((page, pageIndex) => {
    const prefix = `pages[${pageIndex}]`;
    requireText(page.id, `${prefix}.id`);
    if (pageIds.has(page.id)) {
      throw new BookSpecValidationError(
        `pages contains duplicate id: ${page.id}`,
      );
    }
    pageIds.add(page.id);

    switch (page.type) {
      case "chapter-opening":
        validateChapterOpeningPage(page, pageIndex);
        break;
      case "concept":
        validateConceptPage(page, pageIndex);
        break;
      case "comparison":
        validateComparisonPage(page, pageIndex);
        break;
      case "practice-opening":
        validatePracticeOpeningPage(page, pageIndex);
        break;
      case "practice-checklist":
        validatePracticeChecklistPage(page, pageIndex);
        break;
      case "flowchart":
        validateFlowchartPage(page, pageIndex);
        break;
      default: {
        const unknownPage: never = page;
        throw new BookSpecValidationError(
          `${prefix}.type is not supported: ${String(
            (unknownPage as { type?: unknown }).type,
          )}`,
        );
      }
    }
  });
}

function validateChapterOpeningPage(
  page: ChapterOpeningPage,
  pageIndex: number,
): void {
  const prefix = `pages[${pageIndex}]`;
  if (!Number.isInteger(page.chapterNumber) || page.chapterNumber < 1) {
    throw new BookSpecValidationError(
      `${prefix}.chapterNumber must be a positive integer.`,
    );
  }
  requireText(page.chapterTitle, `${prefix}.chapterTitle`);
  requireText(page.chapterSubtitle, `${prefix}.chapterSubtitle`);
  requireTextArray(page.learningObjectives, `${prefix}.learningObjectives`);
  requireText(page.subsectionTitle, `${prefix}.subsectionTitle`);
  requireText(page.body, `${prefix}.body`);
}

function validateConceptPage(page: ConceptPage, pageIndex: number): void {
  const prefix = `pages[${pageIndex}]`;
  requireText(page.title, `${prefix}.title`);
  if (!Array.isArray(page.sections) || page.sections.length === 0) {
    throw new BookSpecValidationError(`${prefix}.sections must not be empty.`);
  }
  page.sections.forEach((section, index) => {
    requireText(section.title, `${prefix}.sections[${index}].title`);
    if (!section.body && (!section.bullets || section.bullets.length === 0)) {
      throw new BookSpecValidationError(
        `${prefix}.sections[${index}] needs body or bullets.`,
      );
    }
  });
}

function validateComparisonPage(page: ComparisonPage, pageIndex: number): void {
  const prefix = `pages[${pageIndex}]`;
  requireText(page.title, `${prefix}.title`);
  requireTextArray(page.columns, `${prefix}.columns`);
  if (page.columns.length < 2) {
    throw new BookSpecValidationError(
      `${prefix}.columns needs at least two columns.`,
    );
  }
  if (!Array.isArray(page.rows) || page.rows.length === 0) {
    throw new BookSpecValidationError(`${prefix}.rows must not be empty.`);
  }
  page.rows.forEach((row, rowIndex) => {
    if (row.length !== page.columns.length) {
      throw new BookSpecValidationError(
        `${prefix}.rows[${rowIndex}] must have ${page.columns.length} cells.`,
      );
    }
    row.forEach((cell, cellIndex) =>
      requireText(cell, `${prefix}.rows[${rowIndex}][${cellIndex}]`),
    );
  });
}

function validatePracticeOpeningPage(
  page: PracticeOpeningPage,
  pageIndex: number,
): void {
  const prefix = `pages[${pageIndex}]`;
  requireText(page.practiceId, `${prefix}.practiceId`);
  requireText(page.practiceKind, `${prefix}.practiceKind`);
  requireText(page.platform, `${prefix}.platform`);
  requireText(page.title, `${prefix}.title`);
  requireText(page.description, `${prefix}.description`);
  if (page.support?.type === "objectives") {
    requireTextArray(page.support.items, `${prefix}.support.items`);
  } else if (page.support?.type === "tip") {
    requireText(page.support.text, `${prefix}.support.text`);
  }
}

function validatePracticeChecklistPage(
  page: PracticeChecklistPage,
  pageIndex: number,
): void {
  const prefix = `pages[${pageIndex}]`;
  requireText(page.title, `${prefix}.title`);
  requireTextArray(page.items, `${prefix}.items`);
}

function validateFlowchartPage(page: FlowchartPage, pageIndex: number): void {
  const prefix = `pages[${pageIndex}]`;
  requireText(page.title, `${prefix}.title`);
  const controlStructures = new Set([
    "linear",
    "if-else",
    "if-else-if",
    "loop",
  ]);
  if (page.controlStructure && !controlStructures.has(page.controlStructure)) {
    throw new BookSpecValidationError(
      `${prefix}.controlStructure is not supported: ${page.controlStructure}`,
    );
  }
  if (page.placeholderHeight !== undefined) {
    const { min, max } = FLOWCHART_PLACEHOLDER_HEIGHT;
    if (
      !Number.isInteger(page.placeholderHeight) ||
      page.placeholderHeight < min ||
      page.placeholderHeight > max
    ) {
      throw new BookSpecValidationError(
        `${prefix}.placeholderHeight must be an integer between ${min} and ${max}.`,
      );
    }
  }
  if (!Array.isArray(page.nodes) || page.nodes.length === 0) {
    throw new BookSpecValidationError(`${prefix}.nodes must not be empty.`);
  }

  const nodeIds = new Set<string>();
  const nodeRoles = new Set([
    "declaration",
    "input",
    "output",
    "process",
    "decision",
  ]);
  page.nodes.forEach((node, index) => {
    requireText(node.id, `${prefix}.nodes[${index}].id`);
    requireText(node.text, `${prefix}.nodes[${index}].text`);
    if (!nodeRoles.has(node.role)) {
      throw new BookSpecValidationError(
        `${prefix}.nodes[${index}].role is not supported: ${node.role}`,
      );
    }
    if (nodeIds.has(node.id)) {
      throw new BookSpecValidationError(
        `${prefix}.nodes contains duplicate id: ${node.id}`,
      );
    }
    nodeIds.add(node.id);
  });

  if (!Array.isArray(page.connections) || page.connections.length === 0) {
    throw new BookSpecValidationError(
      `${prefix}.connections must not be empty.`,
    );
  }
  page.connections.forEach((connection, index) => {
    if (
      connection.label !== undefined &&
      connection.label !== "YES" &&
      connection.label !== "NO"
    ) {
      throw new BookSpecValidationError(
        `${prefix}.connections[${index}].label must be YES or NO.`,
      );
    }
    if (!nodeIds.has(connection.from)) {
      throw new BookSpecValidationError(
        `${prefix}.connections[${index}].from references missing node: ${connection.from}`,
      );
    }
    if (!nodeIds.has(connection.to)) {
      throw new BookSpecValidationError(
        `${prefix}.connections[${index}].to references missing node: ${connection.to}`,
      );
    }
  });
}
