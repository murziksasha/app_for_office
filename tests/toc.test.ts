import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../src/document/model';
import { generateTocItems } from '../src/document/toc';
import { computeDocumentPagination, getPageAtPosition } from '../src/document/pagination';
import { DEFAULT_PAGE_SETUP } from '../src/document/pageSetup';
import { exportDocx } from '../src/document/docx/exporter';
import JSZip from 'jszip';

describe('Table of Contents', () => {
  const multiPageFixture = {
    type: 'doc',
    attrs: {
      pageSetup: { ...DEFAULT_PAGE_SETUP },
    },
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Chapter 1: The Beginning' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Introductory text for chapter 1.' }],
      },
      {
        type: 'pageBreak',
      },
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Chapter 2: Methods' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Section 2.1: Data Collection' }],
      },
      {
        type: 'pageBreak',
      },
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Chapter 3: Results' }],
      },
      {
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: 'Sub-sub section (omitted from TOC)' }],
      },
    ],
  };

  it('generates TOC items with heading entries and page numbers matching pagination.ts', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: multiPageFixture,
    });

    const items = generateTocItems(editor.state.doc, DEFAULT_PAGE_SETUP);
    expect(items).toHaveLength(4);

    expect(items[0]).toEqual({
      level: 1,
      text: 'Chapter 1: The Beginning',
      page: 1,
      pos: expect.any(Number),
    });

    expect(items[1]).toEqual({
      level: 1,
      text: 'Chapter 2: Methods',
      page: 2,
      pos: expect.any(Number),
    });

    expect(items[2]).toEqual({
      level: 2,
      text: 'Section 2.1: Data Collection',
      page: 2,
      pos: expect.any(Number),
    });

    expect(items[3]).toEqual({
      level: 1,
      text: 'Chapter 3: Results',
      page: 3,
      pos: expect.any(Number),
    });

    // Verify page numbers directly against pagination.ts
    const pagination = computeDocumentPagination(editor.state.doc, DEFAULT_PAGE_SETUP);
    for (const item of items) {
      const expectedPage = getPageAtPosition(pagination.gapPositions, item.pos);
      expect(item.page).toBe(expectedPage);
    }

    editor.destroy();
  });

  it('inserts TOC node at selection and stores items in attributes', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: multiPageFixture,
    });

    // Move to start of document and insert TOC
    editor.commands.setTextSelection(0);
    editor.commands.insertTableOfContents();

    const json = editor.getJSON();
    const tocNode = json.content?.find((node) => node.type === 'toc');
    expect(tocNode).toBeDefined();
    expect(tocNode?.attrs?.items).toHaveLength(4);
    expect(tocNode?.attrs?.items[0].text).toBe('Chapter 1: The Beginning');
    expect(tocNode?.attrs?.items[0].page).toBe(1);

    editor.destroy();
  });

  it('exports TOC to DOCX with native field codes and static cached fallback entries', async () => {
    const tocHtml = `
      <nav data-type="toc" class="folio-toc" data-items='[{"level":1,"text":"Chapter 1","page":1},{"level":2,"text":"Section 1.1","page":1},{"level":1,"text":"Chapter 2","page":2}]'>
        <p class="folio-toc-entry" data-level="1"><span class="folio-toc-text">Chapter 1</span><span class="folio-toc-leader">1</span></p>
        <p class="folio-toc-entry" data-level="2"><span class="folio-toc-text">Section 1.1</span><span class="folio-toc-leader">1</span></p>
        <p class="folio-toc-entry" data-level="1"><span class="folio-toc-text">Chapter 2</span><span class="folio-toc-leader">2</span></p>
      </nav>
      <h1>Chapter 1</h1>
      <p>Body</p>
    `;

    const blob = await exportDocx(tocHtml);
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');

    expect(docXml).toBeDefined();
    expect(docXml).toContain('<w:sdt>');
    expect(docXml).toContain('<w:alias w:val="Table of Contents"/>');
    expect(docXml).toContain('w:instrText xml:space="preserve">TOC');
    expect(docXml).toContain('Chapter 1');
    expect(docXml).toContain('Chapter 2');
  });
});

