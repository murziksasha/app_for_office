# UI & Styling Specification

## 1. Visual Theme: Warm Paper & Ink

### The Rule
Folio employs a warm editorial aesthetic inspired by physical paper and book design:
- **Background**: Warm ivory/stone gray canvas (`--folio-bg: #f8fafc; --folio-page: #ffffff`).
- **Typography (Ink)**: High-contrast, readable dark gray ink (`--folio-ink: #1e293b; --folio-ink-muted: #64748b; --folio-ink-faint: #94a3b8`).
- **Brand Accent (Teal)**: Primary brand color is deep teal (`--folio-teal: #0f766e; --folio-teal-light: #ccfbf1; --folio-teal-hover: #115e59`).
- **Paper Sheet Elevation**: Documents sit on an elevated white paper sheet (`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)`).

### The Reason
Prevents screen fatigue during extended document editing sessions and emphasizes content over flashy UI chrome.

### The Check
`src/styles/theme.css` variables define `--folio-teal: #0f766e` and `--folio-ink: #1e293b`.

---

## 2. Folio Branding & Trademark Neutrality

### The Rule
All UI strings and labels must use native Folio naming:
- Use **Document** (never "Word" or "DOC").
- Use **Spreadsheet** (never "Excel").
- Use **Presentation** (never "PowerPoint").
- Use the teal book mark icon as the application emblem.
- No third-party trademarks, Microsoft Office logos, or proprietary product badges may appear in the UI.

### The Reason
Avoids trademark infringement and presents Folio as an independent, modern local-first productivity tool.

### The Check
Playwright smoke tests in `e2e/smoke.spec.ts` assert heading labels `"New Document"`, `"New Spreadsheet"`, and `"New Presentation"`.

---

## 3. Ribbon Tabs and Instrument Groups

### The Rule
The ribbon is a tab row plus a strip of labeled instrument groups. Each group shows its tools on top and a caption underneath: Clipboard, Font, Paragraph, Styles, and the other captions for that tab. The Clipboard group includes Format painter for documents and spreadsheets. Document painter copies caret marks and paragraph attrs (`textAlign`, `lineSpacing`), applying them to the next selection; a second click locks the painter until Escape or a third click. Sheet painter copies cell formatting (`bl`, `it`, `un`, `fc`, `bg`, `ht`, `tb`, and number format `{ fa, t }`) onto the next selection. Escape cancels.

Tabs follow the open file:

- Document: File, Home, Insert, Layout, View.
- Spreadsheet: File, Home, Insert. FortuneSheet’s own toolbar stays hidden. The formula bar and sheet tabs stay.
- Presentation: File, Home, Insert. Slide, text, picture, video, shape, and table commands live here. Home's Slides group includes a slide size selector (16:9, 16:10, 4:3). Home also offers shape fill and outline colors, and table row and column commands when selected. Insert offers text box, table (3x3), picture, video, and five shapes: Rectangle, Rounded, Oval, Triangle, and Line. Double-clicking a shape edits optional text. A Notes field below the canvas allows typing speaker notes. The thumbnail rail stays beside the canvas and reflects the slide aspect ratio.
- PDF: File only. Page navigation stays on the viewer.

File groups are New, Open, Save, Print, and Settings. Save as PDF is absent on a PDF tab. Edit as Document is present on a PDF tab. Drafts and recent files stay listed under the File groups.

A chevron at the right of the tab row collapses the tool strip. Tab names stay. Clicking the active tab also collapses it. Clicking any tab while the strip is hidden selects that tab and shows its tools. PDF’s only tab is File, so collapsing hides the File pane until File is clicked again. The choice is stored on this machine as `folio_ribbon_collapsed` (`1` or `0`) and restored the next time the ribbon mounts.

The Home header and the editor title bar, immediately left of Print, share a language control. The button shows `EN` or `UA` for the language in use. Its tooltip names the other language. One click switches every Folio-owned label immediately. Document, cell, and slide text stays as written. The last choice is stored as `folio_ui_lang` and wins over detection on the next launch. With no saved choice, the desktop build reads the Windows country and starts in Ukrainian when that country is `UA`. Any other country follows the Windows display language. The browser build uses `navigator.language`.

The ribbon does not include dictation, designer assistance, add-ins, sharing, ink drawing, transitions, animations, a presenter view, mailings, or comments.

