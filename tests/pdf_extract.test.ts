import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractTextFromPdf } from '../src/pdf/extractText';

describe('PDF text extraction', () => {
  it('extracts paragraphs in order, keeps header text, and skips empty pages', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Page 1: Header + 2 paragraphs
    const page1 = doc.addPage([612, 792]);
    // Header
    page1.drawText('Document Header', { x: 54, y: 750, size: 10, font });
    // Paragraph 1: two lines close together (vertical gap ~14pt with 12pt font)
    page1.drawText('First paragraph first line', { x: 54, y: 700, size: 12, font });
    page1.drawText('First paragraph second line', { x: 54, y: 686, size: 12, font });
    // Paragraph 2: clearly larger vertical gap (> 12 * 1.45 = 17.4pt, e.g. gap = 46pt)
    page1.drawText('Second paragraph line here', { x: 54, y: 640, size: 12, font });

    // Page 2: Empty page (no selectable text)
    doc.addPage([612, 792]);

    // Page 3: Paragraph on third page
    const page3 = doc.addPage([612, 792]);
    page3.drawText('Third page text content', { x: 54, y: 700, size: 12, font });

    const pdfBytes = await doc.save();
    const result = await extractTextFromPdf(pdfBytes);

    expect(result.skippedPages).toEqual([2]);
    expect(result.paragraphsCount).toBe(4);
    expect(result.html).toContain('Document Header');
    expect(result.html).toContain('First paragraph first line First paragraph second line');
    expect(result.html).toContain('Second paragraph line here');
    expect(result.html).toContain('Third page text content');

    // Assert paragraph order
    const p1Idx = result.html.indexOf('Document Header');
    const p2Idx = result.html.indexOf('First paragraph first line');
    const p3Idx = result.html.indexOf('Second paragraph line here');
    const p4Idx = result.html.indexOf('Third page text content');
    expect(p1Idx).toBeLessThan(p2Idx);
    expect(p2Idx).toBeLessThan(p3Idx);
    expect(p3Idx).toBeLessThan(p4Idx);
  });

  it('keeps hyphens at the end of a line', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);

    page.drawText('This is a hyphen-', { x: 54, y: 700, size: 12, font });
    page.drawText('separated sentence', { x: 54, y: 686, size: 12, font });

    const pdfBytes = await doc.save();
    const result = await extractTextFromPdf(pdfBytes);

    expect(result.html).toContain('This is a hyphen- separated sentence');
  });

  it('refuses empty files and unreadable data', async () => {
    await expect(extractTextFromPdf(new Uint8Array(0))).rejects.toThrow('This PDF is protected or unreadable');
    await expect(extractTextFromPdf(new Uint8Array([1, 2, 3, 4, 5, 6]))).rejects.toThrow('This PDF is protected or unreadable');
  });

  it('reports empty result when every page has no selectable text', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);

    const pdfBytes = await doc.save();
    const result = await extractTextFromPdf(pdfBytes);

    expect(result.paragraphsCount).toBe(0);
    expect(result.html).toBe('');
    expect(result.skippedPages).toEqual([1, 2]);
  });
});

