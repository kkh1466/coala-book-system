import type { ElementAtPoint } from "@canva/design";
import type { PendingFlowchart } from "../types/pending-flowchart";
import type { PendingImage } from "../types/pending-image";

/**
 * 물리 페이지 하나.
 *
 * 원고의 한 페이지가 분량 때문에 여러 장이 되면 여기 여러 개가 생긴다.
 * 쪽번호는 책 전체의 분할이 끝난 뒤에 붙으므로 여기에는 없다.
 */
export type PagePart = {
  /** Canva 페이지 제목. 두 번째 조각부터 `(계속)`이 붙는다. */
  title: string;
  /** 쪽번호를 제외한 이 페이지의 모든 요소. */
  elements: ElementAtPoint[];
  /** 이 페이지에 비워 둔 이미지 자리. 하나도 없으면 필드 자체가 없다. */
  pendingImages?: PendingImage[];
  /** 이 페이지에 비워 둔 순서도 자리. 하나도 없으면 필드 자체가 없다. */
  pendingFlowcharts?: PendingFlowchart[];
};