On a document, the Layout tab sets the page size and the four margins as numbers. The same margins are sliders on the page: a horizontal ruler above the sheet for the left and right margins, and a vertical ruler beside the first page for the top and bottom margins. English shows inches. Ukrainian shows centimeters. The stored unit is millimeters. Print uses those margins as the page margin. RTF, plain text, Markdown, and HTML keep the setup for the session and for drafts; their file bytes do not store a page box. The Layout tab also controls headers and footers with a "Different first page" switch and "Page number" insertion (digit `1` or `Page 1 of 8`). On-screen page margins paint the resolved header and footer stories with a quiet localized hint when empty; clicking a band allows inline editing outside the body editor while Home font and paragraph alignment controls follow the caret.

### The Reason
People expect writing tools in one place, grouped the way the rest of an office app groups them. A second toolbar inside the sheet or above the slide duplicates that and hides commands that already exist.

### The Check
`e2e/smoke.spec.ts` expects the document captions Clipboard, Font, Paragraph, and Styles, a presentation New slide control that adds a thumbnail, and a spreadsheet ribbon that shows Font and Number with FortuneSheet’s toolbar absent. It also collapses the ribbon, reloads, and checks that the tools stay hidden, then switches the language control to Ukrainian and expects `Основне` while the typed document text stays unchanged. Those smoke tests set `folio_ui_lang=en` before they look for English labels.

---

## 4. Settings and About

### The Rule
Settings is a dialog rendered with the warm paper theme and a single section list:
1. **About**: Displays identity lines as selectable plain text:
   - App title (`Folio`) and app version constant (`1.0.0`).
   - One line summary: `Local-first office suite for documents, spreadsheets, and presentations`.
   - Author name: `Oleksandr Hryhoriev` (same Latin spelling in English and Ukrainian).
   - Author email: `1versuses1@gmail.com` (presented as plain text and a `mailto:` link, without network requests).
   - Author phone: `063 556 70 90` (plain text).
   - Author place: `Ukraine, Chornomorsk` in English, `Україна, Чорноморськ` in Ukrainian.
2. **General**: Repeats the existing language switch (`EN` / `UA`). The choice updates UI strings immediately and is stored in `folio_ui_lang`. The title-bar and start-screen language buttons stay.

Settings is reachable from:
- The start screen header, beside the language button.
- The File ribbon pane, under the new **Settings** group and **Settings** button, on Document, Spreadsheet, Presentation, and PDF.

Escape and a Close button dismiss the dialog. Settings is not a file tab, not dirty, and not printed.

### The Reason
Settings and About information must be accessible both before opening any document (from the start screen) and while editing any file type (from the File ribbon), without creating tabs, modifying dirty state, or invoking network activity.

### The Check
`tests/about.test.ts` asserts that `src/shell/about.ts` exports the four identity lines, that none of the identity or about strings mention third-party office brands, and that place localization works. `e2e/smoke.spec.ts` opens Settings from the start screen, verifies the identity lines, switches language to Ukrainian, verifies `Україна, Чорноморськ` while the author name stays `Oleksandr Hryhoriev`, opens a document, opens Settings from the File ribbon, and dismisses it with Escape to verify document text remains unchanged.


---

## 5. Shared Command List

### The Rule
Ribbon buttons, context menus, quick access, and command search call a single typed command list in `src/shell/commands.ts`. Each command provides a unique id, an i18n label key, compatible document kinds (`document`, `spreadsheet`, `presentation`, `pdf`, or `any`), and a `run` callback.

### The Reason
Centralizing command definitions ensures consistent labels, keyboard shortcuts, contextual availability, and key tips across all app surfaces without duplicating action logic.

### The Check
`tests/commands.test.ts` asserts every id is unique, every `labelKey` exists in both locale files, and a document-only command is omitted for a spreadsheet.

---

## 6. Find and Replace Panel

### The Rule
Home Find is present on the ribbon for Document, Spreadsheet, and Presentation. Find and Replace (`src/shell/FindPanel.tsx`) opens as a floating panel on Ctrl+F (focusing the find field) or Ctrl+H (focusing the replace field in documents). For documents, it walks text nodes only in document order, treating regex characters like `.` and `*` literally. Replacements edit text nodes directly through editor transactions, preserving existing marks and never editing markup or tags as text. For spreadsheets, it searches active sheet cell display text (`m`, else `v`). For presentations, it searches slide element text, table cells, and speaker notes. It supports case matching, next match, and previous match, wrapping at the ends.

