# Folio Specifications

This directory contains the normative specifications for the **Folio** application.

## Rule of Authority

1. **Normative Precedence**: When implementation code or casual comments disagree with the specifications in this directory, the code is considered defect-laden and must be updated to conform to these specifications.
2. **Structure of Every Rule**: Each specification document provides definitive rules formatted with:
   - **The Rule**: Exact constraint, invariant, or architectural boundary.
   - **The Reason**: Threat model, user experience guarantee, or engineering stability rationale.
   - **The Check**: Automated test, static check, or deterministic build step proving compliance.

## Specification Index

- [`product.md`](./product.md) — Product mission, supported format matrix, and explicit non-goals.
- [`architecture.md`](./architecture.md) — Shell, platform abstraction, editor engines, and byte-to-model data flow.
- [`document-model.md`](./document-model.md) — Structured in-memory models (Tiptap JSONContent, FortuneSheet, PresentationModel).
- [`file-pipelines.md`](./file-pipelines.md) — Per-format read/write pipelines, mammoth fallback, and skipped feature tracking.
- [`shell.md`](./shell.md) — Start screen, ribbon tabs, status bar, drafts, keyboard shortcuts, and close guard.
- [`security.md`](./security.md) — DOMPurify sanitization, VBA macro neutralization, legacy binary refusal, path allow-list, and offline guarantee.
- [`desktop-windows.md`](./desktop-windows.md) — Tauri 2 desktop shell, native dialogs, file associations, single-instance forwarding, and NSIS installer.
- [`ui.md`](./ui.md) — Visual styling (warm paper, ink typography, teal accents), iconography, and brand independence.
- [`testing.md`](./testing.md) — Test pyramid, unit tests per adapter, Playwright smoke suite, and desktop build validation.

