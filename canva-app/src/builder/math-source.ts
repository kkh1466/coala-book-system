import type { BookPage, BookSpec } from "../types/book-spec";
import { scanMathBlocks } from "../parser/math-block";
import type { ManuscriptIssue } from "../parser/manuscript-lint";

/** Source locations are diagnostic metadata, never SVGs in the manuscript model. */
const locations = new WeakMap<BookSpec, MathSource[]>();
export type MathSource = { tex: string; pageId: string; line?: number };
export function rememberMathSources(
  spec: BookSpec,
  sources: MathSource[],
): void {
  locations.set(spec, sources);
}

type TextField = { text: string; allowed: boolean };
function fields(page: BookPage): TextField[] {
  if (page.type === "concept") {
    const allowed = page.layout !== "cards";
    return [
      { text: page.title, allowed: false },
      { text: page.introduction ?? "", allowed },
      ...page.sections.flatMap((section) => [
        { text: section.title, allowed: false },
        { text: section.content ?? section.body ?? "", allowed },
        ...(!section.content
          ? (section.bullets ?? []).map((text) => ({ text, allowed: false }))
          : []),
      ]),
      { text: page.callout?.text ?? "", allowed: false },
    ];
  }
  const strings = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (typeof value === "object" && value != null)
      return Object.values(value).flatMap(strings);
    return [];
  };
  return strings(page).map((text) => ({ text, allowed: false }));
}

export function mathPageProblems(page: BookPage): string[] {
  return fields(page).flatMap(({ text, allowed }) => {
    const result = scanMathBlocks(text.split("\n"));
    return [
      ...result.problems.map((problem) => problem.message),
      ...(!allowed && result.blocks.length
        ? ['수식 블록은 concept layout="basic" 본문에서만 사용할 수 있습니다.']
        : []),
    ];
  });
}

export function mathSourcesOf(spec: BookSpec): MathSource[] {
  const remembered = [...(locations.get(spec) ?? [])];
  return spec.pages.flatMap((page) =>
    fields(page).flatMap(({ text, allowed }) => {
      if (!allowed) return [];
      return scanMathBlocks(text.split("\n")).blocks.map(({ tex }) => {
        const index = remembered.findIndex(
          (source) => source.pageId === page.id && source.tex === tex,
        );
        const source = index < 0 ? undefined : remembered.splice(index, 1)[0];
        return source ?? { tex, pageId: page.id };
      });
    }),
  );
}

export function mathIssue(
  source: MathSource,
  message: string,
): ManuscriptIssue {
  return {
    severity: "error",
    pageId: source.pageId,
    line: source.line,
    message: `수식 오류: ${message}`,
  };
}