### The Reason
Direct text node editing prevents markup corruption, broken HTML tags, and lost formatting marks while honoring expected office shortcuts and navigation.

### The Check
`tests/find_text.test.ts` asserts two matches, match case, a match inside bold, replace one, replace all, no match, empty query, and regex literal handling. `tests/find_sheet_slides.test.ts` verifies matches in column B, formula display text, slide 2, and speaker notes. `e2e/document-tools.spec.ts` verifies replace leaves marks in place.

---

## 7. Context Menus

### The Rule
Right-clicking editor content renders a contextual menu at the pointer via `src/shell/ContextMenu.tsx`. The menu uses command definitions from `src/shell/commands.ts`, dismisses on Escape or pointer down outside the menu, and is clamped to the viewport boundaries.
- Document text displays: cut, copy, paste, bold, italic, underline, clear formatting, link.
- Document table displays: cut, copy, paste, bold, italic, underline, clear formatting, link, add row, add column, delete table.
- Spreadsheet displays: cut, copy, paste, insert row, insert column, delete row, delete column, clear. FortuneSheet's built-in context menus are disabled so only Folio-labeled actions are presented.
- Slide object displays: duplicate, delete (reordering commands are added in Wave 4 Step 21).

### The Reason
Users expect familiar right-click access to editing and structural commands directly at the pointer, with options tailored to whether plain text, tables, spreadsheet cells, or slide objects are selected.

### The Check
`tests/context_menu.test.ts` asserts that `docTable` includes table row, column, and deletion commands while `docText` omits them, that all context menu actions resolve to valid registered commands, and that spreadsheet and slide targets provide their expected commands. `e2e/document-tools.spec.ts` right-clicks typed text and applies bold formatting.

---

## 8. Quick Access Toolbar

### The Rule
A Quick Access row (`src/shell/QuickAccess.tsx`) is rendered above the ribbon across all open document kinds (Document, Spreadsheet, Presentation, PDF):
- **Save**: Saves the active file (opens Save As if untitled or macro path).
- **Undo**: Undoes the previous action (in Document editor, Spreadsheet workbook, or Slide presentation).
- **Redo**: Redoes the undone action (in Document editor or Spreadsheet workbook).
- **Print**: Opens print workflow matching the ribbon print handler.

The row is hidden on Home with the ribbon and remains omitted from printed output.

### The Reason
Users need persistent, immediate access to critical file and edit history operations from anywhere in the window, even when ribbon tabs are switched or collapsed.

### The Check
`e2e/document-tools.spec.ts` clicks quick-access Save on a new document and verifies the Save As dialog appears, and clicks quick-access Undo after typing to restore the empty paragraph.

---

## 9. Document Navigation Pane

### The Rule
The View tab on the Document ribbon includes a View group with a Headings command that toggles a docked left navigation pane (`folio-outline-pane`).
- The pane lists headings 1–3 in document order with indented typography.
- Clicking a heading row positions the caret at that heading in the document editor and scrolls the view so the heading is visible.
- If the document contains no headings of level 1–3, the pane displays the localized empty state `No headings`.

### The Reason
Long-form documents require fast visual overview and one-click navigation between major sections.

### The Check
`tests/outline.test.ts` tests heading extraction. `e2e/document-tools.spec.ts` toggles the outline pane, types a heading, verifies it appears in the navigation list, clicks it, and confirms caret lands on the heading.

---

## 10. Contextual Ribbon Tabs

### The Rule
When the caret or selection in a Document is within a table or image, the ribbon dynamically surfaces contextual tabs:
- **Table**: Surfaces when the selection is inside a table, providing row actions (`Add row above`, `Add row below`, `Delete row`), column actions (`Add column left`, `Add column right`, `Delete column`), and cell/table actions (`Merge cells`, `Split cell`, `Delete table`).
- **Picture**: Surfaces when an image node is selected, providing alignment options (`Align left`, `Align center`, `Align right`) and image deletion (`Delete picture`).

When the selection leaves the table or image, the contextual tab immediately disappears, and the active tab falls back to Home if the dismissed contextual tab was currently focused.

### The Reason
Context-sensitive editing tabs keep the primary ribbon uncluttered while giving users instant access to deep object-specific manipulation tools precisely when editing those objects.

