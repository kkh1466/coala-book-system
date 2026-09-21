# Production workflow

## Separate the three size systems

Record these independently:

1. source Canva canvas and its displayed text settings;
2. intermediate file canvas and text settings, such as PPTX;
3. final printed paper size and print scaling.

Do not assume that equal numeric font values produce equal physical text sizes across these systems.

## Preferred Canva-native route

Prefer a Canva-native copy when the user is authorized to copy the reference and the available Canva integration can perform the required page and element operations.

1. Copy the source design; never turn the shared reference itself into the working document.
2. Confirm that the copy preserves fonts, colors, margins, reusable page layouts, grouped elements, and `${pageNumberOnly}`.
3. Duplicate the native source pages for the locked table-of-contents, chapter-opening, and practice-opening templates. Do not reconstruct them from their PNG references.
4. For flowcharts, follow `flowcharts.md`: insert or duplicate the exact mapped Canva library elements, apply the matching conditional or loop construction, and connect them with native editable lines or connectors. Do not use visually similar source shapes unless their graphics IDs match.
5. Replace text and media through an editing transaction when available while preserving grouping, relative positions, and layer order.
6. Preserve the automatic page-number field and recheck it after page operations.
7. Preview all changed page types against their retained PNG references before saving or exporting.

Do not assume that every environment exposes page duplication, page merging, arbitrary element creation, or export. Do not name or call a capability that is not actually available. If the design cannot be copied or edited with the current permissions, stop or use the tested fallback route rather than modifying the reference.

An output cannot be called an exact match when the locked page templates were recreated approximately or a flowchart was flattened. The retained PNG assets are for visual comparison only.

## Fallback PPTX-to-Canva route

Use PPTX when a Canva-native copy or required page operations are unavailable, or when a Canva-independent deliverable is required. It must be tested before producing a full book.

1. Create a representative sample containing three to five page types.
2. Include a title, body text, Korean bold and regular text, a table, a screenshot, and a flowchart.
3. Use the intended aspect ratio or confirmed physical page size.
4. Render the PPTX locally and complete the readability checklist.
5. Import the sample into Canva.
6. Compare page size, font substitution, line wrapping, object positions, screenshots, tables, and editability.
7. Confirm how page numbering will be generated because `${pageNumberOnly}` will not be preserved as a Canva-native field through this route.
8. Proceed with the full book only when the sample passes.

Do not claim that PPTX import preserves every font, effect, position, or editable element until this test has been completed.

PPTX is not an exact-fidelity substitute for the locked Canva templates. After import, rebuild or replace flowcharts with the exact Canva library elements and constructions in `flowcharts.md`, and verify the contents, chapter-opening, and practice-opening pages against native duplicated source pages before claiming an exact match.

## Density validation

Do not use guessed character or line limits. Place content with confirmed typography, render the page, and inspect it at normal viewing size. If the page requires zooming or reduced text, add a continuation page.
