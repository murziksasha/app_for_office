# Grill: Ribbon collapse, Home drop, SoftMaker packages, Ukrainian
Date: 2026-10-19

## Intent
Folio should hide the tool strip without losing the tabs, open files only when they land on the large Home box, open and save SoftMaker packages through the existing editors, and switch every Folio-owned label between English and Ukrainian without a reload.

## Constraints
- Collapse hides the tool strip. Tab names stay. File still opens. The same behavior applies to Document, Spreadsheet, Presentation, and the PDF File tab.
- A chevron at the right of the tabs, or a click on the active tab, collapses the strip. A click on a tab while collapsed opens that tab’s tools and leaves them open. The choice is stored on this machine and restored next launch.
- The only drop target is the large Home box labeled “Drag and drop files here to open”. It works when Home is the visible page, including as a tab beside open files. A drop on an open document, the ribbon, or the Open Existing card does nothing.
- Several files: each supported file opens in its own tab. An unsupported file shows the existing error. The others still open. The Open Existing card stays click-to-browse.
- `.tmdx`, `.pmdx`, and `.prdx` open and save through the existing Document, Spreadsheet, and Presentation pipelines. The extension stays on the file. A saved file may be plainer. Skipped pieces stay on the import report.
- Older `.tmd`, `.pmd`, and `.prd` open only when the ZIP contains `word/document.xml`, `xl/workbook.xml`, or `ppt/presentation.xml`. The tab is dirty, the name uses `.tmdx`, `.pmdx`, or `.prdx`, and there is no save path. The first Save asks for a path. The original file is never overwritten. A binary file, or a ZIP without that part, shows a Folio error and does not open.
- Library is `i18next` and `react-i18next`. Local JSON only. No network. Every Folio-owned label switches. Document, cell, and slide text does not. Ukrainian buttons are short office labels. No Russian.
- The language control sits on the Home header and on the editor title bar, before Save. The button shows the language you are in: `EN` or `UA`. The tooltip names the other language. The chrome updates immediately. Last choice is stored and restored after close. Key wins over detection.
- First launch, no saved choice: desktop reads the Windows country. `UA` starts in Ukrainian even when Windows menus are English. Any other country follows the Windows display language. The browser build has no country API and uses `navigator.language`.
- Windows double-click stays with SoftMaker. Filter labels say Document, Spreadsheet, or Presentation plus the extension.
- Acceptance test for drop: drag `C:\Users\user\Desktop\hello.tmdx` onto that box in the desktop window.

