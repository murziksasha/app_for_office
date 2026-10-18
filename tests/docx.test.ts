import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { exportDocx } from '../src/document/docx/exporter';
import { importDocx } from '../src/document/docx/importer';

describe('DOCX Importer and Exporter', () => {
  it('round-trips HTML to DOCX and imports back', async () => {
    const inputHtml = `
      <h1>Quarterly Strategy</h1>
      <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> words.</p>
      <ul>
        <li>Objective Alpha</li>
        <li>Objective Beta</li>
      </ul>
    `;

    const blob = await exportDocx(inputHtml);
    expect(blob.size).toBeGreaterThan(100);

    const arrayBuffer = await blob.arrayBuffer();
    const { html, report } = await importDocx(arrayBuffer, 'test.docx');

    expect(html).toContain('Quarterly Strategy');
    expect(html).toContain('Objective Alpha');
    expect(report.format).toBe('docx');
    expect(report.fileName).toBe('test.docx');
  });

  it('reads the pre-generated sample.docx fixture', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.docx');
    const buffer = fs.readFileSync(fixturePath);
    const { html, report } = await importDocx(buffer.buffer as ArrayBuffer, 'sample.docx');

    expect(html).toContain('Executive Summary');
    expect(html).toContain('bold statement');
    expect(report.fileName).toBe('sample.docx');
  });

  it('falls back gracefully to Mammoth if custom parser encounters non-standard XML', async () => {
    // Construct a zip package where word/document.xml has unexpected non-standard namespace/schema
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
         <w:body>
           <w:p><w:r><w:t>Fallback content from Mammoth test</w:t></w:r></w:p>
         </w:body>
       </w:document>`
    );
    // Add [Content_Types].xml so mammoth recognizes it as docx
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
         <Default Extension="xml" ContentType="application/xml"/>
         <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
       </Types>`
    );

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const { html } = await importDocx(zipBuffer, 'fallback.docx');

    expect(html).toContain('Fallback content');
  });
});

