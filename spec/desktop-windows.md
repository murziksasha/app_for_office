# Desktop Windows Specification

## 1. Window and Single Instance

### The Rule
The desktop application is Tauri 2 with the evergreen WebView2 runtime (`downloadBootstrapper`). Folio does not bundle a private browser.

- The window title starts as `Folio`. Size is `1280x800`, minimum `960x640`, and the window is resizable.
- Only one Folio process owns the window. A later launch focuses that window.
- File arguments on the first launch are allow-listed and queued. The page reads them with `folio_take_launch_paths` after it is listening, then opens every path.
- A later launch emits `folio://open-files` with every existing file argument, not only the first. The page opens that list with the same batch rules as File > Open.
- Dropped paths are allow-listed and opened as a batch. Folders are ignored.

### The Reason
Explorer double-click and a second launch must land in the window the user already has open, on the file they chose.

### The Check
`src-tauri/tauri.conf.json` sets the window size and the single-instance plugin. `src-tauri/src/lib.rs` queues launch paths and emits `folio://open-files`.

---

## 2. Native Dialogs and Save in Place

### The Rule
Desktop file I/O goes through the Rust commands. The page does not show a browser download for a desktop save.

- `folio_pick_open` returns every chosen file. Filter labels say Document, Spreadsheet, Presentation, and PDF. They do not use Microsoft product names.
- `folio_pick_save` is the save dialog for a file with no path, for Save As, and for a path that no longer exists.
- `folio_write` overwrites the tab's path on Ctrl+S once that path exists and is not newer.
- `folio_path_status` reports exists, parent exists, modified time in milliseconds, and length. The path must already be on the in-memory allow-list. `folio_allow_path` adds a path the user picked from Recent.
- `folio_choose` shows 1 to 3 buttons with the words the shell decided (Save, Don't save, Cancel, and the other prompts). Closing the dialog with the title-bar X is Cancel.
- Window close always calls `preventDefault`, runs the per-tab save pass, and calls `destroy` only when that pass returns true.

### The Reason
A desktop office app overwrites the open file and asks with real button names. A download prompt or a Yes/No dialog is the browser, not the desktop app.

### The Check
`src/platform/desktop.ts` calls these commands. `tests/session.test.ts` covers the decisions the page makes from `folio_path_status`. Native dialogs themselves are checked by running the desktop app.

---

## 3. File Associations

### The Rule
The NSIS installer registers Folio for `.docx`, `.odt`, `.rtf`, `.txt`, `.md`, `.html`, `.htm`, `.xlsx`, `.csv`, `.tsv`, `.pptx`, and `.pdf`.

- Association display names are Document, Spreadsheet, Presentation, and PDF, plus the format's own name where that name is not a Microsoft product (OpenDocument Text, Rich Text, CSV, Markdown, HTML).
- Folio does not associate with `.doc`, `.xls`, `.ppt`, `.docm`, `.xlsm`, or `.pptm`.
- Double-clicking an associated file launches or focuses Folio and opens that file.

### The Reason
Shell integration should make Folio the handler for the formats it can edit, without claiming Microsoft product names or macro binaries.

### The Check
`src-tauri/tauri.conf.json` `bundle.fileAssociations` lists those extensions and the neutral descriptions.

---

## 4. Browser Shell

### The Rule
The browser runs the same tabs, dirty marks, and in-page prompts. Save uses the File System Access API when the browser provides it, and a download otherwise. There is no second single-document browser app. A browser file is the same tab only when `isSameEntry` succeeds.

### The Reason
The editors and the file rules should not fork just because the window is a browser tab.

### The Check
`e2e/smoke.spec.ts` runs against the Vite app and exercises tabs, the three-button close, and Ctrl+S download for a new document.
