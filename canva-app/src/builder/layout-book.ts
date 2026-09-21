import type { BookPage, BookSpec } from "../types/book-spec";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { PagePart } from "../page-types/page-part";
import type { PendingFlowchartReport } from "../types/pending-flowchart";
import type { PendingImageReport } from "../types/pending-image";
import { layoutPage } from "./create-page";
import { isNumberedPage } from "./plan-book";

/**
 * 책 한 권을 물리 페이지 목록으로 배치한다.
 *
 * 순서가 중요하다. **분할이 끝난 뒤에** 쪽번호를 매긴다. 원고 한 페이지가
 * 세 장으로 나뉘면 쪽번호도 세 개 나간다. 번호를 먼저 매기고 나중에 나누면
 * 번호가 어긋난다.
 */
export type LaidOutPage = PagePart & {
  /** 원고 페이지 유형. 진행 표시와 오류 보고에 쓴다. */
  pageType: string;
  /** 이 물리 페이지를 만든 원고 페이지의 id. */
  sourcePageId: string;
  /** 원고 페이지 안에서 몇 번째 장인지(0부터). */
  partIndex: number;
  /** 원고 페이지가 모두 몇 장이 됐는지. */
  partCount: number;
  /** 최종 쪽번호. 번호를 매기지 않는 페이지는 undefined. */
  pageNumber?: string;
};

export function layoutBook(
  spec: BookSpec,
  pages: readonly BookPage[],
  fonts: ResolvedBookFonts,
): LaidOutPage[] {
  const laidOut: Omit<LaidOutPage, "pageNumber">[] = [];

  for (const page of pages) {
    const parts = layoutPage(page, fonts);
    parts.forEach((part, partIndex) => {
      laidOut.push({
        ...part,
        pageType: page.type,
        sourcePageId: page.id,
        partIndex,
        partCount: parts.length,
      });
    });
  }

  if (spec.numbering === "none") {
    return laidOut;
  }

  const numberedPageIds = new Set(
    pages.filter((page) => isNumberedPage(page)).map((page) => page.id),
  );
  let next = 1;
  return laidOut.map((page) =>
    numberedPageIds.has(page.sourcePageId)
      ? { ...page, pageNumber: String(next++) }
      : page,
  );
}

/**
 * 비워 둔 이미지 자리를 책 전체에서 모은다.
 *
 * 생성이 끝난 뒤 "이 목록만 채우면 이미지 작업이 끝난다"를 보여 주기 위한
 * 것이다. 순서는 지면 순서와 같다.
 */
export function collectPendingImages(
  pages: readonly LaidOutPage[],
): PendingImageReport[] {
  return pages.flatMap((page, index) =>
    (page.pendingImages ?? []).map((image) => ({
      ...image,
      designPage: index + 1,
      pageNumber: page.pageNumber,
      pageTitle: page.title,
    })),
  );
}

/** 비워 둔 순서도 자리를 책 전체에서 모은다. 순서는 지면 순서와 같다. */
export function collectPendingFlowcharts(
  pages: readonly LaidOutPage[],
): PendingFlowchartReport[] {
  return pages.flatMap((page, index) =>
    (page.pendingFlowcharts ?? []).map((flowchart) => ({
      ...flowchart,
      designPage: index + 1,
      pageNumber: page.pageNumber,
      pageTitle: page.title,
    })),
  );
}
