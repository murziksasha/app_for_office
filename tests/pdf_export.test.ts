import { describe, expect, it } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist';
import { exportPdf } from '../src/pdf/exportPdf';
import { EditorState } from '../src/types';

async function extractTextWordsFromBytes(pdfBytes: Uint8Array): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  let allText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageWords = (content.items || [])
      .map((item: any) => item.str || '')
      .join(' ');
    allText += ` [Page ${p}] ${pageWords}`;
  }
  return allText;
}

describe('PDF Export', () => {
  it('exports a document with headings, bold, page breaks, and reports unmapped character omissions', async () => {
    const docState: EditorState = {
      kind: 'document',
      fileName: 'test-doc.docx',
      format: 'docx',
      isDirty: false,
      documentContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Chapter One: Overview' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'This text has ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'bold emphasis' },
              { type: 'text', text: ' and an unsupported character \u4E16\u754C here.' },
            ],
          },
          {
            type: 'pageBreak',
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Text on second page after break.' }],
          },
        ],
      },
    };

    const { bytes, omissions } = await exportPdf(docState);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    // Omissions must record the missing glyphs
    expect(omissions.length).toBeGreaterThan(0);
    expect(omissions.some((o) => o.includes('Dropped unsupported character'))).toBe(true);

    // Read bytes back with pdfjs
    const extracted = await extractTextWordsFromBytes(bytes);
    expect(extracted).toContain('Chapter One: Overview');
    expect(extracted).toContain('bold emphasis');
    expect(extracted).toContain('Text on second page after break.');
    expect(extracted).toContain('[Page 1]');
    expect(extracted).toContain('[Page 2]');
    // The CJK character should not appear
    expect(extracted).not.toContain('\u4E16\u754C');
  });

  it('exports a wide spreadsheet using displayed values and not formula strings', async () => {
    // 15 wide columns
    const row: any[] = [];
    for (let c = 0; c < 15; c++) {
      if (c === 0) {
        row.push({
          v: 999,
          m: 'DisplayValueTotal',
          f: '=SUM(B1:O1)',
          bl: 1,
        });
      } else {
        row.push({
          v: c * 10,
          m: `Col${c}Val`,
          f: `=A1*${c}`,
        });
      }
    }

    const sheetState: EditorState = {
      kind: 'spreadsheet',
      fileName: 'test-sheet.xlsx',
      format: 'xlsx',
      isDirty: false,
      spreadsheetData: [
        {
          name: 'Sheet1',
          id: '1',
          status: 1,
          order: 0,
          row: 5,
          column: 15,
          data: [row],
        },
      ],
    };

    const { bytes, omissions } = await exportPdf(sheetState);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    const extracted = await extractTextWordsFromBytes(bytes);
    // Displayed value is present
    expect(extracted).toContain('DisplayValueTotal');
    expect(extracted).toContain('Col1Val');
    // Formula strings are NOT written
    expect(extracted).not.toContain('=SUM');
    expect(extracted).not.toContain('=A1*');
  });

  it('exports a slide presentation placing text and rects', async () => {
    const slideState: EditorState = {
      kind: 'presentation',
      fileName: 'slides.pptx',
      format: 'pptx',
      isDirty: false,
      presentationData: {
        title: 'My Presentation',
        slides: [
          {
            id: 'slide-1',
            background: '#FAFAFA',
            elements: [
              {
                id: 'rect-1',
                type: 'rect',
                x: 10,
                y: 10,
                width: 80,
                height: 30,
                fill: '#E0E0E0',
              },
              {
                id: 'text-1',
                type: 'text',
                x: 15,
                y: 15,
                width: 70,
                height: 20,
                text: 'Welcome to Slide Presentation',
                color: '#333333',
                bold: true,
                fontSize: 24,
              },
            ],
          },
        ],
      },
    };

    const { bytes, omissions } = await exportPdf(slideState);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    const extracted = await extractTextWordsFromBytes(bytes);
    expect(extracted).toContain('Welcome to Slide Presentation');
  });

  it('rejects unsupported document kinds without writing', async () => {
    const invalidState: EditorState = {
      kind: 'pdf',
      fileName: 'doc.pdf',
      format: 'pdf',
      isDirty: false,
    };

    await expect(exportPdf(invalidState)).rejects.toThrow('Save as PDF is not available for pdf');
  });
});

