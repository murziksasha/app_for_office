# Folio

Local-first office app. Windows desktop is Tauri 2 (`src-tauri`). The browser build is Vite on port 5188, using the File System Access API with a download fallback. There is no PWA manifest and no service worker. Files stay on the machine: no accounts, telemetry, or uploads.

`spec/` holds the long product rules. Open a spec only when the task changes that area. This file is the working constraint for every edit.

## Rules

- Sanitize HTML in `src/document/sanitize.ts` (DOMPurify) before parse or render. `EditorState` holds Tiptap `JSONContent`, FortuneSheet sheets, or `PresentationModel`. HTML stays inside adapters.
- Reject `.doc`, `.xls`, `.ppt`, and OLE headers (`D0 CF 11 E0`) in `src/files/detect.ts`. Do not add a binary parser. Keep the messages already in that file.
- `.docm`, `.xlsm`, `.pptm`: import the body, strip macros, set `isMacroFile`, and warn on `ImportReport`. Never execute macros.
- Do not send document bytes, analytics, or identifiers over the network. Do not add remote script or font hosts. The PDF.js worker stays bundled.
- New UI copy says Document, Spreadsheet, or Presentation. Do not add Word, Excel, PowerPoint, or Microsoft. A few dialog filters and MIME strings already use those names; do not copy them into new UI.
- No Electron. Editors (`src/document`, `src/spreadsheet`, `src/slides`, `src/pdf`) must not import `@tauri-apps/*` or `src/platform/desktop.ts`. Host and OS I/O go through `src/platform`.
- Desktop disk I/O goes through the Rust commands in `src-tauri/src/lib.rs`. `folio_read` and `folio_write` allow only paths added this session: open dialog, save dialog, an existing CLI file arg, a window drop, or `folio_allow_path`.

## Where to change things

- Shell and file flow: `src/App.tsx`, `src/shell/`, `src/files/open.ts`, `src/files/save.ts`.
- Platform: `src/platform/types.ts` (`PlatformAdapter`), `desktop.ts`, `browser.ts`, `index.ts`. `__TAURI_INTERNALS__` selects the desktop adapter.
- Formats: `src/files/detect.ts`, then `src/document/`, `src/spreadsheet/adapters.ts`, `src/slides/pptxAdapter.ts`, `src/pdf/PdfViewer.tsx`.
- Drafts and recents use IndexedDB (`idb-keyval`). Drafts use `folio_draft_*` and save 1.5s after a dirty edit. Recents use `folio_recent_files` (browser handle or desktop path).
- Rust commands live in `src-tauri/src/lib.rs` (crate `folio_lib`). `src-tauri/src/main.rs` only calls `folio_lib::run()`.

## Desktop (already built)

Window is `1280×800`, minimum `960×640`. The installer is NSIS. WebView2 uses `downloadBootstrapper`. App id is `app.folio.local`. A second launch focuses `main` and emits `folio://open-file` with the path. Startup CLI file args are allow-listed. Drops are allow-listed in Rust, then read by `DesktopPlatformAdapter`. Save writes the existing path with `folio_write` and calls `folio_pick_save` only when there is no path. The title is `Folio - {name}`, with ` *` when dirty. Closing with unsaved edits asks, then destroys the window.

Shell associations, and no others: `docx odt rtf txt md html htm xlsx csv tsv pptx pdf`.

IPC: `folio_pick_open`, `folio_pick_save`, `folio_read`, `folio_write`, `folio_allow_path`.

### Adding a desktop feature

1. Add the command in `src-tauri/src/lib.rs` and register it in `generate_handler!`. If it takes a path, check `AppState::is_allowed` first.
2. Add the method on `PlatformAdapter`. Implement it in `desktop.ts` with `tauriInvoke`. Give `browser.ts` a real fallback or an explicit no-op. Export it from `src/platform/index.ts`.
3. Call it from `App.tsx` or `src/shell/`. Do not call Tauri from an editor.
4. Do not add a plugin that phones home. `app.security.csp` is null; do not open it to the network.
5. Register file types only in `src-tauri/tauri.conf.json` `bundle.fileAssociations`, and only for formats Folio already opens.

## Formats

| Ext | In | Out | Engine |
| --- | --- | --- | --- |
| docx | yes | yes | JSZip + fast-xml-parser; mammoth if that parse fails; write with `docx` |
| odt | yes | yes | ZIP/XML (`content.xml`) |
| rtf | yes | yes | tokenizer / writer |
| txt, md, html | yes | yes | text; markdown-it + DOMPurify in, turndown out |
| xlsx, csv, tsv | yes | yes | ExcelJS ↔ FortuneSheet; RFC 4180 for csv/tsv |
| pptx | yes | yes | slide XML in; pptxgenjs out |
| pdf | yes | no | pdfjs-dist |

To add a format: sniff it in `detect.ts`, import into the in-app model, export from that model, add a fixture under `fixtures/`, and add a Vitest file under `tests/`. Open and save go through `src/files/open.ts` and `save.ts` only.

## Commands

`npm run dev` (port 5188) · `npm test` · `npm run test:e2e` · `npm run build` · `npm run desktop` · `npm run desktop:build` (NSIS under `src-tauri/target/release/bundle/nsis/`). The `@` alias maps to `src/`.

## Out of scope

Collaboration and cloud sync. Pivot tables and live charts. Slide animation and sound. PDF editing. Office 97–2003 binary parsers. Macro runtimes.
