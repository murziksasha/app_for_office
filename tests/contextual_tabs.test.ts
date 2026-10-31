import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import { getContextualTabs } from '../src/shell/Ribbon';

describe('Contextual ribbon tabs', () => {
  it('computes contextual tabs based on active selections', () => {
    expect(getContextualTabs(false, false)).toEqual([]);
    expect(getContextualTabs(true, false)).toEqual(['table']);
    expect(getContextualTabs(false, true)).toEqual(['picture']);
    expect(getContextualTabs(true, true)).toEqual(['table', 'picture']);
  });

  it('detects table active state when caret enters or leaves table in editor', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: '<p>Before</p><table style="width:100%"><tbody><tr><td><p>Inside cell</p></td></tr></tbody></table><p>After</p>',
    });

    // Position 1 is inside <p>Before</p>
    editor.commands.setTextSelection(1);
    expect(editor.isActive('table')).toBe(false);

    // Position inside table cell
    editor.commands.setTextSelection(14);
    expect(editor.isActive('table')).toBe(true);

    // Move to paragraph after table
    const afterPos = editor.state.doc.content.size - 2;
    editor.commands.setTextSelection(afterPos);
    expect(editor.isActive('table')).toBe(false);

    editor.destroy();
  });
});

