/** One shared scanner for parsing, linting and direct BookSpec validation.
 * Code/dialogue fences are literal and never become equations. */
export type MathBlock = { tex: string; start: number; end: number };
export type MathProblem = { line: number; message: string };

export function scanMathBlocks(lines: readonly string[]): {
  blocks: MathBlock[];
  problems: MathProblem[];
  mask: boolean[];
} {
  const blocks: MathBlock[] = [];
  const problems: MathProblem[] = [];
  const mask = lines.map(() => false);
  let fence: string | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    const marker = line.match(/^(```+|~~~+)/)?.[1];
    if (fence) {
      if (line === fence) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    if (line !== "$$") {
      if (hasMathDelimiter(line)) {
        problems.push({
          line: index,
          message:
            '수식은 concept layout="basic" 본문에서 독립된 $$ 줄로 여닫아야 합니다. 인라인·제목·목록·표·강조 박스 안 수식은 지원하지 않습니다.',
        });
      }
      continue;
    }
    if ((lines[index] ?? "") !== "$$") {
      problems.push({
        line: index,
        message:
          "수식 $$ 표시는 들여쓰기 없이 줄 맨 앞에 작성해 주세요. 목록 안에는 수식을 넣을 수 없습니다.",
      });
    }
    const end = lines.findIndex(
      (candidate, at) => at > index && candidate.trim() === "$$",
    );
    const last = end < 0 ? lines.length - 1 : end;
    for (let at = index; at <= last; at += 1) mask[at] = true;
    if (end < 0) {
      problems.push({
        line: index,
        message: "수식 블록을 닫는 $$ 줄이 없습니다.",
      });
      break;
    }
    if ((lines[end] ?? "") !== "$$") {
      problems.push({
        line: end,
        message:
          "수식을 닫는 $$ 표시는 들여쓰기 없이 줄 맨 앞에 작성해 주세요.",
      });
    }
    const tex = lines
      .slice(index + 1, end)
      .join("\n")
      .trim();
    if (!tex)
      problems.push({ line: index, message: "수식 블록이 비어 있습니다." });
    blocks.push({ tex, start: index, end });
    index = end;
  }
  return { blocks, problems, mask };
}

function hasMathDelimiter(line: string): boolean {
  return /\$\$|\$[^$\n]+\$|\\[()[\]]/.test(line);
}
