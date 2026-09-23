# Structured Markdown manuscript format

Use this format for manuscripts that will be parsed by the Coala Book Builder Canva app.

## Core rules

- Save the manuscript as UTF-8 Markdown.
- Start with YAML Front Matter.
- Put every intended Canva page inside one `:::page{...}` container.
- Give every page a stable, unique `id`.
- Use kebab-case page types.
- Do not write literal page numbers. Set `numbering: auto`.
- Do not put colors, coordinates, font sizes, or other visual styling in the manuscript.
- Use relative asset paths under `assets/`. When assets are required, package `book.md` and `assets/` together.

## Front Matter

```yaml
---
schema_version: 1
title: AI와 함께하는 앱 개발
subtitle: 생성형 AI와 Python GUI 프로젝트
learner_level: 대학 초급
language: ko
canvas: coala-portrait
numbering: auto
toc: none
institution: 삼육대학교
assets_dir: ./assets
---
```

Currently supported values:

- `schema_version: 1`
- `language: ko`
- `canvas: coala-portrait`
- `numbering: auto | none`
- `toc: auto | none`; `auto` is reserved until automatic contents rendering is implemented

## Implemented page templates

### Chapter opening

```markdown
:::page{type="chapter-opening" id="chapter-01" chapter="1"}
# AI 디지털 리터러시
## AI와 함께하는 디지털 시대

### 학습 목표

- 생성형 AI의 개념을 설명할 수 있다.
- AI가 제공한 정보를 검토할 수 있다.

### 생성형 AI란 무엇일까?

생성형 AI는 사용자의 요청에 따라 새로운 결과물을 만드는 인공지능입니다.
:::
```

### Concept

Use `layout="basic"` for vertically stacked sections or `layout="cards"` for up to four cards.

```markdown
:::page{type="concept" id="data-types" layout="cards"}
# 데이터의 종류

입력 데이터의 유형을 살펴봅시다.

## 문자 데이터

- 이름
- 증상 설명

## 숫자 데이터

- 나이
- 체온

> [!KEY_POINT]
> 앱의 목적에 따라 필요한 입력 데이터가 달라집니다.
:::
```

### Comparison

Use a standard Markdown table with two or three columns and no more than five body rows.

```markdown
:::page{type="comparison" id="prompt-comparison"}
# 좋은 질문 비교

| 모호한 질문 | 구체적인 질문 |
|---|---|
| 추천해줘 | 대학생을 위한 공부 계획을 추천해줘 |

> [!TIP]
> 대상과 조건을 함께 적어보세요.
:::
```

### Practice opening

The page can contain one Tip or one checklist, not both.

```markdown
:::page{type="practice-opening" id="practice-002-1" practice="002-1" practice-kind="프롬프트 실습" platform="알고플로에서 실습하기"}
# 어떤 질문이 더 좋은 답을 만들까?

짧은 질문과 구체적인 질문의 결과를 비교해봅시다.

> [!TIP]
> 답변이 아쉽다면 조건을 추가해보세요.
:::
```

### Practice checklist

```markdown
:::page{type="practice-checklist" id="practice-002-1-objectives"}
# 실습 목표

- [ ] 질문 방식의 차이를 확인할 수 있다.
- [ ] 프롬프트를 구체적으로 수정할 수 있다.
:::
```

### Flowchart

The parser accepts the semantic flowchart structure below. The app does not draw the flowchart: the required native Canva library elements cannot be inserted through the public Apps SDK, and lookalike shapes are forbidden. It generates the page with a reserved placeholder instead, and a person builds the flowchart in the Canva editor. See "Flowchart placeholders in the Coala Book Builder app" in `flowcharts.md`.

