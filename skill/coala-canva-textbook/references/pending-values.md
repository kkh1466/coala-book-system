# Missing inputs and how to complete them

This skill intentionally leaves the following items unresolved because they were not available as reliable values from the Canva reading interface.

## Missing reference assets

Not included yet:

- an exported PDF of the complete 102-page reference book;
- page examples for the code-explanation, continuation, and caution-only page types;
- authorized Coala logo files;
- institution-logo placeholder or institution-specific logos.

Twenty full-resolution page examples are already retained at 1587 × 2245 px and are mapped to page types in `page-types.md`.

How to complete:

1. Export the Canva source as a standard PDF without changing page size.
2. Place it at `assets/reference-book.pdf`.
3. Export the remaining representative pages directly from Canva as PNG at 1587 × 2245 px.
4. Place them under `assets/page-examples/` with role-based names, and add each new file to both the metadata asset list and the page-type reference table. Preserve the existing examples.
5. Add only logo files the user is authorized to reuse.

## Missing exact style values

Unconfirmed:

- native Canva color-picker HEX values; values measured from the full-resolution PNG exports are recorded in `style-guide.md` and are sufficient for reproduction;
- caution-box fill, table borders, corner radii, and shadow values;
- cover-title size;
- caption, label, table, code, and page-number sizes;
- font weights for each role;
- flowchart-internal text size and weight for `Hakgyoansim Chilpanjiugae OTF` (line spacing `2` and letter spacing `0` are already confirmed globally);
- ordinary flowchart connector stroke weight (the loop-container internal divider is separately confirmed as weight `10`);
- exact size and upper-left offset of the Decision element layered over an if/else Process container;
- exact outer margins, gutters, corner radii, border widths, and shadow values;
- final publication numbering policy for the cover, dividers, contents, and chapter openings;
- preferred continuation naming convention if `제목 (계속)` is not desired;
- confirmed physical page preset and final print size.

How to complete:

1. Open a representative Canva page.
2. Select one element for each text and component role.
3. Record the exact Canva toolbar values without estimating from screenshots.
4. Sample the actual fill, border, and text colors.
5. Measure page-edge positions for the common content frame.
6. Update `references/style-guide.md` and remove only the corresponding unresolved entries.

The following values are now confirmed and must not be listed as unresolved: main chapter title 50 pt, chapter subtitle 30 pt, section and subsection headings 30 pt, and body introductions, bullets, and paragraphs 28 pt.

## Production route status

Production routing is defined in `production-workflow.md`. Canva-native copying is preferred when the account, source permissions, and available editing capabilities can preserve the reference safely. A small PPTX import test remains the fallback when native page construction or duplication is unavailable. Neither route should be claimed as validated until its stated test passes.

## Deployment target

`agents/openai.yaml` is retained for Codex and OpenAI-compatible environments. Claude Code does not use this file but can still use `SKILL.md`, `references/`, and `assets/`. If the skill will be distributed only for Claude Code, `agents/openai.yaml` may be omitted from that distribution. Do not remove it from a dual-use package.

## Validation status

The Canva app now includes structured-Markdown parsing and BookSpec validation for the implemented page templates. Structural skill validation should still use the Skill Creator `quick_validate.py`. Visual fidelity and readability still require rendered-page review.

The remaining document-validation work includes image resolution, final pagination and contents consistency, font usage in the rendered Canva design, and render success. Do not add tests that merely search for expected words or headings.
