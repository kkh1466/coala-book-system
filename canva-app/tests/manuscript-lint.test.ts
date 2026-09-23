import fs from "node:fs";
import path from "node:path";
import {
  MarkdownBookParseError,
  checkBookMarkdown,
  parseBookMarkdown,
} from "../src/parser/markdown-book";

const FRONT_MATTER = [
  "---",
  "schema_version: 1",
  "title: 검사용 원고",
  "---",
  "",
];

const book = (...pages: string[][]): string =>
  [...FRONT_MATTER, ...pages.flat()].join("\n");

const concept = (body: string[], id = "p1"): string[] => [
  `:::page{type="concept" id="${id}" layout="basic"}`,
  "# 제목",
  "",
  "## 소제목",
  "",
  ...body,
  ":::",
  "",
];

const errorsOf = (source: string) =>
  checkBookMarkdown(source).issues.filter(
    (issue) => issue.severity === "error",
  );

describe("지원하지 않는 Markdown 문법", () => {
  // 예전에는 모두 오류 없이 통과해 기호째로 Canva에 찍히거나 사라졌다.
  it.each([
    ["코드 블록", ["```python", "print('hi')", "```"], "코드 블록"],
    ["표", ["| a | b |", "|---|---|", "| 1 | 2 |"], "표를 넣을 수 없습니다"],
    ["다른 강조 박스", ["본문", "", "> [!CAUTION]", "> 주의"], "[!CAUTION]"],
    ["인용문", ["본문", "", "> 그냥 인용문"], "인용문(>)"],
    ["체크리스트", ["본문", "", "- [ ] 할 일"], "체크리스트"],
    ["중첩 목록", ["- 상위", "  - 하위"], "중첩 목록"],
    ["작은 제목", ["### 더 작은 제목", "", "내용"], "'###' 제목"],
    ["수평선", ["문단", "", "---", "", "문단"], "수평선"],
    ["Markdown 이미지", ["![대체](assets/a.png)"], "Markdown 이미지"],
    ["링크", ["[문서](https://example.com)를 봅니다."], "링크"],
    ["인라인 코드", ["`print()` 함수를 씁니다."], "인라인 코드"],
    ["HTML 태그", ["첫 줄<br>둘째 줄"], "HTML 태그"],
  ])("%s을(를) 행 번호와 함께 거절한다", (_name, body, expected) => {
    const errors = errorsOf(book(concept(body)));

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain(expected);
    expect(errors[0]?.pageId).toBe("p1");
    // 소제목 아래 첫 줄이 원고 11행이다.
    expect(errors[0]?.line).toBeGreaterThanOrEqual(11);
  });

  it("코드 블록 하나에 오류를 하나만 낸다", () => {
    const errors = errorsOf(
      book(concept(["```python", "# 주석", "| a | b |", "> x", "```"])),
    );

    expect(errors.map((issue) => issue.line)).toEqual([11]);
  });

  it("본문에 흔한 표기를 문법으로 오인하지 않는다", () => {
    const { spec, issues } = checkBookMarkdown(
      book(
        concept([
          "tkinter에서는 <Button-1> 이벤트를 씁니다.",
          "",
          "2 * 3 * 4는 24이고 **곱셈**은 *로 적습니다.",
          "",
          "my_var_name과 __init__은 그대로 적습니다.",
          "",
          "1. 첫째",
          "2. 둘째",
        ]),
      ),
    );

    expect(issues).toEqual([]);
    expect(spec?.pages).toHaveLength(1);
  });

  it("기울임은 막지 않고 경고만 한다", () => {
    const { spec, issues } = checkBookMarkdown(
      book(concept(["이건 *기울임*입니다."])),
    );

    expect(spec).toBeDefined();
    expect(issues).toEqual([
      expect.objectContaining({ severity: "warning", line: 11 }),
    ]);
  });

  it("강조 박스 표시 줄에 글을 함께 적으면 거절한다", () => {
    const errors = errorsOf(
      book(concept(["본문", "", "> [!TIP] 바로 적은 글"])),
    );

    expect(errors[0]?.message).toContain("다음 줄에");
  });

  it("chapter-opening에서 지면에 나오지 않는 글을 거절한다", () => {
    const errors = errorsOf(
      book([
        ':::page{type="chapter-opening" id="ch1" chapter="1"}',
        "# 제목",
        "## 부제목",
        "",
        "사라지는 도입문",
        "",
        "### 학습 목표",
        "",
        "- 설명할 수 있다.",
        "목록이 아닌 목표",
        "",
        "### 개념",
        "",
        "본문",
        "",
        "> [!TIP]",
        "> 놓을 자리가 없는 팁",
        ":::",
      ]),
    );

    expect(errors.map((issue) => issue.message)).toEqual([
      expect.stringContaining("'### 학습 목표' 위의 글"),
      expect.stringContaining("학습 목표는 '- '로"),
      expect.stringContaining("강조 박스를 넣을 수 없습니다"),
    ]);
  });

  it("comparison에서 표 아래의 글과 두 번째 표를 거절한다", () => {
    const errors = errorsOf(
      book([
        ':::page{type="comparison" id="c1"}',
        "# 비교",
        "",
        "| a | b |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "사라지는 마무리 글",
        "",
        "| c | d |",
        "|---|---|",
        "| 3 | 4 |",
        "",
        "> [!TIP]",
        "> 이 팁은 지면에 나온다.",
        ":::",
      ]),
    );

    expect(errors.map((issue) => issue.message)).toEqual([
      expect.stringContaining("표 아래의 글"),
      expect.stringContaining("표를 하나만"),
      expect.stringContaining("표를 하나만"),
      expect.stringContaining("표를 하나만"),
    ]);
  });
});

