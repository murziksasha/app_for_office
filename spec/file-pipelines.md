# File Pipelines Specification

This document details the import, export, fallback behavior, and fixture requirements for every supported format.

---

## 1. Word Documents (`.docx`)

- **Read Pipeline**: Decompressed via `JSZip`. `word/document.xml` is parsed with `fast-xml-parser` extracting paragraphs, runs, headings, tables, and images into HTML. When `word/styles.xml` is present, `docDefaults` and named styles (`Normal`, `Heading 1`–`Heading 6`, `Title`, `Subtitle`) are resolved onto runs lacking direct font, size, color, bold, or italic. A zero-byte file or an empty package yields one empty paragraph and the resolved or default page setup. `sectPr` page size and margins are read. Portrait Letter and A4 are kept. Any other size, including landscape, snaps to the nearer portrait size and is named on the import report. Missing section properties use the default page setup. `word/header*.xml` and `word/footer*.xml` are parsed via section references: line 0 maps tabs or single 3-cell table into left/center/right zones, floating logo into left zone, and later paragraphs into full-width lines. Mapped stories are stored in `doc.attrs.chrome`.
- **Mammoth Fallback**: If the custom XML parser fails or encounters corrupt markup, the file is automatically processed using `mammoth.convertToHtml` as a resilient fallback. The import report records `fallbackUsed: true`.
- **Write Pipeline**: Exported using the `docx` library, translating HTML nodes into native Open XML paragraphs, tables, images, and text runs. The section page size and margins are written from the document `pageSetup`. Document chrome is written into native headers and footers; line 0 is written as a borderless 1-row 3-cell table for round-trip fidelity, and page fields are real PAGE and NUMPAGES fields. ODT, RTF, HTML, Markdown, and plain text stay body-only; saving one of those with chrome adds an omission warning.
- **Skipped Features**: VBA macros, complex shape drawing art, SmartArt diagrams, tracked revision history, odd/even headers, extra sections, multi-row header tables, extra floating shapes, EMF/WMF images, and unsupported fields (reported as diagnostic warnings on import).
- **Fixtures**: `fixtures/sample.docx`, `fixtures/empty.docx`, and `fixtures/styles_sample.docx`.
- **Failure Behavior**: Never present a blank document with no report. Any unparseable file triggers an `ImportReport` with diagnostic notices.

---

## 2. OpenDocument Text (`.odt`)

- **Read Pipeline**: Decompressed via `JSZip`. `content.xml` is parsed into semantic HTML. Page width, height, and margins are read from `styles.xml` when present, otherwise from `content.xml`.
- **Write Pipeline**: Repackaged into an ODF container ZIP with valid `mimetype`, `META-INF/manifest.xml`, and `content.xml`. `styles.xml` stores the document page size and margins.
- **Skipped Features**: Complex frame styles, embedded OLE objects.
- **Fixture**: `fixtures/sample.odt`.

---

## 3. Rich Text Format (`.rtf`)

- **Read Pipeline**: Tokenized with an RTF control-word parser translating font tables, color tables, and formatting groups into HTML.
- **Write Pipeline**: Serialized into standard RTF 1.5 syntax with ANSI color and font tables.
- **Skipped Features**: Embedded binary picture streams, drawing objects.
- **Fixture**: `fixtures/sample.rtf`.

---

## 4. Markdown (`.md`)

- **Read Pipeline**: Parsed using `markdown-it` with table and strikethrough extensions into sanitized HTML.
- **Write Pipeline**: Serialized using `TurndownService` into standard CommonMark/GFM markdown.
- **Skipped Features**: Raw non-standard HTML embeds.
- **Fixture**: `fixtures/sample.md`.

---

## 5. HTML (`.html`, `.htm`)

- **Read Pipeline**: Sanitized using `DOMPurify` to eliminate scripts, then parsed directly into `DocumentModel`.
- **Write Pipeline**: Serialized as a clean HTML5 standalone document with UTF-8 encoding and responsive typography styling.
- **Skipped Features**: JavaScript `<script>` execution, external style sheet references, `<iframe>` elements.
- **Fixture**: `fixtures/sample.html`.

---

## 6. Plain Text (`.txt`)

- **Read Pipeline**: Decoded as UTF-8, split by line breaks, and converted to paragraph blocks.
- **Write Pipeline**: Extracted as plain text with preserved line breaks.
- **Skipped Features**: Rich text styling.
- **Fixture**: `fixtures/sample.txt`.

---

## 7. Excel Spreadsheets (`.xlsx`)

- **Read Pipeline**: Loaded via `ExcelJS.Workbook`, iterating worksheets, rows, cells, formulas, and styles into FortuneSheet matrix data. Merged cells, row heights, freeze panes, cell borders, underline, wrap, and autofilter ranges are kept. Formula text is kept. A formula with no cached result is recalculated by Formula.js when the sheet opens. A function Formula.js does not provide stays as text and is named on the import report.
- **Write Pipeline**: Serialized via `ExcelJS.Workbook` into modern Open XML spreadsheet packages, including merges, row heights, freeze panes, borders, underline, wrap, and the autofilter range.
- **Skipped Features**: VBA macros (not run), pivot tables, charts (reported, not drawn), dynamic external data connections.
- **Fixture**: `fixtures/sample.xlsx`.

---

## 8. CSV & TSV (`.csv`, `.tsv`)

