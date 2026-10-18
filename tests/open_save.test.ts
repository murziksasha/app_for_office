import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadFileToEditor } from '../src/files/open';
import { saveEditorContent } from '../src/files/save';
import { htmlToDocument, documentToHtml } from '../src/document/model';
import { isDesktopPlatform, getPlatformAdapter } from '../src/platform';

describe('Central Open and Save Pipeline', () => {
  it('loads sample.docx into Document EditorState as DocumentModel', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.docx');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.docx');

    expect(state.kind).toBe('document');
    expect(state.format).toBe('docx');
    expect(state.documentContent?.type).toBe('doc');
    const html = documentToHtml(state.documentContent!);
    expect(html).toContain('Executive Summary');
    expect(state.isDirty).toBe(false);
  });

  it('loads sample.xlsx into Spreadsheet EditorState', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.xlsx');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.xlsx');

    expect(state.kind).toBe('spreadsheet');
    expect(state.format).toBe('xlsx');
    expect(state.spreadsheetData).toBeDefined();
    expect(state.spreadsheetData!.length).toBeGreaterThanOrEqual(1);
  });

  it('loads sample.pptx into Presentation EditorState', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.pptx');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.pptx');

    expect(state.kind).toBe('presentation');
    expect(state.format).toBe('pptx');
    expect(state.presentationData).toBeDefined();
    expect(state.presentationData!.slides.length).toBeGreaterThanOrEqual(1);
  });

  it('loads sample.md into Document EditorState as DocumentModel', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.md');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.md');

    expect(state.kind).toBe('document');
    expect(state.format).toBe('md');
    expect(state.documentContent?.type).toBe('doc');
    const html = documentToHtml(state.documentContent!);
    expect(html).toContain('Quarterly Review');
  });

  it('refuses legacy binary files with error message', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample_binary.doc');
    const buf = fs.readFileSync(fixturePath);
    await expect(loadFileToEditor(buf.buffer as ArrayBuffer, 'sample_binary.doc')).rejects.toThrow(
      /Legacy Office binary format/
    );
  });

  it('saves document in different formats via Save As', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.docx');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.docx');

    // Save As Markdown
    const resMd = await saveEditorContent(state, { format: 'md', fileName: 'sample.md', saveAs: true });
    expect(resMd.success).toBe(true);
    expect(resMd.updatedState?.format).toBe('md');

    // Save As ODT
    const resOdt = await saveEditorContent(state, { format: 'odt', fileName: 'sample.odt', saveAs: true });
    expect(resOdt.success).toBe(true);
    expect(resOdt.updatedState?.format).toBe('odt');

    // Save As HTML
    const resHtml = await saveEditorContent(state, { format: 'html', fileName: 'sample.html', saveAs: true });
    expect(resHtml.success).toBe(true);
    expect(resHtml.updatedState?.format).toBe('html');
  });

  it('htmlToDocument drops a <script> tag safely', () => {
    const dirtyHtml = `<p>Safe text</p><script>alert("malicious xss");</script><img src="x" onerror="alert(1)" />`;
    const doc = htmlToDocument(dirtyHtml);

    expect(doc.type).toBe('doc');
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain('<script>');
    expect(serialized).not.toContain('malicious xss');
    expect(serialized).not.toContain('onerror');
    expect(serialized).toContain('Safe text');
  });

  it('desktop vs browser selection does not throw in jsdom', () => {
    // Default in jsdom without __TAURI_INTERNALS__
    delete (window as any).__TAURI_INTERNALS__;
    expect(isDesktopPlatform()).toBe(false);
    const browserPlatform = getPlatformAdapter();
    expect(browserPlatform.isDesktop).toBe(false);

    // When __TAURI_INTERNALS__ is present
    (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
    expect(isDesktopPlatform()).toBe(true);
    const desktopPlatform = getPlatformAdapter();
    expect(desktopPlatform.isDesktop).toBe(true);

    // Clean up
    delete (window as any).__TAURI_INTERNALS__;
    expect(isDesktopPlatform()).toBe(false);
  });
});
