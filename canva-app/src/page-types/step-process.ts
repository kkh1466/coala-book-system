import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { StepProcessPage } from "../types/book-spec";
import type { PagePart } from "./page-part";
import { layoutStepCards } from "./step-cards";

/**
 * 단계별 진행 페이지.
 *
 * 원본 process-steps.png 그대로다. 캡처 없이 글만으로 "STEP n. 동작" 카드를
 * 이어 놓는다. 화면 캡처가 필요한 따라하기는 `screenshot-guide`를 쓴다.
 */
export function layoutStepProcess(
  page: StepProcessPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  return layoutStepCards(page, fonts);
}
