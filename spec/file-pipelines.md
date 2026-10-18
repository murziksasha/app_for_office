# File Pipelines Specification

This document details the import, export, fallback behavior, and fixture requirements for every supported format.

---

## 1. Word Documents (`.docx`)

- **Read Pipeline**: Decompressed via `JSZip`. `word/document.xml` is parsed with `fast-xml-parser` extracting paragraphs, runs, headings, tables, and images into HTML.
- **Mammoth Fallback**: If the custom XML parser fails or encounters corrupt markup, the file is automatically processed using `mammoth.convertToHtml` as a resilient fallback. The import report records `fallbackUsed: true`.
- **Write Pipeline**: Exported using the `docx` library, translating HTML nodes into native Open XML paragraphs, tables, images, and text runs.
- **Skipped Features**: VBA macros, complex shape drawing art, SmartArt diagrams, tracked revision history.
- **Fixture**: `fixtures/sample.docx`.
- **Failure Behavior**: Never present a blank document with no report. Any unparseable file triggers an `ImportReport` with diagnostic notices.

---

## 2. OpenDocument Text (`.odt`)

- **Read Pipeline**: Decompressed via `JSZip`. `content.xml` is parsed into semantic HTML.
- **Write Pipeline**: Repackaged into an ODF container ZIP with valid `mimetype`, `META-INF/manifest.xml`, and `content.xml`.
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

- **Read Pipeline**: Loaded via `ExcelJS.Workbook`, iterating worksheets, rows, cells, formulas, and styles into FortuneSheet matrix data.
- **Write Pipeline**: Serialized via `ExcelJS.Workbook` into modern Open XML spreadsheet packages.
- **Skipped Features**: VBA macros, pivot tables, dynamic external data connections.
- **Fixture**: `fixtures/sample.xlsx`.

---

## 8. CSV & TSV (`.csv`, `.tsv`)

- **Read Pipeline**: Parsed using RFC 4180 rules, handling multiline quoted cells and escape characters.
- **Write Pipeline**: Serialized into comma or tab-delimited text with proper quotation escaping.
- **Skipped Features**: Multi-sheet workbooks (only active sheet exported), cell formatting colors/fonts.
- **Fixtures**: `fixtures/sample.csv`, `fixtures/sample.tsv`.

---

## 9. PowerPoint Presentations (`.pptx`)

- **Read Pipeline**: Decompressed via `JSZip`, parsing `ppt/slides/slide{N}.xml` and relationship files into `PresentationModel`.
- **Write Pipeline**: Generated using `PptxGenJS` into valid Open XML presentation packages.
- **Skipped Features**: 3D animations, transition audio effects, speaker notes narration.
- **Fixture**: `fixtures/sample.pptx`.

---

## 10. PDF (`.pdf`)

- **Read Pipeline**: Rendered in a canvas viewer using `pdfjs-dist` with page navigation and zoom controls.
- **Write Pipeline**: PDF editing is out of scope; viewing only. Saving re-exports the exact original PDF bytes.
- **Failure Behavior**: Corrupt PDF files display an in-viewport error banner rather than crashing the shell.

