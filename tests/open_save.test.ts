import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadFileToEditor } from '../src/files/open';
import { saveEditorContent } from '../src/files/save';

describe('Central Open and Save Pipeline', () => {
  it('loads sample.docx into Document EditorState', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.docx');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.docx');

    expect(state.kind).toBe('document');
    expect(state.format).toBe('docx');
    expect(state.documentContent).toContain('Executive Summary');
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

  it('loads sample.md into Document EditorState', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.md');
    const buf = fs.readFileSync(fixturePath);
    const state = await loadFileToEditor(buf.buffer as ArrayBuffer, 'sample.md');

    expect(state.kind).toBe('document');
    expect(state.format).toBe('md');
    expect(state.documentContent).toContain('Quarterly Review');
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
});