describe("오류 모으기", () => {
  it("여러 페이지의 오류를 원고 행 순서로 한 번에 돌려준다", () => {
    const source = book(
      [':::page{type="cover" id="cover"}', "# 표지", ":::", ""],
      concept(["```", "code", "```"], "p1"),
      concept(["본문"], "p1"),
      [
        ':::page{type="flowchart" id="f1"}',
        "# 순서도",
        "",
        "```flowchart",
        "nodes:",
        "  - id: a",
        "    role: input",
        "    text: 입력",
        "connections:",
        "  - from: a",
        "    to: conditon",
        "```",
        ":::",
      ],
    );

    const { spec, issues } = checkBookMarkdown(source);

    expect(spec).toBeUndefined();
    expect(issues.map((issue) => issue.message)).toEqual([
      "지원하지 않는 페이지 형식입니다: cover",
      expect.stringContaining("코드 블록"),
      expect.stringContaining("중복된 page id입니다: p1"),
      "connections[0].to references missing node: conditon",
    ]);
    const lines = issues.map((issue) => issue.line ?? 0);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
    expect(issues.every((issue) => issue.line !== undefined)).toBe(true);
  });

  it("parseBookMarkdown은 첫 오류를 메시지로, 전부를 issues로 던진다", () => {
    const source = book(concept(["```", "```", "", "> 인용문"]));

    let thrown: unknown;
    try {
      parseBookMarkdown(source);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MarkdownBookParseError);
    const error = thrown as MarkdownBookParseError;
    expect(error.message).toMatch(/^11행: 코드 블록.*\(외 1건\)$/);
    expect(error.issues).toHaveLength(2);
  });

  it("Front Matter 값의 오류를 그 값이 적힌 행으로 알린다", () => {
    const source = [
      "---",
      "schema_version: 1",
      "title: 원고",
      "toc: maybe",
      "---",
      "",
      ...concept(["본문"]),
    ].join("\n");

    expect(errorsOf(source)).toEqual([
      expect.objectContaining({
        line: 4,
        message: expect.stringContaining("toc"),
      }),
    ]);
  });

  it("보관된 원고는 모두 문제 없이 통과한다", () => {
    const dir = path.resolve(process.cwd(), "../test-input");
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const { spec, issues } = checkBookMarkdown(
        fs.readFileSync(path.join(dir, file), "utf8"),
      );
      expect({ file, issues }).toEqual({ file, issues: [] });
      expect(spec).toBeDefined();
    }
  });
});