- Text between the page title and the ```` ```flowchart ```` block is the introduction. Paragraph breaks are kept.
- Text **below** the block is placed under the placeholder as the conclusion.
- The optional page attribute `height="900"` sets the placeholder height in pixels, as an integer from 300 to 1800. Without it the height is estimated from the number of nodes on the longest route. Set it when the intended layout is wider than it is tall, or when the estimate leaves too little room for the text below.
- `control_structure` (`linear`, `if-else`, `if-else-if`, or `loop`) selects the construction rule shown to the person who builds the flowchart.
- Image placeholders and callouts are not supported on a `flowchart` page.

````markdown
:::page{type="flowchart" id="age-check"}
# 나이에 따른 결과 분기

```flowchart
control_structure: if-else
nodes:
  - id: age
    role: input
    text: 나이 입력
  - id: condition
    role: decision
    text: 나이가 20세 이상인가?
  - id: adult
    role: output
    text: 성인입니다.
connections:
  - from: age
    to: condition
  - from: condition
    to: adult
    label: YES
```
:::
````

## Code

Write code as a fenced block with the language name, and **always follow it with exactly one execution result**. The app draws the code in a light grey rounded box with a language label, in a monospace font when the Canva account has one, at body size. Comments are grey and keywords are blue for Python and JavaScript; other languages, and a fence without a name, are drawn without colour.

A text result (`print`, `console.log`) is an ```` ```output ```` block right after the code. It is drawn in a **second grey box below the code box**, with a blue `실행 결과` label between the two boxes, in the same monospace font at body size, without colouring:

````markdown
```python
name = "코알라"
print(f"안녕하세요, {name}")
```

```output
안녕하세요, 코알라
```
````

A GUI result is the existing image placeholder with `role="result"`, right after the code. It is drawn after the code box as a drop-target placeholder with the same blue `실행 결과` label above it, so the meaning stays after the screenshot is dropped in:

````markdown
```python
import flet as ft

def main(page):
    page.add(ft.Text("안녕하세요"))

ft.app(target=main)
```

::image{src="assets/ch01/hello-window.png" alt="안녕하세요 문구가 표시된 실행 창" ratio="16:9" role="result"}
````

Rules:

- Allowed only on a `concept` page with `layout="basic"`, in the body under the page title. Rejected on card layouts, inside a callout, and on every other page type. `output` blocks and `role="result"` images follow the same rule.
- Every ordinary code block must have exactly one result directly after it: an `output` block or a `role="result"` image, with nothing but blank lines between. `prompt`, `response`, and `flowchart` fences are not code and take no result.
- Rejected with the row number: a code block without a result; an `output` block or a `role="result"` image without a code block before it; body text, a heading, or a list between the code and its result; two results, or an `output` block and a result image together; an empty `output` block; a heading, list, image directive, or fence inside an `output` block.
- An image directive without `role` is an ordinary image and keeps working as before. `ratio`, `width`, and `caption` work on a result image as on any image; the `실행 결과` label sits above the placeholder and a caption under it.
- Use ```` ``` ```` fences. `~~~` is rejected. A code block may not be empty and must be closed.
- Indentation is kept exactly as written, in both code and output, and a tab becomes four spaces. Trailing spaces are removed.
- Do not write inline code in backticks in body text; name the identifier in bold instead.
- Long code and long output are not shrunk. Each box is split at a line boundary and continues in another box on the next page: a continued code box is labelled `Python (계속)` inside, and a continued result box gets a blue `실행 결과 (계속)` label above it. The label always stays on the same page as the box below it. A result image that does not fit under its code moves whole to the next page, still directly after the code in reading order.
- Body text at 28 pt fits about 52 monospace characters per line. A longer line wraps inside the box; break long lines in the source instead.

Wrong examples, all rejected:

````markdown
```python
print("안녕하세요")
```

다음 문단            ← 결과 없음: 코드 블록 뒤에 실행 결과가 없습니다.

```output           ← 앞선 코드 없음: output 블록 앞에는 실행할 코드 블록이 있어야 합니다.
안녕하세요
```

```python
print("안녕하세요")
```

설명 문장            ← 사이의 본문: 코드 블록과 실행 결과 사이에는 다른 내용을 둘 수 없습니다.

```output
안녕하세요
```
````

## AI prompt and response

Write the user's prompt and the AI's response as two fenced blocks, the response directly after the prompt with nothing but blank lines between them. The app draws the prompt in a pill-shaped outline and the response in a rounded outlined box, both at body size, following `assets/page-examples/ai-prompt-response.png`. The reference page's `+` and microphone icons are decoration and are not reproduced.

````markdown
:::page{type="concept" id="prompt-example" layout="basic"}
# 프롬프트 예시

## 예시1)

```prompt
서울 여행 1박 2일 일정을 추천해줘.
```

```response
DAY 1

