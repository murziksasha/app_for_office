# Shell Specification

## 1. One Window, Many Tabs

### The Rule
Folio has one top-level window. Each open file is a tab. The start screen is shown only when there are zero tabs. It is not a Home tab, and the Folio mark does not close the active file.

- New and Open add a tab. They do not ask about the current tab.
- The same full path is never two tabs. On Windows, identity is the full path, compared case-insensitively with slashes normalized. In the browser, identity is `FileSystemHandle.isSameEntry`. A failed or denied comparison opens a new tab. The file name is not identity.
- A multi-file open or drop opens each file that is not already open. An already-open path is focused only when it is the only item, or the first item when every item is already open. Other already-open paths are skipped and are not reloaded. The current tab stays active unless there was no tab, in which case the first file that opens becomes active.
- Folders are ignored. A file that fails to open does not get a tab. After the batch, one dialog lists every failure. If every file fails, no tab is added.
- Closing the last tab returns to the start screen and does not quit. Closing the window quits only after every dirty tab is saved or discarded.

### The Reason
Office-style work is several files in one window. A second window, or a start screen that hides open files, breaks that model.

### The Check
`e2e/smoke.spec.ts` opens two document tabs with Ctrl+N and no prompt, then returns to the start screen only after the last tab closes. `tests/session.test.ts` covers path identity and batch open order.

---

## 2. Dirty State and Close

### The Rule
A tab is dirty when its content hash differs from the last saved snapshot, or from the empty new document. Full undo back to that snapshot clears dirty. Zoom, ribbon clicks, and tab switches do not. A new untouched file is clean. PDF tabs are never dirty.

Closing a dirty tab, or quitting with dirty tabs, asks once per dirty tab, in order: Save, Don't save, Cancel.

- Save writes that tab. A failed or cancelled save stops the close, shows the reason, selects that tab, and leaves it dirty. Later tabs are left untouched.
- Don't save drops that tab and deletes its draft. During quit, the tab is treated as clean so the pass continues.
- Cancel aborts the rest of the close. During window close, Cancel does not land on the start screen.
- A clean tab closes with no prompt.

The desktop close handler always cancels the native close, then destroys the window only after the pass finishes. The browser uses the same three buttons for in-page tab close. Leaving or reloading the browser page may show the generic leave prompt and must keep drafts.

The window title is `Folio — {file name}` plus ` *` when the active tab is dirty, or `Folio` when no tab is open.

### The Reason
A sticky dirty flag survives undo and punishes people for looking at the ribbon. A single Yes/No close dialog cannot save one tab and discard another.

### The Check
`tests/session.test.ts` covers the hash and the close decision. `e2e/smoke.spec.ts` shows Save, Don't save, and Cancel for a dirty tab. Cancel keeps the text. Don't save on the last tab returns to the start screen.

---

## 3. Save, Save As, and Disk Conflicts

### The Rule
Ctrl+S saves the active tab. Save, Save As, F12, or Ctrl+Shift+S on a tab with no safe path opens the save dialog. A macro path (`.docm`, `.xlsm`, `.pptm`) is not a safe path and is never overwritten; Save As suggests `.docx`, `.xlsx`, or `.pptx`. After that, Ctrl+S overwrites a normal existing path only.

- Save As opens one system dialog (folder, name, type) listing every format that kind can write, with the current type first. Type labels use neutral names (Document, Spreadsheet, Presentation). A host without a save picker keeps an in-app name-and-type fallback step with the same neutral labels.
- The tab becomes the new file. Unsaved edits are written only there; the old path is left at its last save.
- A successful save clears that tab's draft. Recents keeps the old file and puts the new path first. A download with no path is not added to Recents.
- Same-type saves and saves to docx, odt, rtf, html, xlsx, or pptx do not warn and do not reload. Editing history stays; Ctrl+Z changes the new file and marks it dirty.
- Switching to txt, md, csv, or tsv warns on lossy switch with Save and Cancel. Cancel writes nothing and leaves the tab alone. Save writes, reloads the editor from written bytes through format importers, and bumps `historyEpoch` so the editor remounts with an empty undo stack.
- CSV and TSV write the sheet on screen (`status === 1`, otherwise the first sheet) as displayed values, and the warning names that sheet.
- The extension on the picked name wins. `.htm` is HTML. A bare name gets the open file's current extension. Any other extension writes nothing and is refused with an OK message.
- If the path is gone, Ctrl+S does not recreate it. The save dialog opens with the old name. A successful pick retargets the tab. A locked file that still exists shows the error and keeps the old path.
- The system replace prompt is the only overwrite confirm. If another tab already owns the target path, Save As is refused, nothing is written, and both tabs stay as they are.
- If the disk copy's modified time or size differs from the stamp taken at open or last save, Ctrl+S asks Overwrite, Save As, or Cancel. If the stamp cannot be compared, Ctrl+S overwrites.
- Cancelling a save that was started by closing the tab stops the close.

