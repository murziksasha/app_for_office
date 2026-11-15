# Folio — Local-First Office App

**Folio** is a local-first office application running completely in the browser. It opens, edits, and saves everyday documents, spreadsheets, and slides directly on your computer with no account, no tracking, and no cloud uploads.

In Chromium-based browsers (Chrome, Edge), Folio utilizes the **File System Access API** to save changes back to the original file in-place. In other browsers, it smoothly falls back to download-on-save.

---

## Key Features

- **Documents**:
  - Paper layout (Letter and A4 page formats, zoom, print)
  - Formats: Open `.docx`, `.odt`, `.rtf`, `.txt`, `.md`, `.html` / `.htm`; Save `.docx`, `.odt`, `.rtf`, `.md`, `.html`, `.txt`, plus Print (browser PDF)
  - Marks & blocks: bold, italic, underline, superscript, subscript, clear formatting, line spacing (1.0, 1.15, 1.5, 2.0), strikethrough, font family, font size, text colors, highlight, headings 1–6, alignment, bullets, numbering, links, images, tables, dividers, page breaks
  - Headings outline: Dockable left navigation pane listing document headings 1–3 with one-click caret navigation
  - Styles gallery: Ribbon gallery for quick application of Normal, Title, Heading 1–3, and Quote styles, fully round-tripped through `w:pStyle`
  - Table of Contents: Dynamic multi-level table of contents with page numbering, dot leaders, and one-click updates
  - Footnotes: Inline footnote references with dedicated editable footnotes area, serialized natively to DOCX (`word/footnotes.xml`) and ODT (`<text:note>`)
  - Orientation & columns: Portrait / landscape orientation switching and multi-column layouts (1, 2, or 3 columns)
  - Contextual ribbon tabs: Dedicated Table Layout and Picture Format tabs that appear automatically when editing tables or images
  - Offline spell check: Completely private, bundled offline spell checking for English and Ukrainian, with squiggly error marking, right-click corrections, and customizable user dictionary
  - Adaptive Mini Toolbar: Floating selection micro-toolbar for rapid text formatting (font sizes, bold, italic, underline, highlight, clear formatting, format painter) without leaving the cursor position
  - Format painter: One-click single copy or double-click locked formatting painter for text marks and paragraph attributes
  - Right-click context menus: Custom menus for text and tables with instant editing, formatting, and structural operations
  - Status bar: Live word and character count, Page N of M indicator calculated via shared pagination engine, page size, save state, and document zoom
  - Find & replace: Text-node-walking search that preserves formatting marks around replacements
  - Common shortcuts: <kbd>Ctrl+B</kbd>, <kbd>Ctrl+I</kbd>, <kbd>Ctrl+U</kbd>, <kbd>Ctrl+S</kbd>, <kbd>Ctrl+Z</kbd>, <kbd>Ctrl+Y</kbd>, <kbd>Ctrl+F</kbd>, <kbd>Ctrl+H</kbd>
  - Import report: Lists any skipped elements (comments, tracked changes, text boxes, equations, extra sections)
  - Style resolution: Resolves document defaults and named styles (Normal, Heading 1–6, Title, Subtitle) from `word/styles.xml`
  - Zero-byte & empty document support: Opens shell-created stub files and empty packages cleanly with preserved page setup
  - Mammoth safety-net fallback for non-standard `.docx` files

- **Spreadsheets**:
  - Excel-style interactive grid powered by FortuneSheet (MIT)
  - Open & save `.xlsx`, `.csv`, `.tsv`
  - Formulas (`=SUM`, `=AVERAGE`, etc.), multiple sheets, number formatting, bold/italic, cell background colors, text colors, column widths, freeze rows/columns
  - Extended number formats: General, Number (`0.00`), Thousands (`#,##0`), Currency (`#,##0.00`), Percent, Date (`yyyy-MM-dd`), and Time (`hh:mm`)
  - Series & Copy autofill: Automatic sequence completion for numbers and dates
  - Freeze at selection: Multi-directional freeze pane based on active cell position
  - Sheet Tab Bar: Color-coded tabs, double-click inline renaming with validation, drag-and-drop reordering, and XLSX tab color round-trip
  - Conditional formatting: Highlight greater than, less than, and 3-color heatmap scales
  - Data validation: In-cell dropdown pickers with validity checking
  - Print setup & Layout tab: Page Setup group for Fit to Width scaling, Repeat Header Row, and Gridlines on print and PDF export
  - Format painter: Copy cell style and number format onto target cells
  - Right-click context menu: Clean Folio-labeled row/column insertion, deletion, and clearing operations
  - Selection statistics: Instant Count (non-empty), Sum, and Average for multi-cell ranges in the status bar
  - Find: Active sheet display text search

- **Presentations (Slides)**:
  - Open & save `.pptx`
  - 16:9 responsive slide canvas
  - Slide layouts: Blank, Title Slide, Title and Content, and Two Content selectable from New Slide dropdown
  - Slide thumbnails navigation: add, duplicate, reorder, delete slides
  - Add and position text boxes, headings, body text, and images with font sizes and colors
  - Fullscreen plain slideshow: F5 from beginning, Shift+F5 from current slide, left/right mouse and arrow navigation
  - Arrange objects: Align (Left, Center, Right, Top, Middle, Bottom), Distribute (Horizontally, Vertically), and Z-Order (Bring Forward, Send Backward, Bring to Front, Send to Back)
  - Snap and center guides: 2% coordinate grid snapping, automatic 1% slide center snapping with visual red dashed guide lines, and ribbon Snap to Grid toggle
  - Right-click context menu: Duplicate, Delete, Bring Forward, and Send Backward on selected slide objects
  - Slide sorter view: responsive overview grid of all slides with quick selection and navigation
  - Offline palettes: Paper, Ink, and Teal styling palettes to transform presentation theme colors locally without remote dependencies
  - Find: Full presentation search over elements, table cells, and speaker notes
  - Presenter Laser Pointer: Interactive glowing red laser pointer dot during fullscreen slideshow, toggled via `L` key or presentation HUD button

- **PDF Viewer**:
  - Read `.pdf` documents using `pdfjs-dist`
  - Page-by-page navigation, zoom in/out, and text search across pages

- **Shell & Security**:
  - Quick Access Toolbar: Persistent Save, Undo, Redo, and Print buttons above the ribbon
  - Centralized command registry: Unified command model backing ribbon, context menus, quick access, and shortcuts
  - Backstage File Pane: Full-window view for document properties, live statistics (word/page/sheet/slide counts), template selection, and file lifecycle
  - Local offline templates: 6 built-in starter templates (Project Report, Professional Resume, Monthly Budget, Commercial Invoice, Pitch Deck, Business Review)
  - Command Search: "Tell me what you want to do" search bar (`Alt+Q` / `Ctrl+Q`) in the ribbon title bar with keyboard navigation and execution
  - Key Tips: Comprehensive keyboard ribbon navigation via `Alt` key badges (F, H, I, L, V), command triggers, and multi-level Escape dismissal
  - Keyboard Shortcut Reference Palette: Global shortcut reference modal (`?`) searchable by action and category
  - Zoom presets popover: Status bar zoom scrubber with popover menu for 50%–200%, Page Width, and Whole Page viewing
  - Live autosave timestamp: Reactive status bar indicators showing active saving animation, unsaved edits alert, and clean save timestamp (`Saved at HH:MM`)
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