- 경복궁 : 서울 대표 궁궐 / 한복 체험 / 사진 명소
- 북촌한옥마을 : 한옥 골목 산책 / 감성 카페
```
:::
````

Rules:

- Allowed only on a `concept` page with `layout="basic"`, in the body under the page title. Rejected on card layouts, inside a callout, and on every other page type.
- A `prompt` block must be followed by a `response` block, and a `response` block must follow a `prompt` block. Any text between them is rejected. Several pairs may follow one another; put a `## ` heading such as `## 예시1)` above each pair when the reference layout is wanted.
- Inside `prompt`: sentences only. Line breaks are kept. `**강조**` is allowed.
- Inside `response`: paragraphs and one-level `- ` or `1. ` lists, separated by blank lines. `**강조**` is allowed. Headings, tables, callouts, images, checklists, and nested lists are rejected with the row number.
- Neither block may be empty, and each must be closed with a ```` ``` ```` line.
- A long response is not shrunk. The box is split at a paragraph or list-item boundary and continues in another box on the next page, under the `제목(계속)` heading. Keep only the part of the response that the learning purpose needs, and mark shortened or edited AI output in the text itself, as `content-writing.md` and `page-types.md` require.
- The prompt box is never left alone at the bottom of a page; it moves to the next page with its response.

### Screenshot guide

One `## ` heading per step. Every step must contain **both** of the following, in the order the learner should read them:

- exactly one `::image{...}` capture placeholder — a step without a capture, or with two, is rejected with its row number;
- at least one description that is separate from the capture: a paragraph, or a `- `/`1. ` list, saying what the learner does or what the screen shows. The step heading, the image's `alt`, and its `caption` do not count. A step with only a capture is rejected before any Canva page is created: `단계 '템플릿 고르기'에 설명이 없습니다. 이미지와 함께 수행할 행동이나 화면 설명을 문장 또는 목록으로 작성해 주세요.`

The description may come before or after the capture. Do not number the headings: the app renders each step as `STEP n. <heading>` in order, following `assets/page-examples/process-steps.png`, and a heading that begins with `STEP 1.` is rejected.

```markdown
:::page{type="screenshot-guide" id="new-project"}
# 새 프로젝트 만들기

아래 순서대로 따라 하며 첫 프로젝트를 만들어 봅시다.

## 프로젝트 만들기 버튼 누르기

첫 화면 오른쪽 위의 **새 프로젝트** 버튼을 누릅니다.

::image{src="assets/guide/step-01.png" alt="첫 화면의 새 프로젝트 버튼" ratio="16:9"}

## 프로젝트 이름 정하기

::image{src="assets/guide/step-02.png" alt="프로젝트 이름 입력 창" ratio="16:9"}

- 한글과 영문 모두 쓸 수 있습니다.
- 띄어쓰기 대신 밑줄을 씁니다.
:::
```

