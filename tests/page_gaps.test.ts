import fs from 'fs';
import path from 'path';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { documentExtensions, htmlToDocument } from '../src/document/model';
import { markdownToHtml } from '../src/document/textMdHtml';

describe('page gaps', () => {
  it('measures a document that ends with a table without changing it', async () => {
    const text = fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/sample.md'), 'utf8');
    const doc = htmlToDocument(markdownToHtml(text));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = new Editor({
      element: host,
      extensions: documentExtensions,
      content: doc,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(editor.getJSON()).toEqual(doc);
    editor.destroy();
    host.remove();
  });
});
