# Testing Specification

## 1. Unit & Integration Testing (Vitest)

### The Rule
Every file adapter, parser, and platform boundary must have automated test coverage:
- `tests/detect.test.ts`: Magic byte detection and file extension routing.
- `tests/docx.test.ts`: Open XML document parsing, styling preservation, styles.xml resolution, zero-byte and empty package handling, and Mammoth fallback.
- `tests/odt.test.ts`: OpenDocument text parsing and XML container building.
- `tests/rtf.test.ts`: RTF control-word parsing and font/color table generation.
- `tests/text_md_html.test.ts`: Markdown, HTML, and plain text bidirectional conversions.
- `tests/spreadsheet.test.ts`: XLSX workbook parsing, cell formula preservation, CSV/TSV conversions.
- `tests/slides.test.ts`: PowerPoint presentation element extraction and geometric layout.
- `tests/open_save.test.ts`: Central `loadFileToEditor` pipeline, `DocumentModel` generation, script tag stripping, and platform selection verification.
- `tests/drop_target.test.ts`: Home drop hit testing in logical and physical pixels.
- `tests/page_setup.test.ts`: Margin clamp, unit conversion, docx and odt margin round-trip, and undo.
- `tests/commands.test.ts`: Shared command list registry, unique IDs, locale key parity, and kind filtering.
- `tests/find_text.test.ts`: Document text node search, literal matching, case sensitivity, and mark preservation on replace.
- `tests/find_sheet_slides.test.ts`: Active sheet display text search and presentation element, cell, and notes search.
- `tests/format_painter.test.ts`: Format painter capture, single-apply disarm, locked mode, and application across documents and sheets.
- `tests/clear_formatting.test.ts`: Resetting marks, alignment, indent, and line spacing while leaving text intact.
- `tests/context_menu.test.ts`: Context menu command listings for document text, document tables, sheets, and slide objects.
- `tests/pagination.test.ts`: Flowing content and explicit page break math for gaps and status bar.
- `tests/outline.test.ts`: Document outline extraction of headings 1–3 and empty states.
- `tests/styles.test.ts`: Application and round-trip preservation of document styles (Normal, Title, Heading 1–3, Quote).
- `tests/toc.test.ts`: Automated table of contents generation, dot leader formatting, page numbering, and native DOCX field instructions.
- `tests/footnotes.test.ts`: Inline footnote reference creation, footnote list editing, and native round-tripping through DOCX (`word/footnotes.xml`) and ODT (`<text:note>`).
- `tests/contextual_tabs.test.ts`: Contextual tab visibility for table and picture objects based on active editor state.
- `tests/spell.test.ts`: Offline spell-check dictionary lookups, suggestion scoring, user dictionary persistence, and decoration toggling.
- `tests/conditional_format.test.ts`: Greater-than, less-than, and 3-color heatmap scale conditional formatting with XLSX round-trip and warning reporting.
- `tests/data_validation.test.ts`: Dropdown list cell validation, range containment, allowed item checks, and XLSX round-trip.
- `tests/sheet_print.test.ts`: Fit to Width scaling calculation, repeat header row calculation, and multi-page print setup mathematics.
- `tests/slideshow.test.ts`: Slideshow navigation, mode calculation (beginning vs current), wrap-around prevention, key controls, and click-half detection.
- `tests/slide_geometry.test.ts`: Slide element alignment (bounding box & slide relative), equal gap distribution, and depth reordering.
- `tests/slide_snap.test.ts`: 2% coordinate grid snapping, 1% slide center snapping (horizontal and vertical), and snap toggle disabling.
- `tests/slide_layouts.test.ts`: Slide layout generation (blank, title, titleContent, twoContent) element structures and positions.
- `tests/slide_palettes.test.ts`: Local slide color palettes (Paper, Ink, Teal) transforming slide background and element fills/colors.
- `tests/backstage.test.tsx`: Backstage full file pane info statistics, properties, section navigation, and lifecycle actions.
- `tests/templates.test.ts`: Built-in local offline templates (Report, Resume, Budget, Invoice, Pitch, Business Review) and document model generation.
- `tests/command_search.test.tsx`: "Tell me what you want to do" command search kind filtering, label/id matching, keyboard navigation, and execution.
- `tests/key_tips.test.ts`: Alt ribbon navigation key tip badges, tab switching, command triggering, and multi-level Escape behavior.
- `tests/mini_toolbar.test.tsx`: Floating adaptive mini-toolbar mounting on text selection, font size/bold/italic formatting, and Escape dismissal.
- `tests/zoom_popover.test.tsx`: Status bar zoom presets popover, page-width presets, and live saved timestamp / saving status indicators.
- `tests/shortcut_panel.test.tsx`: Keyboard shortcut reference palette (`?`), categorization by action, query filtering, and modal lifecycle.

### The Reason
Prevents regressions across document parsers when modifying schemas or adding new typographic features.

### The Check
Running `npm test` must execute all unit test suites without failures or memory leaks.

---

## 2. End-to-End Testing (Playwright)

### The Rule
The Playwright smoke test suite (`e2e/smoke.spec.ts`) validates core user workflows:
1. Application loads and renders the Start Screen.
2. Creating a new document, typing text into the canvas, and applying bold formatting via the ribbon.
3. Opening the canonical `sample.docx` fixture and verifying imported headings and bold statements.
4. Opening the canonical `sample.xlsx` fixture and verifying spreadsheet grid display.
5. Opening the canonical `sample.pptx` fixture and verifying slide canvas presentation rendering.

The hidden file input (`[data-testid="global-file-input"]`) must remain in the DOM to support automated test file injection.

Additional specialized E2E suites:
- `e2e/document-tools.spec.ts`: Find & Replace text matching, paragraph spacing and line spacing, right-click context menu, page numbering, quick-access controls, outline navigation, document styles, table of contents insertion, footnote creation, and offline spell checking.
- `e2e/sheet-tools.spec.ts`: Display text search, autofill series extension, sheet tab renaming, data validation dropdown picker selection, and print setup dialog cancellation.
- `e2e/slide-tools.spec.ts`: Fullscreen slideshow start and navigation, keyboard triggers (F5/Shift+F5), object context menu Z-order, two-content slide layout, slide sorter view, and palette switching.
- `e2e/frame-tools.spec.ts`: Backstage navigation, statistics and templates, Tell-Me command search execution, and ribbon Alt Key Tips hierarchy.

### The Reason
Ensures that the full integration of Vite, React, Tiptap, FortuneSheet, and CSS styling works end-to-end in a real browser rendering engine.

### The Check
`npm run test:e2e` exits with code 0 with all tests passing.

---

## 3. Desktop Build Verification

### The Rule
`npm run desktop:build` compiles the Tauri desktop app and outputs the NSIS installer under `src-tauri/target/release/bundle/nsis/` (or `src-tauri/target/release/bundle/`) when the Rust toolchain and MSVC/C++ prerequisites are available.

The web build (`npm run build`) must succeed independently without requiring Rust or native platform compilers.

### The Reason
Guarantees continuous integration portability so web deployments and automated testing can proceed without heavyweight native compilers.

### The Check
`npm run build` succeeds cleanly, producing production bundles in `dist/`.