### The Check
`tests/contextual_tabs.test.ts` asserts that contextual tabs appear when table or image is active and are omitted otherwise. `e2e/document-tools.spec.ts` verifies that inserting or clicking into a table surfaces the Table tab and clicking outside dismisses it.

---

## 11. Offline Spell Check Controls

### The Rule
Offline spell checking highlights unrecognized words with red wavy squiggly underlines (`.folio-misspelling`). Right-clicking a highlighted word displays tailored spelling suggestions and an `Add to dictionary` button at the top of the context menu. Clicking a suggestion replaces the misspelled text while preserving neighbor formatting; adding the word persists it to local storage and clears the mark. The View ribbon tab provides a `Spell check` button and the status bar includes a spell check indicator button to toggle real-time spell checking on or off.

### The Reason
Users need visual spelling feedback, quick one-click corrections, and customizable vocabularies without latency, data leakage, or network dependencies.

### The Check
`tests/spell.test.ts` asserts offline suggestion generation and user dictionary persistence. `e2e/document-tools.spec.ts` types a misspelled word, observes the squiggly decoration, right-clicks to view suggestions, and applies the replacement.

---

## 12. Spreadsheet Data and Number Groups

### The Rule
The Spreadsheet Home ribbon includes:
- **Number group**: General (`General`), Number (`0.00`), Thousands (`#,##0`), Currency (`#,##0.00`), Percent (`0%`), Date (`yyyy-MM-dd`), and Time (`hh:mm`). Formats set cell `ct: { fa, t }`.
- **Data group**: Fill (`fillSheetSelection` with series or copy modes), Sort Ascending, Sort Descending, Filter toggle, AutoSum (`=SUM(...)`). Fill in series mode increments numbers or `yyyy-MM-dd` dates by the step between the first two cells (or by 1 when only one seed cell is present). In copy mode, it repeats the seed cell throughout the selected rectangle.
- **View group**: Freeze row, Freeze column, Freeze at selection (freezing rows above and columns to the left of the focused cell), and Unfreeze.

### The Reason
Office users require direct ribbon access to standard accounting and chronological number formats (including thousands comma separators and currency), predictable linear/date sequence autofill, and selection-based viewport split freezing.

### The Check
- `tests/sheet_commands.test.ts` asserts `fillSheetSelection` copy, 1–3 series, and date series, as well as `freezeAtSelectionMath`.
- `tests/spreadsheet.test.ts` asserts thousands format round-trip through xlsx.
- `e2e/sheet-tools.spec.ts` verifies filling three cells from `1`.

---

## 13. Spreadsheet Freeze at Selection and Sheet Tab Bar

### The Rule
- **Freeze at Selection**: Freezes rows above the active cell and columns to the left of the active cell (`freezeAtSelectionMath`), setting `rangeRow`, `rangeColumn`, or `rangeBoth`. Freezing on cell `(0, 0)` is a no-op.
- **Sheet Tab Bar**: Rendered at the bottom of the spreadsheet workspace. Tabs display sheet names, optional color dots (`color`), active highlights, inline double-click renaming with validation (`validateSheetName`), and drag-and-drop reordering. A `+` button appends new sheets.
- **Sheet Color Round-trip**: Serialized to XLSX via ExcelJS `worksheet.properties.tabColor = { argb }` and imported back to CSS hex.

### The Reason
Multi-sheet workbooks require direct visual management of sheet identity, color categorization, tab reordering, and custom freeze pane placement without hidden menus.

### The Check
- `tests/sheet_commands.test.ts` tests `freezeAtSelectionMath` and `validateSheetName`.
- `tests/spreadsheet.test.ts` asserts sheet `color` and order round-trip through XLSX.
- `e2e/sheet-tools.spec.ts` renames Sheet1 to Expenses from the sheet tab bar.

---

## 14. Spreadsheet Dropdown Lists (Data Validation)

### The Rule
- The Spreadsheet Data ribbon group provides a **Data Validation** command (`addSheetDataValidation`) that attaches a discrete list rule (`{ range, list }`) to the selected cell range.
- When an active cell is within a validated range, a floating dropdown picker (`[data-testid="folio-validation-dropdown"]`) appears allowing single-choice selection from the allowed items.
- Selecting an item updates both the sheet cell value and the formula bar (`#luckysheet-functionbox-cell`).
- If a cell contains an invalid value not in the permitted list, the picker highlights with an invalid value warning (`#f59e0b`).
- Validation rules round-trip through XLSX via ExcelJS cell data validations with `type: 'list'` and `formulae: ['"Item1,Item2"']`. Unsupported validation kinds (e.g. custom formulas) warn on import and leave cell values intact.

