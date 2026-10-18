import { describe, it, expect } from 'vitest';
import { detectFileType, isOleBinary, isZipBinary } from '../src/files/detect';
import fs from 'fs';
import path from 'path';

describe('File Type Detection', () => {
  it('detects from extensions correctly', async () => {
    expect((await detectFileType('doc.docx')).format).toBe('docx');
    expect((await detectFileType('calc.xlsx')).format).toBe('xlsx');
    expect((await detectFileType('deck.pptx')).format).toBe('pptx');
    expect((await detectFileType('doc.odt')).format).toBe('odt');
    expect((await detectFileType('doc.rtf')).format).toBe('rtf');
    expect((await detectFileType('notes.md')).format).toBe('md');
    expect((await detectFileType('index.html')).format).toBe('html');
    expect((await detectFileType('data.csv')).format).toBe('csv');
    expect((await detectFileType('data.tsv')).format).toBe('tsv');
    expect((await detectFileType('paper.pdf')).format).toBe('pdf');
  });

  it('rejects legacy binary formats (.doc, .xls, .ppt) with friendly explanation', async () => {
    const docRes = await detectFileType('report.doc');
    expect(docRes.isLegacyBinary).toBe(true);
    expect(docRes.errorMessage).toContain('Legacy Office binary format');

    const xlsRes = await detectFileType('budget.xls');
    expect(xlsRes.isLegacyBinary).toBe(true);
    expect(xlsRes.errorMessage).toContain('Legacy Office binary format');

    const pptRes = await detectFileType('slides.ppt');
    expect(pptRes.isLegacyBinary).toBe(true);
    expect(pptRes.errorMessage).toContain('Legacy Office binary format');
  });

  it('detects macro-enabled files and sets isMacroFile flag', async () => {
    const docm = await detectFileType('template.docm');
    expect(docm.isMacroFile).toBe(true);
    expect(docm.format).toBe('docx');

    const xlsm = await detectFileType('tracker.xlsm');
    expect(xlsm.isMacroFile).toBe(true);
    expect(xlsm.format).toBe('xlsx');
  });

  it('identifies OLE binary signature from bytes', () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).buffer;
    expect(isOleBinary(ole)).toBe(true);

    const normal = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    expect(isOleBinary(normal)).toBe(false);
  });

  it('detects package contents by inspecting zip file', async () => {
    const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');
    const docxBuf = fs.readFileSync(path.join(fixturesDir, 'sample.docx'));
    const res = await detectFileType('unknown_file', docxBuf.buffer);
    expect(res.kind).toBe('document');
    expect(res.format).toBe('docx');
  });
});

