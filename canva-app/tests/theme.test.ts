import { coalaTheme } from "../src/theme/coala-theme";
import { LINE_HEIGHT, TYPOGRAPHY } from "../src/theme/typography";
import { CONTENT_WIDTH, PAGE } from "../src/theme/page-layout";

describe("Coala theme", () => {
  it("keeps the canonical Canva export dimensions", () => {
    expect(coalaTheme.canvas).toEqual({ width: 1587, height: 2245 });
    expect(coalaTheme.canvas.height).toBeGreaterThan(coalaTheme.canvas.width);
  });

  it("keeps the fixed type sizes in a single place", () => {
    // 크기의 출처는 TYPOGRAPHY 하나뿐이다. coalaTheme은 더 이상 크기를
    // 들고 있지 않으므로, 두 곳이 어긋날 방법이 없다.
    expect(TYPOGRAPHY.chapterTitle).toBe(50);
    expect(TYPOGRAPHY.chapterSubtitle).toBe(30);
    expect(TYPOGRAPHY.sectionTitle).toBe(30);
    expect(TYPOGRAPHY.subsectionTitle).toBe(30);
    expect(TYPOGRAPHY.body).toBe(28);
    expect(TYPOGRAPHY.bullet).toBe(28);
    expect(TYPOGRAPHY.learningObjective).toBe(28);
    expect(TYPOGRAPHY.emphasis).toBe(28);
    expect(coalaTheme).not.toHaveProperty("typography");
  });

  it("keeps the same left and right margin on every page", () => {
    expect(PAGE.marginX * 2 + CONTENT_WIDTH).toBe(PAGE.width);
  });

  it("keeps line spacing inside the range the SDK accepts", () => {
    // RichtextFormatting.lineHeightEm: 최소 0.5, 최대 2.5, 기본 1.4.
    for (const value of Object.values(LINE_HEIGHT)) {
      expect(value).toBeGreaterThanOrEqual(1.2);
      expect(value).toBeLessThanOrEqual(2.5);
    }
  });

  it("uses valid six-digit hex colors", () => {
    const colors = Object.values(coalaTheme.colors).filter(
      (color) => color !== undefined,
    );
    expect(colors.every((color) => /^#[0-9A-F]{6}$/i.test(color))).toBe(true);
  });

  it("keeps the confirmed flowchart colors and divider weight", () => {
    expect(coalaTheme.colors).toMatchObject({
      declarationFill: "#FFFAB3",
      declarationStroke: "#F3B96B",
      inputFill: "#DFF1FE",
      inputStroke: "#1800AD",
      processFill: "#D9FAD3",
      processStroke: "#00BF63",
      decisionFill: "#FFDEE7",
      decisionStroke: "#FF5757",
      ifElseContainerFill: "#FFDEE7",
      ifElseContainerStroke: "#FF5757",
      outputFill: "#FFF3E8",
      outputStroke: "#F3B96B",
      loopFill: "#EBEBF9",
      loopStroke: "#1800AD",
      connector: "#737373",
    });
    expect(coalaTheme.flowchart.loopDividerWeight).toBe(10);
    expect(coalaTheme.flowchart.connectorStrokeWeight).toBeNull();
  });
});
