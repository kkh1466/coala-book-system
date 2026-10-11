import fs from "node:fs";
import path from "node:path";
import type { ElementAtPoint } from "@canva/design";
import type { ImageAsset } from "../src/builder/image-assets";
import {
  imageSrcsOf,
  loadImageAssets,
  normalizePath,
  pairImageFiles,
  ratioLabelOf,
  resolveImagePath,
} from "../src/builder/image-assets";
import { collectPlacedImages, layoutBook } from "../src/builder/layout-book";
import { planBook } from "../src/builder/plan-book";
import { parseBookMarkdown } from "../src/parser/markdown-book";
import { PAGE, TEXT_WIDTH } from "../src/theme/page-layout";
import { imageSizeOf } from "../src/utils/image-size";
import {
  findText,
  installRecordingRichtext,
  textElements,
  wantedSansFonts,
} from "./helpers/richtext";

beforeEach(() => {
  installRecordingRichtext();
});

const FRONT_MATTER = ["---", "schema_version: 1", "title: 시험", "---", ""];
const book = (...lines: string[]): string =>
  [...FRONT_MATTER, ...lines].join("\n");

const file = (name: string, type = "image/png"): File =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

/** PNG 헤더만 있는 바이트. 크기 판독에는 IHDR까지만 필요하다. */
const pngBytes = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
};

const asset = (src: string, width: number, height: number): ImageAsset => ({
  src,
  fileName: src.split("/").pop() ?? src,
  mimeType: "image/png",
  dataUrl: `data:image/png;base64,${src}`,
  width,
  height,
  ratio: width / height,
  ratioLabel: ratioLabelOf(width, height),
});

type Shape = Extract<ElementAtPoint, { type: "shape" }> & {
  width: number;
  height: number;
};
type ImageEl = Extract<ElementAtPoint, { type: "image" }> & {
  width: number;
  height: number;
};
const dropTargets = (elements: readonly ElementAtPoint[]): Shape[] =>
  elements.filter(
    (element): element is Shape =>
      element.type === "shape" &&
      element.paths.some((shapePath) => shapePath.fill.dropTarget === true),
  );
const images = (elements: readonly ElementAtPoint[]): ImageEl[] =>
  elements.filter((element): element is ImageEl => element.type === "image");

describe("이미지 파일 크기 판독", () => {
  it("PNG·JPEG·GIF 헤더에서 크기를 읽고 다른 형식은 undefined다", () => {
    expect(imageSizeOf(pngBytes(1280, 720))).toEqual({
      width: 1280,
      height: 720,
    });

    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
      0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01,
      0x03, 0x11, 0x01,
    ]);
    expect(imageSizeOf(jpeg)).toEqual({ width: 800, height: 600 });

    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00, 0, 0,
    ]);
    expect(imageSizeOf(gif)).toEqual({ width: 320, height: 240 });

    expect(imageSizeOf(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
  });

  it("보관된 픽스처 PNG의 크기를 읽는다", () => {
    const bytes = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "../test-input/assets/smoke/first-screen.png",
      ),
    );
    expect(imageSizeOf(new Uint8Array(bytes))).toEqual({
      width: 800,
      height: 600,
    });
  });
});

