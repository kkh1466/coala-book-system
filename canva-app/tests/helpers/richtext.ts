import type { ElementAtPoint, RichtextFormatting } from "@canva/design";
import { createRichtextRange } from "@canva/design";
import type { FontRef } from "@canva/asset";
import type { ResolvedBookFonts } from "../../src/theme/font-resolver";
import { toEditorPoints } from "../../src/theme/typography";

/**
 * Canva에 실제로 전달된 서식을 기록하는 richtext 대역.
 *
 * "상수는 50인데 Canva에는 더 작게 간다"는 문제를 잡으려면 상수가 아니라
 * **SDK 호출 인자**를 봐야 한다. 이 대역은 `createRichtextRange()`가 돌려주는
 * 객체를 흉내 내면서 `appendText`, `formatParagraph`, `formatText`에 들어온
 * 값을 그대로 보관한다.
 */
export type RecordedRichtext = {
  text: string;
  paragraph: RichtextFormatting[];
  inline: { index: number; length: number; formatting: Record<string, unknown> }[];
};

type RecordingRange = {
  __record: RecordedRichtext;
  appendText: (characters: string) => { bounds: { index: number; length: number } };
  formatParagraph: (
    bounds: { index: number; length: number },
    formatting: RichtextFormatting,
  ) => void;
  formatText: (
    bounds: { index: number; length: number },
    formatting: Record<string, unknown>,
  ) => void;
};

/** 테스트 시작 시 호출한다. 이후 만들어지는 모든 richtext가 기록된다. */
export function installRecordingRichtext(): void {
  jest.mocked(createRichtextRange).mockImplementation(() => {
    const record: RecordedRichtext = { text: "", paragraph: [], inline: [] };
    const range: RecordingRange = {
      __record: record,
      appendText: (characters) => {
        const index = record.text.length;
        record.text += characters;
        return { bounds: { index, length: characters.length } };
      },
      formatParagraph: (_bounds, formatting) => {
        record.paragraph.push(formatting);
      },
      formatText: (bounds, formatting) => {
        record.inline.push({ ...bounds, formatting });
      },
    };
    return range as never;
  });
}

export type TextElement = RecordedRichtext & {
  left: number;
  top: number;
  width: number;
  /** SDK `formatParagraph`에 실제로 넘어간 `fontSize`(디자인 px). */
  fontSize?: number;
  /** 위 값이 Canva 편집기 툴바에 찍히는 pt. `fontSize ÷ (96/72)`. */
  fontSizePt?: number;
  fontWeight?: string;
  color?: string;
  lineHeightEm?: number;
  fontRef?: FontRef;
};

/** 요소 목록에서 텍스트 요소만 골라 기록과 함께 돌려준다. */
export function textElements(
  elements: readonly ElementAtPoint[],
): TextElement[] {
  return elements
    .filter(
      (element): element is Extract<ElementAtPoint, { type: "richtext" }> =>
        element.type === "richtext",
    )
    .map((element) => {
      const record = (element.range as unknown as RecordingRange).__record;
      const paragraph = record.paragraph[0] ?? {};
      return {
        ...record,
        left: element.left,
        top: element.top,
        width: element.width ?? 0,
        fontSize: paragraph.fontSize,
        fontSizePt:
          paragraph.fontSize === undefined
            ? undefined
            : Math.round(toEditorPoints(paragraph.fontSize) * 1000) / 1000,
        fontWeight: paragraph.fontWeight as string | undefined,
        color: paragraph.color,
        lineHeightEm: paragraph.lineHeightEm,
        fontRef: paragraph.fontRef,
      };
    });
}

/** 정확히 이 글을 담은 텍스트 요소 하나를 찾는다. */
export function findText(
  elements: readonly ElementAtPoint[],
  text: string,
): TextElement {
  const found = textElements(elements).filter((element) =>
    element.text.trim() === text.trim(),
  );
  if (found.length !== 1) {
    throw new Error(
      `'${text}'를 담은 텍스트 요소가 ${found.length}개입니다. 다음 중에서 찾았습니다:\n` +
        textElements(elements)
          .map((element) => `  - ${JSON.stringify(element.text)}`)
          .join("\n"),
    );
  }
  return found[0] as TextElement;
}

/** 이 글로 시작하는 텍스트 요소를 모두 찾는다. */
export function findTexts(
  elements: readonly ElementAtPoint[],
  predicate: (text: string) => boolean,
): TextElement[] {
  return textElements(elements).filter((element) => predicate(element.text));
}

export const wantedSansFonts: ResolvedBookFonts = {
  familyName: "Wanted Sans",
  fontRef: "wanted-sans-ref" as FontRef,
  regularWeight: "normal",
  boldWeight: "bold",
  source: "findFonts",
};

/** Wanted Sans를 못 찾았을 때의 대체 글꼴 상태(fontRef 없음). */
export const fallbackFonts: ResolvedBookFonts = {
  familyName: "디자인 기본 글꼴",
  regularWeight: "normal",
  boldWeight: "bold",
  source: "canva-default",
};
