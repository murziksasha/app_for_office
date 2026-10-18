# AGENTS.md — Working Agreement for Folio

This document is the authoritative contributor and AI agent guide for the **Folio** repository. All code additions and modifications must adhere to these policies and architectural constraints.

---

## 1. What Folio Is

Folio is a **local-first office suite** for Windows and modern web browsers. It provides focused, clean productivity tooling for:
- **Documents**: Word processing powered by Tiptap (DOCX, ODT, RTF, Markdown, HTML, Plain Text).
- **Spreadsheets**: Multi-sheet workbooks powered by FortuneSheet (XLSX, CSV, TSV).
- **Presentations**: Slide decks and slide editing (PPTX).
- **PDF Viewing**: Document preview and rendering via PDF.js.

### Core Principle: Local-First and Private
- **Files stay on this PC**: Zero data transmission, zero telemetry, zero cloud accounts, and zero background analytics.
- **Document Boundary**: Importers translate external file formats into structured in-memory application models. The editing canvas works strictly on this in-app model. Exporters translate the structured model back to file bytes upon save. HTML is an intermediate serialization format only inside sanitized adapters and never passes across component state.
- **Desktop Shell**: Folio runs as a standard Windows desktop application packaged via **Tauri 2**. In web browsers, it operates as a standard Progressive Web App relying on the File System Access API with download fallback.

---

## 2. Command Reference

All workflow commands are run via `npm`:

| Command | Action |
| --- | --- |
| `npm install` | Install all dependencies for the web shell and Tauri CLI. |
| `npm run dev` | Launch the local Vite development server in browser mode at `http://localhost:5188`. |
| `npm test` | Run fast unit test suites with Vitest across all format adapters and platform boundaries. |
| `npm run test:watch` | Run Vitest in interactive watch mode. |
| `npm run test:e2e` | Run Playwright end-to-end smoke tests (verifying start screen, typing, formatting, and fixtures). |
| `npm run build` | Validate TypeScript (`tsc`) and compile production static web bundles into `dist/`. |
| `npm run desktop` | Launch the native Windows desktop app via `tauri dev`. |
| `npm run desktop:build` | Build the signed, bundled NSIS installer under `src-tauri/target/release/bundle/nsis/`. |

---

## 3. Directory Map

```
app_for_office/
├── AGENTS.md                 # Working agreement and agent guidelines (this file)
├── package.json              # Web dependencies, scripts, and build metadata
├── tsconfig.json             # TypeScript compiler configuration
├── vite.config.ts            # Vite & Vitest configuration
├── playwright.config.ts      # Playwright smoke test configuration
├── index.html                # Vite entry template with teal book favicon
│
├── src/                      # Application source code
│   ├── main.tsx              # React entry root
│   ├── App.tsx               # Top-level shell orchestrator (State, Title, Close Guard)
│   ├── types/                # Canonical TypeScript interfaces (EditorState, RecentItem, Models)
│   │
│   ├── platform/             # Platform abstraction boundary
│   │   ├── types.ts          # PlatformFileResult, PlatformSaveResult, PlatformAdapter
│   │   ├── browser.ts        # File System Access API, in-place handle writes, download fallback
│   │   ├── desktop.ts        # Tauri IPC caller (folio_pick_open, folio_pick_save, folio_read, folio_write)
│   │   └── index.ts          # Runtime detection (__TAURI_INTERNALS__) and adapter dispatch
│   │
│   ├── document/             # Document editor and formats
│   │   ├── model.ts          # DocumentModel (Tiptap JSONContent), htmlToDocument, documentToHtml
│   │   ├── sanitize.ts       # DOMPurify HTML sanitizer
│   │   ├── textMdHtml.ts     # Markdown, HTML, and Plain Text converters
│   │   ├── DocumentEditor.tsx# Tiptap React canvas with Find & Replace
│   │   ├── extensions/       # Custom Tiptap extensions (FontSize, Indent, PageBreak)
│   │   ├── docx/             # DOCX importer (docx4js/mammoth) and exporter (docx library)
│   │   ├── odt/              # OpenDocument Text ZIP parser and XML builder
│   │   └── rtf/              # Rich Text Format parser and RTF generator
│   │
│   ├── spreadsheet/          # Spreadsheet workbook engine
│   │   ├── adapters.ts       # ExcelJS importer/exporter, CSV/TSV parser/builder
│   │   └── SpreadsheetEditor.tsx # FortuneSheet React grid wrapper
│   │
│   ├── slides/               # Presentation engine
│   │   ├── pptxAdapter.ts    # PPTX ZIP/XML slide importer and PptxGenJS builder
│   │   └── SlideEditor.tsx   # Canvas slide thumbnail list and element inspector
│   │
│   ├── pdf/                  # PDF viewer
│   │   └── PdfViewer.tsx     # PDF.js page renderer and toolbar
│   │
│   ├── files/                # File orchestration
│   │   ├── detect.ts         # Magic bytes and extension sniffing
│   │   ├── open.ts           # Central loadFileToEditor pipeline
│   │   ├── save.ts           # Central saveEditorContent pipeline
│   │   ├── drafts.ts         # IndexedDB draft auto-saving
│   │   ├── recent.ts         # Recent files manager (IndexedDB storage)
│   │   └── fileSystem.ts     # Platform proxy bridge
│   │
│   ├── shell/                # Application UI chrome
│   │   ├── StartScreen.tsx   # Welcome dashboard with templates and recent files
│   │   ├── Ribbon.tsx        # Fluent command ribbon (Home, Insert, Page & View, File)
│   │   ├── StatusBar.tsx     # Bottom status bar with word count, sheet count, zoom
│   │   ├── ImportReportDialog.tsx # Notice dialog for warnings and skipped features
│   │   └── SaveAsDialog.tsx  # Format conversion dialog
│   │
│   └── styles/
│       └── theme.css         # CSS design tokens (warm paper, ink text, teal accents)
│
├── fixtures/                 # Canonical test documents
│   ├── sample.docx           # Open XML Word document fixture
│   ├── sample.xlsx           # Open XML Excel workbook fixture
│   ├── sample.pptx           # Open XML PowerPoint presentation fixture
│   ├── sample.odt            # OpenDocument Text fixture
│   ├── sample.rtf            # Rich Text Format fixture
│   ├── sample.md             # Markdown fixture
│   ├── sample.txt            # Plain text fixture
│   ├── sample.html           # HTML fixture
│   ├── sample.csv            # Comma-separated values fixture
│   ├── sample.tsv            # Tab-separated values fixture
│   └── sample_binary.doc     # Office 97-2003 binary rejection fixture
│
├── tests/                    # Unit and integration test suites
│   ├── detect.test.ts        # Format sniffing tests
│   ├── docx.test.ts          # DOCX roundtrip tests
│   ├── odt.test.ts           # ODT roundtrip tests
│   ├── rtf.test.ts           # RTF roundtrip tests
│   ├── text_md_html.test.ts  # Text/MD/HTML tests
│   ├── spreadsheet.test.ts   # XLSX/CSV/TSV tests
│   ├── slides.test.ts        # PPTX slide model tests
│   └── open_save.test.ts     # Central pipeline and platform boundary tests
│
├── e2e/                      # End-to-end integration tests
│   └── smoke.spec.ts         # Playwright smoke test run against live UI
│
├── src-tauri/                # Tauri 2 native Windows desktop shell
│   ├── Cargo.toml            # Rust manifest with tauri, serde, rfd, and single-instance
│   ├── tauri.conf.json       # App configuration, window dimensions, file associations, NSIS
│   ├── build.rs              # Tauri build script
│   ├── src/main.rs           # Rust commands (folio_pick_open, folio_read, etc.) and allow-list
│   └── icons/                # Teal book mark icons (32x32, 128x128, icon.ico, icon.png)
│
└── spec/                     # Normative architectural specifications
    ├── README.md             # Spec directory manifest and reading hierarchy
    ├── product.md            # Product rules, format matrix, non-goals
    ├── architecture.md       # Architectural boundaries and data flow
    ├── document-model.md     # In-app document representations
    ├── file-pipelines.md     # File import, export, and fallback behavior
    ├── shell.md              # User interface chrome, ribbon, shortcuts
    ├── security.md           # Sanitization, macros, binary rejection, allow-list
    ├── desktop-windows.md    # Tauri shell, dialogs, single-instance, associations
    ├── ui.md                 # Design system, theme colors, typography
    └── testing.md            # Testing strategy and verification criteria
```