Names for new files are `DocumentN.docx`, `WorkbookN.xlsx`, and `PresentationN.pptx`, using the smallest N not used by an open tab of that kind.

- **Save as PDF**: A File command available on Document, Spreadsheet, and Presentation editors (absent on the PDF reader). Always prompts for a target path (suggesting the current base name plus `.pdf`), renders the PDF in memory, and writes it. Spreadsheets and presentations reuse the print scope dialog (Active sheet vs All sheets, All slides vs This slide) when multiple units exist; a single unit skips the question, and Cancel writes nothing. Save as PDF never clears dirty, never retargets the tab, and does not alter the tab's name, path, or format.
- **Edit as Document**: Available on loaded PDF tabs via the File ribbon and the PDF viewer toolbar. It extracts selectable text and opens it as a new Document tab (format `docx`, dirty, no path or handle, named from the PDF base name using `nextFileName` to avoid duplicate titles). The PDF tab remains open, clean, and continues to save its original bytes. Unavailable on protected or unreadable PDFs; if no selectable text exists, no tab is created.

### The Reason
One path cannot have two tabs, a silent overwrite can destroy a save made by another program, and lossy format conversions must be acknowledged before discarding document structure.

### The Check
`tests/session.test.ts` covers the save decision, macro suggestions, lossy warnings, active sheet resolution, the missing path, the newer-disk conflict, and Save As onto an open path.

---

## 4. Drafts and Recent Files

### The Rule
A dirty non-PDF tab is written to IndexedDB about 1500ms after a change. Drafts are listed on the start screen and on the File ribbon. They are not opened automatically.

- Opening a draft makes one dirty tab. If it had a path, Ctrl+S targets that path. If not, the save dialog opens.
- Save, Don't save, and Dismiss delete that draft. A finished close does not leave drafts. Dismiss on the start screen deletes the draft.
- Opening a path that has a recovered draft asks Restore or Open from disk. Open from disk leaves the draft listed. In a batch, each draft is asked in list order, and either answer opens that tab and the batch continues. There is no Cancel that drops the remaining files.
- If that path is already open and clean, Folio asks before replacing it. If the open tab is already dirty, Folio focuses it, says it has unsaved edits, and leaves the draft listed.
- A recent file whose path is gone is removed only when the parent folder exists and the file does not. If the drive or parent is unavailable, the recent entry stays. A failed recent open never deletes a recovered draft.

### The Reason
A crash must be recoverable without clobbering the file the user chose to open from disk, and without throwing away recents on an unplugged drive.

### The Check
`tests/open_save.test.ts` covers draft storage and recent limits. `tests/session.test.ts` covers recent removal and draft-versus-disk open order.

---

## 5. Print

### The Rule
Ctrl+P prints the active tab through the WebView print dialog. Folio does not choose the printer.

- Documents print the whole flowing document. There is no scope dialog.
- Spreadsheets, slides, and PDFs ask only when there is more than one sheet, slide, or page. The choices are Active sheet or All sheets, All slides or This slide, and All pages or This page. Cancel does not open the system dialog.
- One sheet, one slide, or one page skips the scope dialog.
- The tab strip, ribbon, and status bar stay off the printed page. Sheet, slide, and PDF output is a print-only render. The on-screen editor stays as it is.

### The Reason
A document is one flowing paper, not a set of numbered pages. Sheets, slides, and PDF pages are real units the user can choose.

### The Check
`tests/session.test.ts` covers when a scope dialog is required and which choice maps to the current unit or the whole file.

---

## 6. Keyboard Shortcuts

### The Rule
- `Ctrl+S` / `Cmd+S`: Save the active tab.
- `F12` / `Ctrl+Shift+S` / `Cmd+Shift+S`: Save As on the active tab (ignored when a prompt is open or no tab is active).
- `Ctrl+W` / `Cmd+W`: Close the active tab, with the same prompt as the tab X.
- `Ctrl+N` / `Cmd+N`: New file of the active tab's kind, or a document from the start screen.
- `Ctrl+O` / `Cmd+O`: Open files into tabs.
- `Ctrl+P` / `Cmd+P`: Print the active tab.
- `Ctrl+Tab` / `Ctrl+Shift+Tab`: Cycle tabs.
- `Ctrl+Z` / `Cmd+Z`, `Ctrl+Y` / `Cmd+Y`: Undo and redo inside the editor.
- `Ctrl+B` / `Cmd+B`, `Ctrl+I` / `Cmd+I`, `Ctrl+U` / `Cmd+U`: Bold, italic, underline.
- `Ctrl+F` / `Cmd+F`: Find and replace in a document.
- `Escape`: Close the find palette or cancel the in-page choice dialog.
- `Alt+F4`: Window close, which quits after the dirty-tab pass.

A save, open, close, or print that is already showing a prompt ignores a second one.

### The Reason
These match Windows Office habits without a second window per file.

### The Check
Playwright covers Ctrl+N, the close dialog, and Ctrl+S on a new document. Editor formatting shortcuts remain in `e2e/smoke.spec.ts` test 2.
