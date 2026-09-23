#!/usr/bin/env node
/**
 * 원고 검증 명령.
 *
 *   npm run validate -- ../coala-book-md/book.md [다른 원고.md ...]
 *
 * Canva 앱이 원고를 올릴 때 쓰는 것과 **같은 파서**(src/parser)를 그대로 부른다.
 * 규칙을 여기에 따로 적지 않는다. 규칙은 파서에만 있고, 이 파일은 파서를
 * 터미널에서 부를 수 있게 하는 입구다.
 *
 * 종료 코드: 오류가 없으면 0, 하나라도 있으면 1, 사용법이 틀리면 2.
 */
const fs = require("node:fs");
const path = require("node:path");
const swc = require("@swc/core");

// 파서는 TypeScript이고 Canva SDK에 의존하지 않는다. 빌드 없이 바로 읽는다.
require.extensions[".ts"] = (module, filename) => {
  const { code } = swc.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    module: { type: "commonjs" },
  });
  module._compile(code, filename);
};

const {
  checkBookMarkdown,
  formatManuscriptIssue,
} = require("../src/parser/markdown-book.ts");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const files = args.filter((arg) => !arg.startsWith("--"));
if (files.length === 0) {
  console.error("사용법: npm run validate -- <원고.md> [원고.md ...] [--json]");
  process.exit(2);
}

// npm은 스크립트를 package.json 위치에서 실행한다. 사용자가 명령을 친 자리를
// 기준으로 경로를 읽어야 상대 경로가 어긋나지 않는다.
const baseDir = process.env.INIT_CWD || process.cwd();

let failed = false;
const reports = files.map((file) => {
  const fullPath = path.resolve(baseDir, file);
  let source;
  try {
    source = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    failed = true;
    return {
      file,
      ok: false,
      issues: [
        { severity: "error", message: `파일을 읽을 수 없습니다: ${error.message}` },
      ],
    };
  }
  const { spec, issues } = checkBookMarkdown(source);
  const ok = spec !== undefined;
  failed ||= !ok;
  return { file, ok, pages: spec?.pages.length, issues };
});

if (asJson) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const report of reports) {
    const errors = report.issues.filter((issue) => issue.severity === "error");
    const warnings = report.issues.filter(
      (issue) => issue.severity === "warning",
    );
    console.log(
      report.ok
        ? `✓ ${report.file} — 원고 ${report.pages}페이지`
        : `✗ ${report.file}`,
    );
    for (const issue of errors) {
      console.log(`  오류  ${formatManuscriptIssue(issue)}`);
    }
    for (const issue of warnings) {
      console.log(`  경고  ${formatManuscriptIssue(issue)}`);
    }
    if (errors.length > 0 || warnings.length > 0) {
      console.log(`  오류 ${errors.length}건, 경고 ${warnings.length}건`);
    }
  }
}
process.exit(failed ? 1 : 0);
