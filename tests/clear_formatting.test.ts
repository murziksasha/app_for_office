import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import { clearFormatting } from '../src/document/clearFormatting';

describe('Clear formatting', () => {
  it('clears formatting on a bold centered span and leaves text', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = new Editor({
      element: host,
      extensions: documentExtensions,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'center', lineSpacing: '1.5', indent: 2 },
            content: [
              { type: 'text', marks: [{ type: 'bold' }], text: 'Centered Bold Content' },
            ],
          },
        ],
      },
    });

    // Select text
    editor.commands.selectAll();

    // Call clearFormatting
    clearFormatting(editor);

    // Assert: text remains intact
    expect(editor.getText()).toBe('Centered Bold Content');

    // Assert: marks removed
    const node = editor.state.doc.firstChild!;
    expect(node.firstChild?.marks.length).toBe(0);

    // Assert: alignment, indent, line spacing reset
    expect(node.attrs.textAlign).toBe('left');
    expect(node.attrs.indent).toBe(0);
    expect(node.attrs.lineSpacing).toBe('1.15');

    editor.destroy();
    host.remove();
  });
});

