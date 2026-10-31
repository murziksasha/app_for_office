# Document Model Specification

## 1. Document Model (Tiptap JSON)

### The Rule
The stored representation of text documents is Tiptap JSON (`JSONContent`), defined in `src/document/model.ts`:
- **In-App Model**: A tree of structured ProseMirror nodes and marks (headings, paragraphs, lists, tables, bold, italic, underline, superscript, subscript, font size, indent, page breaks). Paragraph nodes store `lineSpacing` (`'1' | '1.15' | '1.5' | '2'`, default `'1.15'`). The doc node stores `pageSetup`: `letter` or `a4`, `orientation` (`'portrait' | 'landscape'`, default `'portrait'`), `columns` (`1 | 2 | 3`, default `1`), and top, right, bottom, and left margins in millimeters. The default is Letter with 25.4 mm on every side. Beside `pageSetup`, the doc node stores `chrome` (`DocumentChrome`): headers and footers for the document, including a `differentFirstPage` boolean and stories for `header`, `footer`, `firstHeader`, and `firstFooter`. Each story models line 0 as three zones (`left`, `center`, `right`) and further lines as full-width paragraphs. A margin, orientation, columns, or chrome change is one undo step and is part of the document hash. Document pagination logic in `src/document/pagination.ts` computes page boundaries for both on-screen page gap decorations (`pageGaps.ts`) and status bar page numbering ("Page N of M").
- **Import Boundary**: All incoming content (DOCX, ODT, RTF, Markdown, HTML, Plain Text) must be converted into sanitized HTML and passed through `htmlToDocument(html)` exactly once. For DOCX/TMDX packages, document defaults and named styles (`Normal`, `Heading 1`–`Heading 6`, `Title`, `Subtitle`) defined in `word/styles.xml` are resolved onto runs that do not set explicit mark overrides before HTML serialization. Chrome extracted from format packages (DOCX/TMDX) is attached to the document node attributes via `applyDocChrome(doc, chrome)`. A zero-byte DOCX or an empty package yields one empty paragraph and the resolved or default page setup.
- **Export Boundary**: Conversion to HTML via `documentToHtml(doc)` occurs only at save time within export adapters, keeping header and footer text strictly outside the body HTML. Exporters receive `chrome` beside `pageSetup` and serialize stories into native format structures.
- **Component Interface**: `DocumentEditor` receives `content: JSONContent` and emits `onChange: (doc: JSONContent) => void`.

### The Reason
Storing Tiptap JSON guarantees consistent document semantics, eliminates HTML parsing quirks across editor re-renders, and ensures that drafts stored in IndexedDB can be reconstituted faithfully without loss of structural node attributes or document chrome.

### The Check
`tests/open_save.test.ts` verifies that `loadFileToEditor` populates `state.documentContent` as a valid Tiptap JSON object with `type: 'doc'` and preserves doc attributes.

---

## 2. Spreadsheet Model

### The Rule
Spreadsheets are modeled as an array of sheet objects matching FortuneSheet specifications:
- Each sheet contains an `id`, `name`, `status`, `order`, optional tab `color` hex string, `row`, `column`, and cell data matrix `data[r][c]`.
- Each cell contains calculated values `v`, formatted text `m`, formula strings `f`, number formats `ct: { fa, t }` (including General, `0.00`, thousands `#,##0`, currency `#,##0.00`, percent `0%`, date `yyyy-MM-dd`, and time `hh:mm`), and styling attributes (bold `bl`, italic `it`, underline `un`, wrap `tb`, fill color `bg`, text color `fc`, alignment `ht`/`vt`). A merged block stores `mc` on the cells and `config.merge` on the sheet.
- Sheet `config` also stores column widths, row heights, and `borderInfo`. `frozen` is the freeze pane. `filter_select` is the autofilter range. `conditionalFormats` stores an array of `{ id, range, kind: 'greater' | 'less' | 'scale', value?: number, colors: string[] }` beside `config`, with previous cell fills saved in `conditionalBase` so clearing rules restores them. Charts, pivot tables, and macros are not part of the model.

### The Reason
Maintaining sheet models as structured cell matrices separates raw mathematical formulas and formatting rules from UI canvas drawing.

### The Check
`tests/spreadsheet.test.ts` verifies that multi-sheet workbooks preserve sheet names, numbers, strings, and cell formulas across XLSX and CSV/TSV import and export.

---

## 3. Presentation Model

### The Rule
Presentations are modeled as a structured `PresentationModel`:
- Composed of a `title: string`, an array of `Slide` objects, and optional `slideSize: '16:9' | '16:10' | '4:3'` (missing values default to `'16:9'`).
- Each `Slide` contains an `id`, optional `title`, optional `background`, an array of `SlideElement` objects, and optional `notes: string` for speaker notes.
- `SlideElement` defines layout coordinates (`x`, `y`, `width`, `height`) and element properties (type `'text'`, `'image'`, `'rect'`, `'video'`, or `'table'`). Shapes use `type: 'rect'` and support `shape?: 'rect' | 'roundRect' | 'ellipse' | 'triangle' | 'line'` (defaulting to rectangle), `fill`, `borderColor`, `borderWidth`, and optional text with formatting. Tables store uniform `rows: string[][]`.

### The Reason
A normalized slide element schema decouples PowerPoint Open XML packaging from the canvas layout renderer and export generation.

### The Check
`tests/slides.test.ts` asserts that `importPptx` creates slides with valid geometric coordinates and text elements, and `exportPptx` produces a valid presentation package.

---

## 4. Document Outline

### The Rule
`src/document/outline.ts` extracts heading nodes of levels 1, 2, and 3 from document models (Tiptap `JSONContent` or ProseMirror `Node`), returning an array of `{ level, text, pos }` sorted in document order. Headings with level 4 or greater are omitted.

