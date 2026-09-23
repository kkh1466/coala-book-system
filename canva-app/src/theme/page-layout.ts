/**
 * 지면 치수와 요소 사이 여백의 유일한 출처.
 *
 * 이전 구현은 각 렌더러가 `top += 430`처럼 고정 슬롯을 썼다. 내용이 짧으면
 * 그 슬롯이 통째로 빈 공간으로 남고(학습 목표와 본문 사이의 큰 공백), 길면
 * 아래 요소를 덮었다. 지금은 모든 세로 위치를 "이전 요소의 실제 높이 + 유형별
 * 여백"으로 계산한다(`src/layout/flow.ts`).
 */
export const PAGE = {
  width: 1587,
  height: 2245,
  /** 좌우 여백. 모든 페이지에서 같다. */
  marginX: 165,
  /** 본문이 시작될 수 있는 가장 위. */
  safeTop: 145,
  /**
   * 본문이 내려갈 수 있는 가장 아래. 쪽번호 영역(2155~) 위에서 끊는다.
   * 이 선을 넘기 전에 페이지를 나눈다.
   */
  safeBottom: 2090,
} as const;

/** 카드·표·강조 박스가 쓰는 전체 단 너비. */
export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

/**
 * 흐르는 본문의 너비.
 *
 * 원본 chapter-opening.png의 본문 글줄은 x≈160에서 시작해 x≈1350에서 접힌다.
 * 그 폭 1190px은 28pt(37.3px em) 기준 한 줄 약 32자로, 한국어 교재의 권장
 * 범위 안이다. 좌측 여백은 다른 요소와 같으므로 페이지 사이의 여백 일관성은
 * 그대로 유지된다.
 */
export const TEXT_WIDTH = 1190;

/**
 * 요소 유형별 세로 여백.
 *
 * "다음 요소 Y = 이전 요소 Y + 이전 요소의 실제 높이 + 아래 여백" 규칙에서
 * 마지막 항이다. 줄 간격 2가 이미 글줄 사이에 em 하나만큼의 공기를 넣으므로
 * (28pt 기준 위아래 18.7px씩), 원본에서 이어진 글줄·목록 항목은 추가 여백
 * 없이 74px 간격으로 놓여 있다. 아래 값은 원본 PNG에서 잰 것이다.
 */
export const GAP = {
  /** 문단과 문단 사이. 원본은 줄 간격만으로 문단을 구분한다. */
  paragraph: 0,
  /** 문단 다음에 목록이 올 때. */
  beforeList: 0,
  /** 목록 항목 사이. 원본 학습 목표 항목 간격 74px = 줄 간격뿐. */
  listItem: 0,
  /** 목록 다음에 다른 내용이 올 때. */
  afterList: 0,
  /** 섹션 제목 아래. 원본: 제목 잉크 464 → 안내문 잉크 574. */
  afterHeading: 28,
  /** 앞 섹션이 끝나고 다음 섹션 제목이 시작되기 전. 원본: 944 → 1128. */
  beforeHeading: 110,
  /** 강조 박스 위아래. 원본 practice-opening1.png: 카드 하단 → Tip 상단 93px. */
  callout: 92,
  /** 학습 목표 안내문 아래. 원본은 안내문과 첫 항목이 74px 간격. */
  afterObjectiveIntro: 0,
  /** 학습 목표 항목 사이. */
  objectiveItem: 0,
  /** 표의 위아래. */
  table: 40,
  /** 글 다음에 이미지 자리가 올 때. 제목 아래 여백과 같다. */
  beforeImage: 28,
  /** 이미지 자리(캡션 포함) 다음에 다른 내용이 올 때. */
  afterImage: 28,
  /** 이미지 자리와 캡션 사이. 캡션 줄 간격이 이미 위쪽 공기를 만든다. */
  imageCaption: 4,
  /** 글 다음에 프롬프트 상자가 올 때. 이미지 앞 여백과 같다. */
  beforePrompt: 28,
  /** 프롬프트 상자와 응답 상자 사이. 원본 ai-prompt-response.png: 358 → 397. */
  promptToResponse: 40,
  /** 응답 상자 다음에 다른 내용이 올 때. 원본: 상자 하단 1070 → 다음 제목 잉크 1116. */
  afterResponse: 44,
  /** 글과 코드 상자 사이. 이미지 앞뒤 여백과 같다. */
  beforeCode: 28,
  afterCode: 28,
} as const;

