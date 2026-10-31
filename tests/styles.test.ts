import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import { applyDocumentStyle, type DocumentStyleName } from '../src/document/styles';
import { exportDocx } from '../src/document/docx/exporter';
import { importDocx } from '../src/document/docx/importer';
import JSZip from 'jszip';

describe('Document Styles', () => {
  it('sets each style and asserts the active node and styleName match', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: '<p>Sample text to format</p>',
    });

    const styles: Array<{
      name: DocumentStyleName;
      nodeCheck: (ed: Editor) => boolean;
      expectedAttr: string;
    }> = [
      {
        name: 'Normal',
        nodeCheck: (ed) => ed.isActive('paragraph'),
        expectedAttr: 'Normal',
      },
      {
        name: 'Title',
        nodeCheck: (ed) => ed.isActive('heading', { level: 1 }),
        expectedAttr: 'Title',
      },
      {
        name: 'Heading 1',
        nodeCheck: (ed) => ed.isActive('heading', { level: 1 }),
        expectedAttr: 'Heading 1',
      },
      {
        name: 'Heading 2',
        nodeCheck: (ed) => ed.isActive('heading', { level: 2 }),
        expectedAttr: 'Heading 2',
      },
      {
        name: 'Heading 3',
        nodeCheck: (ed) => ed.isActive('heading', { level: 3 }),
        expectedAttr: 'Heading 3',
      },
      {
        name: 'Quote',
        nodeCheck: (ed) => ed.isActive('blockquote'),
        expectedAttr: 'Quote',
      },
    ];

    for (const { name, nodeCheck, expectedAttr } of styles) {
      applyDocumentStyle(editor, name);
      expect(nodeCheck(editor), `Active node check failed for ${name}`).toBe(true);

      const activeAttrs =
        editor.getAttributes('blockquote').styleName ||
        editor.getAttributes('heading').styleName ||
        editor.getAttributes('paragraph').styleName;

      expect(activeAttrs).toBe(expectedAttr);
    }

    editor.destroy();
  });

  it('exports docx with w:pStyle for styled headings, titles, quotes, and normal paragraphs', async () => {
    const html = `
      <h1 data-style-name="Title">My Document Title</h1>
      <h1 data-style-name="Heading 1">First Heading</h1>
      <h2 data-style-name="Heading 2">Second Heading</h2>
      <p data-style-name="Normal">Standard paragraph text.</p>
      <blockquote data-style-name="Quote"><p>A memorable quote.</p></blockquote>
    `;

    const blob = await exportDocx(html);
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');

    expect(docXml).toBeDefined();
    expect(docXml).toContain('<w:pStyle');
    expect(docXml).toMatch(/<w:pStyle\s+[^>]*w:val="Title"/);
    expect(docXml).toMatch(/<w:pStyle\s+[^>]*w:val="Heading1"/);
    expect(docXml).toMatch(/<w:pStyle\s+[^>]*w:val="Heading2"/);
    expect(docXml).toMatch(/<w:pStyle\s+[^>]*w:val="Quote"/);
  });

  it('round-trips styleName through docx import and export', async () => {
    const html = `
      <h1 data-style-name="Title">Imported Title</h1>
      <blockquote data-style-name="Quote"><p>Round-trip quote</p></blockquote>
    `;
    const blob = await exportDocx(html);
    const buffer = await blob.arrayBuffer();

    const { html: importedHtml } = await importDocx(buffer, 'test.docx');
    expect(importedHtml).toContain('data-style-name="Title"');
    expect(importedHtml).toContain('data-style-name="Quote"');
  });
});
