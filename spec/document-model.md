# Document Model Specification

## 1. Document Model (Tiptap JSON)

### The Rule
The stored representation of text documents is Tiptap JSON (`JSONContent`), defined in `src/document/model.ts`:
- **In-App Model**: A tree of structured ProseMirror nodes and marks (headings, paragraphs, lists, tables, bold, italic, underline, font size, indent, page breaks). The doc node stores `pageSetup`: portrait `letter` or `a4`, and top, right, bottom, and left margins in millimeters. The default is Letter with 25.4 mm on every side. A margin change is one undo step and is part of the document hash.
- **Import Boundary**: All incoming content (DOCX, ODT, RTF, Markdown, HTML, Plain Text) must be converted into sanitized HTML and passed through `htmlToDocument(html)` exactly once.
- **Export Boundary**: Conversion to HTML via `documentToHtml(doc)` occurs only at save time within export adapters.
- **Component Interface**: `DocumentEditor` receives `content: JSONContent` and emits `onChange: (doc: JSONContent) => void`.

### The Reason
Storing Tiptap JSON guarantees consistent document semantics, eliminates HTML parsing quirks across editor re-renders, and ensures that drafts stored in IndexedDB can be reconstituted faithfully without loss of structural node attributes.

### The Check
`tests/open_save.test.ts` verifies that `loadFileToEditor` populates `state.documentContent` as a valid Tiptap JSON object with `type: 'doc'`.

---

## 2. Spreadsheet Model

### The Rule
Spreadsheets are modeled as an array of sheet objects matching FortuneSheet specifications:
- Each sheet contains an `id`, `name`, `status`, `row`, `column`, and cell data matrix `data[r][c]`.
- Each cell contains calculated values `v`, formatted text `m`, formula strings `f`, and styling attributes (bold `bl`, italic `it`, fill color `bg`, text color `fc`, alignment `ht`/`vt`).

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

