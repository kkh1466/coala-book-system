# Canva-native flowchart rules

Use these rules whenever creating a flowchart, algorithm diagram, conditional, or loop in the Coala textbook. The linked Canva graphics identify the required native elements. Use them from **Canva Elements → Shapes → Flowchart shapes**, or duplicate matching native elements from an authorized Canva source page. Do not replace them with custom vector paths, generic icons, uploaded SVGs, screenshots, or flattened images.

Keep all shapes, text, dividers, branch labels, and connectors separately editable. Use `assets/page-examples/flowchart1.png` and `assets/page-examples/flowchart2.png` for composition and spacing comparison only. The written rules in this file take precedence where an older example differs, including connector color, flowchart font, and the revised if/else construction.

## Node mapping

| Semantic role | Required Canva element | Canva graphics ID | Fill | Stroke |
| --- | --- | --- | --- | --- |
| Declaration | [Arrow block convex](https://www.canva.com/graphics/MAE7lCxHi8M/) | `MAE7lCxHi8M` | pale yellow `#FFFAB3` | orange `#F3B96B` |
| Input | [Flowchart Input-Output](https://www.canva.com/graphics/MAGpWHDxa1c/) | `MAGpWHDxa1c` | pale sky blue `#DFF1FE` | solid indigo `#1800AD` |
| Output | [Flowchart Document](https://www.canva.com/graphics/MAGpWDtQbCc/) | `MAGpWDtQbCc` | pale orange `#FFF3E8` | orange `#F3B96B` |
| Process | [Flowchart Process](https://www.canva.com/graphics/MAGpWHT7x4M/) | `MAGpWHT7x4M` | pale green `#D9FAD3` | green `#00BF63` |
| Decision | [Flowchart Decision](https://www.canva.com/graphics/MAGpWETGMb4/) | `MAGpWETGMb4` | pale crimson `#FFDEE7` | coral red `#FF5757` |

Use only the listed element for each semantic role. Do not use a Process rectangle for an ordinary Decision, an Input-Output shape for an Output, or any visually similar replacement.

## Loop construction

1. Create the outer structure with [Flowchart Process](https://www.canva.com/graphics/MAGpWHT7x4M/).
2. Set its fill to pale periwinkle `#EBEBF9` and its stroke to solid indigo `#1800AD`.
3. Divide the box into a loop-condition area and a loop-body area with Canva **Elements → Shapes → Lines → basic solid line**.
4. Set the internal divider to weight `10` and solid indigo `#1800AD`.
5. Keep the outer Process shape, divider, condition text, and body text separately editable.

## Conditional construction

### If/else only

1. Create the boxes that contain the conditional branches with [Flowchart Process](https://www.canva.com/graphics/MAGpWHT7x4M/).
2. Set each container fill to pale crimson `#FFDEE7` and its stroke to coral red `#FF5757`.
3. Place a [Flowchart Decision](https://www.canva.com/graphics/MAGpWETGMb4/) for the condition at the upper-left of the corresponding Process container.
4. Layer the Decision above the Process container; do not hide its outline behind the container.
5. Use the same pale crimson fill `#FFDEE7` and coral-red stroke `#FF5757` for the Decision.

### If/else-if/else

- Do not use Flowchart Process containers for the conditions.
- Use multiple [Flowchart Decision](https://www.canva.com/graphics/MAGpWETGMb4/) elements, one per condition, connected in evaluation order.
- Use pale crimson `#FFDEE7` fills and coral-red `#FF5757` strokes for every Decision.
- Keep branch labels next to the correct outgoing connectors and avoid line crossings.

## Flowchart typography

- Use `Hakgyoansim Chilpanjiugae OTF` for all text inside the flowchart, including node text, condition text, loop text, declaration text, and `YES`/`NO` labels.
- Do not silently substitute Wanted Sans or another font. If the font is unavailable in the Canva account, stop and report the missing font.
- Font size and weight for flowchart-internal text remain unconfirmed. Match the retained examples without claiming exact numeric values, and never make the text unreadably small to fit a dense diagram.
- Apply the skill-wide confirmed typography settings: line spacing `2` and letter spacing `0`.

## Connectors

- Use editable Canva native lines or connectors, with arrowheads where direction must be shown.
- Use straight or curved line geometry according to the route that avoids node and label collisions.
- Set connector color to gray `#737373`.
- The connector stroke weight was not supplied and remains unconfirmed. Do not infer or document a fixed value until it is measured in Canva.
- Connector endpoints must visibly meet the intended shapes. After moving nodes, re-check every endpoint and branch direction.

## Capability boundary

The Canva graphics IDs above identify public Canva Elements library items; they are not image URLs or Apps SDK asset refs. If an automation surface cannot search, insert, or duplicate these native library elements, do not upload or draw replacements and do not claim compliance. Stop and request one of these supported paths:

1. a Canva-native source/template page containing the required editable elements;
2. a user-assisted Canva editor step that inserts the required elements; or
3. a newly documented Canva API that explicitly supports the library graphics IDs.

## Flowchart placeholders in the Coala Book Builder app

The Coala Book Builder app cannot insert the required library elements, so it follows path 2 above. It does not draw the flowchart. For every `flowchart` page it generates the title, the introduction, the text written below the flowchart, and **one reserved placeholder** where the flowchart belongs. A person then builds the flowchart in the Canva editor.

What the app places:

- One neutral grey box across the full content width. It uses none of the role fills, strokes, or shapes in this file, so it cannot be mistaken for a flowchart element. It is not a substitute and must never remain in a finished book.
- One guide text inside the box, in the book font at body size, listing the control structure, every node as `number. [role] text`, and every connection as `1 → 2` or `2 —YES→ 3`. When the full list does not fit, the guide is shortened rather than set smaller; the complete list always remains in the app panel.
- The box height is estimated from the number of nodes on the longest route, or taken from the page's `height` attribute (see `manuscript-format.md`). It is only a working area. If the finished flowchart is taller, move the text below it by hand.

After generation the app panel lists every placeholder with its page number, the required Canva element name and graphics ID for each node, the connections, and the construction rule for the declared control structure.

To finish a placeholder in the Canva editor:

1. Open **Elements → Shapes → Flowchart shapes** and insert the element mapped to each node's role in the node mapping table above. Do not pick a similar-looking shape.
2. Apply the fill and stroke colors from the node mapping table, or the loop and conditional constructions above when the control structure calls for them.
3. Type each node's text in `Hakgyoansim Chilpanjiugae OTF`. If the font is unavailable, stop and report it.
4. Join the nodes with native Canva lines or connectors in gray `#737373`, add arrowheads, and place `YES` and `NO` next to the correct outgoing connector.
5. Delete the grey box and the guide text. Both are separate elements.
6. Check the result against `qa-checklist.md`.

A page that still shows a placeholder does not comply with this file. Do not describe a generated book as complete, and do not claim flowchart compliance, until every placeholder has been replaced by a flowchart built from the required native elements.