## Key decisions
- Decision: store `folio_ribbon_collapsed` in `localStorage` as `'1'` or `'0'`, read when the ribbon mounts. Reason: the choice must survive the next launch on this machine. Alternative considered: a session-only flag, or hiding the tab names with the tools.
- Decision: the chevron `aria-label` comes from i18n. Collapsed mode does not render the tool strip. PDF’s only tab is File; collapsing hides the File pane, and clicking File shows it again. Reason: one collapse rule for every editor. Alternative considered: a separate PDF rule, or collapsing the title bar too.
- Decision: move the browser `onDragOver` / `onDrop` from the page onto the large box only, and highlight that box while a drag is over it. Reason: the page-wide listener was wider than the box. Alternative considered: keeping the page listener and filtering the target.
- Decision: desktop listens with `getCurrentWebview().onDragDropEvent`. On `drop`, open only when the physical-pixel position is inside the box (`data-folio-drop-target`) and that element is on screen. Convert `getBoundingClientRect()` by `devicePixelRatio`. Then `folio_allow_path` and `folio_read`, and open each file in its own tab with its path. Reason: a window listener can miss `tauri://drag-drop`, and Save must still target the original file. Alternative considered: the App-level handler that opens every window drop.
- Decision: keep the Rust allow-list, or allow the path from JS after the hit test. Do not read a path that missed the box. If the webview listener still receives no `drop` on Windows, set the window `dragDropEnabled` to `false` and use the box’s HTML5 drop. That fallback has file bytes and a name and may not have a path, so the first Save asks for one. Prefer the path-bearing listener. Reason: an empty `dataTransfer` on desktop is the current failure. Alternative considered: reading every allow-listed drop.
- Decision: add `'tmdx' | 'pmdx' | 'prdx'` to `SupportedFormat`. For `.tmdx` / `.tmd`, `.pmdx` / `.pmd`, and `.prdx` / `.prd`, a ZIP with the matching part returns the new extension as the format (`tmd` → `tmdx`, and the same for the other pairs). Bytes that are not that ZIP return an error and do not fall through to plain text. Import and export call the existing docx, xlsx, and pptx functions. `save.ts` must not rename `.tmdx` to `.docx`. Reason: `detect.ts` currently sees `word/document.xml` and returns `docx`. Alternative considered: a separate SoftMaker parser, or saving back as `.docx`.
- Decision: opening an old extension clears `filePath`, sets `isDirty`, and sets the file name to the new extension so the existing “no path” Save asks for a location. Reason: the original binary or older package must never be overwritten. Alternative considered: saving in place over `.tmd`.
- Decision: add the six extensions to the combined Open filter in `folio_pick_open`, plus three rows for `*.tmdx`, `*.pmdx`, and `*.prdx`. Add the three formats to `saveFiltersForKind`, the Save As dialog, recent-file badges, and the Home hint line. Do not touch `bundle.fileAssociations`. Reason: Open and Save As must list them, and Windows double-click stays with SoftMaker. Alternative considered: registering the extensions with the installer.
- Decision: copy `hello.tmdx`, `New Документ PlanMaker.pmdx`, and `New Документ Presentations.prdx` into `fixtures/` after a quick look that they are not personal. Add a tiny binary fixture for `.tmd` that must error. Reason: detect, import, and save need fixtures that are not personal files. Alternative considered: generating the packages only in the test.
- Decision: init `i18next` in `src/i18n/index.ts` with `src/i18n/locales/en.json` and `uk.json`. A shared control used by the Home header and `TitleBar` toggles `en` ↔ `uk`, calls `changeLanguage`, and writes `folio_ui_lang`. Reason: the chrome must update immediately with no reload. Alternative considered: a full page reload, or a custom string table.
- Decision: new Rust command `folio_user_region` calls `GetUserDefaultGeoName` on Windows and returns the ISO country. No plugin and no network. Other platforms return an empty string. `userRegion()` on the desktop adapter calls the command. The browser adapter returns `null`. Reason: `UA` must start in Ukrainian even when Windows menus are English, and the browser build has no country API. Alternative considered: reading only the display language on desktop.
- Decision: first-launch resolver is saved `en` or `uk`, else country `UA` → `uk`, else display language Ukrainian → `uk`, else `en`. The browser skips the country step and reads `navigator.language`. Reason: the stored key wins over detection. Alternative considered: always following the display language.
- Decision: Ukrainian labels are short office words: Зберегти, Відкрити, Основне, Вставлення, Макет. Reason: ribbon buttons must stay short. Alternative considered: longer descriptive phrases, or a Russian locale.
- Decision: existing Playwright smoke sets `folio_ui_lang=en` before those tests. One smoke switches to `UA` and sees `Основне`. A unit test asserts `en.json` and `uk.json` have the same keys. Reason: the current smoke expects English labels. Alternative considered: rewriting every smoke in Ukrainian.
- Decision: unit-test the hit test for a point inside the rect, a missing box, and a box that is not shown. Browser verification drops a fixture onto the box and confirms a tab opens, then drops outside the box and confirms nothing opens. Reason: both current drop paths fail to open a file and are wider than the box.

## Surfaced assumptions
- `src/shell/Ribbon.tsx` always renders the tool strip at `minHeight: 104`.
- `StartScreen` listens for a browser drop on the whole page. On the desktop build, Tauri’s default `dragDropEnabled: true` swallows HTML5 drops, so `dataTransfer.files` is empty.
- `DesktopPlatformAdapter.setupFileDropHandler` listens with `getCurrentWindow().onDragDropEvent`. The installed API documents those events on the webview (`tauri://drag-drop`). Rust already allow-lists every drop in `on_window_event`, then nothing opens.
- `detect.ts` sees `word/document.xml` and returns `docx`, ignoring the extension. Save then writes `.docx`.
- Samples live on the desktop as `hello.tmdx`, `New Документ PlanMaker.pmdx`, and `New Документ Presentations.prdx`.
- FortuneSheet’s own menus stay as the library ships them. Its toolbar is already hidden.
- The installer language stays English.
- Filter labels and dialog copy already avoid Word, Excel, PowerPoint, and Microsoft in new UI. TextMaker and PlanMaker stay out of new labels too.
- Spec updates belong in the ribbon section of `spec/ui.md`, in `spec/file-pipelines.md`, and in the format table in `Agents.md`.

## Out of scope
- Installer language stays English.
- No Russian locale.
- No OS association for the new extensions.
- Drop outside the large Home box.
- FortuneSheet’s own menus stay as the library ships them. Its toolbar is already hidden.
- Byte-identical SoftMaker packages, charts, SmartArt, tracked changes, and animations beyond what the current importers already keep.
- A binary parser for older `.tmd`, `.pmd`, and `.prd`. The Office 97–2003 message is not reused for those files.
