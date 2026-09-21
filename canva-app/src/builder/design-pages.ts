import type { PageId, PageMetadata } from "@canva/design";
import { getDesignMetadata } from "@canva/design";

/**
 * 디자인의 페이지를 읽는 얇은 래퍼.
 *
 * 설치된 @canva/design 2.13.0에서 페이지에 대해 **읽을 수 있는 것**은
 * `getDesignMetadata()`의 `pageMetadata`뿐이다. 각 항목은 `type`과 선택적인
 * `id`, `title`, `dimensions`를 가지며 순서는 보장되지 않는다.
 * **페이지를 지우거나 특정 위치에 되돌리는 API는 없다.** 그래서 이 파일은
 * 개수 확인과 id 확인만 제공하고, 없는 기능을 흉내 내지 않는다.
 */

async function readPageMetadata(
  read: typeof getDesignMetadata,
): Promise<PageMetadata[] | undefined> {
  try {
    const metadata = await read();
    const pages = metadata?.pageMetadata;
    if (!pages) {
      return undefined;
    }
    return Array.from(pages);
  } catch {
    return undefined;
  }
}

/** 현재 디자인의 페이지 수. 읽지 못하면 undefined. */
export async function countDesignPages(
  read: typeof getDesignMetadata = getDesignMetadata,
): Promise<number | undefined> {
  const pages = await readPageMetadata(read);
  return pages?.length;
}

export type CreatedPagesCheck = {
  /** 확인을 실제로 할 수 있었는가. surface가 id를 주지 않으면 false. */
  checked: boolean;
  /** 이전 실행에서 만들었지만 지금은 디자인에 없는 페이지. */
  missing: PageId[];
};

/**
 * 이전 실행에서 만든 페이지가 아직 디자인에 남아 있는지 확인한다.
 *
 * `AbsolutePageMetadata.id`는 선택 항목이다. 디자인이 id를 하나도 주지 않으면
 * 확인할 방법이 없으므로 `checked: false`로 정직하게 돌려주고, 호출부는
 * "확인 불가"로 안내한다.
 */
export async function findMissingPageIds(
  pageIds: readonly PageId[],
  read: typeof getDesignMetadata = getDesignMetadata,
): Promise<CreatedPagesCheck> {
  if (pageIds.length === 0) {
    return { checked: true, missing: [] };
  }
  const pages = await readPageMetadata(read);
  if (!pages) {
    return { checked: false, missing: [] };
  }
  const present = new Set<PageId>();
  for (const page of pages) {
    if (page.type === "absolute" && page.id) {
      present.add(page.id);
    }
  }
  if (present.size === 0) {
    return { checked: false, missing: [] };
  }
  return {
    checked: true,
    missing: pageIds.filter((pageId) => !present.has(pageId)),
  };
}
