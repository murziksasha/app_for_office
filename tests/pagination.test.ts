import { describe, it, expect } from 'vitest';
import { computeDocumentPagination, getPageAtPosition } from '../src/document/pagination';
import { DEFAULT_PAGE_SETUP, type PageSetup } from '../src/document/pageSetup';

describe('Document pagination', () => {
  it('reports page 2 with an explicit page break node', () => {
    // A doc with:
    // Paragraph 1: offset 0, size 10
    // PageBreak:   offset 10, size 1
    // Paragraph 2: offset 11, size 10
    const nodes = [
      { type: { name: 'paragraph' }, nodeSize: 10, text: 'Hello Page 1' },
      { type: { name: 'pageBreak' }, nodeSize: 1 },
      { type: { name: 'paragraph' }, nodeSize: 10, text: 'Hello Page 2' },
    ];

    const doc = {
      forEach: (cb: (node: any, offset: number) => void) => {
        let offset = 0;
        for (const n of nodes) {
          cb(n, offset);
          offset += n.nodeSize;
        }
      },
    };

    const res = computeDocumentPagination(doc, DEFAULT_PAGE_SETUP, () => 30);
    expect(res.totalPages).toBe(2);
    expect(res.gapPositions).toHaveLength(1);
    expect(res.gapPositions[0]).toBe(11); // offset 10 + nodeSize 1

    // Caret before page break
    expect(getPageAtPosition(res.gapPositions, 5)).toBe(1);
    // Caret at / after page break (Paragraph 2)
    expect(getPageAtPosition(res.gapPositions, 11)).toBe(2);
    expect(getPageAtPosition(res.gapPositions, 15)).toBe(2);
  });

  it('reports a stable count for a fixture of known block heights across minor margin change', () => {
    // 6 blocks of 200px each = 1200px total
    const blocks = Array.from({ length: 6 }, (_, i) => ({
      type: { name: 'paragraph' },
      nodeSize: 20,
      id: i,
    }));

    const doc = {
      forEach: (cb: (node: any, offset: number) => void) => {
        let offset = 0;
        for (const b of blocks) {
          cb(b, offset);
          offset += b.nodeSize;
        }
      },
    };

    // Standard A4 setup (297mm height): 25mm top & bottom -> inner height 247mm (~933px)
    // 4 blocks * 200px = 800px fits on Page 1. Next block (1000px) exceeds 933px.
    // Blocks 5 and 6 go to Page 2. Total = 2 pages.
    const setup1: PageSetup = {
      size: 'a4',
      marginTop: 25,
      marginBottom: 25,
      marginLeft: 25,
      marginRight: 25,
    };
    const res1 = computeDocumentPagination(doc, setup1, () => 200);
    expect(res1.totalPages).toBe(2);

    // Adjusted margins: top 20mm, bottom 20mm -> inner height 257mm (~971px)
    // 4 blocks * 200px = 800px fits on Page 1. 5 blocks (1000px) still exceeds 971px.
    // Total pages is still 2 pages (stable count).
    const setup2: PageSetup = {
      size: 'a4',
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25,
    };
    const res2 = computeDocumentPagination(doc, setup2, () => 200);
    expect(res2.totalPages).toBe(2);

    // Large margins: top 100mm, bottom 100mm -> inner height 97mm (~366px)
    // Only 1 block (200px) fits per page (since 400px > 366px).
    // Total pages becomes 6 pages.
    const setup3: PageSetup = {
      size: 'a4',
      marginTop: 100,
      marginBottom: 100,
      marginLeft: 25,
      marginRight: 25,
    };
    const res3 = computeDocumentPagination(doc, setup3, () => 200);
    expect(res3.totalPages).toBe(6);
  });
});

