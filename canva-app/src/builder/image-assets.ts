import {
  isImageDirectiveLine,
  tryParseImageDirective,
} from "../parser/image-directive";

/**
 * 원고 폴더에서 넘겨받은 이미지 파일.
 *
 * 원고의 `::image{src="assets/…"}`는 약속일 뿐이고, 파일이 있으면 그 자리에
 * 실제 이미지를 놓고 없으면 자리만 비워 둔다. 파일이 있을 때 **자리의 비율은
 * 원고의 `ratio`가 아니라 파일의 실제 비율**을 따른다. 그래야 잘리지 않는다.
 */
export type ImageAsset = {
  /** 원고에 적힌 그대로의 src. 맵의 키와 같다. */
  src: string;
  fileName: string;
  mimeType: string;
  /** Canva 이미지 요소에 그대로 넘기는 data URL. 검증 명령에서는 비어 있다. */
  dataUrl: string;
  width: number;
  height: number;
  /** 가로 ÷ 세로, 파일 기준. */
  ratio: number;
  /** 사람에게 보여 줄 비율 표기(예: "16:9", "1.48"). */
  ratioLabel: string;
};

export type ResolvedImages = ReadonlyMap<string, ImageAsset>;

/** 폴더에서 온 파일 하나. `relativePath`는 폴더 기준 경로다. */
export type FolderFile = { relativePath: string; file: File };

const IMAGE_EXTENSIONS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * `./`와 `..`를 정리한 슬래시 경로. 앞의 `/`는 없다.
 *
 * 한글은 NFC(완성형)로 맞춘다. macOS는 파일 이름의 한글을 NFD(자모 분리형)로
 * 저장하므로, 원고에 적은 `소개.png`와 폴더에서 온 `소개.png`가 눈에는 같아도
 * 코드 포인트가 달라 짝이 맞지 않는다. 비교 전에 양쪽을 같은 형태로 맞춘다.
 */
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.normalize("NFC").replace(/\\/g, "/").split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

/** 원고 파일 위치를 기준으로 `src`가 가리키는 폴더 기준 경로. */
export function resolveImagePath(markdownPath: string, src: string): string {
  const directory = normalizePath(markdownPath).split("/").slice(0, -1);
  return normalizePath([...directory, src].join("/"));
}

/** 원고 본문에 적힌 이미지 src를 원고 순서대로, 중복 없이 모은다. */
export function imageSrcsOf(source: string): string[] {
  const srcs: string[] = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!isImageDirectiveLine(trimmed)) {
      continue;
    }
    const directive = tryParseImageDirective(trimmed);
    if (directive && !srcs.includes(directive.src)) {
      srcs.push(directive.src);
    }
  }
  return srcs;
}

/**
 * 원고의 이미지 src마다 폴더에서 파일을 찾는다.
 *
 * 먼저 원고 파일이 있는 폴더 기준의 정확한 경로로 찾고, 없으면 폴더 기준 경로가
 * src로 **끝나는** 파일을 찾는다. 그래서 원고 폴더를 통째로 골라도, `assets/`
 * 폴더만 골라도, 그 상위 폴더를 골라도 같은 파일을 찾는다. 여럿이 맞으면 경로가
 * 가장 짧은 것을 쓴다. 대소문자는 구분한다. 못 찾은 src는 `missing`에 남고, 그
 * 자리는 이전처럼 비워 둔다.
 */
export function pairImageFiles(
  markdownPath: string | undefined,
  srcs: readonly string[],
  files: readonly FolderFile[],
): { found: Map<string, FolderFile>; missing: string[] } {
  const entries = files.map(
    (entry) => [normalizePath(entry.relativePath), entry] as const,
  );
  const byPath = new Map(entries);
  const found = new Map<string, FolderFile>();
  const missing: string[] = [];
  for (const src of srcs) {
    const exact =
      markdownPath !== undefined
        ? byPath.get(resolveImagePath(markdownPath, src))
        : undefined;
    const suffix = `/${normalizePath(src)}`;
    const bySuffix = entries
      .filter(([path]) => path === normalizePath(src) || path.endsWith(suffix))
      .sort((a, b) => a[0].length - b[0].length)[0]?.[1];
    const entry = exact ?? bySuffix;
    if (entry) {
      found.set(src, entry);
    } else {
      missing.push(src);
    }
  }
  return { found, missing };
}

/** 픽셀 크기를 사람이 읽는 비율로. 정수비가 작으면 `16:9`, 아니면 소수 두 자리. */
export function ratioLabelOf(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  return w <= 40 && h <= 40 ? `${w}:${h}` : (width / height).toFixed(2);
}

export function mimeTypeOf(file: File): string | undefined {
  if (file.type.startsWith("image/")) {
    return file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS[extension];
}

/** 파일을 읽어 data URL과 픽셀 크기를 돌려준다. 브라우저에서는 실제로 디코딩한다. */
export type ImageDecoder = (
  file: File,
) => Promise<{ dataUrl: string; width: number; height: number }>;

export const browserImageDecoder: ImageDecoder = async (file) => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
  const size = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () =>
        reject(new Error("이미지로 열 수 없는 파일입니다."));
      image.src = dataUrl;
    },
  );
  return { dataUrl, ...size };
};

export type ImageLoadFailure = {
  src: string;
  fileName: string;
  reason: string;
};

/**
 * 짝이 맞은 파일을 모두 읽는다. 하나가 실패해도 나머지는 쓰고, 실패한 자리는
 * 비워 둔다.
 */
export async function loadImageAssets(
  found: ReadonlyMap<string, FolderFile>,
  decode: ImageDecoder = browserImageDecoder,
): Promise<{ images: Map<string, ImageAsset>; failures: ImageLoadFailure[] }> {
  const images = new Map<string, ImageAsset>();
  const failures: ImageLoadFailure[] = [];
  await Promise.all(
    [...found.entries()].map(async ([src, entry]) => {
      const mimeType = mimeTypeOf(entry.file);
      if (!mimeType) {
        failures.push({
          src,
          fileName: entry.file.name,
          reason:
            "이미지 형식이 아닙니다(png, jpg, gif, webp만 넣을 수 있습니다).",
        });
        return;
      }
      try {
        const { dataUrl, width, height } = await decode(entry.file);
        if (width <= 0 || height <= 0) {
          throw new Error("크기를 읽지 못했습니다.");
        }
        images.set(src, {
          src,
          fileName: entry.file.name,
          mimeType,
          dataUrl,
          width,
          height,
          ratio: width / height,
          ratioLabel: ratioLabelOf(width, height),
        });
      } catch (error) {
        failures.push({
          src,
          fileName: entry.file.name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
  return { images, failures };
}
