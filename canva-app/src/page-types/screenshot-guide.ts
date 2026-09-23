import type { ResolvedBookFonts } from "../theme/font-resolver";
import type { ScreenshotGuidePage } from "../types/book-spec";
import type { PagePart } from "./page-part";
import { layoutStepCards } from "./step-cards";

/**
 * 스크린샷 따라하기 페이지.
 *
 * 원본 process-steps.png의 STEP 카드 구조에 step-by-step-guide.png의 화면
 * 캡처를 합쳤다. 단계마다 카드 하나, 카드 안에 캡처 자리 하나. 배치는
 * `step-cards.ts`가 맡는다.
 */
export function layoutScreenshotGuide(
  page: ScreenshotGuidePage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  return layoutStepCards(page, fonts);
}