describe("폴더의 파일과 원고의 src 짝 맞추기", () => {
  it("원고 파일 위치 기준 상대 경로로 찾고, 없는 것은 missing에 남긴다", () => {
    expect(normalizePath("./a/./b/../c.png")).toBe("a/c.png");
    expect(resolveImagePath("ch05/book.md", "assets/ch05/x.png")).toBe(
      "ch05/assets/ch05/x.png",
    );
    expect(resolveImagePath("book.md", "./assets/x.png")).toBe("assets/x.png");

    const { found, missing } = pairImageFiles(
      "ch05/book.md",
      ["assets/ch05/a.png", "assets/ch05/b.png", "assets/ch05/c.PNG"],
      [
        {
          relativePath: "ch05/book.md",
          file: file("book.md", "text/markdown"),
        },
        { relativePath: "ch05/assets/ch05/a.png", file: file("a.png") },
        { relativePath: "ch05/assets/ch05/c.png", file: file("c.png") },
      ],
    );

    expect([...found.keys()]).toEqual(["assets/ch05/a.png"]);
    expect(missing).toEqual(["assets/ch05/b.png", "assets/ch05/c.PNG"]);
  });

  it("정확한 경로가 없으면 경로 끝부분이 src와 같은 파일을 찾는다", () => {
    // 이미지 폴더만 골랐을 때(assets/)와 그 상위 폴더를 골랐을 때 모두 찾는다.
    const { found: fromAssets } = pairImageFiles(
      "book.md",
      ["assets/ch05/a.png"],
      [{ relativePath: "assets/ch05/a.png", file: file("a.png") }],
    );
    const { found: fromParent, missing } = pairImageFiles(
      undefined,
      ["assets/ch05/a.png", "assets/ch05/b.png"],
      [
        { relativePath: "책/ch05/assets/ch05/a.png", file: file("a.png") },
        { relativePath: "책/other/x/assets/ch05/a.png", file: file("a2.png") },
      ],
    );

    expect(fromAssets.get("assets/ch05/a.png")?.file.name).toBe("a.png");
    // 여럿이 맞으면 경로가 짧은 쪽이다.
    expect(fromParent.get("assets/ch05/a.png")?.file.name).toBe("a.png");
    expect(missing).toEqual(["assets/ch05/b.png"]);
  });

  it("macOS가 NFD로 저장한 한글 파일 이름도 원고의 NFC src와 짝이 맞는다", () => {
    // 원고는 NFC(완성형)로 적히고, macOS 파일 이름은 NFD(자모 분리형)로 온다.
    const nfc = "assets/ipynb 소개.png".normalize("NFC");
    const nfd = "assets/ipynb 소개.png".normalize("NFD");
    expect(nfc).not.toBe(nfd);

    const { found, missing } = pairImageFiles(
      "ai-math2/book.md",
      [nfc],
      [
        {
          relativePath: `ai-math2/${nfd}`,
          file: file("ipynb 소개.png".normalize("NFD")),
        },
      ],
    );

    expect(found.get(nfc)?.file.name.normalize("NFC")).toBe("ipynb 소개.png");
    expect(missing).toEqual([]);

    // 이미지 폴더만 골랐을 때(끝부분 비교)도 같다.
    const { found: fromAssets } = pairImageFiles(
      "book.md",
      [nfc],
      [{ relativePath: nfd, file: file("ipynb 소개.png".normalize("NFD")) }],
    );
    expect(fromAssets.has(nfc)).toBe(true);
  });

  it("원고 본문의 이미지 src를 순서대로, 중복 없이 모은다", () => {
    const source = book(
      ':::page{type="concept" id="p1"}',
      "# 제목",
      "",
      "## 소제목",
      "",
      '::image{src="assets/a.png" alt="a" ratio="16:9"}',
      "",
      "본문",
      "",
      '::image{src="assets/b.png" alt="b" ratio="4:3" role="result"}',
      '::image{src="assets/a.png" alt="다시 a" ratio="16:9"}',
      ":::",
    );

    expect(imageSrcsOf(source)).toEqual(["assets/a.png", "assets/b.png"]);
  });

  it("파일을 읽어 자산으로 만들고, 실패한 파일은 자리로 남긴다", async () => {
    const found = new Map([
      ["assets/a.png", { relativePath: "assets/a.png", file: file("a.png") }],
      [
        "assets/b.txt",
        { relativePath: "assets/b.txt", file: file("b.txt", "text/plain") },
      ],
      ["assets/c.png", { relativePath: "assets/c.png", file: file("c.png") }],
    ]);
    const decode = async (entry: File) => {
      if (entry.name === "c.png") {
        throw new Error("깨진 파일");
      }
      return { dataUrl: "data:image/png;base64,AAA", width: 800, height: 600 };
    };

    const { images: loaded, failures } = await loadImageAssets(found, decode);

    expect([...loaded.keys()]).toEqual(["assets/a.png"]);
    expect(loaded.get("assets/a.png")).toMatchObject({
      fileName: "a.png",
      mimeType: "image/png",
      width: 800,
      height: 600,
      ratio: 4 / 3,
      ratioLabel: "4:3",
    });
    expect(failures.map((failure) => failure.src).sort()).toEqual([
      "assets/b.txt",
      "assets/c.png",
    ]);
  });

  it("비율 표기는 작은 정수비면 a:b, 아니면 소수 두 자리다", () => {
    expect(ratioLabelOf(1280, 720)).toBe("16:9");
    expect(ratioLabelOf(800, 600)).toBe("4:3");
    expect(ratioLabelOf(1000, 1000)).toBe("1:1");
    expect(ratioLabelOf(1366, 768)).toBe("1.78");
  });
});

