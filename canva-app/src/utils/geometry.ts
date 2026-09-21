export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const roundedRectPath = (
  width: number,
  height: number,
  radius: number,
): string => {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${height - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
};

export const circlePath = (diameter: number): string => {
  const r = diameter / 2;
  return `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${diameter} A ${r} ${r} 0 1 1 ${r} 0 Z`;
};
