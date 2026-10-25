import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { exportDocx } from '../src/document/docx/exporter';
import { importDocx } from '../src/document/docx/importer';
import { saveEditorContent } from '../src/files/save';
import { loadFileToEditor } from '../src/files/open';
import { exportPdf } from '../src/pdf/exportPdf';
import {
  createEmptyChrome,
  createEmptyStory,
  hasChromeContent,
  type DocumentChrome,
} from '../src/document/chrome';
import type { EditorState } from '../src/types';

const samplePngBase64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Document Headers, Footers, and Page Numbers', () => {
  it('imports tab-separated runs in first paragraph into three zones', async () => {
    const zip = new JSZip();

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p><w:r><w:t>Body text</w:t></w:r></w:p>
          <w:sectPr>
            <w:headerReference w:type="default" r:id="rIdH1"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
      </Relationships>`
    );

    zip.file(
      'word/header1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p>
          <w:r><w:t>Left Zone</w:t></w:r>
          <w:r><w:tab/></w:r>
          <w:r><w:t>Center Zone</w:t></w:r>
          <w:r><w:tab/></w:r>
          <w:r><w:t>Right Zone</w:t></w:r>
        </w:p>
      </w:hdr>`
    );

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { chrome } = await importDocx(buf, 'tab_test.docx');

    expect(chrome).toBeDefined();
    expect(chrome?.header.line0.left.runs[0]).toMatchObject({ type: 'text', text: 'Left Zone' });
    expect(chrome?.header.line0.center.runs[0]).toMatchObject({ type: 'text', text: 'Center Zone' });
    expect(chrome?.header.line0.right.runs[0]).toMatchObject({ type: 'text', text: 'Right Zone' });
  });

  it('imports a single three-cell table into three zones', async () => {
    const zip = new JSZip();

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p><w:r><w:t>Body</w:t></w:r></w:p>
          <w:sectPr>
            <w:headerReference w:type="default" r:id="rIdH1"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
      </Relationships>`
    );

    zip.file(
      'word/header1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Cell 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Cell 2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Cell 3</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:hdr>`
    );

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { chrome } = await importDocx(buf, 'tbl_test.docx');

    expect(chrome).toBeDefined();
    expect(chrome?.header.line0.left.runs[0]).toMatchObject({ type: 'text', text: 'Cell 1' });
    expect(chrome?.header.line0.center.runs[0]).toMatchObject({ type: 'text', text: 'Cell 2' });
    expect(chrome?.header.line0.right.runs[0]).toMatchObject({ type: 'text', text: 'Cell 3' });
  });

  it('imports one floating logo into the left zone', async () => {
    const zip = new JSZip();

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p><w:r><w:t>Body</w:t></w:r></w:p>
          <w:sectPr>
            <w:headerReference w:type="default" r:id="rIdH1"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
      </Relationships>`
    );

    zip.file(
      'word/header1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:p>
          <w:r>
            <w:drawing>
              <wp:anchor>
                <a:graphic>
                  <a:graphicData>
                    <a:blip r:embed="rIdLogo"/>
                  </a:graphicData>
                </a:graphic>
              </wp:anchor>
            </w:drawing>
          </w:r>
          <w:r><w:t>Company Name</w:t></w:r>
        </w:p>
      </w:hdr>`
    );

    zip.file(
      'word/_rels/header1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>
      </Relationships>`
    );

    const pngBytes = Buffer.from(samplePngBase64.split(',')[1], 'base64');
    zip.file('word/media/logo.png', pngBytes);

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { chrome } = await importDocx(buf, 'logo_test.docx');

    expect(chrome).toBeDefined();
    const leftRuns = chrome?.header.line0.left.runs || [];
    expect(leftRuns.length).toBeGreaterThanOrEqual(1);
    expect(leftRuns[0].type).toBe('image');
    expect((leftRuns[0] as any).src).toContain('data:image/png;base64');
  });

  it('imports later paragraphs into full-width lines', async () => {
    const zip = new JSZip();

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p><w:r><w:t>Body</w:t></w:r></w:p>
          <w:sectPr>
            <w:headerReference w:type="default" r:id="rIdH1"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
      </Relationships>`
    );

    zip.file(
      'word/header1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p>
          <w:r><w:t>Letterhead Title</w:t></w:r>
        </w:p>
        <w:p>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r><w:t>123 Office Street, Suite 400</w:t></w:r>
        </w:p>
      </w:hdr>`
    );

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { chrome } = await importDocx(buf, 'lines_test.docx');

    expect(chrome).toBeDefined();
    expect(chrome?.header.lines.length).toBe(1);
    expect(chrome?.header.lines[0].align).toBe('center');
    expect(chrome?.header.lines[0].runs[0]).toMatchObject({
      type: 'text',
      text: '123 Office Street, Suite 400',
    });
  });

  it('detects titlePg and imports different first page header', async () => {
    const zip = new JSZip();

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p><w:r><w:t>Body</w:t></w:r></w:p>
          <w:sectPr>
            <w:titlePg/>
            <w:headerReference w:type="first" r:id="rIdFirst"/>
            <w:headerReference w:type="default" r:id="rIdDefault"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerFirst.xml"/>
        <Relationship Id="rIdDefault" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerDefault.xml"/>
      </Relationships>`
    );

    zip.file(
      'word/headerFirst.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>Cover Page Header</w:t></w:r></w:p>
      </w:hdr>`
    );

    zip.file(
      'word/headerDefault.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>Regular Page Header</w:t></w:r></w:p>
      </w:hdr>`
    );

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { chrome } = await importDocx(buf, 'titlepg_test.docx');

    expect(chrome?.differentFirstPage).toBe(true);
    expect(chrome?.firstHeader?.line0.left.runs[0]).toMatchObject({
      type: 'text',
      text: 'Cover Page Header',
    });
    expect(chrome?.header.line0.left.runs[0]).toMatchObject({
      type: 'text',
      text: 'Regular Page Header',
    });
  });

  it('records warnings for odd/even headers, multi-row tables, and undrawable images', async () => {
    const zip = new JSZip();

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p><w:r><w:t>Body</w:t></w:r></w:p>
          <w:sectPr>
            <w:headerReference w:type="default" r:id="rIdH1"/>
            <w:headerReference w:type="even" r:id="rIdHEven"/>
          </w:sectPr>
        </w:body>
      </w:document>`
    );

    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
        <Relationship Id="rIdHEven" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerEven.xml"/>
      </Relationships>`
    );

    zip.file(
      'word/header1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:tbl>
          <w:tr><w:tc><w:p><w:r><w:t>Row 1</w:t></w:r></w:p></w:tc></w:tr>
          <w:tr><w:tc><w:p><w:r><w:t>Row 2</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
        <w:p>
          <w:r>
            <w:drawing>
              <wp:anchor>
                <a:graphic>
                  <a:graphicData>
                    <a:blip r:embed="rIdEmf"/>
                  </a:graphicData>
                </a:graphic>
              </wp:anchor>
            </w:drawing>
          </w:r>
        </w:p>
      </w:hdr>`
    );

    zip.file(
      'word/_rels/header1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdEmf" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/badge.emf"/>
      </Relationships>`
    );

    zip.file('word/media/badge.emf', Buffer.from('dummy EMF binary data'));

    zip.file(
      'word/headerEven.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>Even Header</w:t></w:r></w:p>
      </w:hdr>`
    );

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { report } = await importDocx(buf, 'warnings_test.docx');

    const warningItems = report.warnings.map((w) => w.item);
    expect(warningItems).toContain('Odd/Even Headers');
    expect(warningItems).toContain('Multi-row Table');
    expect(warningItems).toContain('Undrawable Image');
  });

  it('keeps empty chrome and sample fixture header-free', async () => {
    const emptyChrome = createEmptyChrome();
    expect(hasChromeContent(emptyChrome)).toBe(false);

    const blob = await exportDocx('<p>No header here</p>', null, emptyChrome);
    const buf = await blob.arrayBuffer();
    const { chrome, report } = await importDocx(buf, 'empty_chrome.docx');

    expect(hasChromeContent(chrome)).toBe(false);
    expect(report.warnings.some((w) => w.item.includes('Header'))).toBe(false);
  });

  it('round-trips DOCX with zoned header, logo, page numbers, and different first page', async () => {
    const initialChrome: DocumentChrome = {
      differentFirstPage: true,
      firstHeader: {
        line0: {
          left: {
            align: 'left',
            runs: [
              { type: 'image', src: samplePngBase64 },
              { type: 'text', text: 'First Page Corp', bold: true },
            ],
          },
          center: { align: 'center', runs: [] },
          right: { align: 'right', runs: [] },
        },
        lines: [{ align: 'left', runs: [{ type: 'text', text: 'Confidential Document' }] }],
      },
      firstFooter: {
        line0: {
          left: { align: 'left', runs: [] },
          center: { align: 'center', runs: [] },
          right: { align: 'right', runs: [{ type: 'field', field: 'page' }] },
        },
        lines: [],
      },
      header: {
        line0: {
          left: { align: 'left', runs: [{ type: 'text', text: 'Regular Header' }] },
          center: { align: 'center', runs: [{ type: 'text', text: 'Folio' }] },
          right: { align: 'right', runs: [{ type: 'text', text: 'Q4 Report' }] },
        },
        lines: [],
      },
      footer: {
        line0: {
          left: { align: 'left', runs: [{ type: 'text', text: 'Page ' }] },
          center: { align: 'center', runs: [] },
          right: { align: 'right', runs: [{ type: 'field', field: 'pageOfTotal' }] },
        },
        lines: [],
      },
    };

    const docxBlob = await exportDocx('<p>Page 1 Body</p><hr data-page-break="true"><p>Page 2 Body</p>', null, initialChrome);
    const docxBuffer = await docxBlob.arrayBuffer();

    // 1st open
    const { chrome: loadedChrome } = await importDocx(docxBuffer, 'roundtrip.docx');
    expect(loadedChrome).toBeDefined();
    expect(loadedChrome?.differentFirstPage).toBe(true);

    // Assert first page header has logo and text
    const firstLeftRuns = loadedChrome?.firstHeader?.line0.left.runs || [];
    expect(firstLeftRuns.some((r) => r.type === 'image')).toBe(true);
    expect(firstLeftRuns.some((r) => r.type === 'text' && r.text.includes('First Page Corp'))).toBe(true);
    expect(loadedChrome?.firstHeader?.lines[0].runs[0]).toMatchObject({ text: 'Confidential Document' });

    // Assert first footer has page digit
    const firstRightRuns = loadedChrome?.firstFooter?.line0.right.runs || [];
    expect(firstRightRuns.some((r) => r.type === 'field' && r.field === 'page')).toBe(true);

    // Assert default header has 3 zones
    expect(loadedChrome?.header.line0.left.runs[0]).toMatchObject({ text: 'Regular Header' });
    expect(loadedChrome?.header.line0.center.runs[0]).toMatchObject({ text: 'Folio' });
    expect(loadedChrome?.header.line0.right.runs[0]).toMatchObject({ text: 'Q4 Report' });

    // Assert default footer has pageOfTotal
    const defaultFooterRight = loadedChrome?.footer.line0.right.runs || [];
    expect(defaultFooterRight.some((r) => r.type === 'field' && r.field === 'pageOfTotal')).toBe(true);

    // Save again and re-open
    const reSavedBlob = await exportDocx('<p>Page 1 Body</p><hr data-page-break="true"><p>Page 2 Body</p>', null, loadedChrome);
    const reLoaded = await importDocx(await reSavedBlob.arrayBuffer(), 'roundtrip_reloaded.docx');

    expect(reLoaded.chrome?.differentFirstPage).toBe(true);
    expect(reLoaded.chrome?.firstHeader?.line0.left.runs.some((r) => r.type === 'image')).toBe(true);
    expect(reLoaded.chrome?.header.line0.center.runs[0]).toMatchObject({ text: 'Folio' });
    expect(reLoaded.chrome?.footer.line0.right.runs.some((r) => r.type === 'field' && r.field === 'pageOfTotal')).toBe(true);
  });

  it('warns when saving to body-only formats with non-empty chrome', async () => {
    const chromeWithContent: DocumentChrome = {
      differentFirstPage: false,
      header: {
        line0: {
          left: { align: 'left', runs: [{ type: 'text', text: 'Important Header' }] },
          center: { align: 'center', runs: [] },
          right: { align: 'right', runs: [] },
        },
        lines: [],
      },
      footer: createEmptyStory(),
    };

    const state: EditorState = {
      kind: 'document',
      fileName: 'document.docx',
      format: 'docx',
      isDirty: true,
      documentContent: {
        type: 'doc',
        attrs: { chrome: chromeWithContent },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
      },
    };

    const res = await saveEditorContent(state, { format: 'odt', fileName: 'document.odt' });
    expect(res.success).toBe(true);
    expect(res.updatedState?.importReport?.warnings.some((w) => w.item === 'Headers & Footers')).toBe(true);
  });

  it('PDF export emits footer text on the page', async () => {
    const chromeWithFooter: DocumentChrome = {
      differentFirstPage: false,
      header: createEmptyStory(),
      footer: {
        line0: {
          left: { align: 'left', runs: [] },
          center: { align: 'center', runs: [] },
          right: { align: 'right', runs: [{ type: 'field', field: 'pageOfTotal' }] },
        },
        lines: [],
      },
    };

    const state: EditorState = {
      kind: 'document',
      fileName: 'footer_doc.docx',
      format: 'docx',
      isDirty: false,
      documentContent: {
        type: 'doc',
        attrs: { chrome: chromeWithFooter },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'PDF Body Content' }] }],
      },
    };

    const { bytes } = await exportPdf(state);
    expect(bytes.length).toBeGreaterThan(100);

    // Extract text with pdfjs
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const page = await pdfDoc.getPage(1);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map((item: any) => item.str).join(' ');

    expect(strings).toContain('PDF Body Content');
    expect(strings).toContain('Page 1 of 1');
  });
});