### The Reason
Enables structured document navigation, table of contents generation, and hierarchical overview of long-form documents without modifying document node structures.

### The Check
`tests/outline.test.ts` asserts that a fixture containing headings of level 1, 2, 3, and 4 returns only levels 1–3 in monotonic position order.

---

## 5. Style Gallery

### The Rule
The Home ribbon provides a horizontal style gallery offering six standard document styles:
- **Normal**: Paragraph node, body typography, with attribute `styleName: 'Normal'`.
- **Title**: Heading level 1 node (or paragraph), styled at 26pt bold with attribute `styleName: 'Title'`.
- **Heading 1**: Heading level 1 node with attribute `styleName: 'Heading 1'`.
- **Heading 2**: Heading level 2 node with attribute `styleName: 'Heading 2'`.
- **Heading 3**: Heading level 3 node with attribute `styleName: 'Heading 3'`.
- **Quote**: Blockquote node with attribute `styleName: 'Quote'`.

Applying a style sets the active node type and updates the `styleName` attribute on the paragraph, heading, or blockquote. The active style chip highlights in the ribbon based on explicit `styleName` or inferred node hierarchy.

### The Reason
Users need one-click application of consistent hierarchical typography and semantic document styles matching office conventions.

### The Check
`tests/styles.test.ts` sets each of the six styles, asserts that the active node and `styleName` match, and verifies DOCX export writes `w:pStyle`. `e2e/document-tools.spec.ts` picks Title and verifies the node becomes a Title.

---

## 6. Table of Contents Block

### The Rule
The `toc` block node extension models a non-editable Table of Contents block in the document body:
- **Heading Extraction**: Walks document headings 1–3 in monotonic order using `src/document/toc.ts` and `outline.ts`.
- **Page Calculation**: Obtains real page numbers from `src/document/pagination.ts` using the document `pageSetup`.
- **Block Presentation**: Renders dot leaders connecting heading titles to their target page numbers. Selecting a row navigates caret focus to the target heading.
- **Update Action**: An Update button on the block recalculates heading entries and target page numbers.
- **DOCX Serialization**: Export to DOCX writes Open XML `w:sdt` with native `TOC` field instructions and cached dot leader fallback entries. ODT, HTML, and Markdown export the rendered headings as text.

### The Reason
Long-form documents require an automated, up-to-date table of contents reflecting current pagination and structure across export formats without manual typesetting.

### The Check
`tests/toc.test.ts` asserts that heading entries and page numbers in a multi-page document match `pagination.ts` and that DOCX export generates `w:sdt` with native TOC field codes. `e2e/document-tools.spec.ts` inserts a Table of Contents and verifies the headings are listed.

---

## 7. Footnotes

### Rule
Footnotes are represented by inline reference atom nodes (`footnoteRef`) in the prose body holding an `id` string (e.g. `'1'`, `'2'`). The footnote bodies are stored in document attributes as an array of items `{ id: string; text: string }`. In the editor, a dedicated footnotes area displays each footnote with an editable input for its text. Inserting a footnote allocates the next sequential integer reference at the caret and adds a matching entry to the document footnotes list.

### Reason
Academic and business documents require citations without interleaving body paragraphs with footnote contents. Keeping the reference node as an inline atom maintains prose flow, while storing footnote text at document level allows seamless mapping to native document parts (`word/footnotes.xml` in DOCX and `<text:note>` in ODT) during import and export.

### Check
`tests/footnotes.test.ts` asserts adding a footnote, editing footnote text in the document attributes, and round-tripping footnotes through DOCX and ODT. `e2e/document-tools.spec.ts` inserts a footnote from the Insert ribbon tab and edits its text in the footnotes area.

---

## 8. Offline Spell Check

### Rule
Spell checking is powered strictly offline via bundled local dictionaries (`src/document/spell/dictionaries.ts`) and user-added terms stored in `localStorage` (`folio_user_dictionary`). A ProseMirror decoration plugin scans prose text nodes, ignores numbers, URLs, and emails, and renders unrecognized words with `.folio-misspelling` decorations. Right-clicking a misspelled word presents replacement suggestions computed via edit distance and an `Add to dictionary` command. Spell checking can be toggled via the View ribbon tab and the status bar.

### Reason
Local-first software must provide responsive, private spelling assistance without exposing user keystrokes, document content, or terminology to remote network APIs.

### Check
`tests/spell.test.ts` asserts word validation, punctuation/URL ignoring, suggestion generation, custom dictionary additions, and decoration toggling. `e2e/document-tools.spec.ts` verifies that a misspelled word is flagged with squiggly underline and replaced using a right-click suggestion.

---

## 9. Spreadsheet Data Validation and Dropdown Lists

### Rule
Data validation rules on a spreadsheet sheet are held in `FortuneSheetData.dataValidations` as an array of `DataValidationRule`:
```ts
interface DataValidationRule {
  range: { row: [number, number]; column: [number, number] };
  list: string[];
}
```
Validation applies to any cell whose coordinate `(row, col)` satisfies `row ∈ [r0, r1]` and `col ∈ [c0, c1]`. Values not contained in `list` are marked invalid. On XLSX export, rules are written to `worksheet.getCell(r, c).dataValidation = { type: 'list', allowBlank: true, formulae: ['"..."'] }`. On import, list validations are converted to `DataValidationRule`. Non-list validations are reported via `ImportReport.warnings` and omitted without corrupting cell content.

### Reason
Structured sheets need dropdown constraints for discrete fields without losing non-conforming data or breaking file interchange with other spreadsheet processors.

### Check
`tests/data_validation.test.ts` tests `isCellInRange`, `isValidationValueValid`, XLSX import/export round-trip, and non-list warning reporting.



