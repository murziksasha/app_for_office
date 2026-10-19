# Grill: Save as PDF, and edit a PDF as a Document
Date: 2026-10-19

## Intent

Folio can already open a PDF and draw its pages. Save writes those original bytes back. Print hands the page to the system dialog.

Two additions:

- **Save as PDF** writes a new `.pdf` from the Document, Spreadsheet, or Presentation you are editing.
- **Edit as Document** takes the selectable words out of an open PDF and opens them as a new Document. That Document can then be saved as a PDF.

The PDF you opened stays a reader. Its bytes are not rewritten.

## Decisions

- Edit means words. pdf.js text is grouped into lines and paragraphs and stored as plain paragraphs in the document model. Columns, tables, headings, lists, images, headers, and footers from the PDF are not reconstructed. A two-column page may interleave. Headers and page numbers stay in the text.
- The import report always says the layout was discarded and the reading order may be wrong. Pages with no selectable text are skipped and named on that report. If every page is empty, or the grouping yields no paragraphs, the PDF tab stays put and Folio says there is nothing to edit.
- Scans and image-only pages are empty pages. No OCR.
- A password-protected or otherwise unreadable PDF does not get a password prompt. The reader shows that it is protected or unreadable. Edit as Document stays unavailable.
- Edit as Document is an explicit command. It opens a second tab: a new Document, format `docx`, dirty, no path and no handle, named from the PDF (`Notes.pdf` → `Notes`, using the existing unique-name helper). The PDF tab is unchanged and still saves the original bytes.
- Save as PDF is a File command on Document, Spreadsheet, and Presentation, including a Document created by Edit. It is absent on the PDF reader. Print is unchanged.
- The command always asks for a path, builds the complete PDF in memory, then writes it. The tab's path, format, name, and dirty flag stay as they were. Cancelling the dialog does nothing. A failure while reading the model, or a failure of the write, leaves no file.
- Missing glyphs and images that cannot be embedded are left out. The PDF is still written, and Folio says what was omitted.
- Paper is fixed. Documents and spreadsheets are US Letter portrait. Slides are US Letter landscape, one slide per page, scaled uniformly onto the page. No paper picker.
- A wide sheet or document table shrinks to the page width. Sheet rows continue on the next page. Columns are not tiled and not dropped. Very small type is accepted. Sheet cells are one line of the displayed value (`m`, otherwise `v`). Formula strings are not written.
- The written PDF uses one shipped font covering Latin, Greek, and Cyrillic (Noto Sans, OFL), embedded and subset. No font is downloaded at runtime. CJK and other scripts can be missing. Right-to-left layout is not attempted.
- Document export includes headings, paragraphs, lists, tables, images, bold, italic, underline, and page breaks. Link text is kept and the URL is dropped. Strikethrough, text color, highlight, font family, font size, alignment, and indent are not written.
- Spreadsheet and slide scope reuse the print question: Active sheet or All sheets, All slides or This slide. One unit skips the question. Cancel writes nothing.
- Slide text, images, and rectangles are placed from the model, including element color, fill, and background. Document and sheet colors are not written. Sheet bold and italic are written.

## Out of scope

- Native PDF vector editing, moving boxes, annotations, highlights, comments, and page add, delete, or reorder.
- OCR, a password prompt, and a remembered password.
- Writing the extracted Document back over the original PDF.
- Making Save as PDF the tab's save path, or adding PDF to the normal Save As format list.
- CJK fonts, right-to-left layout, a paper-size picker, column tiling, and header stripping.
- Changing Print.

