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

