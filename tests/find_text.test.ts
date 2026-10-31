import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import {
  findNextIndex,
  findPreviousIndex,
  findTextRanges,
  replaceAll,
  replaceOne,
} from '../src/document/findText';

function createTestEditor(content: any): Editor {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new Editor({
    element: host,
    extensions: documentExtensions,
    content,
  });
}

describe('Document find and replace (findText)', () => {
  it('finds two matches in document order', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The quick brown fox jumps over the lazy dog. The end.' }],
        },
      ],
    });

    const ranges = findTextRanges(editor.state.doc, 'The');
    expect(ranges.length).toBe(3); // 'The', 'the', 'The' (insensitive by default)
    expect(ranges[0].from).toBeLessThan(ranges[1].from);
    expect(ranges[1].from).toBeLessThan(ranges[2].from);
    editor.destroy();
  });

  it('respects match case option', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello hello HELLO' }],
        },
      ],
    });

    const caseMatches = findTextRanges(editor.state.doc, 'Hello', { matchCase: true });
    expect(caseMatches.length).toBe(1);

    const insensitiveMatches = findTextRanges(editor.state.doc, 'Hello', { matchCase: false });
    expect(insensitiveMatches.length).toBe(3);
    editor.destroy();
  });

  it('finds a match inside bold mark', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Normal text and ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold target word' },
            { type: 'text', text: ' followed by more text.' },
          ],
        },
      ],
    });

    const ranges = findTextRanges(editor.state.doc, 'target');
    expect(ranges.length).toBe(1);

    const node = editor.state.doc.resolve(ranges[0].from).nodeAfter;
    expect(node?.marks.some((m) => m.type.name === 'bold')).toBe(true);
    editor.destroy();
  });

  it('replaces one occurrence and preserves bold mark', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Prefix ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold needle here' },
            { type: 'text', text: ' suffix.' },
          ],
        },
      ],
    });

    const ranges = findTextRanges(editor.state.doc, 'needle');
    expect(ranges.length).toBe(1);

    const ok = replaceOne(editor, ranges[0], 'replacement');
    expect(ok).toBe(true);
    expect(editor.getText()).toContain('bold replacement here');

    // Verify marks survived
    const newRanges = findTextRanges(editor.state.doc, 'replacement');
    expect(newRanges.length).toBe(1);
    const node = editor.state.doc.resolve(newRanges[0].from).nodeAfter;
    expect(node?.marks.some((m) => m.type.name === 'bold')).toBe(true);
    editor.destroy();
  });

  it('replaces all occurrences and preserves marks', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'cat and ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'cat' },
            { type: 'text', text: ' and cat' },
          ],
        },
      ],
    });

    const count = replaceAll(editor, 'cat', 'feline');
    expect(count).toBe(3);
    expect(editor.getText()).toBe('feline and feline and feline');

    // The middle 'feline' should still be bold
    const ranges = findTextRanges(editor.state.doc, 'feline');
    expect(ranges.length).toBe(3);
    const middleNode = editor.state.doc.resolve(ranges[1].from).nodeAfter;
    expect(middleNode?.marks.some((m) => m.type.name === 'bold')).toBe(true);
    editor.destroy();
  });

  it('handles no match and empty query', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some sample text' }],
        },
      ],
    });

    expect(findTextRanges(editor.state.doc, 'missing')).toEqual([]);
    expect(findTextRanges(editor.state.doc, '')).toEqual([]);
    expect(replaceAll(editor, 'missing', 'something')).toBe(0);
    editor.destroy();
  });

  it('treats regex characters as literal characters', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'a.b and a*b and axb' }],
        },
      ],
    });

    const dotMatches = findTextRanges(editor.state.doc, 'a.b');
    expect(dotMatches.length).toBe(1);

    const starMatches = findTextRanges(editor.state.doc, 'a*b');
    expect(starMatches.length).toBe(1);
    editor.destroy();
  });

  it('findNextIndex and findPreviousIndex wrap at the ends', () => {
    expect(findNextIndex(3, 0)).toBe(1);
    expect(findNextIndex(3, 2)).toBe(0); // wrap
    expect(findPreviousIndex(3, 2)).toBe(1);
    expect(findPreviousIndex(3, 0)).toBe(2); // wrap
    expect(findNextIndex(0, 0)).toBe(-1);
    expect(findPreviousIndex(0, 0)).toBe(-1);
  });
});