### The Reason
Constrained data entry with dropdown lists prevents errors, enforces consistency in tabular records, and aligns with ExcelJS/OpenXML spreadsheet validation patterns.

### The Check
- `tests/data_validation.test.ts` asserts range matching, valid list values, XLSX round-trip, and unsupported warning reporting.
- `e2e/sheet-tools.spec.ts` applies data validation to cell A1, opens the dropdown picker, selects a value, and checks the cell and formula input.

---

## 15. Spreadsheet Print Setup and Layout Tab

### The Rule
- The Spreadsheet ribbon includes a dedicated **Layout** tab alongside File, Home, and Insert:
  - **Page Setup group**: includes controls for Fit to Width (`fitWidth`), Repeat Header Row (`repeatHeaderRow`), Gridlines (`gridlines`), and a Print Setup dialog launcher (`[data-testid="folio-sheet-print-dialog"]`).
- `printSetup` is stored on the active sheet model (`FortuneSheetData.printSetup`) as `{ fitWidth: boolean, repeatHeaderRow: boolean, gridlines: boolean }`, defaulting to all false flags.
- **Print Setup Dialog**: Modal dialog presenting checkbox controls for Fit to Width, Repeat Header Row, and Gridlines, with Cancel and OK buttons. Canceling leaves the sheet configuration untouched; confirming commits the new setup.
- **Export & Print Fidelity**:
  - `exportPdf`: scales wide sheets to available printable width when `fitWidth` is true via `calculateFitWidthScale`; repeats header row 0 on subsequent pages when `repeatHeaderRow` is true; draws borders when `gridlines` or explicit cell borders are active.
  - `PrintView`: sets `width: 100%` and `table-layout: fixed` when `fitWidth` is enabled; wraps row 0 in `<thead style="display: table-header-group">` for repeated printing on physical pages; draws cell borders when `gridlines` is enabled.

### The Reason
Spreadsheet printing requires predictable column scaling, recurring headers across multi-page paper exports, and optional gridline visibility without altering on-screen editing data.

### The Check
- `tests/sheet_print.test.ts` asserts `calculateFitWidthScale` scaling down and capping at 1.0, and `calculateSheetPageRowSlices` header repetition on multi-page row pagination.
- `e2e/sheet-tools.spec.ts` switches to the Layout tab, opens Print Setup dialog, cancels, and asserts the sheet is unchanged.

---

## 16. Presentation Slideshow

### The Rule
- A plain slideshow can be launched from the presentation ribbon (Home tab "From Beginning" or "From Current Slide" buttons) or using keyboard shortcuts: `F5` starts from slide 1, and `Shift+F5` starts from the current active slide.
- The slideshow renders as a full-screen overlay (`[data-testid="folio-slideshow"]`) covering the workspace without ribbon or status bar.
- Slides scale dynamically to fit the viewport while preserving their aspect ratio (16:9, 16:10, 4:3).
- Slide elements render their full content: text, shapes (rectangle, rounded, oval, triangle, line) with fills/strokes, tables, images, and video.
- Keyboard navigation:
  - Advance: `Space`, `Enter`, `PageDown`, `ArrowRight`, `ArrowDown`.
  - Step back: `PageUp`, `ArrowLeft`, `ArrowUp`.
  - Exit: `Escape` or clicking the overlay's exit button (`[data-testid="folio-slideshow-exit"]`).
- Mouse navigation: clicking the right half of the slide advances; clicking the left half steps back.
- Slide transitions and animations are out of scope.

### The Reason
Users need a clean, distraction-free fullscreen presentation mode to deliver slide decks, with standard presentation clicker and keyboard controls.

### The Check
- `tests/slideshow.test.ts` asserts index calculation for beginning/current slide modes, step forward/back clamping, key handling, and half-slide click detection.
- `e2e/slide-tools.spec.ts` starts the slideshow with F5, verifies the fullscreen overlay, advances by clicking the right half, and exits with Escape.

---

## 17. Presentation Arrange (Align, Distribute, Z-Order)

