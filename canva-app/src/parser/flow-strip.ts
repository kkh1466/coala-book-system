/**
 * 가로 흐름(```` ```flow ````).
 *
 * 원본 caution-box.png 위쪽처럼 흰 카드 몇 개가 가는 선으로 이어진 한 줄
 * 흐름이다. 펜스 안의 줄 하나가 카드 하나이고, `제목 | 부제` 형식이다.
 *
 *   ```flow
 *   정보 입력 | Field
 *   버튼 클릭 | Button
 *   처리 | 기능 실행
 *   결과 확인 | Text
 *   ```
 *
 * 이 파일은 그 줄을 읽고 검사하는 **유일한** 논리다. 블록 파서, 원고 검사,
 * BookSpec 검증이 모두 여기를 부른다.
 */
export type FlowStep = {
  title: string;
  subtitle?: string;
};

/** 카드 수의 허용 범위. 하나면 흐름이 아니고, 여섯부터는 글이 들어가지 않는다. */
export const FLOW_STEP_COUNT = { min: 2, max: 5 } as const;

export type FlowLineProblem = {
  /** 펜스 안 줄의 인덱스. 펜스 줄 자체의 문제는 -1. */
  offset: number;
  message: string;
};

const FORBIDDEN_LINE =
  /^\s*(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|```|~~~|::image\{|>)/;

/** 펜스 안의 줄을 카드로 읽는다. 문제가 있으면 `problems`에 모두 담는다. */
export function parseFlowLines(innerLines: readonly string[]): {
  steps: FlowStep[];
  problems: FlowLineProblem[];
} {
  const steps: FlowStep[] = [];
  const problems: FlowLineProblem[] = [];
  // 형식이 틀린 줄도 카드 하나로 센다. 그래야 줄 하나의 문제가 "개수 부족"
  // 오류까지 끌고 오지 않는다.
  let lineCount = 0;
  innerLines.forEach((raw, offset) => {
    const line = raw.trim();
    if (line.length === 0) {
      return;
    }
    lineCount += 1;
    if (FORBIDDEN_LINE.test(line)) {
      problems.push({
        offset,
        message:
          "flow 블록의 줄은 '제목 | 부제' 형식이어야 합니다. 제목·목록·이미지·펜스는 쓸 수 없습니다.",
      });
      return;
    }
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length > 2) {
      problems.push({
        offset,
        message:
          "flow 블록의 줄에는 '|'를 한 번만 쓸 수 있습니다: '제목 | 부제'.",
      });
      return;
    }
    const [title, subtitle] = parts;
    if (!title) {
      problems.push({
        offset,
        message: "flow 블록의 카드에는 제목이 있어야 합니다: '제목 | 부제'.",
      });
      return;
    }
    steps.push(subtitle ? { title, subtitle } : { title });
  });
  if (lineCount < FLOW_STEP_COUNT.min || lineCount > FLOW_STEP_COUNT.max) {
    problems.push({
      offset: -1,
      message: `flow 블록에는 카드를 ${FLOW_STEP_COUNT.min}개에서 ${FLOW_STEP_COUNT.max}개까지 둘 수 있습니다. 지금은 ${lineCount}개입니다.`,
    });
  }
  return { steps, problems };
}
