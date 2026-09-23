# Page types

Select the closest page type for each learning purpose. Page numbers identify observed examples in the original 102-page Canva source.

For implementation, distinguish a whole-page template from a reusable content block. `Tip`, `핵심 정리`, example results, images, code, tables, and checklists can be blocks inside several page templates; they should not each require an independent full-page renderer.

Twenty full-resolution page examples (1587 × 2245 px native Canva PNG exports) are retained under `assets/page-examples/`. Open the listed example before laying out a page of that type.

The PNGs are visual verification references, not finished page backgrounds. For the locked native templates identified below, duplicate the corresponding page from an authorized copy of the Canva source design and edit its native elements.

## Page-type reference table

| Page type | Retained example |
| --- | --- |
| Cover | `cover.png` (replace institution branding) |
| Divider or intentional blank | `section-divider.png` |
| Table of contents | `table-of-contents.png` |
| Chapter opening | `chapter-opening.png` |
| Concept explanation | `data-visualization.png` |
| Table or comparison | `prompt-comparison.png` |
| Flowchart or algorithm | `flowchart1.png`, `flowchart2.png` |
| Practice opening | `practice-opening1.png`, `practice-opening2.png` |
| Step-by-step practice | `step-by-step-guide.png` |
| Code explanation | none retained |
| AI prompt and response | `ai-prompt-response.png` |
| Tip or caution | tip box visible in `practice-opening1.png`; no caution-only example retained |
| Key-summary box | `core-summary-box.png`, `caution-box.png` |
| Before and after comparison | `before-after.png` |
| Follow-along implementation | `process-steps.png` |
| Practice-objective checklist | `practice-objectives.png` |
| Major-specific extension table | `major-extension-table.png` |
| Project summary or portfolio | `portfolio-summary.png`, `project-checklist.png` |
| Continuation pages | none retained |