### The Rule
- The Presentation ribbon Arrange group provides structural arrangement controls for slide objects:
  - **Z-Order**: Bring Forward, Send Backward, Bring to Front, and Send to Back change the depth order of the selected object in the slide element stack (`reorder`).
  - **Align**: Left, Center, Right, Top, Middle, and Bottom align multiple selected objects relative to their combined bounding box (`alignBoxes`). When a single object is selected, it aligns relative to the slide boundaries (0%, 50%, or 100%).
  - **Distribute**: Distribute Horizontally and Distribute Vertically distribute three or more selected objects evenly with equal spacing between outer edges (`distributeBoxes`).
- Multi-selection: Clicking objects with `Shift` or `Ctrl`/`Cmd` toggles multi-selection of objects on the slide canvas. Clicking canvas background clears selection.
- Right-click context menu on a slide object exposes Duplicate, Delete, Bring Forward, and Send Backward.

### The Reason
Precise spatial alignment, distribution, and layering are essential for creating professional slide decks without tedious manual pixel nudging.

### The Check
- `tests/slide_geometry.test.ts` asserts alignment to min/mid/max bounding coords, horizontal and vertical even gap distribution, and depth reordering.
- `tests/context_menu.test.ts` asserts slide object context menu contains duplicate, delete, bringForward, and sendBackward.
- `e2e/slide-tools.spec.ts` inserts objects, reorders them, and tests context menu and alignment.

---

## 18. Presentation Snap and Guides

### The Rule
- The slide canvas supports 2% coordinate grid snapping (`snapBox`) when dragging and positioning slide objects.
- When an object's horizontal or vertical center aligns within 1% of the 50% slide midpoint, the position automatically snaps to the exact center, and visual dashed center guide lines (`[data-testid="snap-guide-vertical"]` / `[data-testid="snap-guide-horizontal"]`) appear on the canvas to signal center alignment.
- The View tab and Home Arrange group on the Presentation ribbon include a **Snap to Grid** toggle (`commands?.current?.toggleSnapToGrid`), allowing users to turn off snapping when freeform placement is desired.

### The Reason
Precise object alignment against the slide center and uniform grid stops prevents misaligned elements and gives slide layouts clean symmetry.

### The Check
- `tests/slide_snap.test.ts` asserts 2% grid clamping, 1% slide center snapping (horizontal and vertical), and snap toggle disabling.

---

## 19. Presentation Slide Layouts

### The Rule
- The New Slide button in the Presentation ribbon includes a layout dropdown picker (`[data-testid="folio-slide-layout-dropdown"]`) offering 4 standard slide layouts (`createSlideLayout`):
  - **Title Slide** (`layoutTitle`): Large centered title (fontSize 44) and centered subtitle (fontSize 24).
  - **Title and Content** (`layoutTitleContent`): Slide title (fontSize 36) and single wide body content block (fontSize 20).
  - **Two Content** (`layoutTwoContent`): Slide title (fontSize 36) and two side-by-side columns (each 38% width).
  - **Blank** (`layoutBlank`): Empty canvas with zero elements.
- Clicking the main New Slide button defaults to creating a Title and Content layout.

### The Reason
Presenters structure different slides around distinct communicative goals (introductions, comparisons, bullet lists, or visual freeform), requiring standard layout archetypes.

### The Check
- `tests/slide_layouts.test.ts` asserts element counts, positions, font sizes, and column geometry across all 4 layout archetypes.
- `e2e/slide-tools.spec.ts` opens the layout dropdown, chooses Two Content, and verifies 3 elements are created.

---

## 20. Presentation Slide Sorter and Local Palettes

### The Rule
- Presentations support two view modes: **Normal View** (left slide thumbnail strip, central canvas, notes pane) and **Slide Sorter** (`[data-testid="folio-slide-sorter"]`), accessible from the View tab on the Presentation ribbon.
- In Slide Sorter mode, slides are displayed in a responsive grid of slide cards showing preview element placement. Clicking any card selects that slide, exits Sorter mode, and focuses the slide in Normal view.
- The View tab includes a **Palettes** group offering three built-in offline color palettes (`applyPalette` in `src/slides/palettes.ts`):
  - **Paper**: Warm cream background (`#faf8f5`), slate text (`#2d3748`), warm accent (`#d97706`).
  - **Ink**: Dark slate background (`#1e2022`), crisp light text (`#f8fafc`), ice blue accent (`#38bdf8`).
  - **Teal**: Pale mint background (`#f0fdfa`), dark green-slate text (`#134e4a`), teal accent (`#0d9488`).
