/**
 * 자리만 비워 둔 이미지 하나.
 *
 * 책을 만든 뒤 "어느 쪽의 어느 자리에 어떤 파일을 넣어야 하는지"를 알려 주는
 * 목록의 한 줄이다. 이 목록을 모두 채우면 이미지 작업이 끝난다.
 */
export type PendingImage = {
  /** 원고에 적힌 파일 경로. */
  src: string;
  /** 이미지가 보여 주는 내용. */
  alt: string;
  /** 원고에 적힌 비율 표기(예: "16:9"). */
  ratioLabel: string;
  /** 원고가 비율을 직접 적었는가. `false`면 기본값으로 자리를 잡은 것이다. */
  ratioDeclared: boolean;
  /** 비워 둔 자리의 크기(px). 이미지를 이 크기에 맞춰 준비하면 잘리지 않는다. */
  width: number;
  height: number;
  /** 지면에 들어가지 않아 선언한 폭보다 줄여 놓았는가. */
  scaledToFit: boolean;
};

/** 최종 쪽번호까지 붙은 보고용 항목. */
export type PendingImageReport = PendingImage & {
  /** Canva 디자인 안에서의 생성 순서(1부터). */
  designPage: number;
  /** 지면에 찍힌 쪽번호. 번호가 없는 페이지는 undefined. */
  pageNumber?: string;
  /** Canva 페이지 제목. */
  pageTitle: string;
};