/**
 * 코드 상자. 원본 교재에 예시가 없어 앱이 정한 값이며, 강조 박스의 안쪽 여백과
 * 모서리를 그대로 따른다. 글자 크기는 본문 28pt, 줄 간격은 전역값 2다.
 */
export const CODE_BOX = {
  paddingX: 46,
  paddingTop: 36,
  paddingBottom: 36,
  /** 언어 라벨과 코드 사이. */
  afterLabel: 8,
  radius: 24,
  /** 탭 하나를 몇 칸으로 바꾸는가. */
  tabWidth: 4,
  /** 코드 상자와 그 아래 "실행 결과" 라벨 사이. */
  beforeResultLabel: 28,
  /** "실행 결과" 라벨과 결과 상자(또는 결과 이미지 자리) 사이. */
  afterResultLabel: 8,
} as const;

/** 강조 박스 안쪽 여백. */
export const CALLOUT_PADDING = {
  x: 46,
  top: 36,
  bottom: 36,
  /** 박스 제목과 본문 사이 */
  afterTitle: 18,
} as const;

/**
 * 스크린샷 따라하기의 STEP 카드. 원본 process-steps.png에서 잰 값이다.
 *
 * 카드는 흰색 채움에 테두리가 없고 모서리 반지름 72px, 카드 사이 100px 간격의
 * 가운데에 아래쪽 화살표가 놓인다. 제목 "STEP 1. …"은 30pt 굵게, 본문은 28pt.
 */
export const STEP_CARD = {
  radius: 72,
  paddingX: 60,
  /** 카드 위쪽 여백. 원본: 카드 상단 379 → 제목 잉크 444, 30pt 줄 상자 기준. */
  paddingTop: 40,
  paddingBottom: 48,
  /** 제목과 본문 사이. 원본: 제목 잉크 444 → 첫 본문 잉크 554. */
  afterTitle: 32,
  /** 도입문과 첫 카드 사이. 원본: 도입문 잉크 하단 307 → 카드 상단 379. */
  beforeFirst: 50,
  /** 카드와 카드 사이. 화살표가 이 안에 놓인다. 원본: 966 → 1066. */
  gap: 100,
  arrow: {
    width: 93,
    height: 94,
    shaftWidth: 48,
    shaftHeight: 48,
  },
} as const;

/**
 * AI 프롬프트·응답 상자. 원본 ai-prompt-response.png에서 잰 값이다.
 *
 * 프롬프트 상자는 높이의 절반을 반지름으로 하는 알약형이고(한 줄일 때 높이
 * 114px), 응답 상자는 모서리 반지름 70px의 둥근 사각형이다. 둘 다 테두리 2px에
 * 채움이 없다. 원본의 `+`·마이크 아이콘은 장식이라 넣지 않는다.
 */
export const PROMPT_BOX = {
  /** 프롬프트 상자의 위아래 안쪽 여백. 한 줄 글(74.7px) + 20 × 2 ≈ 114. */
  paddingY: 20,
  /**
   * 프롬프트 글을 상자 안에서 아래로 내리는 양.
   *
   * Canva는 줄 간격 2의 여분 공간을 글자 위보다 아래에 더 둔다. 실제 생성한
   * 페이지를 재면 글자가 상자 중심보다 16px 위에 있었다(위 25px, 아래 57px).
   * 상자 높이는 그대로 두고 글만 이만큼 내려 가운데에 맞춘다.
   */
  textOffsetY: 16,
  /** 응답 상자의 위아래 안쪽 여백. */
  responsePaddingY: 36,
  /** 두 상자의 좌우 안쪽 여백. 강조 박스와 같다. */
  paddingX: 46,
  responseRadius: 70,
  strokeWeight: 2,
} as const;

/**
 * 목록 들여쓰기. 원본 chapter-opening.png: 본문 왼쪽 160, 기호 193, 항목 글 224.
 * 모든 목록에서 같다.
 */
export const LIST_MARKER_OFFSET = 33;
export const BULLET_INDENT = 64;

/** 쪽번호 위치. */
export const PAGE_NUMBER = {
  right: 1415,
  width: 80,
  top: 2150,
} as const;
