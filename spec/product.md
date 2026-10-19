# Product Specification

## 1. Product Mission

### The Rule
Folio is a private, local-first office application designed for everyday authoring and reading of documents, spreadsheets, presentations, and PDFs. User files reside exclusively on the user's personal computer and are never uploaded, analyzed, or synchronized to external cloud services.

### The Reason
Users require a fast, distraction-free office suite that respects privacy, opens immediately without mandatory account sign-ins, and functions identically offline.

### The Check
Automated network activity auditing confirms zero outgoing HTTP requests, web sockets, or remote telemetry during application runtime.

---

## 2. Supported Formats Matrix

### The Rule
Folio must support opening and saving the following formats according to their capabilities:

| Format | Category | In | Out | Fallback / Engine |
| --- | --- | --- | --- | --- |
| `.docx` | Document | Yes | Yes | Custom XML parser; Mammoth fallback on read; docx builder on write |
| `.odt` | Document | Yes | Yes | Custom ZIP/XML parser and builder |
| `.rtf` | Document | Yes | Yes | RTF tokenizer/parser and RTF serializer |
| `.txt` | Document | Yes | Yes | UTF-8 text decoder/encoder |
| `.md` | Document | Yes | Yes | markdown-it on read; Turndown on write |
| `.html`, `.htm` | Document | Yes | Yes | DOMPurify parser on read; HTML serializer on write |
| `.xlsx` | Spreadsheet | Yes | Yes | ExcelJS workbook parser and exporter |
| `.csv` | Spreadsheet | Yes | Yes | RFC 4180 CSV parser and serializer |
| `.tsv` | Spreadsheet | Yes | Yes | Tab-delimited parser and serializer |
| `.pptx` | Presentation | Yes | Yes | Open XML slide parser; PptxGenJS exporter |
| `.pdf` | Viewer | Yes | No | PDF.js rendering canvas (viewer in, original bytes out) |

Binary Office 97–2003 formats (`.doc`, `.xls`, `.ppt`) and macro-enabled files (`.docm`, `.xlsm`, `.pptm`) are handled as restricted formats:
- Legacy binaries must be refused with an explicit diagnostic message instructing the user to convert to modern Open XML.
- Macro-enabled files may be imported for viewing and editing, but their macro code is stripped and never executed.

### The Reason
Supporting modern open standards (Open XML, ODF, plain text, RFC 4180) ensures interoperability with modern operating systems and productivity applications without burdening the codebase with legacy binary OLE compound file parsers.

### The Check
`tests/detect.test.ts`, `tests/open_save.test.ts`, and `tests/docx.test.ts` verify correct classification, reading, writing, and rejection.

---

## 3. Explicit Non-Goals

### The Rule
The following capabilities are explicitly outside the scope of Folio:
1. Real-time multiplayer collaborative editing.
2. Embedded interactive 3D charts and dynamic OLAP pivot tables.
3. Complex slide entrance/exit animations, timing curves, and media triggers.
4. Native PDF vector editing, page restructuring, annotation, and OCR. (Edit as Document extracts selectable text into a new Document tab, and Save as PDF exports a new PDF from Document, Spreadsheet, or Presentation; the opened PDF reader remains viewer-only, writing original bytes back).
5. Macro scripting engines (VBA, VBScript, Python macros).
6. Cloud storage synchronization servers or proprietary account management.

### The Reason
Folio prioritizes reliability, lightweight execution, clean boundaries, and offline longevity over complex, maintenance-heavy enterprise features.

### The Check
Codebase review verifies no WebRTC, WebSocket collaboration servers, or VBA interpreters exist in the dependencies or source tree.

