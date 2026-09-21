import type { BookPage, BookSpec } from "../types/book-spec";

/**
 * 원고를 페이지 순서로 정리한다.
 *
 * 번호는 여기서 매기지 않는다. 한 원고 페이지가 분량 때문에 여러 장으로
 * 나뉠 수 있고, 그 분할은 실제 글 높이를 재야 알 수 있기 때문이다. 번호는
 * 분할이 끝난 뒤 `builder/layout-book.ts`가 확정한다.
 */
export type BookPlan = {
  spec: BookSpec;
  /** 구조 페이지까지 끼워 넣은 최종 원고 페이지 순서. 번호는 아직 없다. */
  pages: BookPage[];
};

/**
 * 페이지 번호를 세지도, 찍지도 않는 페이지 타입.
 *
 * 사용자 확정 정책: "본문만 계수·표시". 표지·목차·구분 페이지는 순번에서
 * 제외되므로 본문 첫 페이지가 1번이 된다.
 * skill/references/page-types.md > "Pagination and contents"가 사용자 확인을
 * 요구한 항목이며, 위 정책으로 확정되었다.
 *
 * 아래 타입들은 아직 구현되지 않았다(다음 과제). 미리 선언해 두어야 해당
 * 렌더러가 추가될 때 번호 정책이 자동으로 적용된다.
 */
export const UNNUMBERED_PAGE_TYPES: ReadonlySet<string> = new Set([
  "cover",
  "toc",
  "divider",
]);

export function isNumberedPage(page: BookPage): boolean {
  return !UNNUMBERED_PAGE_TYPES.has(page.type);
}

/**
 * 표지, 목차, 구분 페이지를 순서에 맞게 끼워 넣는다.
 *
 * 아직 미구현이다. cover/toc/divider 페이지 타입 자체가 없으므로 지금은
 * 원고를 그대로 통과시키고, 지원하지 않는 요청만 분명히 거절한다.
 */
export function insertStructuralPages(
  spec: BookSpec,
  pages: BookPage[],
): BookPage[] {
  if (spec.toc === "auto") {
    throw new Error(
      "자동 목차 생성은 아직 구현되지 않았습니다. 현재 원고에서는 toc: none을 사용해 주세요.",
    );
  }
  return pages;
}

/**
 * 원고를 페이지 순서로 확정한다.
 *
 * 파싱 → 구조 페이지 삽입까지가 이 함수의 책임이다. 그다음 단계인 분량 분할과
 * 쪽번호 확정은 글 높이를 재야 하므로 `builder/layout-book.ts`가 맡는다.
 * 순수 함수이므로 Canva에 쓰기 전에 몇 번이든 호출할 수 있다.
 */
export function planBook(spec: BookSpec): BookPlan {
  return { spec, pages: insertStructuralPages(spec, spec.pages) };
}