- Each step is a white rounded card with the step title, the instruction, and the capture box at the card's inner width. A down arrow sits between cards.
- A card is never split. A card that does not fit moves whole to the next page under `제목(계속)`, with its arrow above it. A capture taller than the page is scaled down with its ratio kept, as on other pages.
- Write the instruction as body text even when the capture seems self-explanatory; the `alt` is a label for the placeholder, not the lesson.
- Keep one action per step, and keep the instruction short: when the instruction and the capture together do not fit one page, generation stops with a manuscript error naming the step. Split the step instead of shortening the capture.
- Callouts, tables, and checklists are not allowed on this page. Put a Tip on a following `concept` page.

## Image placeholders

Declare an image where it belongs in the manuscript, even when the file does not exist yet. The app reserves the exact space, marks it, and leaves it empty. The image is added later in Canva by dragging it onto the reserved box; nothing else on the page moves.

```markdown
::image{src="assets/ch01/step-01.png" alt="새 프로젝트 만들기 창" ratio="16:9" caption="그림 1-1 새 프로젝트 만들기"}
```

Write the directive as **one line with no closing line**. A line containing only `:::` closes the page container, so a fenced block form cannot be used.

| Attribute | Required | Meaning |
| --- | --- | --- |
| `role` | no | `result` marks the image as a code block's GUI execution result. It must directly follow a code block, and the app draws a permanent `실행 결과` label above the box. See "Code". |
| `src` | yes | Planned file path, relative to the manuscript, under `assets/`. The file may not exist yet. URLs, absolute paths, and `..` are rejected. |
| `alt` | yes | What the image shows. Used in the placeholder label and in the post-generation list. |
| `ratio` | no | Width to height, as `16:9` or a decimal such as `1.5`. Allowed range 1:4 to 4:1. Defaults to `16:9`, and the post-generation list flags every placeholder that relied on the default. |
| `width` | no | `text` (default, body text width), `full` (full content width, same as cards and tables), or `half` (half of the text width, centered). |
| `caption` | no | A real caption placed under the box. It stays after the image is added. |

Rules:

- `ratio` decides the reserved height, and Canva fills the box by cropping. **Declare the ratio of the final image.** A different ratio means the image is cropped.
- The Canva editor itself can scale the box but cannot stretch it to another ratio. When the final image turns out to have a different ratio, change the box with the app's **이미지 자리 비율 바꾸기** panel before adding the image (see `image-guidelines.md`). The manuscript `ratio` still decides how much space is reserved when the book is generated, so set it as accurately as you can.
- A placeholder is never split across pages. One that is taller than a page is scaled down with its ratio preserved, and the post-generation list says so.
- Allowed positions: anywhere under the page title of a `concept` page with `layout="basic"`, in the body under the concept subsection heading of a `chapter-opening` page, and under each step heading of a `screenshot-guide` page, where exactly one is required per step.
- Rejected positions, with the manuscript row number: `concept` pages with `layout="cards"`, `practice-opening`, `practice-checklist`, `comparison`, and `flowchart` pages, above the first step of a `screenshot-guide` page, inside a `>` callout, above a `concept` page title, and among the learning objectives of a `chapter-opening` page. Move the image to a following `concept` page instead.
- Do not use a placeholder for a flowchart. Flowcharts follow `flowcharts.md`.

After generation the app lists every placeholder with its page number, planned file, reserved pixel size, and ratio. Preparing each image at that pixel size avoids cropping.

## Supported Markdown, and nothing else

The parser rejects any syntax it cannot lay out. Earlier versions let these through, and they reached Canva as literal symbols or disappeared without an error. Write only what this table allows.

