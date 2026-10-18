# Security Specification

## 1. Content Sanitization (DOMPurify)

### The Rule
All markup originating outside the memory space of the editor canvas must be sanitized using `DOMPurify` before DOM parsing or insertion.
- The sanitizer explicitly permits safe typographic, structural, and tabular tags (`p`, `h1`-`h6`, `strong`, `em`, `u`, `table`, `img`, `a`, etc.).
- `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers (`onload`, `onerror`), and `javascript:` URIs are strictly stripped.

### The Reason
Prevents Cross-Site Scripting (XSS) and code injection attacks via maliciously crafted `.docx`, `.html`, or `.rtf` files.

### The Check
`tests/open_save.test.ts` test `"htmlToDocument drops a <script> tag safely"` proves that injected `<script>` tags and `onerror` handlers are removed.

---

## 2. Macro Handling

### The Rule
VBA macro streams within `.docm`, `.xlsm`, and `.pptm` files are never parsed or executed.
- When a macro-enabled container is opened, the editor ignores the `vbaProject.bin` stream.
- An informative warning is logged in the `ImportReport`: `"VBA Macros: Embedded macro code was safely ignored and will not execute."`
- The file is saved back as a clean Open XML document without macro payloads.

### The Reason
Macros are a primary vector for malware distribution; an office tool without macro execution provides safe document inspection.

### The Check
`tests/detect.test.ts` and `src/files/open.ts` verify that `isMacroFile: true` produces a non-fatal warning in `ImportReport`.

---

## 3. Legacy Binary Rejection

### The Rule
Office 97–2003 binary files (`.doc`, `.xls`, `.ppt`) are rejected immediately during sniffing with an explicit user error:
`"Legacy Office binary format (.doc, .xls, .ppt) cannot be opened directly. Please save the file as modern .docx, .xlsx, or .pptx."`

### The Reason
Binary OLE compound document structures contain numerous security vulnerabilities and complex reverse-engineered schemas that compromise stability.

### The Check
`tests/open_save.test.ts` verifies that `sample_binary.doc` triggers this exact rejection error.

---

## 4. Desktop File System Allow-List

### The Rule
On desktop, file reading and writing occurs exclusively through Rust commands in `src-tauri`.
- The Rust process maintains an in-memory `HashSet<PathBuf>` session allow-list.
- Paths are added to the allow-list ONLY when:
  1. Picked by the user in `folio_pick_open`.
  2. Selected by the user in `folio_pick_save`.
  3. Dropped by the user onto the window (via Tauri file-drop event).
  4. Passed as command-line arguments on initial launch or second launch.
- `folio_read` and `folio_write` verify that the target path is present in the allow-list before opening a file handle. Unlisted paths return `Err("Access denied")`.

### The Reason
Prevents malicious web scripts or compromised dependencies from arbitrary reading or overwriting user files on the filesystem.

### The Check
`src-tauri/src/main.rs` contains the `AppState.is_allowed` check guarding all `folio_read` and `folio_write` calls.

