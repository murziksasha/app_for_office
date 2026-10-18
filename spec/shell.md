# Shell Specification

## 1. Application Layout & Chrome

### The Rule
When no document is open, Folio displays the **Start Screen**.
When an active document exists, the application presents:
1. **Top Application Bar**: Product mark ("Folio"), active file name, unsaved changes badge, import report trigger, and quick save/save-as/print/close controls.
2. **Command Ribbon**: Tabbed navigation (`File`, `Home`, `Insert`, `Page & View`).
3. **Active Workspace**: Paged document viewport, spreadsheet canvas, slide deck editor, or PDF reader.
4. **Bottom Status Bar**: Contextual metadata (word count, character count, sheet count, slide index, zoom controls, page size selector).

### The Reason
Users need a consistent, familiar workspace hierarchy that provides immediate access to file lifecycle operations and editing tools.

### The Check
`e2e/smoke.spec.ts` verifies visibility of the start screen, transitions into the active editor, and presence of ribbon and status bar.

---

## 2. Dirty Guard & Close Handling

### The Rule
Whenever a document is modified, `isDirty` is set to `true`.
- In the desktop app, closing the window triggers Tauri's `onCloseRequested` event. If `isDirty` is true, an exit confirmation dialog is shown. If the user cancels, `event.preventDefault()` aborts the close. If the user confirms, the window is destroyed.
- In the browser, `beforeunload` displays standard browser confirmation prompts.
- The window title reflects the dirty status: e.g. `Folio - Document1.docx *`.

### The Reason
Prevents accidental data loss from clicking the window close button or pressing Alt+F4 with unsaved edits.

### The Check
Unit tests in `tests/open_save.test.ts` verify window title dirty mark generation and close guard registration.

---

## 3. Draft Auto-Saving & Recent Files

### The Rule
- **Drafts**: Modified documents automatically persist to IndexedDB (`folio_draft_...`) after 1500ms of inactivity. Restoring a draft rehydrates the model. Saving explicitly clears the draft.
- **Recent Files**: Stored in IndexedDB (`folio_recent_files`, capped at 20 items). On desktop, items store their absolute `path` and reopen without permission prompts. On browser, items store the `FileSystemFileHandle` and request permissions on reopen.

### The Reason
Protects user work across unexpected system reboots or power loss while providing rapid access to recently edited files.

### The Check
`tests/open_save.test.ts` and `src/files/recent.ts` test suites verify storage keys and list limits.

---

## 4. Keyboard Shortcuts

### The Rule
Folio supports standard global shortcuts:
- `Ctrl+S` / `Cmd+S`: Save active document.
- `Ctrl+Z` / `Cmd+Z`: Undo.
- `Ctrl+Y` / `Cmd+Y`: Redo.
- `Ctrl+B` / `Cmd+B`: Toggle bold text.
- `Ctrl+I` / `Cmd+I`: Toggle italic text.
- `Ctrl+U` / `Cmd+U`: Toggle underline text.
- `Ctrl+F` / `Cmd+F`: Open Find & Replace floating palette.
- `Escape`: Close Find & Replace palette or active modal dialog.
- `Ctrl+P` / `Cmd+P`: Trigger document printing.

### The Reason
Standard hotkeys allow keyboard-driven productivity without requiring mouse clicks for frequent actions.

### The Check
Playwright test 2 in `e2e/smoke.spec.ts` verifies `Ctrl+A` selection and shortcut styling.

