import { describe, expect, it } from 'vitest';
import { calculateTextStats, getEditorStats } from '../src/document/wordCount';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';

describe('Document Word Count Statistics', () => {
  it('calculates stats for plain text accurately', () => {
    const text = 'Hello world!\nThis is a second paragraph.';
    const stats = calculateTextStats(text, 2, 1);

    expect(stats.words).toBe(7);
    expect(stats.charactersNoSpaces).toBe(34);
    expect(stats.charactersWithSpaces).toBe(40);
    expect(stats.paragraphs).toBe(2);
    expect(stats.pages).toBe(1);
    expect(stats.lines).toBeGreaterThanOrEqual(2);
  });

  it('handles empty or whitespace-only text gracefully', () => {
    const stats = calculateTextStats('   \n\n   ', 0, 1);
    expect(stats.words).toBe(0);
    expect(stats.charactersNoSpaces).toBe(0);
    expect(stats.paragraphs).toBe(0);
  });

  it('extracts live statistics from ProseMirror editor', () => {
    const fixture = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Executive Summary' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This document contains essential statistics for project review.' }],
        },
      ],
    };

    const editor = new Editor({
      extensions: documentExtensions,
      content: fixture,
    });

    const stats = getEditorStats(editor, 2);
    expect(stats.document.pages).toBe(2);
    expect(stats.document.words).toBe(10); // 'Executive' 'Summary' + 8 words
    expect(stats.document.paragraphs).toBe(2);
    expect(stats.hasSelection).toBe(false);
    expect(stats.selection).toBeNull();

    // Now select 'Executive Summary'
    editor.commands.setTextSelection({ from: 1, to: 18 });
    const statsWithSel = getEditorStats(editor, 2);
    expect(statsWithSel.hasSelection).toBe(true);
    expect(statsWithSel.selection?.words).toBe(2);
    expect(statsWithSel.selection?.charactersNoSpaces).toBe(16);

    editor.destroy();
  });
});
