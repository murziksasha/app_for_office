# Folio — Local-First Office App

**Folio** is a local-first office application running completely in the browser. It opens, edits, and saves everyday documents, spreadsheets, and slides directly on your computer with no account, no tracking, and no cloud uploads.

In Chromium-based browsers (Chrome, Edge), Folio utilizes the **File System Access API** to save changes back to the original file in-place. In other browsers, it smoothly falls back to download-on-save.

---

## Key Features

- **Documents**:
  - Paper layout (Letter and A4 page formats, zoom, print)
  - Formats: Open `.docx`, `.odt`, `.rtf`, `.txt`, `.md`, `.html` / `.htm`; Save `.docx`, `.odt`, `.rtf`, `.md`, `.html`, `.txt`, plus Print (browser PDF)
  - Marks & blocks: bold, italic, underline, strikethrough, font family, font size, text colors, highlight, headings 1–6, alignment, bullets, numbering, links, images, tables, dividers
  - Live word and character count, find & replace floating panel, undo/redo
  - Common shortcuts: <kbd>Ctrl+B</kbd>, <kbd>Ctrl+I</kbd>, <kbd>Ctrl+U</kbd>, <kbd>Ctrl+S</kbd>, <kbd>Ctrl+Z</kbd>, <kbd>Ctrl+Y</kbd>, <kbd>Ctrl+F</kbd>
  - Import report: Lists any skipped elements (comments, tracked changes, text boxes, equations, headers/footers)
  - Mammoth safety-net fallback for non-standard `.docx` files

- **Spreadsheets**:
  - Excel-style interactive grid powered by FortuneSheet (MIT)
  - Open & save `.xlsx`, `.csv`, `.tsv`
  - Formulas (`=SUM`, `=AVERAGE`, etc.), multiple sheets, number formatting, bold/italic, cell background colors, text colors, column widths, freeze rows/columns

- **Presentations (Slides)**:
  - Open & save `.pptx`
  - 16:9 responsive slide canvas
  - Slide thumbnails navigation: add, duplicate, reorder, delete slides
  - Add and position text boxes, headings, body text, and images with font sizes and colors

- **PDF Viewer**:
  - Read `.pdf` documents using `pdfjs-dist`
  - Page-by-page navigation, zoom in/out, and text search across pages

- **Shell & Security**:
  - Warm paper aesthetic: cream canvas, ink text (`#1f2328`), and teal accent (`#0f766e`)
  - Start screen with New cards, Open button, drag-and-drop zone, and Recent files list with IndexedDB handle persistence
  - Unsaved edits guard (`beforeunload`) to prevent accidental tab closing
  - Local IndexedDB autosave drafts so work is never lost on refresh
  - Security default: DOMPurify sanitizes every HTML fragment before rendering; macro files (`.docm`, `.xlsm`, `.pptm`) never run code; legacy binary files (`.doc`, `.xls`, `.ppt`) are recognized and rejected with guidance to convert to modern Open XML formats.

---

## File Pipelines

| Format | Read Engine | Write Engine |
| --- | --- | --- |
| **DOCX** | `JSZip` + `fast-xml-parser` over `word/document.xml`, `styles.xml`, `numbering.xml`, and rels (with `mammoth` fallback) | `docx` (dolanmiu) |
| **ODT** | `JSZip` over `content.xml` & `styles.xml` | Minimal valid ODT package generator |
| **RTF** | RTF control token parser (unicode escapes, styles, color table) | RTF writer |
| **Markdown** | `markdown-it` + `DOMPurify` | `turndown` with table support |
| **HTML** | `DOMPurify` sanitization | Standard standalone HTML document |
| **TXT** | Paragraphs split on blank lines | Plain text extractor |
| **XLSX** | `ExcelJS` → FortuneSheet cell model | FortuneSheet cell model → `ExcelJS` |
| **CSV / TSV** | RFC 4180 parser with quoted fields | RFC 4180 serializer |
| **PPTX** | `JSZip` over `ppt/slides/slideN.xml` & rels | `pptxgenjs` from slide model |
| **PDF** | `pdfjs-dist` page rendering + text search | — |

---

## How to Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Open the shown local URL (`http://localhost:5188`) in Chrome or Edge.

3. **Run unit tests** (Vitest):
   ```bash
   npm test
   ```

4. **Run End-to-End smoke tests** (Playwright):
   ```bash
   npm run test:e2e
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

