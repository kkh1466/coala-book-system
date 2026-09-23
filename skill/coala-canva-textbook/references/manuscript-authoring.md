# Writing a manuscript from rough material

Use this reference when the user gives notes, an outline, lecture slides, an existing explanation, or just a topic, and wants a Markdown manuscript that the Coala Book Builder app can turn into pages. The deliverable is a manuscript that passes `npm run validate` plus a hand-over list of what a person still has to prepare.

Read `manuscript-format.md` first: it is the only authority on what the parser accepts. Read `content-writing.md` for tone and sequencing, and `page-types.md` to choose page types. The manuscripts under `test-input/` are working examples of every page type and block.

## Procedure

1. **Collect the inputs.** Use the supplied title, learner level, session or chapter structure, source material, any existing images or image requirements, and destination. Infer a sensible structure when the material supports one; ask only for missing information that materially changes the lesson. Do not invent curriculum, facts, software behaviour, or institutional claims (`content-writing.md`).
2. **Plan the pages before writing.** Map each learning purpose to a page type, suitable blocks, and any images to be added later, using the inventory below and about 6–7 pages per session as a starting point, never as a cap. Show the plan to the user when the material is more than one session or when the mapping is not obvious; a changed plan is cheaper than a rewritten manuscript.
3. **Write the manuscript** using only components that `manuscript-format.md` allows. Choose the representation that best explains the supplied material. Use different suitable components across the lesson when they add clarity, but do not add a component or repeat content merely to increase variety. Follow "Paragraphs and bullets", "Screenshot guides", and "Images" below.
4. **Run every code block.** An `output` block must be the real output of the code above it. When a Python interpreter is available, run the code and paste what it printed. Never type an output from memory. GUI programs get a `role="result"` image placeholder instead.
5. **Check source coverage and claims.** Compare the complete draft with the user's notes or other source: account for every required topic, example, activity, constraint, and supplied image; remove repetition and unsupported specifics. Check that each practice page states the learner action and observable result. Mark any uncertain fact, version-dependent instruction, or assumed screen state for review rather than presenting it as verified.
6. **Validate and fix until it passes.** From `canva-app/`, run `npm run validate -- <manuscript.md>` (add `--json` to read the issues as data). Fix every reported row and run again. Do not hand over a manuscript that has not printed `✓`. Without the repository, check by hand against "Supported Markdown, and nothing else" in `manuscript-format.md`. Validation checks structure and syntax, not factual accuracy, visual readability, actual rendered page count, or the existence of image files.
7. **Hand over.** Give the user the manuscript path and a list of what remains for a person: every image placeholder with its planned path, ratio, what it must show, and whether the file is already supplied or still needed; every flowchart to build in Canva; any fact or software behaviour that should be checked. State the validator's page count as manuscript page containers, not the final Canva page count after splitting.

Save manuscripts under `coala-book-md/<book>/book.md`, with planned image paths under `assets/` relative to that file.

## Available manuscript components

This is the working inventory for authoring. `manuscript-format.md` is the authority for exact syntax, attributes, limits, and allowed positions. A component is an option, not a page quota: use it when the source and learning purpose call for it. Keep one learning purpose per page and split crowded pages.

Every manuscript also needs YAML Front Matter (`title`, learner level, supported canvas and numbering settings), and every planned page needs a `:::page{...}` container with a stable unique `id` and one `#` title. These are required structure, not optional teaching components. See `manuscript-format.md` for the exact fields and syntax.

### Page types

There are eight supported page types; `concept` has two layouts.

| Page type | Use when the material calls for… | Avoid when… |
| --- | --- | --- |
| `chapter-opening` | A session start with title, objectives, and a first concept. Usually one per session. | The material continues the same session. |
| `concept` + `layout="basic"` | Explanation, example, image, code and result, prompt and response, or a short flow strip. | Several items are better compared side by side or presented as steps. |
| `concept` + `layout="cards"` | Two to four short, parallel kinds, features, or options. | Items need long explanations, images, code, or a sequence. |
| `comparison` | A true side-by-side comparison with two or three columns and up to five rows. | Items are a sequence or unrelated facts. |
| `screenshot-guide` | Screen actions that each need a capture and a written instruction. The captures may be added later. | The steps cannot be described reliably or some steps do not need a capture; use `step-process` for a text-only procedure. |
| `step-process` | A procedure or design sequence with a short instruction for each step and no captures. | The steps need screenshots. |
| `flowchart` | An algorithm, branch, or loop whose connections matter. The person finishes the native Canva diagram later. | A simple linear sequence is clearer as a `flow` strip or `step-process`. |
| `practice-opening` | The start of an actual learner activity: task and expected outcome. | The text only explains a concept or continues an existing activity. |
| `practice-checklist` | Criteria learners can verify after practice. | The items are explanations or ordinary learning objectives. |

### Blocks inside pages

