# Grill: Document headers, footers, and page numbers
Date: 2026-10-25

## Intent
On a Document, show a header and a footer in the page margins, edit them by clicking the band, and write the same bands into `.docx` / `.tmdx`, print, and Save as PDF. A received `.docx` keeps a simple letterhead: text, one logo, and a page number. The teal paper theme stays. Microsoft product names stay out of new UI copy.

## Constraints
- One header and one footer for the whole document, plus a Layout switch, Different first page. New documents start with that switch off. A file that asks for a different first page opens with it on. Page 1 then has its own pair. Later pages share the other pair.
- The first line of each band is three zones: left, center, right. Lines under that are full-width paragraphs (an address).
- A zone holds one line: font family, size, bold, italic, underline, color, alignment of the whole zone, and one image. Paragraphs under the zones use the same marks. No lists, tables, headings, or links in the band.
- The page-number field is either the digit (`1`) or `Page 1 of 8`, chosen at insert. Counting starts at 1.
- While the caret is in a band, Home font controls and alignment follow it. Styles, lists, find, and tables stay on the body.
- Layout Page number inserts into the zone that has the caret. If the caret is in the body, it inserts into the footer’s right zone.
- Empty margins show a quiet localized “Header” or “Footer” hint. That hint is not part of the file.
- What is on screen is what `.docx`, `.tmdx`, print, and Save as PDF save. Odd/even headers, extra sections, multi-row header tables, and extra floating shapes are named on the import report and dropped on save.
- Import maps the first paragraph’s tabs into the three zones. A single three-cell header row maps the same way. One floating logo goes in the left zone. Later paragraphs stay full width.
- PNG, JPEG, GIF, WebP, and SVG logos are kept. EMF, WMF, and other undrawable images are named on the import report and dropped.
- ODT, RTF, HTML, Markdown, and plain text stay body-only. Saving one of those while a band has content adds a warning that the header and footer are not in that file.

## Decisions
- Store chrome on the ProseMirror doc attrs next to `pageSetup`, so the existing document hash, undo, and drafts include it.
- Each story (header, footer, and the first-page pair) is:
  - line 0: `{ left, center, right }` runs
  - further lines: full-width runs plus alignment
- A run is text, or a `page` / `pageOfTotal` field, or one image, with the marks above. Empty stories are the default.
- Do not put header text inside the body document. `documentToHtml` keeps ignoring it. Save already passes `pageSetup` beside the HTML. Pass the chrome the same way.
- In `src/document/docx/importer.ts`, read `word/header*.xml` and `word/footer*.xml` through the section references. Stop recording “Headers & Footers” as omitted when the mapped story is kept. Record a specific warning for each dropped piece (odd/even, another section, multi-row table, extra float, undrawable image, unsupported field).
- In `src/document/docx/exporter.ts`, write the stories into the package. Prefer the `docx` library’s header and footer support. A three-zone line is written as a borderless one-row, three-cell table so the next open maps it back. Page fields are real PAGE / NUMPAGES fields. If the library cannot express a zone image or that table, patch the zip after it builds the body. `.tmdx` uses this same exporter.
- `src/document/DocumentEditor.tsx` and `src/document/extensions/pageGaps.ts` already measure visual pages. Paint the resolved story into the top and bottom margin of page 1 and into each page-gap’s top and bottom. Clicking a zone edits that zone outside the body editor and writes doc attrs.
- The screen page number uses the same page index and page count as that measurement.
- Document print currently hides page gaps and lets the browser paginate the body, so on-screen bands would not repeat. Before `window.print()` for a document, build a print-only stack of the measured pages with the bands painted in the margins. Sheet, slide, and PDF printing stay as they are.
- `src/pdf/exportPdf.ts` draws the same stories in the margin of each PDF page it already creates. Body line breaks can still differ from the screen. The bands must match. An undrawable image is an omission notice, same as today.
- Spec updates in `spec/document-model.md`, `spec/file-pipelines.md`, and `spec/ui.md`.
- English and Ukrainian strings added with identical key structure. New copy says Document, not Word.

## Out of scope
- Line spacing, a longer style list, contextual table tools, odd/even pages, more than one section, roman numerals, a custom start number, comments, tracked changes, and reskinning the ribbon.