---

## 4. Hard Architectural Rules

1. **DOMPurify Before Render**: All incoming HTML from files, markdown transformations, or clipboard pastes must pass through `DOMPurify` before being parsed or rendered.
2. **Macros Never Execute**: `.docm`, `.xlsm`, and `.pptm` files have their VBA macro streams stripped or ignored on import. Macros never execute, and a warning notice is added to the `ImportReport`.
3. **Legacy Office Binaries Refused**: Pre-OpenXML binary formats (`.doc`, `.xls`, `.ppt`) cannot be parsed cleanly in modern web environments. They must be explicitly rejected with the standard message: `"Legacy Office binary format (.doc, .xls, .ppt) cannot be opened directly. Please save the file as modern .docx, .xlsx, or .pptx."`
4. **No Network Upload**: The application must never transmit document data, telemetry, analytics, or user identifiers over the network.
5. **No Microsoft Trademarks in UI**: Never use Microsoft brand names or logos in the interface (e.g. do not label buttons as "Word", "Excel", or "PowerPoint"). Use neutral format descriptors: "Document", "Spreadsheet", "Presentation".
6. **No Electron Dependency**: Editor components and client utilities must never import Electron or assume an Electron environment. Platform integration is abstracted through `src/platform/`.
7. **Strict Desktop Path Allow-List**: On desktop, disk I/O must go exclusively through the Rust commands (`folio_pick_open`, `folio_read`, `folio_write`). Reading and writing are only permitted for paths explicitly chosen by the user, dropped into the window, passed via CLI args, or saved during the current session. The allow-list resides inside the Rust process.

---

## 5. How to Add or Extend a File Format

To add or extend a format in Folio, follow this standard pattern:
1. **Sniffing**: Register the magic byte signature or extension detection in `src/files/detect.ts`.
2. **Import Adapter**: Implement the parser to translate external bytes into the corresponding structured model:
   - For text documents: produce sanitized HTML and convert with `htmlToDocument`.
   - For spreadsheets: produce FortuneSheet sheet objects.
   - For presentations: produce `PresentationModel` slide objects.
3. **Export Adapter**: Implement serialization from the structured model into the destination format bytes.
4. **Fixture**: Add a representative fixture file in `fixtures/` exercising typical formatting.
5. **Vitest Suite**: Add or expand a unit test in `tests/` verifying bidirectional import/export and error handling.

---

## 6. Out of Scope for This Version

The following features are explicitly out of scope:
- Real-time multiplayer collaboration or cloud syncing.
- Complex embedded interactive Excel charts and dynamic pivot tables.
- Advanced PowerPoint transitions, timing animations, and sound effects.
- Direct PDF vector shape editing (PDF is read-only).
- Binary Office 97–2003 reverse-engineered compound document parsers.

