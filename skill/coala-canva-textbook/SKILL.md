---
name: coala-canva-textbook
description: Create or restructure Korean portrait educational textbooks from structured Markdown or source manuscripts, following the retained Coala Canva book's page system and prioritizing large readable text, generous whitespace, and content splitting over shrinking. Use for new Canva-style textbooks, workbooks, and course materials; do not use for ordinary slide decks or unrelated documents.
---

# Coala Canva Textbook

Create a new educational book that follows the structure and visual language of the reference Canva book. Treat readability as the primary constraint.

Do not modify the original Canva design unless the user explicitly asks for an edit. Do not invent unknown measurements, colors, assets, or institutional branding.

## Non-negotiable readability rules

- Use Wanted Sans for textbook text except inside flowcharts. Use `Hakgyoansim Chilpanjiugae OTF` for every text element inside a flowchart, including node text and branch labels.
- Use 50 pt for the main chapter title inside the rounded chapter header, such as `AI 디지털 리터러시`.
- Use 30 pt for the chapter subtitle and section or subsection headings, such as `AI와 함께하는 디지털 시대`, `학습 목표`, and `생성형 AI란 무엇일까?`.
- Use 28 pt for body paragraphs, introductory sentences, bullet items, and ordinary explanatory text.
- Use line spacing 2 and letter spacing 0.
- Never reduce any confirmed typography size, tighten spacing, crop text, or reduce margins merely to fit more content.
- When content does not fit comfortably, split it across additional pages.
- Prefer fewer elements and more whitespace over a dense page.
- Keep one main learning purpose per page.
- Screenshots, tables, flowcharts, and code must remain readable at normal viewing size. Move supporting explanation to another page when necessary.
- Empty space is intentional. Do not enlarge or add decorative content simply to fill it.

If the target tool cannot preserve these requirements, stop and explain the limitation instead of silently producing smaller text.

Do not use the ambiguous phrase `title size` without naming the role. Distinguish `main chapter title 50 pt`, `chapter subtitle 30 pt`, `section heading 30 pt`, and `body 28 pt` in plans, generation instructions, and validation reports.

## Non-negotiable Canva template fidelity

The retained PNG files show what the finished pages must look like, but they are not flattened page backgrounds for new books. When working in Canva, preserve editability by copying the matching native page or native elements from an authorized copy of the source design.

- For table-of-contents, chapter-opening, and practice-opening pages, duplicate the matching Canva source page and preserve its frame, grouped elements, relative positions, spacing, strokes, shadows, colors, and layer order. Replace only the content, numbering, and authorized branding required for the new book.
- Do not rebuild these locked templates from memory, approximate them with a generic layout, or use the retained PNG as the final full-page image.
- For flowcharts, use only the exact Canva Elements assets and constructions defined in `references/flowcharts.md`. Join them with native Canva line or connector elements and keep every shape, label, and connector editable. Do not substitute generic or custom-drawn lookalikes.
- The Coala Book Builder app cannot insert those flowchart assets, so it reserves a marked placeholder on each flowchart page and lists what must be built. A person builds the flowchart in the Canva editor. A page that still shows a placeholder is unfinished and does not satisfy the flowchart rules.
- A practice-opening page contains exactly one primary practice card. Below it, leave empty space or place at most one short supporting block: a simple Tip or a concise practice-objective block. Do not add a second practice card or ordinary lesson content below it.
- If the available Canva capabilities cannot duplicate and edit the required native template or flowchart elements, stop and report that exact template fidelity cannot be guaranteed. Produce an approximate draft only when the user accepts that limitation.

## Before creating

Determine from the request or ask only when material:

- book title and learner level;
- chapter or session outline;
- source manuscript and required content;
- approximate scope or page limit, if one exists;
- institution name and authorized logos;
- target output format and whether Canva is required;
- intended physical print size and whether the design will be scaled for printing.

If a fixed page limit conflicts with the typography and whitespace rules, report the conflict and ask whether to increase the page count or shorten the content. Do not solve the conflict by shrinking the design.

Do not treat the Canva canvas setting, PPTX point size, and final printed size as interchangeable. Confirm the production and print path before applying typography outside the source Canva canvas.

## Required references

Always read:

- [references/style-guide.md](references/style-guide.md)
- [references/page-types.md](references/page-types.md)
- [references/qa-checklist.md](references/qa-checklist.md)

Read [references/content-writing.md](references/content-writing.md) when drafting or restructuring instructional content.

Read [references/image-guidelines.md](references/image-guidelines.md) when the book uses screenshots, diagrams, illustrations, tables, or code.

Read [references/flowcharts.md](references/flowcharts.md) whenever a page contains a flowchart, algorithm diagram, conditional, or loop diagram.

Read [references/pending-values.md](references/pending-values.md) before claiming exact visual fidelity or adding new reference assets.

Read [references/production-workflow.md](references/production-workflow.md) when choosing Canva, PPTX, PDF, or another production route.

Read [references/manuscript-format.md](references/manuscript-format.md) whenever a Markdown manuscript will be parsed by the Coala Book Builder app. Validate the manuscript before creating any Canva pages.

## Workflow

1. Preserve all required source content and identify the learning purpose of each section.
2. Map the content to the page templates and content blocks in `references/page-types.md`.
3. When the input is Markdown, normalize it to `references/manuscript-format.md` and validate the complete document before creating any Canva pages. Where the Coala Book Builder source is available, run `npm run validate -- <manuscript.md>` from `canva-app/` and fix every reported row until it passes; otherwise check the manuscript against "Supported Markdown, and nothing else" by hand.
4. Estimate density using the fixed typography. Split dense content before layout.
5. For table-of-contents, chapter-opening, and practice-opening pages, duplicate the matching native Canva page instead of recreating its structure when that capability is available.
6. For flowcharts, classify each node and conditional/loop structure, then follow `references/flowcharts.md` exactly. If the target integration cannot insert or duplicate the required native Canva assets, do not draw substitutes. With the Coala Book Builder app, write the flowchart in the manuscript, let the app reserve its placeholder, and hand the listed placeholders to a person to build in the Canva editor; with any other integration, stop and report the limitation.
7. Create other pages using the style roles in `references/style-guide.md`.
8. Render or retrieve representative page previews.
9. Run the checks in `references/qa-checklist.md`.
10. Revise crowded pages by shortening optional prose or adding pages, never by shrinking required text.
11. After all splits and insertions, finalize page numbering and regenerate the table of contents.
12. Report any items that could not be verified, and list every image placeholder and flowchart placeholder that still has to be filled by hand.

The source book is evidence for visual language and reusable page patterns, not an authority for density or numbering quality. When a source page conflicts with this skill's readability or sequence checks, follow the skill and improve the new book rather than copying the defect.

## Missing manuscript behavior

If no manuscript is supplied, create only an outline when the user requested planning. Draft instructional content only when the user explicitly requested writing. Distinguish user-supplied source content from newly drafted content, and do not invent curriculum requirements, institutional policies, citations, or software behavior.

## Reference source

The canonical source record is [assets/source-metadata.json](assets/source-metadata.json). Twenty full-resolution page examples are retained under `assets/page-examples/` at 1587 × 2245 px; the page-type reference table in `references/page-types.md` maps each file to the page type it illustrates. The complete reference PDF and a few page types still lack an example. Follow `references/pending-values.md` to add them without changing known rules.

`assets/page-examples/cover.png` contains the reference institution's logo and the producer mark. Use it for layout reference only and replace both marks with authorized artwork.
