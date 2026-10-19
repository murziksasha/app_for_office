import fs from 'fs';
import path from 'path';
import { exportDocx } from '../src/document/docx/exporter';
import { exportOdt } from '../src/document/odt/exporter';
import { exportXlsx, FortuneSheetData } from '../src/spreadsheet/adapters';
import { exportPptx } from '../src/slides/pptxAdapter';
import { PresentationModel } from '../src/types';

export async function buildFixtures() {
  const fixturesDir = path.resolve(import.meta.dirname, '.');

  const files = [
    'sample.docx',
    'sample.odt',
    'sample.xlsx',
    'sample.pptx',
    'sample_binary.doc',
    'sample_text.pdf',
    'sample_empty.pdf',
  ];
  const allExist = files.every((f) => {
    const p = path.join(fixturesDir, f);
    try {
      return fs.existsSync(p) && fs.statSync(p).size > 0;
    } catch {
      return false;
    }
  });

  if (allExist) {
    return;
  }

  // 1. DOCX fixture
  const docxHtml = `
    <h1>Folio Executive Summary</h1>
    <p>This is a <strong>bold statement</strong> and this is <em>italic text</em>.</p>
    <ul>
      <li>First key objective</li>
      <li>Second key objective</li>
    </ul>
    <table>
      <tr><th>Metric</th><th>Target</th></tr>
      <tr><td>Performance</td><td>100% Local</td></tr>
    </table>
  `;
  const docxBlob = await exportDocx(docxHtml);
  const docxBuf = Buffer.from(await docxBlob.arrayBuffer());
  fs.writeFileSync(path.join(fixturesDir, 'sample.docx'), docxBuf);

  // 2. ODT fixture
  const odtHtml = `
    <h1>ODT Project Scope</h1>
    <p>Document testing for <strong>OpenDocument</strong> text files.</p>
    <ul>
      <li>Local-first security</li>
    </ul>
  `;
  const odtBlob = await exportOdt(odtHtml);
  const odtBuf = Buffer.from(await odtBlob.arrayBuffer());
  fs.writeFileSync(path.join(fixturesDir, 'sample.odt'), odtBuf);

  // 3. XLSX fixture
  const sheetData: FortuneSheetData[] = [
    {
      name: 'Financials',
      id: 'sheet_1',
      status: 1,
      order: 0,
      row: 30,
      column: 10,
      data: [
        [
          { v: 'Category', bl: 1, m: 'Category' },
          { v: 'Q1', bl: 1, m: 'Q1' },
          { v: 'Q2', bl: 1, m: 'Q2' },
          { v: 'Total', bl: 1, m: 'Total' },
        ],
        [
          { v: 'Revenue', m: 'Revenue' },
          { v: 10000, m: '10000' },
          { v: 12000, m: '12000' },
          { f: '=SUM(B2:C2)', v: 22000, m: '22000' },
        ],
        [
          { v: 'Expenses', m: 'Expenses' },
          { v: 4000, m: '4000' },
          { v: 5000, m: '5000' },
          { f: '=SUM(B3:C3)', v: 9000, m: '9000' },
        ],
      ],
    },
  ];
  const xlsxBlob = await exportXlsx(sheetData);
  const xlsxBuf = Buffer.from(await xlsxBlob.arrayBuffer());
  fs.writeFileSync(path.join(fixturesDir, 'sample.xlsx'), xlsxBuf);

  // 4. PPTX fixture
  const presentation: PresentationModel = {
    title: 'Folio Presentation',
    slides: [
      {
        id: 's1',
        title: 'Title Slide',
        background: '#ffffff',
        elements: [
          {
            id: 'e1',
            type: 'text',
            x: 10,
            y: 20,
            width: 80,
            height: 20,
            text: 'Folio Presentation Deck',
            fontSize: 32,
            bold: true,
            color: '#0f766e',
          },
          {
            id: 'e2',
            type: 'text',
            x: 10,
            y: 45,
            width: 80,
            height: 30,
            text: 'A modern local-first office suite.\nZero cloud dependencies.',
            fontSize: 18,
            color: '#1e2022',
          },
        ],
      },
    ],
  };
  const pptxBlob = await exportPptx(presentation);
  const pptxBuf = Buffer.from(await pptxBlob.arrayBuffer());
  fs.writeFileSync(path.join(fixturesDir, 'sample.pptx'), pptxBuf);

  // 5. Legacy binary .doc fixture (OLE compound header)
  const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
  fs.writeFileSync(path.join(fixturesDir, 'sample_binary.doc'), oleHeader);

  // 6. PDF fixtures
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const textPdfDoc = await PDFDocument.create();
  const font = await textPdfDoc.embedFont(StandardFonts.Helvetica);
  const p1 = textPdfDoc.addPage([612, 792]);
  p1.drawText('Sample Notes from PDF', { x: 54, y: 720, size: 14, font });
  p1.drawText('This is paragraph one of the notes.', { x: 54, y: 690, size: 12, font });
  p1.drawText('Second line of paragraph one.', { x: 54, y: 674, size: 12, font });
  p1.drawText('And this is paragraph two.', { x: 54, y: 620, size: 12, font });
  fs.writeFileSync(path.join(fixturesDir, 'sample_text.pdf'), Buffer.from(await textPdfDoc.save()));

  const emptyPdfDoc = await PDFDocument.create();
  emptyPdfDoc.addPage([612, 792]);
  fs.writeFileSync(path.join(fixturesDir, 'sample_empty.pdf'), Buffer.from(await emptyPdfDoc.save()));

  console.log('Fixtures generated successfully.');
}

