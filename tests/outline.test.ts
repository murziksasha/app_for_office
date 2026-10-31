import { describe, expect, it } from 'vitest';
import { getHeadings, getOutline } from '../src/document/outline';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';

describe('Document outline', () => {
  const fixture = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Introduction' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Some body text in between.' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Background' }],
      },
      {
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: 'Deep details (ignored)' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'More body text.' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Implementation' }],
      },
    ],
  };

  it('extracts headings 1, 2, 3 and ignores level 4 from JSONContent', () => {
    const headings = getHeadings(fixture);
    expect(headings).toHaveLength(3);

    expect(headings[0]).toEqual({
      level: 1,
      text: 'Introduction',
      pos: expect.any(Number),
    });
    expect(headings[1]).toEqual({
      level: 2,
      text: 'Background',
      pos: expect.any(Number),
    });
    expect(headings[2]).toEqual({
      level: 3,
      text: 'Implementation',
      pos: expect.any(Number),
    });

    // Check monotonic position ordering
    expect(headings[0].pos).toBeLessThan(headings[1].pos);
    expect(headings[1].pos).toBeLessThan(headings[2].pos);
  });

  it('extracts headings from live ProseMirror Editor doc matching positions', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: fixture,
    });

    const headings = getHeadings(editor.state.doc);
    expect(headings).toHaveLength(3);
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3]);
    expect(headings.map((h) => h.text)).toEqual(['Introduction', 'Background', 'Implementation']);
    expect(headings[0].pos).toBeLessThan(headings[1].pos);
    expect(headings[1].pos).toBeLessThan(headings[2].pos);

    // Both getHeadings and getOutline function equivalently
    expect(getOutline(editor.state.doc)).toEqual(headings);

    editor.destroy();
  });

  it('returns empty array when there are no headings', () => {
    const emptyFixture = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plain text' }] }],
    };
    expect(getHeadings(emptyFixture)).toEqual([]);
  });
});

