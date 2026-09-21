# Visual style guide

## Document geometry

- Design type returned by Canva metadata: `unknown`
- The browser editor labeled the design as `Poster`, but this is not treated as authoritative metadata.
- Orientation: portrait
- Canonical Canva PNG export size: 1587 × 2245 px
- Size reported by Canva API metadata: 1588 × 2246 px. Both are correct for their own surface; the PNG export size is canonical here.
- Aspect ratio: consistent with the A-series portrait ratio
- Likely physical preset: A2 when interpreted at approximately 96 px per inch
- Physical page size: not independently confirmed
- General body-page background: `#F8F9FA`, a near-white gray rather than pure white
- Contents and divider background: pale blue
- Page number placement: bottom-right on applicable interior pages
- Default alignment: left

## Confirmed typography

The word `title` is not a single style in this book. Always identify the semantic role before applying a size.

| Role | Example from reference | Font | Size | Observed treatment |
| --- | --- | --- | ---: | --- |
| Main chapter title | `AI 디지털 리터러시` | Wanted Sans | 50 pt | Prominent dark text inside the rounded chapter header |
| Chapter subtitle | `AI와 함께하는 디지털 시대` | Wanted Sans | 30 pt | Smaller gray text directly below the main chapter title |
| Section heading | `학습 목표` | Wanted Sans | 30 pt | Blue emphasized heading |
| Subsection heading | `생성형 AI란 무엇일까?` | Wanted Sans | 30 pt | Blue emphasized heading |
| Body introduction | `이 장을 학습한 후, 여러분은 다음을 할 수 있습니다.` | Wanted Sans | 28 pt | Ordinary body text |
| Body bullet | `생성형 AI의 개념을 설명할 수 있다.` | Wanted Sans | 28 pt | Ordinary bulleted body text |
| Body paragraph | General explanatory prose | Wanted Sans | 28 pt | Ordinary body text; selected phrases may use emphasis color or weight |
| Flowchart-internal text | Node text, condition text, loop text, `YES`/`NO` | Hakgyoansim Chilpanjiugae OTF | Unconfirmed | Applies only inside flowcharts; do not substitute Wanted Sans |

Confirmed global settings:

- Line spacing: 2
- Letter spacing: 0

Do not interpret every visually prominent string as a 30 pt `page title`. The 50 pt main chapter title and 30 pt section hierarchy are distinct styles.

These values were supplied by the user and take precedence over visual estimation.

`references/style-guide.md` is the single source of truth for typography. Machine-readable metadata must point here rather than duplicate these values.

These typography values belong to the Canva source whose direct PNG export is 1587 × 2245 px. Do not automatically reuse the same numeric values in an A4 PPTX, PDF, Word document, or other differently sized canvas. Before production, confirm the intended printed paper size and any print scaling. If the source is produced at A2 and printed at A4, the physical result is scaled to approximately half size.

Do not assume that Canva's displayed font-size values, CSS pixels, PowerPoint points, and printed typographic points are interchangeable without a representative export or import test.

Do not infer exact values for cover titles, circular chapter numbers, labels, captions, table text, code, or page numbers. Their role hierarchy can be reproduced visually, but their exact sizes remain unconfirmed.

## Blocking values for close visual fidelity

The following must be measured before claiming that a result closely matches the reference:

- exact font weight for each confirmed text role;
- primary title color;
- chapter-title frame color;
- title-to-body spacing.

A readable preliminary book may be produced before these are known, but it must be described as preliminary rather than an exact visual match.

Confirm 50/30/28 values from the Canva toolbar, from editable source properties, or by measuring a full-resolution 1587 × 2245 native PNG export. The retained page examples are at that resolution, so the 30 pt and 28 pt roles are distinguishable from them. Do not attempt this distinction from a reduced screenshot.

## Readability and spacing

- Keep consistent outer margins on all interior pages.
- Leave clear separation between the title, content blocks, and footer.
- Do not fill the lower part of a page merely because space remains.
- A page that requires smaller type, tighter line spacing, narrow margins, or a compressed screenshot is overcrowded and must be split.
- Avoid long uninterrupted paragraphs. Break content by meaning, not simply by available space.
- Keep corresponding elements aligned across pages of the same type.

Exact margin measurements are not confirmed. Do not claim a numeric margin until it has been measured from the source design.

## Measured color roles

These values were sampled from the retained full-resolution native Canva PNG exports, not from a reduced screenshot. They supersede the earlier screenshot-derived estimates. Verify with Canva's native color control before claiming an exact match, since PNG export still passes through color management.

| Role | Value | Observed use | Measured from |
| --- | --- | --- | --- |
| Body-page background | `#F8F9FA` | interior content pages | `chapter-opening.png` |
| Contents and divider background | `#DFE9F2` | contents pages and blank dividers | `table-of-contents.png`, `section-divider.png` |
| Primary indigo | `#1800AD` | circular chapter number, section headings, rounded chapter-header outline | `chapter-opening.png` |
| Main and body text | `#000000` | main chapter title and body copy | `chapter-opening.png` |
| Chapter subtitle and page number | `#737373` | subtitle below the main chapter title; page number | `chapter-opening.png` |
| Tip box fill | `#EAF1FF` | pale-blue tip box on practice pages | `practice-opening1.png`, `practice-opening2.png` |
| Key-summary box fill | `#FFFAB3` or `#FFF9D9` | `핵심 정리` box | `core-summary-box.png`, `caution-box.png` |

Do not split the circular chapter number and blue section heading into separate primary and secondary brand colors; both measure `#1800AD`. The rounded chapter-header outline measures `#1800AD` as well, so it is the same role rather than a separate frame color.

The two key-summary fills are both `핵심 정리` boxes in the source, not a summary color and a caution color. The source is inconsistent here. Choose one fill for a new book and apply it consistently rather than reproducing both.

The caution-box fill remains unconfirmed because no caution-only page example is retained.

### Flowchart shape roles

The following user-confirmed values supersede color estimates sampled from the PNG examples. The exact Canva element mapping and construction rules are maintained in `references/flowcharts.md`.

| Shape role | Fill | Stroke |
| --- | --- | --- |
| Declaration | `#FFFAB3` | `#F3B96B` |
| Input | `#DFF1FE` | `#1800AD` |
| Output | `#FFF3E8` | `#F3B96B` |
| Process | `#D9FAD3` | `#00BF63` |
| Decision and if/else container | `#FFDEE7` | `#FF5757` |
| Loop container | `#EBEBF9` | `#1800AD` |

The loop's internal divider is `#1800AD` at weight `10`. Ordinary flowchart connectors are gray `#737373`; their stroke weight remains unconfirmed.

Table borders, corner radii, and shadow values remain unconfirmed.

## Density decisions

Use this order when a page is crowded:

1. Remove duplicated or nonessential explanation without removing required content.
2. Move secondary explanation to a continuation page.
3. Split a process into multiple steps or pages.
4. Split a large table, code sample, diagram, or screenshot sequence.

Never solve density by reducing confirmed typography or line spacing.

Do not enforce estimated limits such as characters per line or lines per page until they have been measured from multiple retained reference pages. Use rendered-page inspection as the current density test.
