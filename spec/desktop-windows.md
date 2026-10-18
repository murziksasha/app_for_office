# Desktop Windows Specification

## 1. Window & Runtime Lifecycle

### The Rule
The desktop application is built with **Tauri 2**:
- **Application Window**: Title `"Folio"`, default size `1280x800` pixels, minimum constraints `960x640` pixels, fully resizable.
- **WebView2 Runtime**: Uses the evergreen Windows WebView2 runtime via the bootstrapper mode (`downloadBootstrapper`). Folio does not bundle private browser binaries.
- **Single-Instance Enforcement**: Only one Folio window exists at a time. Launching a second instance focuses the first window and forwards any document path arguments into the existing instance's open pipeline via the `folio://open-file` event.

### The Reason
Tauri provides lightweight native Windows memory footprints (~40MB vs Electron's ~200MB) while taking advantage of Windows-native WebView2 hardware acceleration.

### The Check
`src-tauri/tauri.conf.json` specifies `app.windows[0].width: 1280`, `height: 800`, `minWidth: 960`, `minHeight: 640`, and `tauri-plugin-single-instance`.

---

## 2. Native File Dialogs & Save-in-Place

### The Rule
1. **Open Dialog**: Uses `folio_pick_open` (native `IFileDialog`), filtering for supported office formats.
2. **Save Dialog**: Uses `folio_pick_save` when a file does not have an existing path (e.g. Save As or new document).
3. **Save-in-Place**: When a document has an established `filePath`, invoking Save writes directly back to that path via `folio_write` without re-prompting the user.
4. **Recent Files**: Stored desktop recents include the absolute file path and reopen immediately via `folio_read` without dialog prompts.

### The Reason
Users expect desktop applications to overwrite the active file directly on `Ctrl+S` without annoying browser download popups or file picker interruptions.

### The Check
`src/platform/desktop.ts` tests and code inspection verify that `saveFile` writes directly to `options.path` when present.

---

## 3. Windows Shell File Associations & Installer

### The Rule
The NSIS installer registers Folio as a Windows file handler for:
- `.docx`, `.odt`, `.rtf`, `.txt`, `.md`, `.html`, `.htm`, `.xlsx`, `.csv`, `.tsv`, `.pptx`, `.pdf`.
- Folio MUST NOT associate with legacy binary formats (`.doc`, `.xls`, `.ppt`) or macro extensions (`.docm`, `.xlsm`, `.pptm`).
- Double-clicking an associated file in Windows Explorer launches or focuses Folio and opens that file.
- The Start menu shortcut and installer icon use the teal book mark branding.

### The Reason
Seamless shell integration allows users to make Folio their default viewer and editor for daily office files.

### The Check
`src-tauri/tauri.conf.json` `bundle.fileAssociations` explicitly lists the allowed 12 extensions and excludes legacy formats.

