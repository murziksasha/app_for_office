import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { detectFileType } from '../src/files/detect';
import { finishOpenedTab, loadFileToEditor } from '../src/files/open';
import { saveEditorContent } from '../src/files/save';

const fixtures = path.resolve(import.meta.dirname, '../fixtures');

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function partOf(bytes: Uint8Array, part: string) {
  const zip = await JSZip.loadAsync(bytes);
  expect(zip.file(part)).toBeTruthy();
}

describe('SoftMaker packages', () => {
  it('detects modern packages by extension and keeps that format', async () => {
    const hello = toArrayBuffer(fs.readFileSync(path.join(fixtures, 'hello.tmdx')));
    const sheet = toArrayBuffer(fs.readFileSync(path.join(fixtures, 'New Документ PlanMaker.pmdx')));
    const deck = toArrayBuffer(fs.readFileSync(path.join(fixtures, 'New Документ Presentations.prdx')));

    expect((await detectFileType('hello.tmdx', hello)).format).toBe('tmdx');
    expect((await detectFileType('book.pmdx', sheet)).format).toBe('pmdx');
    expect((await detectFileType('deck.prdx', deck)).format).toBe('prdx');
    expect((await detectFileType('notes.tmdx')).format).toBe('tmdx');
  });

  it('imports each sample and saves a package with the same extension', async () => {
    const cases = [
      { file: 'hello.tmdx', format: 'tmdx' as const, kind: 'document' as const, part: 'word/document.xml' },
      { file: 'New Документ PlanMaker.pmdx', format: 'pmdx' as const, kind: 'spreadsheet' as const, part: 'xl/workbook.xml' },
      { file: 'New Документ Presentations.prdx', format: 'prdx' as const, kind: 'presentation' as const, part: 'ppt/presentation.xml' },
    ];

    for (const item of cases) {
      const bytes = toArrayBuffer(fs.readFileSync(path.join(fixtures, item.file)));
      const state = await loadFileToEditor(bytes, item.file, undefined, `C:/docs/${item.file}`);
      expect(state.kind).toBe(item.kind);
      expect(state.format).toBe(item.format);
      expect(state.fileName).toBe(item.file);
      const tab = finishOpenedTab(state, item.file);
      expect(tab.isDirty).toBe(false);
      expect(tab.filePath).toBe(`C:/docs/${item.file}`);

      const saved = await saveEditorContent(tab, { format: item.format, fileName: item.file, saveAs: true });
      expect(saved.success).toBe(true);
      expect(saved.updatedState?.format).toBe(item.format);
      expect(saved.updatedState?.fileName.endsWith(`.${item.format}`)).toBe(true);
      await partOf(saved.bytes!, item.part);
    }
  });

  it('opens an older package as a dirty copy and never keeps the original path', async () => {
    const bytes = toArrayBuffer(fs.readFileSync(path.join(fixtures, 'hello.tmdx')));
    const detected = await detectFileType('hello.tmd', bytes);
    expect(detected.format).toBe('tmdx');
    expect(detected.errorMessage).toBeUndefined();

    const state = await loadFileToEditor(bytes, 'hello.tmd', undefined, 'C:/docs/hello.tmd');
    const tab = finishOpenedTab(state, 'hello.tmd');
    expect(tab.fileName).toBe('hello.tmdx');
    expect(tab.format).toBe('tmdx');
    expect(tab.filePath).toBeUndefined();
    expect(tab.fileHandle).toBeUndefined();
    expect(tab.isDirty).toBe(true);
    expect(tab.cleanHash).toBe('');
  });

  it('rejects a binary .tmd and a package missing its part', async () => {
    const binary = toArrayBuffer(fs.readFileSync(path.join(fixtures, 'sample_binary.tmd')));
    const binaryResult = await detectFileType('sample_binary.tmd', binary);
    expect(binaryResult.errorMessage).toMatch(/Folio cannot open this \.tmd file/);
    expect(binaryResult.errorMessage).not.toMatch(/97-2003|Legacy Office|Microsoft/);
    await expect(loadFileToEditor(binary, 'sample_binary.tmd')).rejects.toThrow(/Folio cannot open this \.tmd file/);

    const zip = new JSZip();
    zip.file('word/other.xml', '<x/>');
    const empty = await zip.generateAsync({ type: 'arraybuffer' });
    const missing = await detectFileType('notes.pmd', empty);
    expect(missing.format).toBe('pmdx');
    expect(missing.errorMessage).toMatch(/Folio cannot open this \.pmd file/);
    expect(missing.errorMessage).not.toMatch(/97-2003|Legacy Office/);
  });
});
