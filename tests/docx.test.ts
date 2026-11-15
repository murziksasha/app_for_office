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

  it('opens a zero-byte docx file (like Windows ShellNew) as an empty document', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/empty.docx');
    const buffer = fs.readFileSync(fixturePath);
    expect(buffer.byteLength).toBe(0);

    const { html, report, pageSetup } = await importDocx(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
      'New Документ Microsoft Word.docx'
    );
    expect(html).toBe('<p></p>');
    expect(report.fileName).toBe('New Документ Microsoft Word.docx');
    expect(report.warnings).toHaveLength(0);
    expect(pageSetup).toBeNull();

    // Round-trip export of empty document
    const blob = await exportDocx(html);
    expect(blob.size).toBeGreaterThan(100);
    const reloaded = await importDocx(await blob.arrayBuffer(), 'reloaded.docx');
    expect(reloaded.html).toBe('<p></p>');
  });

  it('resolves styles.xml docDefaults and named heading styles onto runs', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/styles_sample.docx');
    const buffer = fs.readFileSync(fixturePath);
    const { html, pageSetup, report } = await importDocx(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
      'styles_sample.docx'
    );

    // Visible text is kept
    expect(html).toContain('Styled Heading');
    expect(html).toContain('Standard body paragraph inheriting doc defaults.');
    expect(html).toContain('With custom red run.');

    // Heading inherits Heading 1 style from styles.xml: size 16pt (32 half-pts), color #2e74b5, font Calibri Light, bold
    expect(html).toMatch(/<h1[^>]*>.*font-size:\s*16pt/i);
    expect(html).toMatch(/<h1[^>]*>.*color:\s*#2e74b5/i);
    expect(html).toMatch(/<h1[^>]*>.*font-family:\s*'Calibri Light'/i);
    expect(html).toMatch(/<h1[^>]*>.*<strong>Styled Heading<\/strong>/i);

    // Normal body paragraph inherits docDefaults: size 11pt, color #333333, font Calibri
    expect(html).toMatch(/<p[^>]*>.*font-size:\s*11pt/i);
    expect(html).toMatch(/<p[^>]*>.*color:\s*#333333/i);
    expect(html).toMatch(/<p[^>]*>.*font-family:\s*'Calibri'/i);

    // Custom run overrides inherited font size and color
    expect(html).toMatch(/color:\s*#ff0000/i);
    expect(html).toMatch(/font-size:\s*14pt/i);

    // Section setup preserved from sectPr (A4 portrait)
    expect(pageSetup?.size).toBe('a4');
    expect(pageSetup?.marginTop).toBeCloseTo(20, 1);
    expect(pageSetup?.marginBottom).toBeCloseTo(20, 1);
    expect(pageSetup?.marginLeft).toBeCloseTo(30, 1);
    expect(pageSetup?.marginRight).toBeCloseTo(20, 1);
    expect(report.warnings).toHaveLength(0);

    // Export and re-import preserves visible text and page setup
    const exportedBlob = await exportDocx(html, pageSetup);
    const reloaded = await importDocx(await exportedBlob.arrayBuffer(), 'reloaded_styles.docx');
    expect(reloaded.html).toContain('Styled Heading');
    expect(reloaded.html).toContain('Standard body paragraph');
    expect(reloaded.pageSetup?.size).toBe('a4');
  });

  it('imports an empty Word package with sectPr as one empty paragraph plus page setup', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
         <w:body>
           <w:p/>
           <w:sectPr>
             <w:pgSz w:w="11906" w:h="16838"/>
             <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701"/>
           </w:sectPr>
         </w:body>
       </w:document>`
    );
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
         <Default Extension="xml" ContentType="application/xml"/>
         <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
       </Types>`
    );

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const { html, pageSetup, report } = await importDocx(zipBuffer, 'empty_pkg.docx');

    expect(html).toBe('<p></p>');
    expect(pageSetup?.size).toBe('a4');
    expect(pageSetup?.marginLeft).toBeCloseTo(30, 1);
    expect(pageSetup?.marginRight).toBeCloseTo(20, 1);
    expect(report.warnings).toHaveLength(0);
  });

  it('round-trips a 1.5-spaced paragraph', async () => {
    const inputHtml = '<p style="line-height: 1.5;">Paragraph with 1.5 line spacing.</p>';
    const blob = await exportDocx(inputHtml);
    const arrayBuffer = await blob.arrayBuffer();
    const { html } = await importDocx(arrayBuffer, 'spacing.docx');

    expect(html).toContain('line-height: 1.5');
    expect(html).toContain('Paragraph with 1.5 line spacing.');
  });
});

