# Testing Specification

## 1. Unit & Integration Testing (Vitest)

### The Rule
Every file adapter, parser, and platform boundary must have automated test coverage:
- `tests/detect.test.ts`: Magic byte detection and file extension routing.
- `tests/docx.test.ts`: Open XML document parsing, styling preservation, and Mammoth fallback.
- `tests/odt.test.ts`: OpenDocument text parsing and XML container building.
- `tests/rtf.test.ts`: RTF control-word parsing and font/color table generation.
- `tests/text_md_html.test.ts`: Markdown, HTML, and plain text bidirectional conversions.
- `tests/spreadsheet.test.ts`: XLSX workbook parsing, cell formula preservation, CSV/TSV conversions.
- `tests/slides.test.ts`: PowerPoint presentation element extraction and geometric layout.
- `tests/open_save.test.ts`: Central `loadFileToEditor` pipeline, `DocumentModel` generation, script tag stripping, and platform selection verification.
- `tests/drop_target.test.ts`: Home drop hit testing in logical and physical pixels.
- `tests/page_setup.test.ts`: Margin clamp, unit conversion, docx and odt margin round-trip, and undo.

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

