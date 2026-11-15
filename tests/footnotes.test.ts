import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import { exportDocx } from '../src/document/docx/exporter';
import { importDocx } from '../src/document/docx/importer';
import { exportOdt } from '../src/document/odt/exporter';
import { importOdt } from '../src/document/odt/importer';

describe('Footnotes', () => {
  it('adds footnote reference and updates footnote text in editor', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: '<p>Some text here</p>',
    });

    // Move to end of text
    editor.commands.setTextSelection(14);
    (editor.commands as any).addFootnote();

    const json = editor.getJSON();
    const footnotes = json.attrs?.footnotes;
    expect(footnotes).toHaveLength(1);
    expect(footnotes[0].id).toBe('1');
    expect(footnotes[0].text).toBe('');

    // Update footnote text
    (editor.commands as any).updateFootnoteText('1', 'Test citation note');
    const updated = editor.getJSON();
    expect(updated.attrs?.footnotes[0].text).toBe('Test citation note');

    editor.destroy();
  });

  it('round-trips footnotes in DOCX', async () => {
    const html = '<p>Reference here<sup data-footnote-id="1" class="folio-footnote-ref">[1]</sup> in paragraph.</p>';
    const footnotes = [{ id: '1', text: 'DOCX citation text' }];

    const blob = await exportDocx(html, null, null, footnotes);
    const buf = await blob.arrayBuffer();

    const imported = await importDocx(buf, 'test.docx');
    expect(imported.footnotes).toBeDefined();
    expect(imported.footnotes?.length).toBeGreaterThan(0);
    expect(imported.footnotes?.[0].id).toBe('1');
    expect(imported.footnotes?.[0].text).toBe('DOCX citation text');
    expect(imported.html).toContain('data-footnote-id="1"');
  });

  it('round-trips footnotes in ODT', async () => {
    const html = '<p>ODT note here<sup data-footnote-id="1" class="folio-footnote-ref">[1]</sup> in text.</p>';
    const footnotes = [{ id: '1', text: 'ODT citation body' }];

    const blob = await exportOdt(html, null, footnotes);
    const buf = await blob.arrayBuffer();

    const imported = await importOdt(buf, 'test.odt');
    expect(imported.footnotes).toBeDefined();
    expect(imported.footnotes?.length).toBeGreaterThan(0);
    expect(imported.footnotes?.[0].id).toBe('1');
    expect(imported.footnotes?.[0].text).toBe('ODT citation body');
    expect(imported.html).toContain('data-footnote-id="1"');
  });
});