| Block | Use when… | Placement and limit |
| --- | --- | --- |
| Paragraphs, one-level bullets or numbered lists, `**bold**` | Explaining an idea, grouping scan-friendly points, or showing a short ordered list. | Follow each page type's body rules; bold is the only inline style. |
| `> [!TIP]` or `> [!KEY_POINT]` | A useful caution/hint or one takeaway deserves emphasis. | At most one callout on `concept`, `comparison`, `practice-opening`, or `practice-checklist`. Do not use as filler. |
| Markdown table | Two or three comparable dimensions need aligned rows. | `comparison` only; one table, at most five body rows. |
| `- [ ]` checklist | Learners need observable practice goals or completion checks. | `practice-opening` or `practice-checklist` only. |
| `::image{...}` | A supplied image or a later screenshot, illustration, diagram, or result will clarify content. | `concept` basic, chapter-opening concept subsection, or one per screenshot-guide step. A GUI code result uses `role="result"`. |
| Fenced code + `output` or result image | A runnable example is needed to explain behaviour. | `concept` basic only; exactly one real result immediately after each code block. |
| `prompt` + `response` | The lesson examines a specific AI exchange. | `concept` basic only; keep the pair adjacent. Do not invent a sourced response. |
| `flow` | Two to five short stages of a simple left-to-right process. | `concept` basic only; not a substitute for a branch or loop. |
| `flowchart` | Decision or loop nodes and connections need a diagram. | `flowchart` page only; one semantic block, then native Canva construction later. |

If the material has no natural use for a block, omit it. Where multiple representations fit, prefer the one that makes learner action or comparison clearest. A Tip or 핵심정리 on an unsupported page can go on a following `concept` page when it adds a distinct explanation, rather than creating a page for a decorative callout. `cover`, `toc`, `divider`, `chart-result`, `before-after`, and `final-submission` are not accepted manuscript page types; they are handled outside the MD manuscript.

## Paragraphs and bullets

Write for readability at 28 pt on a portrait page:

- When an explanation grows long, or when several items are listed — examples, features, steps, learning objectives — use a bulleted list instead of a long run of prose. Put a short lead-in of one or two sentences before the list when it helps, and give each item exactly one point, written briefly.
- Keep a short, naturally flowing explanation as a paragraph. Do not turn content into a list when splitting it would break the flow or read awkwardly.
- When a paragraph is about to become long, first split it into two paragraphs; switch to bullets only when the reader is better served by scanning items one by one.
- Lists are one level deep, and inline formatting is `**강조**` only. Name identifiers in bold rather than in backticks.

## Screenshot guides

- Give every step one action, one capture, and one or more sentences or bullets saying what the learner does or sees. A step with only a capture is rejected.
- **Declare captures with `width="half"` by default**, so that two steps can fit on one page. If important labels cannot be read at that size, use `text` or `full` and say why in the hand-over list. Never force two steps onto one page by making a capture unreadable.
- Do not number the step headings; the app adds `STEP n.`.

## Images

- Plan useful images from the supplied material and the page's teaching purpose. The normal hand-off is a manuscript with `::image{...}` placeholders; the user adds the actual images later. Do not wait for files before writing or validating the MD. If the user supplies images first, inspect and use those that fit; honor any stated image choices, exclusions, or count.
- Give each placeholder a stable planned `src` under `assets/`, an `alt` describing what the learner should see, and an explicit `ratio` matching the expected final image. If the exact ratio is unknown, choose a plausible provisional ratio, mark it as provisional in the hand-over, and tell the user to adjust the placeholder ratio in the app before dropping in a differently shaped image. Never claim the file exists when it has only been planned.
- Use a placeholder when the visual carries information that text alone would make hard to follow: a relevant app screen, a result state, or a supplied diagram. Do not add decorative images solely for variety or fabricate a software screen. A required capture for each `screenshot-guide` step and a `role="result"` image after GUI code are format requirements; include them and list them in the hand-over.
- If a required visual is uncertain, describe the expected content in `alt` and the hand-over instead of inventing what a real screen or result looks like. If an image cannot be planned without a missing product detail, ask for that detail or choose a page type that does not require the image.

## Common mistakes the validator catches

- Inline code in backticks, `> quotations`, tables outside `comparison`, nested lists, `###` on a `concept` page.
- A code block without an `output` block or a `role="result"` image directly after it.
- A screenshot-guide step with only a capture, or a step heading that starts with `STEP 1.`.
- A `prompt` block without its `response`, or a `flow` block with one card or more than five.
- Page types that do not exist yet: `cover`, `toc`, `divider`, `chart-result`, `before-after`, `final-submission`. Leave those to be added in Canva by hand and say so.

## Hand-over list format

```
원고: coala-book-md/ch05-conditionals/book.md (검증 통과, 원고 페이지 컨테이너 8개; Canva에서 분할될 수 있음)

준비할 이미지 (3)
- assets/ch05/if-window.png · 미제공 · 16:9 (임시 비율) · 실행 결과 · 나이 입력 창과 결과 문구
- …

직접 만들 순서도 (1)
- 3쪽 '나이에 따른 결과 분기' · if-else · 노드 4개

확인할 사실
- 이 교재는 Flet 0.2x 기준으로 썼습니다. 수업 환경의 버전을 확인해 주세요.
```