`caution-box.png` is named after a caution box but actually shows a `핵심정리` key-summary box. Treat it as a second key-summary example, not as a caution reference. Its top shows the horizontal flow strip of white cards joined by thin lines, which the Coala Book Builder app draws from a ```` ```flow ```` block on a `concept` page (see `manuscript-format.md` > "Flow strip"); the key-summary box itself is the `> [!KEY_POINT]` callout, drawn with the `📑 핵심정리` label.

## Cover

Observed example: page 1. Reference example: `assets/page-examples/cover.png`.

Use a restrained pale-blue and white background, a large two- or three-line title, a small producer mark near the top, and an authorized institution logo near the bottom. Keep generous empty space.

The retained cover example carries the reference institution's logo and the producer mark. It is a layout reference only. Replace both marks with artwork the user is authorized to use, and never carry the reference institution's branding into a book for a different institution.

## Divider or intentional blank

Observed examples: pages 2 and 102. Reference example: `assets/page-examples/section-divider.png`.

Use pale blue with no content or only minimal section information. Do not treat an intentional divider as an error.

## Table of contents

Observed examples: pages 3–4. Reference example: `assets/page-examples/table-of-contents.png`.

This is a locked native template. Duplicate the source Canva contents page rather than constructing a generic contents list. Preserve the pale-blue background, title placement, number and title columns, thin horizontal separators, row spacing, line lengths, margins, and page-number treatment. Replace the entry text and numbers only after final pagination. When the contents require another page, duplicate the same native contents page and continue there instead of tightening the rows.

Do not place `table-of-contents.png` as a flattened page image. Use it to confirm that the duplicated native page still matches the reference after editing.

## Chapter opening

Observed examples include pages 5, 10, 25, 32, 36, 49, and 64. Page 63 is a practice page, not a chapter opening.

Required structure:

1. numbered circular marker;
2. rounded title frame;
3. 50 pt main chapter title inside the frame;
4. 30 pt chapter subtitle directly below the main title;
5. 30 pt learning-objective heading;
6. 28 pt learning-objective introduction and bullets;
7. 30 pt subsection heading for the next concept when it shares the page;
8. 28 pt explanatory body text;
9. page number when applicable.

Learning objectives should normally use the Korean form `~할 수 있다`. If objectives or introduction make the page crowded, move the introduction to the next page.

Reference example: `assets/page-examples/chapter-opening.png`.

This is a locked native template. Duplicate the source Canva chapter-opening page. Preserve the native top header group exactly, including the circular chapter marker overlapping the rounded title frame, frame proportions, stroke, title and subtitle positions, internal padding, relative spacing, and layer order. Replace the chapter number, title, subtitle, objectives, and body content without redrawing the header from scratch.

Do not use `chapter-opening.png` as a flattened background. If the native page or header group cannot be copied, report that an exact chapter-opening match is unavailable.

## Concept explanation

Reference example: `assets/page-examples/data-visualization.png`.

Use for one central concept. Start with a question or short subheading, explain it in short blocks, and use one supporting example, table, or diagram when helpful. Continue on another page when more than one independent concept competes for attention.

## Table or comparison

Reference example: `assets/page-examples/prompt-comparison.png`.

Use a bold header, restrained light-gray separators, comfortable row height, and short cell text. Put detailed interpretation before or after the table rather than forcing it into cells. Split a table when readable 28 pt body text cannot be maintained.

## Flowchart or algorithm

Observed examples include pages 26, 29, 30, and 34. Reference examples: `assets/page-examples/flowchart1.png`, `assets/page-examples/flowchart2.png`.

Build the finished flowchart from editable native Canva elements and follow [flowcharts.md](flowcharts.md) for the exact Canva assets, semantic mapping, colors, conditional/loop construction, typography, and connector rules. Do not paste a PNG, screenshot, uploaded SVG, or flattened externally generated diagram as the final flowchart, and do not draw lookalike vector shapes when the required native Canva assets are unavailable.

- Classify declaration, input, output, process, decision, loop, and conditional structures before choosing elements.
- Use `Hakgyoansim Chilpanjiugae OTF` for every flowchart-internal text element rather than the book's default Wanted Sans.
- Keep branch labels such as `YES` and `NO` next to the correct outgoing line.
- Prefer a top-to-bottom flow, keep node text short, and avoid unnecessary crossings. Put long explanations outside the diagram or on a continuation page.
- Keep every node, label, divider, and connector separately editable. Grouping for movement is allowed only when it does not flatten or break the connectors.

When the Coala Book Builder app generates the book, a flowchart page arrives with a grey placeholder and a guide instead of a flowchart. That page is unfinished. Build the flowchart over the placeholder by following the "Flowchart placeholders" section of [flowcharts.md](flowcharts.md), then delete the placeholder and its guide.

If the new logic needs more nodes than fit at normal reading size, split the explanation or flowchart across pages. Never solve this by scaling the complete diagram down.

## Practice opening

Observed examples include pages 9, 31, and 35. Do not use page 48 as a practice-opening reference; it is a data-visualization concept page. Reference examples: `assets/page-examples/practice-opening1.png`, `assets/page-examples/practice-opening2.png`.

This is a locked native template. Choose the closer of `practice-opening1.png` and `practice-opening2.png`, then duplicate that native Canva practice-opening page. Preserve the raised white card, rounded corners, restrained shadow, top label pills, internal padding, text hierarchy, width, and placement. Do not combine parts from the two variants arbitrarily.

Exactly one primary practice-opening card is allowed on a page. The area below the card must be one of the following:

1. intentionally empty;
2. one short pale-blue Tip block; or
3. one concise practice-objective block.

Do not place a second practice card, full procedure, flowchart, code listing, table, screenshot sequence, long explanation, or multiple callout boxes below the opening card. Move those materials to subsequent step-by-step or concept pages. If the opening text does not fit the existing card comfortably, shorten the introduction or move detail to the next page; do not shrink the text, enlarge the card into the lower support area, or add another opening card.

Do not use either practice-opening PNG as a flattened background. The native card and support block must remain editable.

## Step-by-step practice

Reference example: `assets/page-examples/step-by-step-guide.png`.

Use one clear action per step. Show a readable screenshot and only the instruction needed for that action. Highlight the target control when the source image permits it. Split multiple screens across pages rather than shrinking them.

The Coala Book Builder app renders this as the `screenshot-guide` page type (see `manuscript-format.md` > "Screenshot guide"): the STEP cards and down arrows of `process-steps.png`, each card holding one required capture placeholder at the card's inner width and at least one required paragraph or list describing the action; the manuscript is rejected when a step has only a capture. Cards move whole to the next page rather than splitting.

## Code explanation

No retained example yet.

Show only the code needed for the current learning point. Label the language, separate code visually from prose, and explain the behavior nearby or on the next page. Do not fit a long complete program on one page by reducing type.

The Coala Book Builder app draws a fenced code block on a `concept` page (see `manuscript-format.md` > "Code") as a light grey rounded box with a language label, 28 pt monospace text at line spacing 2, grey comments, and blue keywords. Every code block must carry exactly one execution result: a text result is drawn in a second grey box under a blue `실행 결과` label, and a GUI result is a `role="result"` image placeholder under the same blue label. Long code and output split at line boundaries across pages; the continuation label says whether code or output continues. Because no code page from the reference book is retained, this look was chosen by the app and is provisional until a reference page is supplied (`pending-values.md`).

## AI prompt and response

Observed in the reference book's AI literacy and example pages. Reference example: `assets/page-examples/ai-prompt-response.png`.

Use separate rounded containers or otherwise clearly distinct regions for the user's prompt and the AI response. Label the two roles consistently, keep one primary prompt task per page, and maintain comfortable internal padding.

The Coala Book Builder app draws this from a ```` ```prompt ````/```` ```response ```` pair on a `concept` page (see `manuscript-format.md` > "AI prompt and response"): a pill-shaped outline for the prompt and a rounded outlined box for the response, both with 28 pt text. The shapes themselves distinguish the roles, as in the reference page; no text label is added. The reference page's `+` and microphone icons are not reproduced.

When a response is long, retain only the portion required for the learning purpose or continue it on another page. Clearly mark summarized, shortened, or edited AI output. Never shrink the response text to force the full output onto one page.

Do not present generated factual, medical, legal, or financial statements as verified merely because they appear in an AI response.

## Tip or caution

A pale-blue tip box is visible in `assets/page-examples/practice-opening1.png`. No caution-only page is retained yet, so the caution fill remains unconfirmed.

Use pale blue for explanatory tips and pale yellow for cautions or essential checks. Keep one message per box. A tip box supports the page; it must not become a second full lesson.

## Key-summary box

Observed repeatedly in the source, including algorithm and repetition explanations. Reference examples: `assets/page-examples/core-summary-box.png`, `assets/page-examples/caution-box.png`.

Use a visually distinct box headed `핵심 정리` for one short consolidation message. Keep it separate from ordinary tips: a summary states the concept the learner should retain, while a tip provides optional help. Do not add a second lesson inside the box.

## Before and after comparison

Observed in later UI-improvement content. Reference example: `assets/page-examples/before-after.png`.

Use matched panels with the same scale and aligned comparison dimensions. Label `Before` and `After` clearly, explain the meaningful change, and avoid changing unrelated variables between the two examples.

## Follow-along implementation

Observed as `따라해보기` content. Reference example: `assets/page-examples/process-steps.png`.

Break the task into readable actions with an input, action, and expected visible result. Keep screenshots large enough to read. Continue on another page instead of placing an entire implementation sequence on one page.

The Coala Book Builder app renders this as the `step-process` page type (see `manuscript-format.md` > "Step process"): the same STEP cards and down arrows as `process-steps.png`, text only, one required paragraph or list per step and no image placeholders. It shares its card layout with `screenshot-guide`.

## Practice-objective checklist

Reference example: `assets/page-examples/practice-objectives.png`.

Use at the start of a practice sequence when learners need to know what they will complete. Keep checklist items observable and concise. This is distinct from a chapter-opening learning-objective list and should not repeat the full chapter goals.

## Major-specific extension table

Observed in the major-customization chapters. Reference example: `assets/page-examples/major-extension-table.png`.

Map each major or learner context to a concrete feature, input, processing rule, or output. Keep cell text short and move implementation detail to follow-along pages. Split the table when 28 pt text cannot be maintained.

## Project summary or portfolio

Reference examples: `assets/page-examples/portfolio-summary.png`, `assets/page-examples/project-checklist.png`.

Use a checklist or concise structured list covering purpose, major functions, implemented elements, evidence, and reflection. Focus on consolidation rather than introducing new concepts.

## Continuation pages

No retained example yet.

When content must be split, repeat the page title and mark the continuation consistently. Until the publication convention is confirmed, use `제목 (계속)` for the second page and `제목 (계속 2)`, `제목 (계속 3)` for later pages.

- Preserve the same chapter and page-type styling.
- Do not repeat the full chapter introduction or learning objectives.
- Repeat table headers when a table continues.
- Repeat step context only when the next action would otherwise be unclear.
- Do not use a continuation marker for a new independent topic.

This continuation convention is an operational rule added for reliable splitting; it was not confirmed as a convention used by the source book.

## Conditional page types

Troubleshooting, review questions, glossary, and references pages may be added when the manuscript or user request requires them. Do not treat them as mandatory source-derived page types until representative pages are confirmed.

## Pagination and contents

Do not finalize page numbers during initial layout. Assign them only after all content splitting, insertion, and deletion is complete. Regenerate the table of contents after pagination changes; never preserve stale manually typed page references.

The source appears to show bottom-right numbering on contents pages, but the intended publication policy is not fully confirmed. Before final production, confirm whether the cover, blank dividers, contents pages, and chapter-opening pages are counted and whether their numbers are visibly printed.

The Canva source uses the automatic page-number field `${pageNumberOnly}`. In a Canva-native copy, preserve this field and do not replace it with a literal number. After duplicating, inserting, or deleting pages, verify that each numbered page still contains the automatic field.

When the target format cannot preserve `${pageNumberOnly}`, use that format's native automatic page-number mechanism. Use literal page numbers only as a last resort after pagination is final, then audit every page.

## Chapter and practice numbering

- Validate chapter numbers as a continuous intended sequence.
- Validate practice identifiers independently from printed page numbers.
- Do not copy numbering defects from the source book.
- Report duplicates, gaps, reversals, and unexpected resets.
- When practices are intentionally reordered, update their identifiers or document the intentional exception.
