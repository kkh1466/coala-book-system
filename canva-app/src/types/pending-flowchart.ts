import type { FlowchartNode } from "./book-spec";

/**
 * 자리만 비워 둔 순서도 하나.
 *
 * 공개 Apps SDK로는 스킬이 지정한 Canva 순서도 요소를 넣을 수 없다. 앱은
 * 비슷한 도형을 그려 흉내 내지 않고, 자리를 비워 둔 채 무엇을 만들어야 하는지
 * 알려 준다(`skill/references/flowcharts.md`의 "user-assisted" 경로).
 */
export type PendingFlowchartNode = {
  /** 안내 글과 연결 표기에 쓰는 번호(1부터). 원고의 노드 순서와 같다. */
  number: number;
  role: FlowchartNode["role"];
  /** 역할의 한글 이름(입력, 조건 등). */
  roleLabel: string;
  /** 이 역할에 반드시 써야 하는 Canva 요소의 이름과 그래픽 ID. */
  elementName: string;
  elementId: string;
  text: string;
};

export type PendingFlowchartConnection = {
  from: number;
  to: number;
  label?: "YES" | "NO";
};

export type PendingFlowchart = {
  title: string;
  /** 제어 구조의 한글 이름. 원고가 적지 않았으면 undefined. */
  structureLabel?: string;
  /** 이 구조를 스킬 규칙대로 만드는 방법 한 줄. */
  structureHint?: string;
  nodes: PendingFlowchartNode[];
  connections: PendingFlowchartConnection[];
  /** 비워 둔 자리의 크기(px). */
  width: number;
  height: number;
  /** 원고가 높이를 직접 적었는가. `false`면 노드 수로 추정한 값이다. */
  heightDeclared: boolean;
};

/** 최종 쪽번호까지 붙은 보고용 항목. */
export type PendingFlowchartReport = PendingFlowchart & {
  designPage: number;
  pageNumber?: string;
  pageTitle: string;
};
