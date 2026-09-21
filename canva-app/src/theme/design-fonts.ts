import type { Font, FontRef } from "@canva/asset";
import { findFonts } from "@canva/asset";
import type { DesignEditing } from "@canva/design";
import { openDesign } from "@canva/design";

/**
 * 현재 디자인이 실제로 쓰고 있는 글꼴 수집.
 *
 * findFonts()는 Canva 글꼴의 일부만 돌려준다(SDK 타입 정의의 명시된 제약).
 * 그래서 편집기에서 멀쩡히 쓰이는 Wanted Sans가 그 목록에 없을 수 있다.
 *
 * 디자인 안의 텍스트 요소에는 실제로 적용된 fontRef가 들어 있다. 그 ref를
 * 모아 findFonts({ fontRefs })로 되물으면 Canva가 그 글꼴의 진짜 이름과
 * 굵기를 돌려준다. 하드코딩한 ID가 아니라 SDK가 준 값만 쓴다.
 *
 * 이 경로는 보조 수단이다. 실패하거나 아무것도 못 찾아도 생성을 막지 않는다.
 */

/** 훑어볼 페이지 수 상한. 큰 디자인에서 생성 시작이 느려지지 않게 한다. */
export const MAX_SCANNED_PAGES = 20;

/** 모을 fontRef 수 상한. */
export const MAX_COLLECTED_REFS = 50;

export type DesignFontScan = {
  fonts: Font[];
  /** 훑는 도중 실패했다면 그 사유. 화면에 그대로 보여 준다. */
  error?: string;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function collectFromElements(
  elements: readonly DesignEditing.AbsoluteElement[] | readonly DesignEditing.GroupContentElement[],
  refs: Set<FontRef>,
): void {
  for (const element of elements) {
    if (refs.size >= MAX_COLLECTED_REFS) {
      return;
    }
    if (element.type === "text") {
      for (const region of element.text.readTextRegions()) {
        const fontRef = region.formatting?.fontRef;
        if (fontRef) {
          refs.add(fontRef);
        }
      }
    } else if (element.type === "group") {
      collectFromElements(element.contents.toArray(), refs);
    }
  }
}

async function collectDesignFontRefs(
  openDesignImpl: typeof openDesign,
): Promise<FontRef[]> {
  const refs = new Set<FontRef>();
  await openDesignImpl({ type: "all_pages" }, async (session) => {
    const pageRefs = session.pageRefs.toArray().slice(0, MAX_SCANNED_PAGES);
    for (const pageRef of pageRefs) {
      if (pageRef.type !== "absolute" || refs.size >= MAX_COLLECTED_REFS) {
        continue;
      }
      // 읽기만 한다. session.sync()를 부르지 않으므로 디자인은 바뀌지 않는다.
      await session.helpers.openPage(pageRef, async ({ page }) => {
        collectFromElements(page.elements.toArray(), refs);
      });
    }
  });
  return [...refs];
}

export async function scanDesignFonts(
  deps: {
    openDesign?: typeof openDesign;
    findFonts?: typeof findFonts;
  } = {},
): Promise<DesignFontScan> {
  const openDesignImpl = deps.openDesign ?? openDesign;
  const findFontsImpl = deps.findFonts ?? findFonts;
  try {
    const fontRefs = await collectDesignFontRefs(openDesignImpl);
    if (fontRefs.length === 0) {
      return { fonts: [] };
    }
    // ref로 되묻는 경로는 목록 조회와 달리 "일부만 반환"이라는 제약이 없다.
    const { fonts } = await findFontsImpl({ fontRefs });
    return { fonts: [...fonts] };
  } catch (error) {
    return { fonts: [], error: describeError(error) };
  }
}