- Palettes execute 100% locally on the presentation model without external network access or CDN dependencies.

### The Reason
Slide decks benefit from high-level thumbnail overview when restructuring or reviewing sequence, and unified styling palettes ensure consistent branding and visual appeal across slides without manual color-by-color adjustments.

### The Check
- `tests/slide_palettes.test.ts` asserts color and background transformations across all three palettes.
- `e2e/slide-tools.spec.ts` toggles Slide Sorter view, selects a slide to return to normal view, and verifies Teal and Ink palette color applications.

---

## 21. Backstage File Pane

### The Rule
- Clicking the **File** tab (`activeTab === 'file'`) opens the **Backstage** view (`src/shell/Backstage.tsx`, `[data-testid="folio-backstage"]`), a full-window view replacing the ribbon and editor workspace. (PDF reader retains its compact toolbar view to preserve viewer layout).
- The left rail displays:
  - Circular Back button (`[data-testid="folio-backstage-back"]`) or pressing Escape returns to the active document.
  - Primary navigation: **Info** (`[data-testid="backstage-nav-info"]`), **New** (`[data-testid="backstage-nav-new"]`), and **Open** (`[data-testid="backstage-nav-open"]`).
  - File commands: **Save**, **Save As**, **Export PDF** (or **Edit as Document** for PDF), **Print**, **Close**, and **Settings**.
- The main content area adapts dynamically to the selected rail section:
  - **Info**: displays file title, location, format badge, and document statistics (word count and page count for Documents; sheet count for Spreadsheets; slide count for Presentations).
  - **New**: displays blank starters (Blank Document, Blank Spreadsheet, Blank Presentation) and local template cards.
  - **Open**: displays device file browser button, recovered drafts, and recent files list.

### The Reason
Centralizing document lifecycle commands, properties, statistics, templates, and file system navigation in a dedicated full-window Backstage mirrors the expected Office suite workflow and keeps everyday editing ribbons focused strictly on document content.

### The Check
- `tests/backstage.test.tsx` asserts rendering of Info properties and statistics across document kinds, rail navigation between sections, Back and Escape key exit behavior, blank document creation, and action triggers.

---

## 22. Local Offline Templates

### The Rule
- The application ships 2 built-in local offline templates per document kind (6 total, located in `src/templates/index.ts`):
  - **Document**:
    - *Project Report* (`doc-report`): Executive summary, deliverables progress, and action items table.
    - *Professional Resume* (`doc-resume`): Candidate header, experience details, bullet points, and education.
  - **Spreadsheet**:
    - *Monthly Budget* (`sheet-budget`): Expense categories, planned vs actual columns, and difference formulas (`=B2-C2`).
    - *Commercial Invoice* (`sheet-invoice`): Header details, itemized table with quantities, unit prices, and row multiplication formulas (`=B5*C5`).
  - **Presentation**:
    - *Pitch Deck* (`pres-pitch`): 3-slide startup pitch (Title, Problem & Solution comparison, Market opportunity).
    - *Business Review* (`pres-report`): 3-slide quarterly review (Title, Key performance metrics, Strategic roadmap).
- Choosing any template in Backstage opens a new dirty, untitled tab without a save path (`isDirty: true`, `path: undefined`), allowing immediate editing and saving.

### The Reason
Users starting common office tasks need pre-formatted boilerplate with sensible layouts and formulas, without downloading untrusted remote templates or phoning home.

### The Check
- `tests/templates.test.ts` asserts template registration counts, structure, node contents, formula definitions, slide counts, and localization keys.

---

## 23. Command Search ("Tell me what you want to do")

### The Rule
- A dedicated command search input (`src/shell/CommandSearch.tsx`, `[data-testid="folio-command-search-input"]`) is integrated into the ribbon title bar.
- Global keyboard shortcuts `Alt+Q` and `Ctrl+Q` focus the input and open the command search dropdown.
- Queries are matched against registered commands in `src/shell/commands.ts` using both translated command labels and command identifiers, filtered by the active document kind.
- Navigating with ArrowDown/ArrowUp and pressing Enter or clicking runs the command in the active context and closes search. Pressing Escape dismisses the dropdown.

### The Reason
Natural-language search over office capabilities allows quick discoverability and execution of complex ribbon features without navigating tab hierarchies.

