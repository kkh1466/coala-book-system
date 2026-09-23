import type { DesignMetadata, PageId, PageMetadata } from "@canva/design";
import {
  countDesignPages,
  findMissingPageIds,
} from "../src/builder/design-pages";

const metadata = (pages: PageMetadata[]): DesignMetadata =>
  ({
    pageMetadata: pages,
    durationInSeconds: 0,
  }) as DesignMetadata;

const absolutePage = (id?: string): PageMetadata =>
  id ? { type: "absolute", id: id as PageId } : { type: "absolute" };

describe("디자인 페이지 읽기", () => {
  it("페이지 수를 센다", async () => {
    const read = jest
      .fn()
      .mockResolvedValue(metadata([absolutePage("a"), absolutePage("b")]));
    await expect(countDesignPages(read)).resolves.toBe(2);
  });

  it("읽지 못하면 undefined를 돌려준다", async () => {
    const read = jest.fn().mockRejectedValue(new Error("nope"));
    await expect(countDesignPages(read)).resolves.toBeUndefined();
  });
});

describe("이전 실행에서 만든 페이지 확인", () => {
  it("아직 남아 있는 페이지와 사라진 페이지를 가려낸다", async () => {
    const read = jest
      .fn()
      .mockResolvedValue(metadata([absolutePage("a"), absolutePage("c")]));

    const check = await findMissingPageIds(["a", "b"] as PageId[], read);

    expect(check.checked).toBe(true);
    expect(check.missing).toEqual(["b"]);
  });

  it("디자인이 페이지 id를 주지 않으면 확인 불가로 보고한다", async () => {
    const read = jest
      .fn()
      .mockResolvedValue(metadata([absolutePage(), absolutePage()]));

    const check = await findMissingPageIds(["a"] as PageId[], read);

    expect(check.checked).toBe(false);
    expect(check.missing).toEqual([]);
  });

  it("확인할 페이지가 없으면 조회하지 않는다", async () => {
    const read = jest.fn();
    await expect(findMissingPageIds([], read)).resolves.toEqual({
      checked: true,
      missing: [],
    });
    expect(read).not.toHaveBeenCalled();
  });
});
