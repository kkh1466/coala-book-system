import { addPage } from "@canva/design";
import type { ElementAtPoint, PageMetadata } from "@canva/design";
import { coalaTheme } from "../theme/coala-theme";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { BookPage } from "../types/book-spec";
import { layoutChapterOpening } from "../page-types/chapter-opening";
import { layoutFlowchart } from "../page-types/flowchart";
import { layoutConcept } from "../page-types/concept";
import { layoutComparison } from "../page-types/comparison";
import { layoutPracticeOpening } from "../page-types/practice-opening";
import { layoutPracticeChecklist } from "../page-types/practice-checklist";
import { layoutScreenshotGuide } from "../page-types/screenshot-guide";
import { layoutStepProcess } from "../page-types/step-process";
import type { PagePart } from "../page-types/page-part";
import { buildPageNumber } from "../page-types/shared";

export type PreparedPage = {
  title: string;
  elements: ElementAtPoint[];
  /**
   * 물리 페이지를 구분하는 키(`원고 페이지 id#조각 번호`). 한 원고 페이지가
   * 여러 장으로 나뉘면 제목(`…(계속)`)이 겹칠 수 있으므로 제목 대신 이 값으로
   * 페이지를 식별한다. 같은 페이지의 재시도는 같은 키를 가진다.
   */
  key: string;
};

/**
 * 원고 페이지 하나를 물리 페이지 목록으로 배치한다.
 *
 * 분량이 안전 영역을 넘으면 여러 장이 된다. 글자 크기는 어느 장에서도 같다.
 */
export function layoutPage(
  page: BookPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  switch (page.type) {
    case "chapter-opening":
      return layoutChapterOpening(page, fonts);
    case "concept":
      return layoutConcept(page, fonts);
    case "comparison":
      return layoutComparison(page, fonts);
    case "practice-opening":
      return layoutPracticeOpening(page, fonts);
    case "practice-checklist":
      return layoutPracticeChecklist(page, fonts);
    case "flowchart":
      // 순서도는 그리지 않는다. 자리를 비워 두고 사용자가 Canva에서 지정된
      // 요소로 직접 만든다. 대체 도형으로 흉내 내지 않는다.
      return layoutFlowchart(page, fonts);
    case "screenshot-guide":
      return layoutScreenshotGuide(page, fonts);
    case "step-process":
      return layoutStepProcess(page, fonts);
    default:
      throw new Error(
        `지원하지 않는 페이지 형식입니다: ${String(
          (page as { type?: unknown }).type,
        )}`,
      );
  }
}

/** 배치가 끝난 페이지에 쪽번호를 붙여 Canva에 보낼 형태로 만든다. */
export function preparePage(
  part: PagePart & { sourcePageId?: string; partIndex?: number },
  fonts: ResolvedBookFonts,
  pageNumber?: string,
): PreparedPage {
  return {
    title: part.title,
    key:
      part.sourcePageId !== undefined
        ? `${part.sourcePageId}#${part.partIndex ?? 0}`
        : part.title,
    elements: [...part.elements, ...buildPageNumber(pageNumber, fonts)],
  };
}

/**
 * 페이지 하나를 Canva에 추가한다.
 *
 * 페이지와 그 안의 모든 요소는 addPage() 한 번의 호출로 함께 만들어진다.
 * 돌려받은 PageMetadata는 "이 페이지가 실제로 추가됐다"는 유일한 증거이며,
 * 재시도할 때 같은 페이지를 다시 만들지 않기 위해 호출부가 보관한다.
 */
export async function createPage(page: PreparedPage): Promise<PageMetadata> {
  return addPage({
    title: page.title,
    dimensions: coalaTheme.canvas,
    background: { color: coalaTheme.colors.pageBackground },
    elements: page.elements,
  });
}
