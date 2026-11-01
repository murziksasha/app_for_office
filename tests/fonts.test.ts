import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import fontkit from '@pdf-lib/fontkit';
import catalogJson from '../src/fonts/catalog.json';
import type { FontCatalogFile } from '../src/fonts/types';

const catalogFile = catalogJson as FontCatalogFile;
import { REQUIRED_FONT_TEXT } from '../src/fonts/coverage';
import { importFontFiles } from '../src/fonts/importFonts';
import { rewriteSheetFont, sheetFontUsesNoto } from '../src/spreadsheet/defaultFont';
import { importChosenFonts, listFontFamilies, removeCustomFont, resetCustomFontsForTests } from '../src/fonts/registry';
import { canonicalFamilyName, rememberFont, readRecentFonts } from '../src/fonts/names';
import { exportOdt } from '../src/document/odt/exporter';
import { importOdt } from '../src/document/odt/importer';
import { exportRtf } from '../src/document/rtf/exporter';
import { importRtf } from '../src/document/rtf/importer';
import { exportPptx, importPptx } from '../src/slides/pptxAdapter';
import { createEmptySheet, exportXlsx, importXlsx } from '../src/spreadsheet/adapters';
import { wrapInHtmlDocument } from '../src/document/textMdHtml';
import { exportDocx } from '../src/document/docx/exporter';
import { importDocx } from '../src/document/docx/importer';
import { exportPdf } from '../src/pdf/exportPdf';
import type { EditorState } from '../src/types';

const fixtureDir = path.resolve(import.meta.dirname, 'fixtures/fonts');

function readFixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(fixtureDir, name)));
}

