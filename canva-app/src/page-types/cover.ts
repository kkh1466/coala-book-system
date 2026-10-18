import type { ElementAtPoint } from "@canva/design";
import type { CoverPage } from "../types/book-spec";
import type { ResolvedBookFonts } from "../theme/font-resolver";
import { coalaTheme } from "../theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../theme/typography";
import { CONTENT_WIDTH, COVER, PAGE } from "../theme/page-layout";
import { createRichText } from "../builder/element-factory";
import { measureText } from "../layout/measure";
import type { PagePart } from "./page-part";

/**
 * 표지를 만든다.
 *
 * 원본 cover.png의 배치를 따른다. 위쪽 가운데에 제작사 표시, 왼쪽 여백에서
 * 시작하는 큰 제목(과 부제목), 아래쪽 가운데에 기관명. 표지는 한 장을 넘지
 * 않으며 쪽번호를 찍지 않는다(`plan-book.ts`의 UNNUMBERED_PAGE_TYPES).
 *
 * 그라데이션 배경은 `addPage()`가 받지 않으므로 단색 `coverBackground`를 쓴다.
 * 로고 이미지는 원고가 줄 수 없으므로 기관명은 글로만 놓는다.
 */
export function layoutCover(
  page: CoverPage,
  fonts: ResolvedBookFonts,
): PagePart[] {
  const { colors } = coalaTheme;
  const elements: ElementAtPoint[] = [];

  if (page.brand) {
    elements.push(
      createRichText({
        left: PAGE.marginX,
        top: COVER.mark.top,
        width: CONTENT_WIDTH,
        text: page.brand,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.coverMark,
        role: "coverMark",
        fontWeight: fonts.boldWeight,
        color: colors.text,
        textAlign: "center",
        lineHeightEm: LINE_HEIGHT.single,
      }),
    );
  }

  const titleHeight = measureText(page.title, {
    fontSize: TYPOGRAPHY.coverTitle,
    width: COVER.title.width,
    lineHeightEm: LINE_HEIGHT.chapterTitle,
  });
  elements.push(
    createRichText({
      left: PAGE.marginX,
      top: COVER.title.top,
      width: COVER.title.width,
      text: page.title,
      fontRef: fonts.fontRef,
      fontSize: TYPOGRAPHY.coverTitle,
      role: "coverTitle",
      fontWeight: fonts.boldWeight,
      color: colors.text,
      lineHeightEm: LINE_HEIGHT.chapterTitle,
    }),
  );

  if (page.subtitle) {
    elements.push(
      createRichText({
        left: PAGE.marginX,
        top: COVER.title.top + titleHeight + COVER.subtitleGap,
        width: CONTENT_WIDTH,
        text: page.subtitle,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.coverSubtitle,
        role: "coverSubtitle",
        fontWeight: fonts.regularWeight,
        color: colors.secondaryText,
        lineHeightEm: LINE_HEIGHT.chapterSubtitle,
      }),
    );
  }

  if (page.institution) {
    elements.push(
      createRichText({
        left: PAGE.marginX,
        top: COVER.institution.top,
        width: CONTENT_WIDTH,
        text: page.institution,
        fontRef: fonts.fontRef,
        fontSize: TYPOGRAPHY.coverInstitution,
        role: "coverInstitution",
        fontWeight: fonts.boldWeight,
        color: colors.text,
        textAlign: "center",
        lineHeightEm: LINE_HEIGHT.single,
      }),
    );
  }

  return [
    {
      title: page.title,
      elements,
      background: colors.coverBackground,
    },
  ];
}
