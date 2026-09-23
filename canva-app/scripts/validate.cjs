#!/usr/bin/env node
/**
 * 원고 검증 명령.
 *
 *   npm run validate -- ../coala-book-md/book.md [다른 원고.md ...] [--layout] [--json]
 *
 * Canva 앱이 원고를 올릴 때 쓰는 것과 **같은 파서**(src/parser)를 그대로 부른다.
 * 규칙을 여기에 따로 적지 않는다. 규칙은 파서에만 있고, 이 파일은 파서를
 * 터미널에서 부를 수 있게 하는 입구다.
 *
 * `--layout`을 주면 앱과 같은 배치 엔진(src/builder/layout-book)까지 돌려
 * 원고 페이지마다 Canva 몇 장이 되는지, 이미지·순서도 자리가 어디에 몇 개인지
 * 알려 준다. 배치는 글꼴 정보 없이(Canva 기본 글꼴 가정) 계산하며, 요소를
 * 실제로 만들지는 않으므로 Canva SDK는 최소 대역으로 바꿔 끼운다.
 *
 * 종료 코드: 오류가 없으면 0, 하나라도 있으면 1, 사용법이 틀리면 2.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const swc = require("@swc/core");

// 파서와 배치는 TypeScript다. 빌드 없이 바로 읽는다.
require.extensions[".ts"] = (module, filename) => {
  const { code } = swc.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    module: { type: "commonjs" },
  });
  module._compile(code, filename);
};

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const withLayout = args.includes("--layout");
const files = args.filter((arg) => !arg.startsWith("--"));
if (files.length === 0) {
  console.error(
    "사용법: npm run validate -- <원고.md> [원고.md ...] [--layout] [--json]",
  );
  process.exit(2);
}

const {
  checkBookMarkdown,
  formatManuscriptIssue,
} = require("../src/parser/markdown-book.ts");

/**
 * 배치 엔진이 import하는 Canva SDK를 대역으로 바꾼다. richtext는 글만 모으고,
 * 페이지 추가나 글꼴 조회는 부르지 않는다.
 */
function installCanvaStubs() {
  const stubs = {
    "@canva/design": {
      createRichtextRange: () => {
        let text = "";
        return {
          appendText: (chunk) => {
            const index = text.length;
            text += chunk;
            return { bounds: { index, length: chunk.length } };
          },
          formatParagraph() {},
          formatText() {},
          readPlaintext: () => text,
        };
      },
      addPage: async () => {
        throw new Error("검증 명령은 Canva 페이지를 만들지 않습니다.");
      },
    },
    "@canva/asset": { findFonts: async () => ({ fonts: [] }) },
    "@canva/error": { CanvaError: class CanvaError extends Error {} },
  };
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    return stubs[request] ? request : resolve.call(this, request, ...rest);
  };
  for (const [name, exports] of Object.entries(stubs)) {
    require.cache[name] = { id: name, filename: name, loaded: true, exports };
  }
}

let layoutModules;
function layoutOf(spec) {
  if (!layoutModules) {
    installCanvaStubs();
    layoutModules = {
      ...require("../src/builder/plan-book.ts"),
      ...require("../src/builder/layout-book.ts"),
    };
  }
  const { planBook, layoutBook, collectPendingImages, collectPendingFlowcharts } =
    layoutModules;
  const fonts = {
    familyName: "Canva 디자인 기본 글꼴",
    regularWeight: "normal",
    boldWeight: "bold",
    source: "canva-default",
  };
  const pages = layoutBook(spec, planBook(spec).pages, fonts);
  const counts = new Map();
  for (const page of pages) {
    counts.set(page.sourcePageId, (counts.get(page.sourcePageId) ?? 0) + 1);
  }
  return {
    canvaPages: pages.length,
    pages: spec.pages.map((page) => ({
      id: page.id,
      type: page.type,
      canvaPages: counts.get(page.id) ?? 0,
    })),
    images: collectPendingImages(pages).map((image) => ({
      page: image.pageNumber ?? image.pageTitle,
      src: image.src,
      ratio: image.ratioLabel,
      size: `${image.width}×${image.height}`,
      role: image.role,
      alt: image.alt,
    })),
    flowcharts: collectPendingFlowcharts(pages).map((flowchart) => ({
      page: flowchart.pageNumber ?? flowchart.pageTitle,
      title: flowchart.pageTitle,
      controlStructure: flowchart.controlStructure,
      nodes: flowchart.nodes?.length,
    })),
  };
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
  const report = { file, ok: spec !== undefined, pages: spec?.pages.length, issues };
  if (report.ok && withLayout) {
    try {
      report.layout = layoutOf(spec);
    } catch (error) {
      // 배치 단계의 원고 오류(카드에 들어가지 않는 글 등)도 원고 오류다.
      report.ok = false;
      report.issues = [
        ...issues,
        { severity: "error", message: `배치 오류: ${error.message}` },
      ];
    }
  }
  failed ||= !report.ok;
  return report;
});

if (asJson) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const report of reports) {
    const errors = report.issues.filter((issue) => issue.severity === "error");
    const warnings = report.issues.filter(
      (issue) => issue.severity === "warning",
    );
    const summary = report.layout
      ? `원고 ${report.pages}페이지 → Canva ${report.layout.canvaPages}장`
      : `원고 ${report.pages}페이지`;
    console.log(report.ok ? `✓ ${report.file} — ${summary}` : `✗ ${report.file}`);
    for (const issue of errors) {
      console.log(`  오류  ${formatManuscriptIssue(issue)}`);
    }
    for (const issue of warnings) {
      console.log(`  경고  ${formatManuscriptIssue(issue)}`);
    }
    if (errors.length > 0 || warnings.length > 0) {
      console.log(`  오류 ${errors.length}건, 경고 ${warnings.length}건`);
    }
    if (report.layout) {
      for (const page of report.layout.pages) {
        const split = page.canvaPages > 1 ? "  ← 분할됨" : "";
        console.log(`  ${page.id} (${page.type}): ${page.canvaPages}장${split}`);
      }
      const { images, flowcharts } = report.layout;
      console.log(`  이미지 자리 ${images.length}곳, 순서도 자리 ${flowcharts.length}곳`);
      for (const image of images) {
        const role = image.role === "result" ? " · 실행 결과" : "";
        console.log(
          `    ${image.page}쪽 · ${image.src} · ${image.ratio} · ${image.size}px${role} — ${image.alt}`,
        );
      }
      for (const flowchart of flowcharts) {
        console.log(
          `    ${flowchart.page}쪽 · ${flowchart.title} · ${flowchart.controlStructure ?? "구조 미지정"} · 노드 ${flowchart.nodes ?? "?"}개`,
        );
      }
    }
  }
}
process.exit(failed ? 1 : 0);