describe("파일이 있는 자리에 실제 이미지 놓기", () => {
  const source = book(
    ':::page{type="concept" id="p1" layout="basic"}',
    "# 제목",
    "",
    "## 소제목",
    "",
    "앞 문단입니다.",
    "",
    '::image{src="assets/found.png" alt="찾은 그림" ratio="16:9" caption="그림 1"}',
    "",
    '::image{src="assets/missing.png" alt="없는 그림" ratio="16:9"}',
    "",
    "뒤 문단입니다.",
    ":::",
  );
  const layoutWith = (resolved?: Map<string, ImageAsset>) => {
    const spec = parseBookMarkdown(source);
    return layoutBook(
      spec,
      planBook(spec).pages,
      resolved ? { ...wantedSansFonts, images: resolved } : wantedSansFonts,
    );
  };

  it("파일이 없으면 이전과 똑같이 모든 자리를 비워 둔다", () => {
    const [page] = layoutWith();

    expect(dropTargets(page?.elements ?? [])).toHaveLength(2);
    expect(images(page?.elements ?? [])).toHaveLength(0);
    expect(page?.pendingImages).toHaveLength(2);
    expect(page?.placedImages).toBeUndefined();
  });

  it("파일이 있는 자리는 이미지 요소가 되고 비율은 파일을 따르며, 없는 자리는 그대로다", () => {
    const pages = layoutWith(
      new Map([["assets/found.png", asset("assets/found.png", 800, 600)]]),
    );
    // 4:3 파일은 원고의 16:9보다 높아 뒤의 자리가 다음 페이지로 밀릴 수 있다.
    const elements = pages.flatMap((page) => page.elements);
    const [placed] = images(elements);
    const [pending] = dropTargets(elements);

    expect(images(elements)).toHaveLength(1);
    expect(dropTargets(elements)).toHaveLength(1);
    // 원고는 16:9라고 했지만 파일이 4:3이므로 자리는 4:3이다.
    expect(placed?.width).toBe(TEXT_WIDTH);
    expect(placed?.height).toBe(Math.round(TEXT_WIDTH / (4 / 3)));
    expect(placed?.dataUrl).toBe("data:image/png;base64,assets/found.png");
    expect(placed?.altText).toEqual({ text: "찾은 그림", decorative: false });
    // 없는 자리는 원고의 비율 그대로다.
    expect(pending?.height).toBe(Math.round(TEXT_WIDTH / (16 / 9)));
    // 안내 라벨은 빈 자리에만 있고, 캡션은 채운 이미지 바로 아래에 그대로 있다.
    expect(
      textElements(elements).filter((text) =>
        text.text.includes("이미지 자리"),
      ),
    ).toHaveLength(1);
    expect(findText(elements, "그림 1").top).toBe(
      (placed?.top ?? 0) + (placed?.height ?? 0) + 4,
    );
    // 읽는 순서는 원고 그대로: 채운 이미지 → 빈 자리 → 뒤 문단.
    const pageOf = (predicate: (page: (typeof pages)[number]) => boolean) =>
      pages.findIndex(predicate);
    const placedPage = pageOf((page) => images(page.elements).length > 0);
    const pendingPage = pageOf((page) => dropTargets(page.elements).length > 0);
    const afterPage = pageOf((page) =>
      textElements(page.elements).some(
        (text) => text.text === "뒤 문단입니다.",
      ),
    );
    expect(placedPage).toBeLessThanOrEqual(pendingPage);
    expect(pendingPage).toBeLessThanOrEqual(afterPage);
    const after = findText(pages[afterPage]?.elements ?? [], "뒤 문단입니다.");
    const pendingBottom =
      pendingPage === afterPage
        ? (pending?.top ?? 0) + (pending?.height ?? 0)
        : 0;
    expect(after.top).toBeGreaterThan(pendingBottom);
  });

  it("채운 이미지와 비워 둔 자리를 따로 보고하고, 비율이 달라졌음을 알린다", () => {
    const pages = layoutWith(
      new Map([["assets/found.png", asset("assets/found.png", 800, 600)]]),
    );
    const placed = collectPlacedImages(pages);

    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({
      src: "assets/found.png",
      fileName: "found.png",
      ratioLabel: "4:3",
      manuscriptRatioLabel: "16:9",
      ratioChanged: true,
      pageNumber: "1",
    });
    expect(
      pages
        .flatMap((page) => page.pendingImages ?? [])
        .map((image) => image.src),
    ).toEqual(["assets/missing.png"]);
  });

  it("세로로 긴 파일도 지면에 맞춰 비율을 지킨 채 줄어들고 안전 영역 안에 놓인다", () => {
    const pages = layoutWith(
      new Map([["assets/found.png", asset("assets/found.png", 600, 2400)]]),
    );
    const placed = pages.flatMap((page) => images(page.elements));
    const [tall] = placed;

    expect(placed).toHaveLength(1);
    expect(Math.round(((tall?.width ?? 0) / (tall?.height ?? 1)) * 100)).toBe(
      25,
    );
    expect((tall?.top ?? 0) + (tall?.height ?? 0)).toBeLessThanOrEqual(
      PAGE.safeBottom,
    );
    expect(collectPlacedImages(pages)[0]?.scaledToFit).toBe(true);
  });
});
