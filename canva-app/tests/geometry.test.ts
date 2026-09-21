import { circlePath, roundedRectPath } from "../src/utils/geometry";

describe("native vector geometry", () => {
  it.each([roundedRectPath(100, 50, 10), circlePath(50)])(
    "creates a closed Canva-compatible path",
    (pathData) => {
      expect(pathData.startsWith("M ")).toBe(true);
      expect(pathData.endsWith("Z")).toBe(true);
      expect(pathData).not.toContain(" Q ");
    },
  );
});
