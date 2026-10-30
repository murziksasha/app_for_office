# Document Model Specification

## 1. Document Model (Tiptap JSON)

### The Rule
The stored representation of text documents is Tiptap JSON (`JSONContent`), defined in `src/document/model.ts`:
- **In-App Model**: A tree of structured ProseMirror nodes and marks (headings, paragraphs, lists, tables, bold, italic, underline, font size, indent, page breaks). The doc node stores `pageSetup`: portrait `letter` or `a4`, and top, right, bottom, and left margins in millimeters. The default is Letter with 25.4 mm on every side. Beside `pageSetup`, the doc node stores `chrome` (`DocumentChrome`): headers and footers for the document, including a `differentFirstPage` boolean and stories for `header`, `footer`, `firstHeader`, and `firstFooter`. Each story models line 0 as three zones (`left`, `center`, `right`) and further lines as full-width paragraphs. A margin or chrome change is one undo step and is part of the document hash.
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
- Each sheet contains an `id`, `name`, `status`, `row`, `column`, and cell data matrix `data[r][c]`.
- Each cell contains calculated values `v`, formatted text `m`, formula strings `f`, and styling attributes (bold `bl`, italic `it`, underline `un`, wrap `tb`, fill color `bg`, text color `fc`, alignment `ht`/`vt`). A merged block stores `mc` on the cells and `config.merge` on the sheet.
- Sheet `config` also stores column widths, row heights, and `borderInfo`. `frozen` is the freeze pane. `filter_select` is the autofilter range. Charts, pivot tables, and macros are not part of the model.

### The Reason
Maintaining sheet models as structured cell matrices separates raw mathematical formulas and formatting rules from UI canvas drawing.

### The Check
`tests/spreadsheet.test.ts` verifies that multi-sheet workbooks preserve sheet names, numbers, strings, and cell formulas across XLSX and CSV/TSV import and export.

---

## 3. Presentation Model

### The Rule
Presentations are modeled as a structured `PresentationModel`:
- Composed of a `title: string` and an array of `Slide` objects.
- Each `Slide` contains an `id`, optional `title`, optional `background`, and an array of `SlideElement` objects.
- `SlideElement` defines layout coordinates (`x`, `y`, `width`, `height`) and element properties (type `'text'`, `'image'`, or `'rect'`, text styles, colors, alignments).

### The Reason
A normalized slide element schema decouples PowerPoint Open XML packaging from the canvas layout renderer and export generation.

### The Check
`tests/slides.test.ts` asserts that `importPptx` creates slides with valid geometric coordinates and text elements, and `exportPptx` produces a valid presentation package.
