import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import { exportDocx } from '../src/document/docx/exporter';

describe('Table cell shading & styling', () => {
  it('sets and retrieves backgroundColor attribute on table cell', () => {
    const fixture = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 1' }] }],
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 2' }] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const editor = new Editor({
      extensions: documentExtensions,
      content: fixture,
    });

    // Move cursor into Cell 1
    editor.commands.setTextSelection(3);
    // Apply shading
    editor.commands.setCellAttribute('backgroundColor', '#e0f2fe');

    const json: any = editor.getJSON();
    const cell1 = json.content?.[0]?.content?.[0]?.content?.[0];
    expect(cell1?.attrs?.backgroundColor).toBe('#e0f2fe');

    // Test verticalAlign
    editor.commands.setCellAttribute('verticalAlign', 'middle');
    const jsonUpdated: any = editor.getJSON();
    const cell1Updated = jsonUpdated.content?.[0]?.content?.[0]?.content?.[0];
    expect(cell1Updated?.attrs?.verticalAlign).toBe('middle');

    editor.destroy();
  });

  it('exports table with cell shading to DOCX', async () => {
    const tableHtml = '<table><tr><td data-background="#dcfce7"><p>Shaded Green</p></td></tr></table>';
    const docxBlob = await exportDocx(tableHtml);
    expect(docxBlob).toBeInstanceOf(Blob);
    expect(docxBlob.size).toBeGreaterThan(0);
  });
});
