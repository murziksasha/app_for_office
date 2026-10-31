import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import {
  applyDocumentFormat,
  captureDocumentFormat,
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

    // Check that target text now has bold mark
    const $target = editor.state.doc.resolve(14);
    const marks = $target.marks().map((m) => m.type.name);
    expect(marks).toContain('bold');

    editor.destroy();
  });
});

