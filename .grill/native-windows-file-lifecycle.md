# Grill: Native Windows file lifecycle
Date: 2026-10-18

## Intent
Folio should feel like a native Windows office app in daily file use. Explorer opens the file, Ctrl+S writes that file, closing asks what to do with unsaved work, and a second launch does not create a second app. The editors stay as they are.

## Constraints
- One OS window, many document tabs.
- One path, or one proven browser file handle, belongs to one tab.
- Dirty means the content differs from the last saved file, or from the empty new file. Undo back to that state clears it. Zoom, ribbon clicks, and switching tabs do not.
- An untouched new file closes with no prompt. The first edit makes it dirty. The first save is always a Save dialog.
- Window Close quits after a per-tab Save / Don't save / Cancel pass. Closing the last tab shows the start screen and does not quit.
- A failed or cancelled save stops the close, shows the reason, and selects that tab. Later tabs are not asked and not discarded.
- Desktop prompts are native dialogs whose buttons read Save, Don't save, and Cancel. Browser prompts inside the page use the same words. Leaving the browser can only raise the generic leave prompt and must keep drafts.
- No background file watcher. Disk changes are checked when that path is opened again and when that tab is saved.
- No Win32 pagination engine. Print uses the WebView print dialog.

## Key decisions
- Decision: one shared shell for desktop and browser. Reason: there is one screen codebase. Alternative considered: desktop-only tabs, or removing the browser.
- Decision: Explorer or a second launch focuses the existing window. A new path becomes a tab. The same path focuses the existing tab and does not reload it when that tab is dirty. Reason: unsaved edits must survive a second double-click. Alternative considered: one window per file, or replacing the current file.
- Decision: a clean tab whose disk copy is newer asks Reload or Keep. A failed reload leaves the tab unchanged. A missing path on Ctrl+S opens Save and retargets the tab. A locked file that still exists shows the error and keeps the path. Reason: recreating the old path duplicates a moved file. Alternative considered: always recreate, or never reload.
- Decision: crash drafts are listed on the start screen and on the File ribbon. They are not opened automatically. Opening a path that has a draft asks Restore or Open from disk. Open from disk leaves the draft listed. Replacing an already-open clean tab with its draft asks first. A dirty open tab is only focused. Other drafts wait. Reason: a crash must be recoverable without clobbering a file opened from disk. Alternative considered: reopen dirty tabs automatically, or drop drafts.
- Decision: New and Open add a tab and do not prompt. A batch walks the list in order. Each recovered draft is asked, then the batch continues. One failure list follows. The current tab stays active. From the start screen, the first file that opens becomes active. Folders are ignored. Reason: a multi-open must not discard work and must not stack one alert per file. Alternative considered: open only the first file, or stop at the first failure.
- Decision: Save As onto another open tab is refused. Save As onto this tab's own path is a normal save. A newer disk copy asks Overwrite, Save As, or Cancel. If the modification time cannot be compared, Ctrl+S overwrites. Reason: one path cannot have two tabs, and a silent overwrite can destroy another program's save. Alternative considered: always overwrite, or always Save As.
- Decision: a missing recent file is removed only when its parent folder exists and the file does not. An unavailable drive keeps the recent entry. A draft for that path is kept either way. Reason: an unplugged drive is not a deleted file. Alternative considered: always remove, or never remove.
- Decision: documents print the whole document with no scope dialog. Sheets, slides, and PDFs ask only when there is more than one unit. Defaults are the active sheet, all slides, and all pages. Cancel does not open the system dialog. Reason: a document has no numbered current page. Alternative considered: a Win32 pagination engine, or printing only the pixels on screen.

## Surfaced assumptions
- Cold start from Explorer must open that file. The path used to be only added to the Rust allow-list.
- Drafts were keyed by file name, so two unsaved documents collided. Each tab has its own id.
- The dirty flag used to stick after undo. Dirty is a comparison with a clean snapshot.
- File association descriptions must not use Microsoft product names.
- Ctrl+S saves the active tab. Ctrl+W and the tab X use the same close prompt. Ctrl+N creates a file of the active tab's kind, or a document from the start screen. Ctrl+O opens. Ctrl+P prints the active tab. Ctrl+Tab cycles tabs. Alt+F4 is window Close.
- Suggested names are DocumentN.docx, WorkbookN.xlsx, and PresentationN.pptx, using the smallest N not used by an open tab of that kind.

## Out of scope
- Replacing the web editors with WinUI.
- Making the ribbon a visual copy of Word or Excel.
- Document, spreadsheet, or slide fidelity work.
- A classic Win32 print-pagination engine.
- Real-time collaboration, macros, legacy binary parsers, and PDF editing.
- One top-level window per file.
