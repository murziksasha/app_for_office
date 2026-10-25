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
The ribbon is a tab row plus a strip of labeled instrument groups. Each group shows its tools on top and a caption underneath: Clipboard, Font, Paragraph, Styles, and the other captions for that tab.

Tabs follow the open file:

- Document: File, Home, Insert, Layout.
- Spreadsheet: File, Home, Insert. FortuneSheet’s own toolbar stays hidden. The formula bar and sheet tabs stay.
- Presentation: File, Home, Insert. Slide, text, picture, video, and shape commands live here. The thumbnail rail stays beside the canvas.
- PDF: File only. Page navigation stays on the viewer.

File groups are New, Open, Save, and Print. Save as PDF is absent on a PDF tab. Edit as Document is present on a PDF tab. Drafts and recent files stay listed under the File groups.

A chevron at the right of the tab row collapses the tool strip. Tab names stay. Clicking the active tab also collapses it. Clicking any tab while the strip is hidden selects that tab and shows its tools. PDF’s only tab is File, so collapsing hides the File pane until File is clicked again. The choice is stored on this machine as `folio_ribbon_collapsed` (`1` or `0`) and restored the next time the ribbon mounts.

The Home header and the editor title bar, before Save, share a language control. The button shows `EN` or `UA` for the language in use. Its tooltip names the other language. One click switches every Folio-owned label immediately. Document, cell, and slide text stays as written. The last choice is stored as `folio_ui_lang` and wins over detection on the next launch. With no saved choice, the desktop build reads the Windows country and starts in Ukrainian when that country is `UA`. Any other country follows the Windows display language. The browser build uses `navigator.language`.

The ribbon does not include dictation, designer assistance, add-ins, sharing, ink drawing, transitions, animations, a presenter view, mailings, or comments.

On a document, the Layout tab sets the page size and the four margins as numbers. The same margins are sliders on the page: a horizontal ruler above the sheet for the left and right margins, and a vertical ruler beside the first page for the top and bottom margins. English shows inches. Ukrainian shows centimeters. The stored unit is millimeters. Print uses those margins as the page margin. RTF, plain text, Markdown, and HTML keep the setup for the session and for drafts; their file bytes do not store a page box. The Layout tab also controls headers and footers with a "Different first page" switch and "Page number" insertion (digit `1` or `Page 1 of 8`). On-screen page margins paint the resolved header and footer stories with a quiet localized hint when empty; clicking a band allows inline editing outside the body editor while Home font and paragraph alignment controls follow the caret.

### The Reason
People expect writing tools in one place, grouped the way the rest of an office app groups them. A second toolbar inside the sheet or above the slide duplicates that and hides commands that already exist.

### The Check
`e2e/smoke.spec.ts` expects the document captions Clipboard, Font, Paragraph, and Styles, a presentation New slide control that adds a thumbnail, and a spreadsheet ribbon that shows Font and Number with FortuneSheet’s toolbar absent. It also collapses the ribbon, reloads, and checks that the tools stay hidden, then switches the language control to Ukrainian and expects `Основне` while the typed document text stays unchanged. Those smoke tests set `folio_ui_lang=en` before they look for English labels.
