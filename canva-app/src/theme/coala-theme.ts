export const coalaTheme = {
  canvas: {
    width: 1587,
    height: 2245,
  },
  colors: {
    pageBackground: "#F8F9FA",
    contentsBackground: "#DFE9F2",
    primary: "#1800AD",
    text: "#000000",
    secondaryText: "#737373",
    cardFill: "#FFFFFF",
    softBorder: "#D8DDE3",
    tipFill: "#EAF1FF",
    keySummaryFill: "#FFFAB3",
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
    loopDivider: "#1800AD",
    connector: "#737373",
    /** 이미지 자리표시자. 이미지를 넣으면 채움이 통째로 바뀌므로 남지 않는다. */
    placeholderFill: "#E3E7EC",
    placeholderText: "#5B6673",
  },
  /**
   * 활자와 지면 치수는 여기 없다.
   *
   * 크기는 `theme/typography.ts`의 TYPOGRAPHY가, 여백과 안전 영역은
   * `theme/page-layout.ts`가 단독으로 정한다. 같은 값을 두 곳에 두면 한쪽만
   * 고치는 사고가 나므로 이 파일에는 색과 지면 크기, 순서도 자산만 남긴다.
   */
  // Only values explicitly supplied by the flowchart rules are fixed here.
  flowchart: {
    fontFamily: "Hakgyoansim Chilpanjiugae OTF",
    loopDividerWeight: 10,
    connectorStrokeWeight: null,
    graphics: {
      declaration: "MAE7lCxHi8M",
      input: "MAGpWHDxa1c",
      output: "MAGpWDtQbCc",
      process: "MAGpWHT7x4M",
      decision: "MAGpWETGMb4",
    },
  },
} as const;

export type CoalaTheme = typeof coalaTheme;
