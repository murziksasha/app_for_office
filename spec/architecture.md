# Architecture Specification

## 1. System Layers

### The Rule
Folio is organized into four strictly segregated architectural tiers:

```
┌────────────────────────────────────────────────────────┐
│                   Shell Tier                           │
│  (StartScreen, Ribbon, StatusBar, Dialogs, Hotkeys)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Platform Tier                         │
│  (src/platform: browserAdapter vs desktopAdapter)      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Editor Tier                          │
│  (DocumentEditor, SpreadsheetEditor, SlideEditor, PDF) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Adapters Tier                         │
│  (docx, odt, rtf, textMdHtml, exceljs, pptxAdapter)    │
└────────────────────────────────────────────────────────┘
```

1. **Shell Tier**: Manages UI chrome, file switching, autosave draft timeouts, modal dialogs, and window state.
2. **Platform Tier**: Encapsulates all interactions with the operating system or browser host (`pickFile`, `saveFile`, `readFile`, `setWindowTitle`, `setupCloseGuard`).
3. **Editor Tier**: Provides interactive canvas rendering for documents (Tiptap ProseMirror), spreadsheets (FortuneSheet), presentations (slide thumbnail grid and element inspector), and PDFs (PDF.js).
4. **Adapters Tier**: Implements format parsing and serialization, converting between raw disk/network bytes and structured in-app models.

### The Reason
Strict tier separation prevents UI editors from depending on platform-specific APIs (e.g. Tauri internals or Chromium file handles) or file format idiosyncrasies.

### The Check
Import analysis confirms that editors under `src/document/`, `src/spreadsheet/`, and `src/slides/` never import `src/platform/desktop` or `window.__TAURI_INTERNALS__`.

---

## 2. Unidirectional Data Flow

### The Rule
All file operations follow a strict, unidirectional data pipeline:

```
[Raw Bytes] 
    │
    ▼ (Format Sniffing & Validation)
[Importer] 
    │
    ▼ (Sanitization & Model Conversion)
[In-Memory Model] (Tiptap JSON / FortuneSheet / PresentationModel)
    │
    ▼ (Interactive Editing)
[Editor Canvas]
    │
    ▼ (Serialization on Save / Export)
[Exporter]
    │
    ▼ (Writing to Allowed Path or File Handle)
[Raw Bytes on Disk]
```

At no point does raw HTML sit on `EditorState` or pass between React components.

### The Reason
Treating the document as a structured model prevents state corruption, enables predictable undo/redo histories, eliminates HTML injection vulnerabilities, and ensures that saving does not depend on scraping the live DOM tree.

### The Check
TypeScript compiler verification ensures `EditorState.documentContent` is strictly typed as `JSONContent` (Tiptap JSON).

