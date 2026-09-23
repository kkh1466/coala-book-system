# Images, screenshots, diagrams, tables, and code

## Screenshots

- Keep the original aspect ratio.
- Crop irrelevant interface chrome only when doing so does not remove needed context.
- The learner must be able to read important labels at normal page viewing size.
- If a screenshot becomes unreadable beside prose, give it more space or place it on a separate page.
- Use a restrained callout or red outline to identify the required target; do not decorate every control.
- Do not fabricate software screens.

## Image placeholders

When a manuscript will be parsed by the Coala Book Builder app, do not wait for the image files. Declare each image with the `::image{...}` directive described in `references/manuscript-format.md`; the app reserves the space and the image is added afterwards.

- Decide the final aspect ratio first and write it as `ratio`. The reserved box is filled by cropping, so a mismatched ratio cuts the image. For a screenshot, use the ratio of the capture after irrelevant chrome has been cropped.
- Write `alt` as what the learner must see in the image, not as a file description. It tells whoever adds the image later which capture is expected.
- For `screenshot-guide` captures, start with `width="half"` so two short steps can share a page; use `text` or `full` if important controls or labels would be unreadable. For other image placeholders, choose width from the image's teaching role and legibility: a small subject may fit at half width, while a full window usually needs `text` or `full`.
- Give every planned file a stable, descriptive path under `assets/`, grouped by chapter, for example `assets/ch03/step-02-run-button.png`.
- To finish a placeholder in Canva: drag the image onto the grey box, confirm the crop, then delete the guide label inside the box. The caption, if any, is already in place.
- The grey box is a drop target: the dropped image fills it exactly and nothing else on the page moves. The Canva editor cannot stretch the box to a different aspect ratio, so do it with the app before adding the image:
  1. Open the page and click the guide label in the middle of the box, or pick the box from the list in the app's **이미지 자리 비율 바꾸기** panel. Clicking the empty grey area selects a shape, which Canva does not report to apps, so use the list in that case.
  2. Press a preset (`16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `9:16`) or enter a ratio such as `5:4` or `1.5`, from 1:4 to 4:1.
  3. The app keeps the box width, changes its height, re-centers the guide label, updates the ratio shown in the label, and moves everything below the box on that page by the same amount. The page number stays where it is.
  4. If the panel warns that content was pushed out of the body area, move the overflowing content to the next page by hand. The app does not re-paginate.
- The ratio can only be changed while the box is still empty. After an image has been dropped in, the box is no longer a placeholder.
- A book is not finished while any placeholder remains. Use the list the app shows after generation as the work list.
- The provenance rules below apply to the image that is eventually added.

## Diagrams

- Use diagrams only when they clarify sequence, branching, comparison, or structure.
- Keep node text short and place supporting explanation outside the diagram.
- Avoid dense, wide diagrams that require scaling down.
- For Canva flowcharts, follow `references/flowcharts.md`: use only the mapped Canva-native library elements, connect them with editable native lines or connectors, and never use a flattened PNG, screenshot, uploaded SVG, or custom-drawn lookalike as the final diagram.

## Tables

- Keep cell text concise and maintain comfortable row height.
- Avoid heavy grids and excessive decoration.
- Split large tables instead of reducing text below the confirmed body size.

## Code

- Present the smallest code excerpt that explains the current concept.
- Preserve indentation and syntax.
- Keep code visibly distinct from body prose.
- Move lengthy explanations or complete listings to continuation pages or appendices.

## Asset provenance

Use only user-provided, licensed, generated, or otherwise authorized images and logos. Do not reuse the reference institution's branding for a different institution.

## Font availability

Before full production, check whether Wanted Sans and the required weights are available in the target Canva account and in the selected intermediate format. If custom upload is required, verify that the account supports it and that the font license permits upload and embedding.

For any flowchart page, separately verify the exact `Hakgyoansim Chilpanjiugae OTF` family. Do not replace it with Wanted Sans or another family.

Create a Korean test page containing Hangul, English, numbers, punctuation, regular text, and bold text. After any PPTX import, verify that no font substitution or line-wrap change occurred. Do not silently replace Wanted Sans with another font.
