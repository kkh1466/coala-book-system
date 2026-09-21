# Quality assurance checklist

## Automatic or metadata checks

- [ ] A direct Canva PNG reference export is 1587 × 2245 px when reproducing the original format.
- [ ] Orientation is portrait.
- [ ] Intended physical print size and print scaling are recorded.
- [ ] Canvas font values were not blindly reused in a differently sized output format.
- [ ] Required pages render without corruption.
- [ ] Intended divider pages are distinguished from accidental blank pages.
- [ ] Page numbers are present, ordered, and not duplicated where required.
- [ ] Required images resolve and preserve aspect ratio.
- [ ] Every image placeholder listed by the app after generation has been filled, and no grey placeholder box or guide label remains.
- [ ] No filled placeholder crops needed content; where an image's ratio differed from the manuscript, the box ratio was changed with the app before the image was added.
- [ ] After a box ratio was changed, nothing on that page overlaps or runs past the body area, and the page number is untouched.
- [ ] No placeholder relied on the default ratio without that being intended.

## Typography checks

- [ ] Wanted Sans is used or its absence is reported.
- [ ] Main chapter titles inside the rounded chapter header are 50 pt.
- [ ] Chapter subtitles are 30 pt.
- [ ] Section and subsection headings are 30 pt.
- [ ] Body introductions, bullet items, and paragraphs are 28 pt.
- [ ] Line spacing is 2.
- [ ] Letter spacing is 0.
- [ ] No confirmed text role was reduced to make content fit.
- [ ] A 30 pt section heading was not mistaken for the 50 pt main chapter title.
- [ ] A 28 pt body paragraph or bullet was not mistakenly formatted as a 30 pt heading.
- [ ] The 50/30/28 checks were performed using Canva toolbar values, editable source properties, or a full-resolution 1587 × 2245 native PNG export, never a reduced screenshot.
- [ ] No text is clipped, overlapped, or outside its container.
- [ ] Wanted Sans was not substituted during generation or import.

## Readability checks

- [ ] Every page has one clear primary learning purpose.
- [ ] Outer margins remain visually generous and consistent.
- [ ] Title, content blocks, and footer have visible separation.
- [ ] The page does not appear filled edge-to-edge.
- [ ] Paragraphs are broken into readable units.
- [ ] Screenshots and code are readable at normal viewing size.
- [ ] Tables have comfortable row height and concise cells.
- [ ] Diagrams do not require the learner to zoom in.
- [ ] Continued pages use a consistent continuation marker.
- [ ] Continued tables repeat their headers.

## Native template fidelity checks

- [ ] Retained PNG examples were used for visual comparison only, not pasted as flattened final pages.
- [ ] Each table-of-contents page was duplicated from the native Canva source and preserves its background, title placement, number and title columns, separators, spacing, and margins.
- [ ] Each chapter-opening page was duplicated from the native Canva source and preserves the circular marker, rounded title frame, overlap, proportions, positions, and layer order.
- [ ] Each practice-opening page was duplicated from one intact native source variant rather than reconstructed or mixed from multiple variants.
- [ ] Each practice-opening page contains exactly one primary practice card.
- [ ] The area below a practice-opening card is empty or contains only one short Tip or one concise practice-objective block.
- [ ] No practice-opening page includes a second practice card, full procedure, flowchart, code listing, table, screenshot sequence, or multiple callout boxes below the card.
- [ ] Every flowchart placeholder listed by the app after generation has been replaced by a finished flowchart, and no grey placeholder box or guide text remains on any page.
- [ ] Each finished flowchart contains every node and connection listed for its placeholder, with the listed text.
- [ ] Text placed below a flowchart does not overlap it; it was moved down when the flowchart outgrew the reserved area.
- [ ] Every flowchart consists of separately editable native Canva shapes, labels, and connectors rather than a flattened image.
- [ ] Declaration, input, output, process, and decision nodes use the exact Canva graphics IDs mapped in `references/flowcharts.md`; no generic or custom-drawn substitutes were used.
- [ ] Every flowchart-internal text element uses `Hakgyoansim Chilpanjiugae OTF`, or its absence is explicitly reported.
- [ ] If/else-only diagrams use crimson Process containers with Decision elements layered at the upper-left.
- [ ] If/else-if/else diagrams use multiple Decision elements and do not use Process containers for their conditions.
- [ ] Loop diagrams use a `#EBEBF9` Process container with `#1800AD` stroke and a separately editable `#1800AD` internal divider at weight `10`.
- [ ] Flowchart connectors have visible arrowheads, meet the intended shapes, preserve the correct direction, and do not cross labels or unrelated nodes.
- [ ] Ordinary flowchart connectors are gray `#737373`; no unconfirmed stroke weight is presented as exact.
- [ ] Flowchart branch labels such as `YES` and `NO` are attached visually to the correct outgoing paths.
- [ ] Where a retained flowchart example differs from `references/flowcharts.md`, the newer written rule was applied and the example was used only for composition and spacing.

## Pagination checks

- [ ] The visible numbering policy for cover, divider, contents, and chapter pages was confirmed.
- [ ] Page numbering was assigned after all page splits and insertions.
- [ ] The table of contents was regenerated after final pagination.
- [ ] Contents entries match the final chapter-opening pages.
- [ ] Canva-native numbered pages preserve `${pageNumberOnly}` rather than literal page numbers.
- [ ] Chapter numbers have no unintended duplicates, gaps, reversals, or resets.
- [ ] Practice identifiers have no unintended duplicates, gaps, reversals, or resets.
- [ ] Chapter numbers, practice identifiers, and printed page numbers were validated as separate sequences.

## Density failure rule

Fail the page if any confirmed font or spacing value must be reduced, if meaningful content approaches the safe edge, or if screenshots and diagrams cannot be read normally. Correct the failure by adding or splitting pages.

## Visual review

Render the cover, contents, one chapter opening, one concept page, one practice opening, one screenshot page, one diagram or table page, and the final page. Compare hierarchy, whitespace, alignment, and color roles with retained reference images when available.

Report unverified values and missing assets. Never mark exact visual fidelity as verified while `references/pending-values.md` contains unresolved items needed for that claim.
