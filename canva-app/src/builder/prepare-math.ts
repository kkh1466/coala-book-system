import type { BookSpec } from "../types/book-spec";
import { validateBookSpec } from "../types/book-spec";
import { MarkdownBookParseError } from "../parser/markdown-book";
import type { ManuscriptIssue } from "../parser/manuscript-lint";
import { mathIssue, mathSourcesOf } from "./math-source";
import type { MathSource } from "./math-source";
import type { RenderedMath } from "../math/render-math";
import { TYPOGRAPHY, toCanvaFontSize } from "../theme/typography";
import { coalaTheme } from "../theme/coala-theme";

export type PreparedMath = RenderedMath & MathSource;
export type ResolvedMath = ReadonlyMap<string, PreparedMath>;
export type MathProgress = { completed: number; total: number };

/** No engine/font loading for existing manuscripts without math. Complete the
 * entire preflight before any Canva write, including invalid later equations. */
export async function prepareMath(
  spec: BookSpec,
  onProgress?: (event: MathProgress) => void,
): Promise<{ math: ResolvedMath; count: number }> {
  validateBookSpec(spec);
  const sources = mathSourcesOf(spec);
  const math = new Map<string, PreparedMath>();
  if (!sources.length) return { math, count: 0 };
  onProgress?.({ completed: 0, total: sources.length });
  const { renderMath } = await import("../math/render-math");
  const issues: ManuscriptIssue[] = [];
  sources.forEach((source, index) => {
    try {
      if (!math.has(source.tex)) {
        math.set(source.tex, {
          ...renderMath(
            source.tex,
            toCanvaFontSize(TYPOGRAPHY.body),
            coalaTheme.colors.primary,
          ),
          ...source,
        });
      }
    } catch (error) {
      issues.push(
        mathIssue(
          source,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    onProgress?.({ completed: index + 1, total: sources.length });
  });
  if (issues.length) {
    throw new MarkdownBookParseError(
      issues[0]?.message ?? "수식 오류",
      issues[0]?.line,
      issues,
    );
  }
  return { math, count: sources.length };
}
