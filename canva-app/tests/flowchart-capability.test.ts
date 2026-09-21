import {
  assertFlowchartLibraryAssetSupport,
  FlowchartLibraryAssetUnavailableError,
  REQUIRED_FLOWCHART_GRAPHICS,
} from "../src/page-types/flowchart";

describe("strict flowchart capability guard", () => {
  it("keeps the user-specified Canva graphics IDs", () => {
    expect(
      Object.fromEntries(
        Object.entries(REQUIRED_FLOWCHART_GRAPHICS).map(([role, asset]) => [
          role,
          asset.id,
        ]),
      ),
    ).toEqual({
      declaration: "MAE7lCxHi8M",
      input: "MAGpWHDxa1c",
      output: "MAGpWDtQbCc",
      process: "MAGpWHT7x4M",
      decision: "MAGpWETGMb4",
    });
  });

  it("stops instead of generating substitute vector shapes", () => {
    expect(() => assertFlowchartLibraryAssetSupport()).toThrow(
      FlowchartLibraryAssetUnavailableError,
    );
    expect(() => assertFlowchartLibraryAssetSupport()).toThrow(
      "임의 벡터 도형으로 대체하지 않았습니다",
    );
  });
});
