import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importDocx } from '../src/document/docx/importer';
import { exportDocx } from '../src/document/docx/exporter';
import { importXlsx, exportXlsx } from '../src/spreadsheet/adapters';
import { importPptx, exportPptx } from '../src/slides/pptxAdapter';

const corpusDir = process.env.FOLIO_COMPAT_DIR;
const extensions = new Set(['.docx', '.xlsx', '.pptx']);

function normalizedText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

describe.skipIf(!corpusDir)('private compatibility corpus', () => {
  it('keeps supported content through an in-memory round trip', async () => {
    const files = fs.readdirSync(corpusDir!).filter((name) => extensions.has(path.extname(name).toLowerCase()));
    expect(new Set(files.map((name) => path.extname(name).toLowerCase()))).toEqual(extensions);

    for (const name of files) {
      const bytes = fs.readFileSync(path.join(corpusDir!, name));
      const input = Uint8Array.from(bytes).buffer;
      if (name.toLowerCase().endsWith('.docx')) {
        const first = await importDocx(input, name);
        const saved = await exportDocx(first.html, first.pageSetup, first.chrome, first.footnotes);
        const second = await importDocx(await saved.arrayBuffer(), name);
        expect(normalizedText(second.html), name).toBe(normalizedText(first.html));
      } else if (name.toLowerCase().endsWith('.xlsx')) {
        const first = await importXlsx(input, name);
        const saved = await exportXlsx(first.sheets);
        const second = await importXlsx(await saved.arrayBuffer(), name);
        expect(second.sheets.length, name).toBe(first.sheets.length);
        const values = (sheets: typeof first.sheets) => sheets.map((sheet) =>
          (sheet.data || []).map((row) => (row || []).map((cell) => cell ? { v: cell.v, f: cell.f } : null))
        );
        expect(values(second.sheets), name).toEqual(values(first.sheets));
      } else {
        const first = await importPptx(input, name);
        const saved = await exportPptx(first.presentation);
        const second = await importPptx(await saved.arrayBuffer(), name);
        expect(second.presentation.slides.length, name).toBe(first.presentation.slides.length);
        const text = (slides: typeof first.presentation.slides) => slides.map((slide) =>
          slide.elements.map((element) => element.text || '').join(' ')
        );
        expect(text(second.presentation.slides), name).toEqual(text(first.presentation.slides));
      }
    }
  });
});
