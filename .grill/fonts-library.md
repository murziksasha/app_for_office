# Grill: 120 built-in fonts and persistent custom fonts
Date: 2026-11-01

## Intent

Documents, Spreadsheets, and Presentations share one font library on Windows desktop and in the browser. The library has 120 bundled open-source families, searchable previews, and custom `.ttf` / `.otf` imports that stay on the machine.

## Decisions

- Vendor 120 distinct families from one pinned Google Fonts revision, with each family's license and a hash of every bundled face. Every bundled face must cover the Ukrainian alphabet, basic Latin, digits, and common punctuation.
- Seed the collection, in this order, with Noto Sans, Noto Serif, Noto Sans Mono, Inter, Roboto, Open Sans, Montserrat, Manrope, Fira Code, and Source Serif 4. Fill the remaining places by cycling serif, sans-serif, monospace, display, and handwriting in alphabetical family order. Skip ineligible families. Skip a category once it is exhausted.
- Bundle the regular face and the bold, italic, and bold-italic faces when those variants exist and pass the same glyph check. Build static faces from variable fonts when the family has no static file. Load a face only when content or a visible preview needs it.
- Editor models keep canonical family names. Font bytes live outside the document. One resolver serves all three editors.
- `PlatformAdapter` gains multi-file font picking and font storage. Desktop copies imports into an app-data font directory through Rust commands. The source path must already be on the session allow-list. The browser stores custom fonts in IndexedDB. Desktop and browser libraries are separate and are not synced.
- The browser prefetches the bundled pack in the background, with progress and a retry when a fetch fails. Editing stays available while that runs. After the pack is cached, bundled fonts keep working if the network drops, for as long as the app remains open. No service worker is added.
- The Document font control becomes a searchable picker. Spreadsheet and Presentation get the same control. The picker has Ukrainian and Latin previews, category filters, eight recent families, and **Add fonts…**. Opening it does not discard the editor selection.
- Settings has a Fonts section: multi-file import, previews, coverage labels, and removal of custom families. Built-in families are read-only.
- An import reads the family and style from the file, groups complementary styles, skips a byte-identical duplicate, and reports a conflicting face without replacing the stored one. Custom fonts may cover only part of the required letters, and the UI says so. Malformed files and containers other than `.ttf` and `.otf` are rejected. Nothing is uploaded.
- Applying a family changes document text and header or footer runs, selected spreadsheet cells, and selected presentation text boxes, shape text, and tables. Format painter carries the family. The presentation ribbon shows the selected family's name.
- A new Document starts in Noto Serif. A new Spreadsheet or Presentation starts in Noto Sans. Opening an existing file keeps the families already stored in it.
- A missing or removed family name stays in the file, draws with a bundled fallback, and shows a localized warning. Importing that family again restores the drawing and does not rewrite the content.
- The picker is keyboard accessible, closes on Escape, and uses English and Ukrainian labels. It fits the light theme, the dark theme, and the minimum desktop window.
- Family names round-trip through DOCX, ODT, RTF, HTML, XLSX, PPTX, and the existing format aliases. Plain-text formats keep their current formatting limits. ODT, RTF, and PPTX write and read the family name.
- PDF export embeds the faces it is allowed to embed, using the existing pdf-lib and fontkit path, and measures wrapping with that face. An embedding restriction, a missing family, or a missing style is named on the existing export report. PDF uses the nearest real face when a style is missing and says that it did. A glyph the selected face lacks is taken from a bundled fallback. Text is not dropped without a report. Editable files store names only and do not embed font files.
- Print, PDF export, and layout measurement wait until the required faces are loaded. Pagination and spreadsheet measurement refresh after those faces load.
- On screen, a missing bold or italic may be simulated. PDF does not simulate a style by shearing or thickening a face.

## Out of scope

- A hard cap on installer size.
- Syncing fonts between desktop and browser, or between machines.
- Listing fonts installed on the operating system.
- Importing a font from a URL.
- Variable-axis controls in the ribbon.
- A service worker or any other offline shell for the application itself.