- **Read Pipeline**: Parsed using RFC 4180 rules, handling multiline quoted cells and escape characters.
- **Write Pipeline**: Serialized into comma or tab-delimited text with proper quotation escaping.
- **Skipped Features**: Multi-sheet workbooks (only active sheet exported), cell formatting colors/fonts.
- **Fixtures**: `fixtures/sample.csv`, `fixtures/sample.tsv`.

---

## 9. PowerPoint Presentations (`.pptx`)

- **Read Pipeline**: Decompressed via `JSZip`, parsing `ppt/slides/slide{N}.xml` and relationship files into `PresentationModel`. The first mp4 on each slide is kept. Further videos, videos that are not mp4, and audio that is not inside a video are reported and left out.
- **Write Pipeline**: Generated using `PptxGenJS` into valid Open XML presentation packages, including one mp4 per slide. Bytes are written aside and then replace the previous file, so a failed write leaves that file in place.
- **Skipped Features**: 3D animations, transition audio effects, speaker notes narration, extra videos, non-mp4 video, standalone audio.
- **Fixture**: `fixtures/sample.pptx`.

---

## 10. PDF (`.pdf`)

- **Read Pipeline**: Rendered in a canvas viewer using `pdfjs-dist` with page navigation and zoom controls.
- **Write Pipeline**: Native PDF vector editing is out of scope; viewing only. Saving a PDF tab re-exports the exact original PDF bytes.
- **Text Extraction ("Edit as Document")**: Pure function over PDF bytes using `pdf.js` `getTextContent`. Text fragments are clustered onto baselines and ordered left-to-right into lines, then grouped into paragraphs when the vertical gap exceeds the line height. Lines are joined with spaces (keeping trailing hyphens) and emitted as sanitized HTML `<p>` tags converted into a new dirty `docx` Document tab. Layout (columns, tables, headings, headers/footers, images) is discarded; pages with no selectable text are skipped and recorded in the ImportReport. If all pages lack selectable text or grouping yields no paragraphs, no tab opens and Folio reports that there is nothing to edit.
- **Failure Behavior**: Corrupt or password-protected PDF files display an in-viewport error banner ("This PDF is protected or unreadable") rather than crashing the shell or prompting for a password. Edit as Document remains unavailable.

---

## 11. Save as PDF Pipeline

- **Trigger & Scope**: Available via the File ribbon on Document, Spreadsheet, and Presentation editors (including Documents created via Edit as Document). Spreadsheets and presentations reuse the print scope prompt (Active sheet vs All sheets, All slides vs This slide) when there are multiple units.
- **Write Pipeline**: Built entirely in memory using `pdf-lib` with subset embedded Noto Sans fonts (Regular, Bold, Italic, Bold Italic covering Latin, Greek, and Cyrillic). The caller writes the file to the chosen path via platform I/O only after complete byte generation succeeds. The active tab's path, format, name, and clean/dirty state remain unchanged.
- **Document Export**: The document `pageSetup` chooses Letter or A4 portrait and the four margins, converted to points. Flowing text. Headings, paragraphs, bullet/numbered lists, tables (shrunk to content width), images (JPEG/PNG), bold, italic, underline, and page breaks are rendered. Header and footer bands are rendered into the page margins matching the in-app document chrome. Link URLs, strikethrough, text color, highlight, font family, font size, alignment, and indentation are omitted.
- **Spreadsheet Export**: US Letter portrait, used cell range, displayed text (`m` or `v`), one line per cell, uniform shrink-to-fit width, rows flowing to subsequent pages. Sheet bold and italic are preserved; formula strings and colors are omitted.
- **Presentation Export**: US Letter landscape (one slide per page, scaled uniformly). Slide text runs, images, and rectangles are placed from percentages with background, fill, and font colors preserved. Videos are omitted and recorded.
- **Omissions & Fallback**: Characters not covered by the font are dropped and recorded as omissions. Non-JPEG/PNG images that cannot be embedded are omitted and recorded. Folio displays a notice summarizing any omissions after writing. Export or write failures leave no file on disk.

---

## 12. SoftMaker packages (`.tmdx`, `.pmdx`, `.prdx`, and older `.tmd`, `.pmd`, `.prd`)

- **Read Pipeline**: `.tmdx` and a ZIP `.tmd` that contains `word/document.xml` use the Document importer. `.pmdx` and a ZIP `.pmd` that contains `xl/workbook.xml` use the Spreadsheet importer. `.prdx` and a ZIP `.prd` that contains `ppt/presentation.xml` use the Presentation importer. The format stays `tmdx`, `pmdx`, or `prdx`. A saved package may be plainer than the original. Skipped pieces stay on the import report.
- **Older Packages**: Opening `.tmd`, `.pmd`, or `.prd` clears the save path, renames the tab to `.tmdx`, `.pmdx`, or `.prdx`, and leaves the tab dirty. The first Save asks for a path. The original file is never overwritten. A recent entry may still point at the original path.
- **Failure Behavior**: A binary file, or a ZIP without the matching part, shows `Folio cannot open this .ext file. It is not a package Folio can read.` and does not open. That message is separate from the Office 97–2003 message. There is no binary parser.
- **Write Pipeline**: Save and Save As call the existing Document, Spreadsheet, and Presentation exporters. The extension on the name stays `.tmdx`, `.pmdx`, or `.prdx`. Save As offers those three formats. Windows file associations are unchanged, so a double-click stays with the program that already owns the extension.
- **Fixtures**: `fixtures/hello.tmdx`, `fixtures/New Документ PlanMaker.pmdx`, `fixtures/New Документ Presentations.prdx`, and `fixtures/sample_binary.tmd`.
