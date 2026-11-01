import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import {
  applyDocumentFormat,
  applySheetFormat,
  captureDocumentFormat,
  captureSheetFormat,
  formatPainter,
  FormatPainterManager,
} from '../src/shell/formatPainter';

function createTestEditor(content: any): Editor {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new Editor({
    element: host,
    extensions: documentExtensions,
    content,
  });
}

describe('Format Painter', () => {
  it('captures format payload from caret in a document', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            { type: 'text', marks: [{ type: 'bold' }, { type: 'italic' }], text: 'styled text' },
          ],
        },
      ],
    });

    // Place caret inside the styled text
    editor.commands.setTextSelection(3);

    const payload = captureDocumentFormat(editor);
    expect(payload).toBeDefined();
    expect(payload!.textAlign).toBe('center');
    const markTypes = payload!.marks.map((m) => m.type);
    expect(markTypes).toContain('bold');
    expect(markTypes).toContain('italic');

    editor.destroy();
  });

  it('paints the document font family onto the next selection', () => {
    const source = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Source',
              marks: [{ type: 'textStyle', attrs: { fontFamily: 'Manrope' } }],
            },
          ],
        },
      ],
    });
    source.commands.setTextSelection(3);
    const payload = captureDocumentFormat(source);
    const target = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Target' }] }],
    });
    target.commands.setTextSelection({ from: 1, to: 7 });
    applyDocumentFormat(target, payload!);
    expect(target.getHTML()).toContain('Manrope');
    source.destroy();
    target.destroy();
  });

  it('locked stays armed after one apply, while unlocked disarms after one apply', () => {
    const manager = new FormatPainterManager();

    // 1. Unlocked flow:
    manager.arm({ doc: { marks: [{ type: 'bold' }] } });
    expect(manager.getState().armed).toBe(true);
    expect(manager.getState().locked).toBe(false);

    // Apply once -> disarms
    const stillArmed = manager.didApply();
    expect(stillArmed).toBe(false);
    expect(manager.getState().armed).toBe(false);

    // 2. Locked flow:
    // First click: arm
    manager.arm({ doc: { marks: [{ type: 'italic' }] } });
    expect(manager.getState().armed).toBe(true);
    expect(manager.getState().locked).toBe(false);

    // Second click: lock
    manager.arm({});
    expect(manager.getState().armed).toBe(true);
    expect(manager.getState().locked).toBe(true);

    // Apply once -> remains armed!
    const stillArmedLocked = manager.didApply();
    expect(stillArmedLocked).toBe(true);
    expect(manager.getState().armed).toBe(true);
    expect(manager.getState().locked).toBe(true);

    // Cancel cancels even when locked
    manager.cancel();
    expect(manager.getState().armed).toBe(false);
    expect(manager.getState().locked).toBe(false);
  });

  it('applies captured document formatting to another range', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Source bold' },
            { type: 'text', text: ' Target plain' },
          ],
        },
      ],
    });

    // Capture from Source bold (pos 2)
    editor.commands.setTextSelection(2);
    const payload = captureDocumentFormat(editor);
    expect(payload).not.toBeNull();

    // Select Target plain: "Target" is from 13 to 19
    editor.commands.setTextSelection({ from: 13, to: 19 });
    applyDocumentFormat(editor, payload!);

    const $target = editor.state.doc.resolve(14);
    const marks = $target.marks().map((m) => m.type.name);
    expect(marks).toContain('bold');

    editor.destroy();
  });

  it('copies a spreadsheet font family onto the selected cells', () => {
    const api = {
      selection: [{ row: [0, 0], column: [0, 0] }],
      cell: { ff: 'Manrope', bl: 1 },
      applied: [] as Array<{ attr: string; value: unknown }>,
      getSelection() {
        return this.selection;
      },
      getCellValue() {
        return this.cell;
      },
      setCellFormatByRange(attr: string, value: unknown) {
        this.applied.push({ attr, value });
      },
    };
    const payload = captureSheetFormat(api);
    expect(payload?.ff).toBe('Manrope');
    api.selection = [{ row: [1, 1], column: [2, 2] }];
    applySheetFormat(api, payload!);
    expect(api.applied).toContainEqual({ attr: 'ff', value: 'Manrope' });
    expect(api.applied).toContainEqual({ attr: 'bl', value: 1 });
  });

  it('undoes a document font family change', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().focus().setFontFamily('Manrope').run();
    expect(editor.getHTML()).toContain('Manrope');
    editor.commands.undo();
    expect(editor.getHTML()).not.toContain('Manrope');
    editor.destroy();
  });
});