| Syntax | Where it is allowed |
| --- | --- |
| `#` page title | Exactly one per page, at the start of a line. Nothing may be written above it. |
| `##` | `chapter-opening` (one, the subtitle), `concept` (any number, the section headings), and `screenshot-guide` (one per step, without a `STEP n.` prefix). |
| `###` | `chapter-opening` only: `### 학습 목표` and one concept subsection heading. |
| Paragraphs, `- ` lists, `1. ` lists | Body text. Lists are one level deep. |
| `**강조**` | The only inline formatting. |
| `> [!TIP]`, `> [!KEY_POINT]` | One per page, on `concept`, `comparison`, `practice-opening`, and `practice-checklist`; not on `screenshot-guide`. The marker stands alone on its line, starting at column one; the text follows on `> ` lines directly below. |
| Table | `comparison` pages only, one table. The introduction above it is sentences, not a list. Text below the table is rejected; use the callout. |
| `- [ ]` checklist | `practice-opening` and `practice-checklist` only, written with `-`. |
| `::image{...}` | See "Image placeholders". |
| ```` ```flowchart ```` | `flowchart` pages only, one block. |
| ```` ```prompt ```` + ```` ```response ```` | `concept` pages with `layout="basic"`, always as a pair. See "AI prompt and response". |
| ```` ```python ```` and other fenced code + ```` ```output ```` or `role="result"` image | `concept` pages with `layout="basic"`, always as a pair. See "Code". |

Rejected everywhere, with the manuscript row number: `~~~` fences, empty or unclosed fences, inline code in backticks, links, Markdown images (`![]()`), HTML tags, strikethrough, horizontal rules, nested lists, plain `>` quotations, other callout kinds such as `[!CAUTION]`, `[!NOTE]`, and `[!WARNING]`, and headings deeper than the page type allows. On a `chapter-opening` page, text between the subtitle and `### 학습 목표` is rejected, and the learning objectives must be `- ` items only.

`*기울임*` is reported as a warning rather than an error, because a sentence may use a literal asterisk. The asterisks are printed as written.

Write plain text such as `<Button-1>`, `2 * 3 * 4`, `my_var_name`, and `__init__` as is. They are not mistaken for syntax.

## Page templates and content blocks

Treat `tip`, `key-point`, tables, checklists, images, code, and prompt-response content as blocks inside a page rather than independent page templates. Add new page templates only when the whole-page arrangement changes.

## Not implemented: do not write these

The seven page types under "Implemented page templates" are the only ones the parser accepts. The following are planned and are **rejected today**: `cover`, `toc`, `divider`, `step-process`, `chart-result`, `before-after`, and `final-submission`. `toc: auto` is rejected as well. A person adds the cover, contents, and divider pages in Canva after generation.

## Validating a manuscript

Validate before opening Canva. From `canva-app/`:

```bash
npm run validate -- ../coala-book-md/book.md
```

The command calls the same parser the Canva app uses when a manuscript is uploaded, so a manuscript that passes here is accepted there. It lists **every** problem at once with its row number and page `id`, then exits with status 1 when there is at least one error. Add `--json` for machine-readable output. Several files may be given.

```
✗ book.md
  오류  18행 page "print-basics": 코드 블록(```)은 아직 지원하지 않습니다. …
  오류  49행 page "age-check": connections[0].to references missing node: conditon
  오류 2건, 경고 0건
```

Fix every reported row and run the command again until it prints `✓`. Do not hand over a manuscript that has not passed.

The command checks structure and syntax only. It does not check whether the content is correct, whether a page is comfortable to read, how many Canva pages the manuscript becomes after splitting, or whether the planned image files exist.

## Validation behavior

The parser must reject the complete manuscript before Canva writes begin when:

- Front Matter is missing or malformed;
- content exists outside a page container;
- a page type, layout, or required attribute is unsupported;
- page IDs are duplicated;
- a required heading, table, checklist, or flowchart field is missing;
- a flowchart `height` is not an integer from 300 to 1800;
- an image placeholder is malformed, uses an unsupported attribute, or sits in a position where it cannot be laid out;
- a practice opening contains both a Tip and an objective checklist;
- any syntax outside "Supported Markdown, and nothing else" appears.

Problems are collected page by page and reported together. Only a broken Front Matter or a broken `:::page` boundary stops the check at once, because row numbers after it cannot be trusted.