describe('Font library', () => {
  it('vendors 120 licensed families that cover Ukrainian, Latin, digits, and punctuation', () => {
    expect(catalogFile.revision).toBe('6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec');
    expect(catalogFile.families).toHaveLength(120);
    const names = catalogFile.families.map((family) => family.family);
    expect(new Set(names).size).toBe(120);
    for (const seed of [
      'Noto Sans',
      'Noto Serif',
      'Noto Sans Mono',
      'Inter',
      'Roboto',
      'Open Sans',
      'Montserrat',
      'Manrope',
      'Fira Code',
      'Source Serif 4',
    ]) {
      expect(names).toContain(seed);
    }
    expect(names.slice(0, 10)).toEqual([
      'Noto Sans',
      'Noto Serif',
      'Noto Sans Mono',
      'Inter',
      'Roboto',
      'Open Sans',
      'Montserrat',
      'Manrope',
      'Fira Code',
      'Source Serif 4',
    ]);
    for (const family of catalogFile.families) {
      expect(family.coverage).toBe('full');
      expect(family.faces.some((face) => face.style === 'regular')).toBe(true);
      const licensePath = path.resolve(import.meta.dirname, '../public/fonts/licenses', family.licenseFile);
      expect(fs.existsSync(licensePath)).toBe(true);
      expect(fs.readFileSync(licensePath, 'utf8').length).toBeGreaterThan(40);
      for (const face of family.faces) {
        const filePath = path.resolve(import.meta.dirname, '../public/fonts/files', face.file);
        const bytes = fs.readFileSync(filePath);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(face.sha256);
        const font = fontkit.create(new Uint8Array(bytes));
        for (const ch of REQUIRED_FONT_TEXT) {
          expect(font.hasGlyphForCodePoint(ch.codePointAt(0)!)).toBe(true);
        }
      }
    }
  });

  it('keeps an explicit quoted Times New Roman and rewrites the sheet default prefix', () => {
    const rewritten = rewriteSheetFont('normal normal normal 11pt Times New Roman,"Helvetica Neue", sans-serif');
    expect(sheetFontUsesNoto(rewritten)).toBe(true);
    const quoted = rewriteSheetFont('16px "Times New Roman", serif');
    expect(quoted).toContain('Times New Roman');
    expect(quoted.includes('"Noto Sans"')).toBe(false);
  });

  it('imports, skips duplicates, reports conflicts, and labels partial coverage', async () => {
    resetCustomFontsForTests();
    const partial = readFixture('partial-latin.ttf');
    const conflict = readFixture('partial-latin-conflict.ttf');
    const first = await importFontFiles(
      [
        { name: 'partial-latin.ttf', bytes: partial },
        { name: 'notes.txt', bytes: new Uint8Array([1, 2, 3]) },
        { name: 'not-a-font.bin', bytes: readFixture('not-a-font.bin') },
      ],
      []
    );
    expect(first.families.map((family) => family.family)).toEqual(['Folio Partial']);
    expect(first.families[0].coverage).toBe('partial');
    expect(first.issues.some((issue) => issue.kind === 'partial')).toBe(true);
    expect(first.issues.some((issue) => issue.kind === 'invalid')).toBe(true);
    const again = await importFontFiles(
      [
        { name: 'partial-latin.ttf', bytes: partial },
        { name: 'partial-latin-conflict.ttf', bytes: conflict },
      ],
      first.families
    );
    expect(again.families[0].faces).toHaveLength(1);
    expect(again.issues.map((issue) => issue.kind).sort()).toEqual(['conflict', 'duplicate']);
  });

  it('keeps a custom family after the source bytes are discarded and removes it later', async () => {
    resetCustomFontsForTests();
    const bytes = readFixture('partial-latin.ttf');
    const issues = await importChosenFonts([{ name: 'partial-latin.ttf', bytes }]);
    const stored = issues.some((issue) => issue.kind === 'storage');
    if (stored) {
      expect(issues.some((issue) => issue.kind === 'storage')).toBe(true);
      expect(listFontFamilies().some((family) => family.family === 'Folio Partial')).toBe(false);
      return;
    }
    expect(listFontFamilies().some((family) => family.family === 'Folio Partial')).toBe(true);
    await removeCustomFont('Folio Partial');
    expect(listFontFamilies().some((family) => family.family === 'Folio Partial')).toBe(false);
  });

  it('remembers eight recent families and canonicalizes the first name', () => {
    if (typeof localStorage?.removeItem !== 'function') {
      const mem = new Map<string, string>();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => mem.get(key) ?? null,
          setItem: (key: string, value: string) => mem.set(key, value),
          removeItem: (key: string) => mem.delete(key),
        },
      });
    }
    localStorage.removeItem('folio_recent_fonts');
    for (let index = 0; index < 10; index += 1) rememberFont(`Family ${index}`);
    expect(readRecentFonts()).toHaveLength(8);
    expect(readRecentFonts()[0]).toBe('Family 9');
    expect(canonicalFamilyName(`"Noto Serif", serif`)).toBe('Noto Serif');
  });

  it('round-trips a font family through ODT, RTF, HTML, and PPTX', async () => {
    const html = `<p><span style="font-family: 'Source Serif 4'">Привіт Folio</span></p>`;
    const odt = await importOdt(await (await exportOdt(html)).arrayBuffer(), 'fonts.odt');
    expect(odt.html).toMatch(/font-family:\s*'Source Serif 4'/);
    const rtf = await (await exportRtf(html)).text();
    expect(rtf).toContain('Source Serif 4');
    const importedRtf = importRtf(rtf, 'fonts.rtf');
    expect(importedRtf.html).toMatch(/font-family:\s*'Source Serif 4'/);
    const docx = await importDocx(await (await exportDocx(html)).arrayBuffer(), 'fonts.docx');
    expect(docx.html).toMatch(/Source Serif 4/);
    const htmlOut = wrapInHtmlDocument(html, 'Fonts');
    expect(htmlOut).toContain('Source Serif 4');
    expect(htmlOut).toContain('Noto Serif');
    const blob = await exportPptx({
      title: 'Fonts',
      slides: [
        {
          id: 's1',
          title: 'One',
          elements: [
            {
              id: 't1',
              type: 'text',
              x: 10,
              y: 10,
              width: 40,
              height: 20,
              text: 'Привіт',
              fontFamily: 'Manrope',
              fontSize: 18,
            },
          ],
        },
      ],
    });
    const pptx = await importPptx(await blob.arrayBuffer(), 'fonts.pptx');
    expect(pptx.presentation.slides[0].elements[0].fontFamily).toBe('Manrope');
    const sheet = createEmptySheet('Fonts');
    sheet.data![0][0] = { v: 'Привіт', m: 'Привіт', ff: 'Manrope' };
    const importedSheet = await importXlsx(await (await exportXlsx([sheet])).arrayBuffer(), 'fonts.xlsx');
    expect(importedSheet.sheets[0].data?.[0]?.[0]?.ff).toBe('Manrope');
  });

  it('embeds selected faces in a PDF, wraps Ukrainian text, and reports a missing glyph', async () => {
    expect(catalogFile.families.map((family) => family.family)).toContain('Noto Sans');
    expect(catalogFile.families.map((family) => family.family)).toContain('Manrope');
    const state: EditorState = {
      kind: 'document',
      fileName: 'fonts.docx',
      format: 'docx',
      isDirty: false,
      documentContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Привіт Folio 0123.,;:!? ',
                marks: [{ type: 'textStyle', attrs: { fontFamily: 'Noto Sans' } }],
              },
              {
                type: 'text',
                text: 'Manrope line ' + 'довгий рядок '.repeat(30),
                marks: [{ type: 'textStyle', attrs: { fontFamily: 'Manrope' } }],
              },
              { type: 'text', text: '\u4E16' },
            ],
          },
        ],
      },
    };
    const { bytes, omissions } = await exportPdf(state);
    const raw = new TextDecoder('latin1').decode(bytes);
    expect(raw).toMatch(/NotoSans|Noto Sans/);
    expect(raw).toMatch(/Manrope/);
    expect(omissions.some((item) => item.includes('U+4E16'))).toBe(true);
    const extracted = new TextDecoder('utf-8').decode(bytes);
    expect(extracted.includes('\u4E16')).toBe(false);
  });
});
