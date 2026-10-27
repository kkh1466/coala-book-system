import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import type { LiteText } from "mathjax-full/js/adaptors/lite/Text.js";
import type { LiteDocument } from "mathjax-full/js/adaptors/lite/Document.js";
import type { UnknownBBox } from "mathjax-full/js/output/common/OutputJax.js";
import type TexError from "mathjax-full/js/input/tex/TexError.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import { parse } from "opentype.js";
import { gunzipSync } from "fflate";
import fontData from "../../assets/fonts/wanted-sans-regular.json";

/** Paths and metrics use the same bundled font in Node and the browser. */
const bytes = Uint8Array.from(atob(fontData.gzipBase64), (char) =>
  char.charCodeAt(0),
);
const font = parse(gunzipSync(bytes).buffer as ArrayBuffer);
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

/** MathJax's default unknown-character SVG uses <text> and approximate widths.
 * Replace both with actual outlines/metrics, including Korean in \\text{}. */
class OutlineSVG extends SVG<LiteElement, LiteText, LiteDocument> {
  private readonly metrics = new WeakMap<LiteElement, UnknownBBox>();

  override unknownText(text: string, _variant: string): LiteElement {
    for (const char of text) {
      if (!/\s/.test(char) && font.charToGlyphIndex(char) === 0) {
        throw new Error(`수식 글꼴에 없는 문자입니다: ${char}`);
      }
    }
    const path = font.getPath(text, 0, 0, 1000);
    const box = path.getBoundingBox();
    const node = this.svg("g", { transform: "scale(1,-1)" }, [
      this.svg("path", { d: path.toPathData(3) }),
    ]);
    this.metrics.set(node, {
      w: font.getAdvanceWidth(text, 1000) / 1000,
      h: Math.max(0, -box.y1 / 1000),
      d: Math.max(0, box.y2 / 1000),
    });
    return node;
  }

  override measureTextNode(node: LiteElement): UnknownBBox {
    const metrics = this.metrics.get(node);
    if (!metrics) {
      throw new Error("수식 글자의 크기를 계산하지 못했습니다.");
    }
    return metrics;
  }
}

export type RenderedMath = {
  svg: string;
  dataUrl: string;
  width: number;
  height: number;
  baseline: number;
};

/** Kept bounded so repeated file selection does not retain every SVG forever. */
const cache = new Map<string, RenderedMath>();
const CACHE_LIMIT = 128;

export function renderMath(
  tex: string,
  em: number,
  color: string,
): RenderedMath {
  const key = JSON.stringify([tex, em, color]);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  if (!tex.trim() || tex.length > 10000) {
    throw new Error("수식은 비어 있거나 10,000자를 넘을 수 없습니다.");
  }
  // Only mathematical packages are installed. No external assets, links or macros
  // whose definitions could leak into another formula are accepted.
  if (
    /\\(?:def|gdef|edef|xdef|let|newcommand|renewcommand|require|href|url|style|class|cssId|html\w*|includegraphics|tag|label)\b/.test(
      tex,
    )
  ) {
    throw new Error(
      "수식에는 정의·외부 자료·링크·번호 지정 명령을 사용할 수 없습니다.",
    );
  }
  const input = new TeX<LiteElement, LiteText, LiteDocument>({
    packages: ["base", "ams"],
    maxBuffer: 10000,
    maxMacros: 1000,
    formatError: (_jax: unknown, error: TexError) => {
      throw new Error(error.message);
    },
  });
  const output = new OutlineSVG({
    fontCache: "none",
    internalSpeechTitles: false,
  });
  const doc = mathjax.document("", { InputJax: input, OutputJax: output });
  const container = doc.convert(tex, {
    display: true,
    em,
    ex: em * 0.442,
    containerWidth: 100000,
  }) as LiteElement;
  const svgNode = adaptor.firstChild(container) as LiteElement;
  const viewBox = adaptor
    .getAttribute(svgNode, "viewBox")
    .split(/\s+/)
    .map(Number);
  const [x, y, w, h] = viewBox;
  if (
    [x, y, w, h].some(
      (value) => value === undefined || !Number.isFinite(value),
    ) ||
    !w ||
    !h
  ) {
    throw new Error("수식 크기를 계산하지 못했습니다.");
  }
  // A little real padding protects strokes at the edge of the exported viewport.
  const padding = 60;
  const width = ((w + padding * 2) / 1000) * em;
  const height = ((h + padding * 2) / 1000) * em;
  adaptor.setAttribute(
    svgNode,
    "viewBox",
    `${(x ?? 0) - padding} ${(y ?? 0) - padding} ${w + padding * 2} ${h + padding * 2}`,
  );
  adaptor.setAttribute(svgNode, "width", `${width}px`);
  adaptor.setAttribute(svgNode, "height", `${height}px`);
  adaptor.setAttribute(svgNode, "color", color);
  adaptor.removeAttribute(svgNode, "style");
  const svg = adaptor.outerHTML(svgNode).replace(/currentColor/g, color);
  if (/<(?:text|foreignObject|image|use)\b/.test(svg)) {
    throw new Error("수식에 독립 SVG로 만들 수 없는 요소가 있습니다.");
  }
  const result = {
    svg,
    // Outlines contain only ASCII XML; UTF-8 labels live in altText, not the SVG.
    dataUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    width,
    height,
    baseline: ((padding - (y ?? 0)) / 1000) * em,
  };
  if (cache.size >= CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, result);
  return result;
}
