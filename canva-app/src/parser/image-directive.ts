/**
 * 이미지 자리표시자 지시자.
 *
 * 원고에는 "여기에 이 이미지가 들어간다"는 약속만 적는다. 파일이 아직 없어도
 * 된다. 앱은 선언된 비율만큼 자리를 비워 두고, 나중에 Canva에서 그 자리에
 * 이미지를 끌어다 놓으면 끝난다.
 *
 *   ::image{src="assets/ch01/step-01.png" alt="새 프로젝트 화면" ratio="16:9"}
 *
 * 닫는 줄이 없는 **한 줄** 형식이다. `:::`만 있는 줄은 page 구역을 닫으므로
 * (`markdown-book.ts`의 extractPages) 여닫는 블록 형식은 쓸 수 없다.
 */
export type ImageWidth = "text" | "full" | "half";

export type ImageDirective = {
  /** 넣을 예정인 파일의 상대 경로. 파일이 아직 없어도 된다. */
  src: string;
  /** 이미지가 무엇을 보여 주는지. 자리표시자 라벨과 보고 목록에 쓴다. */
  alt: string;
  /** 가로 ÷ 세로. 비워 둘 높이를 정한다. */
  ratio: number;
  /** 원고에 적힌 그대로의 비율 표기(예: "16:9"). */
  ratioLabel: string;
  /** 원고가 비율을 직접 적었는가. 기본값을 썼다면 보고 목록에서 알린다. */
  ratioDeclared: boolean;
  width: ImageWidth;
  /** 자리 아래에 놓이는 실제 캡션. 이미지를 넣은 뒤에도 남는다. */
  caption?: string;
  /**
   * `result`면 코드 블록의 GUI 실행 결과다. 자리 위에 "실행 결과" 라벨이 영구히
   * 놓이고, 코드 블록 바로 뒤에만 올 수 있다(`code-result.ts`).
   */
  role?: "result";
};

export class ImageDirectiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageDirectiveError";
  }
}

export const DEFAULT_IMAGE_RATIO_LABEL = "16:9";

/** 너무 길쭉한 자리는 지면에 놓을 수 없다. */
const MIN_RATIO = 0.25;
const MAX_RATIO = 4;

const DIRECTIVE_START = /^\s*::image(?![A-Za-z0-9_-])/;
const DIRECTIVE_LINE = /^\s*::image\{(.*)\}\s*$/;
const ALLOWED_KEYS = new Set([
  "src",
  "alt",
  "ratio",
  "width",
  "caption",
  "role",
]);
const ALLOWED_WIDTHS: readonly ImageWidth[] = ["text", "full", "half"];

/** 이 줄이 이미지 지시자로 시작하는가. 형식이 맞는지는 따지지 않는다. */
export function isImageDirectiveLine(line: string): boolean {
  return DIRECTIVE_START.test(line);
}

/** `16:9` 또는 `1.5` 형식의 비율을 가로 ÷ 세로로 읽는다. 1:4에서 4:1까지. */
export function parseRatio(value: string): number {
  const pair = value.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  const ratio = pair
    ? Number(pair[1]) / Number(pair[2])
    : /^\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new ImageDirectiveError(
      `image ratio는 "16:9" 또는 "1.5" 형식이어야 합니다: ${value}`,
    );
  }
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
    throw new ImageDirectiveError(
      `image ratio는 1:4에서 4:1 사이여야 합니다: ${value}`,
    );
  }
  return ratio;
}

function parseAttributes(source: string): Record<string, string> {
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
      throw new ImageDirectiveError(`중복된 image 속성입니다: ${key}`);
    }
    if (!ALLOWED_KEYS.has(key)) {
      throw new ImageDirectiveError(
        `지원하지 않는 image 속성입니다: ${key} (src, alt, ratio, width, caption, role만 쓸 수 있습니다)`,
      );
    }
    attributes[key] = value;
    consumed += match[0];
  }
  if (source.replace(/\s+/g, "") !== consumed.replace(/\s+/g, "")) {
    throw new ImageDirectiveError(
      'image 속성은 key="value" 형식으로 작성해야 합니다.',
    );
  }
  return attributes;
}

/** 지시자 한 줄을 읽는다. 형식이 틀리면 `ImageDirectiveError`를 던진다. */
export function parseImageDirective(line: string): ImageDirective {
  const matched = line.match(DIRECTIVE_LINE);
  if (!matched) {
    throw new ImageDirectiveError(
      'image 지시자는 ::image{src="..." alt="..."} 형식의 한 줄이어야 합니다.',
    );
  }
  const attributes = parseAttributes(matched[1] ?? "");

  const src = attributes.src?.trim();
  if (!src) {
    throw new ImageDirectiveError("image에는 src가 필요합니다.");
  }
  if (
    /^([a-z][a-z0-9+.-]*:|\/|\\)/i.test(src) ||
    /(^|\/)\.\.(\/|$)/.test(src)
  ) {
    throw new ImageDirectiveError(
      `image src는 원고 기준 상대 경로여야 합니다: ${src}`,
    );
  }
  const alt = attributes.alt?.trim();
  if (!alt) {
    throw new ImageDirectiveError(
      "image에는 alt(이미지가 보여 주는 내용)가 필요합니다.",
    );
  }

  const ratioLabel = attributes.ratio?.trim() || DEFAULT_IMAGE_RATIO_LABEL;
  const width = (attributes.width?.trim() || "text") as ImageWidth;
  if (!ALLOWED_WIDTHS.includes(width)) {
    throw new ImageDirectiveError(
      `image width는 text, full, half 중 하나여야 합니다: ${width}`,
    );
  }
  const caption = attributes.caption?.trim();
  const role = attributes.role?.trim();
  if (role !== undefined && role !== "result") {
    throw new ImageDirectiveError(
      `image role은 result만 쓸 수 있습니다: ${role}`,
    );
  }

  return {
    src,
    alt,
    ratio: parseRatio(ratioLabel),
    ratioLabel,
    ratioDeclared: Boolean(attributes.ratio?.trim()),
    width,
    ...(caption ? { caption } : {}),
    ...(role === "result" ? { role: "result" as const } : {}),
  };
}

/** 던지지 않는 판. 형식이 틀린 줄은 `undefined`. */
export function tryParseImageDirective(
  line: string,
): ImageDirective | undefined {
  try {
    return parseImageDirective(line);
  } catch {
    return undefined;
  }
}