### The Check
- `tests/command_search.test.tsx` asserts kind filtering, label and id matching, input rendering, results list display, keyboard navigation (ArrowDown, Enter, Escape), and command execution.

---

## 24. Key Tips (Alt Ribbon Navigation)

### The Rule
- Pressing `Alt` activates Key Tips badge mode (`src/shell/keyTips.ts`):
  - In tabs mode, badges appear on ribbon tabs (`F` for File, `H` for Home, `I` for Insert, `L` for Layout, `V` for View) and on the quick-access toolbar (`1` for Save, `2` for Undo, `3` for Redo, `4` for Print).
  - Pressing a tab letter activates that tab and enters command mode, displaying command badges (e.g. `B` for Bold, `I` for Italic, `U` for Underline).
  - Pressing a command badge letter executes that command and exits key tips.
  - Pressing `Escape` in command mode steps back one level to tab badges; a second `Escape` exits key tips entirely.

### The Reason
Comprehensive keyboard accessibility across the ribbon interface allows mouse-free power user navigation adhering to established office navigation conventions.

### The Check
- `tests/key_tips.test.ts` asserts badge mappings, tab activation, command execution, quick access triggering, and two-level Escape step-back behavior.

---

## 25. Adaptive Mini Toolbar

### The Rule
- Selecting text in a Document displays a floating micro-toolbar (`src/shell/MiniToolbar.tsx`, `[data-testid="mini-toolbar"]`) positioned directly adjacent to the selection bounding box.
- The toolbar features rapid-access controls: font size select, bold, italic, underline, highlight, clear formatting, and format painter.
- The mini toolbar automatically dismisses on selection collapse, document scroll, Escape key, or when opening the right-click context menu.
- Mouse clicks on toolbar actions do not blur or collapse the active text selection.

### The Reason
Reduces cursor travel to the top ribbon by up to 60% during everyday prose drafting and formatting.

### The Check
- `tests/mini_toolbar.test.tsx` validates toolbar rendering upon text selection, formatting command dispatch, and Escape dismissal.

---

## 26. Status Bar Zoom Presets & Live Save Timestamp

### The Rule
- The Status Bar (`src/shell/StatusBar.tsx`) includes an interactive zoom percentage button (`[data-testid="status-zoom-btn"]`) alongside the continuous range scrubber.
- Clicking the percentage label reveals a popover (`src/shell/ZoomPopover.tsx`, `[data-testid="zoom-popover"]`) offering standard zoom presets (50%, 75%, 100%, 125%, 150%, 200%) plus document-specific Page Width and Whole Page viewport presets.
- The disk status indicator reports live saving state: a subtle pulse indicator during active draft writes (`status.saving`), an amber alert for unsaved edits (`status.unsaved`), and a formatted timestamp (`status.savedAt`) upon clean disk/draft synchronization.

### The Reason
Provides instant visibility into local document persistence and rapid switching between detail inspection and bird's-eye layout views.

### The Check
- `tests/zoom_popover.test.tsx` validates preset selection, document width/whole page calculations, and live timestamp rendering in the status bar.

---

## 27. Presentation Presenter Laser Pointer

### The Rule
- Fullscreen slideshow mode (`src/slides/Slideshow.tsx`) includes a virtual laser pointer feature.
- Toggled via the `L` key or the target button in the presentation HUD (`[data-testid="slideshow-laser-btn"]`).
- When active, the standard mouse cursor is replaced by a high-visibility glowing red dot (`[data-testid="slideshow-laser"]`) with soft glow and coordinate tracking across the slide stage.

### The Reason
Enables presenters to highlight slide elements during full-screen presentations without relying on third-party remote hardware.

### The Check
- `tests/slideshow.test.ts` tests `L` key recognition and HUD laser controls.

---

## 28. Keyboard Shortcut Reference Panel

### The Rule
- Pressing `?` when keyboard focus is outside editable text inputs or clicking the shortcuts command opens a modal reference palette (`src/shell/ShortcutPanel.tsx`, `[data-testid="shortcut-panel"]`).
- Shortcuts are grouped by category (General, Navigation, Formatting) and filterable via real-time search input.
- Pressing Escape or clicking the close button dismisses the overlay.

### The Reason
Empowers users to discover keyboard productivity accelerators without leaving the application context.

### The Check
- `tests/shortcut_panel.test.tsx` asserts categorized shortcut listings, search query filtering, and modal lifecycle.






