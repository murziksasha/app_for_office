import JSZip from 'jszip';
import { clampPageSetup, PAGE_MM, readPageSetup, type PageSetup } from '../pageSetup';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function processInlineNodes(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeXml(node.textContent || '');
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') return '<text:line-break/>';

    const childContent = Array.from(el.childNodes).map(processInlineNodes).join('');

    if (tag === 'strong' || tag === 'b') {
      return `<text:span text:style-name="Bold">${childContent}</text:span>`;
    }
    if (tag === 'em' || tag === 'i') {
      return `<text:span text:style-name="Italic">${childContent}</text:span>`;
    }
    if (tag === 'u') {
      return `<text:span text:style-name="Underline">${childContent}</text:span>`;
    }
    if (tag === 'a') {
      const href = escapeXml(el.getAttribute('href') || '#');
      return `<text:a xlink:type="simple" xlink:href="${href}">${childContent}</text:a>`;
    }

    return childContent;
  }

  return '';
}

export async function exportOdt(htmlContent: string, pageSetup?: PageSetup | null): Promise<Blob> {
  const parser = new (globalThis.DOMParser || DOMParser)();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const docElement = doc.body;

  let textXml = '';

  const processBlockNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      const level = tag.replace('h', '');
      const content = Array.from(el.childNodes).map(processInlineNodes).join('');
      textXml += `<text:h text:outline-level="${level}">${content}</text:h>`;
    } else if (tag === 'p') {
      const content = Array.from(el.childNodes).map(processInlineNodes).join('');
      textXml += `<text:p>${content}</text:p>`;
    } else if (tag === 'ul' || tag === 'ol') {
      textXml += '<text:list>';
      const items = Array.from(el.querySelectorAll(':scope > li'));
      items.forEach((li) => {
        const itemContent = Array.from(li.childNodes).map(processInlineNodes).join('');
        textXml += `<text:list-item><text:p>${itemContent}</text:p></text:list-item>`;
      });
      textXml += '</text:list>';
    } else if (tag === 'table') {
      textXml += '<table:table table:name="Table1">';
      const rows = Array.from(el.querySelectorAll('tr'));
      rows.forEach((r) => {
        textXml += '<table:table-row>';
        const cells = Array.from(r.querySelectorAll('th, td'));
        cells.forEach((c) => {
          const cellContent = Array.from(c.childNodes).map(processInlineNodes).join('');
          textXml += `<table:table-cell office:value-type="string"><text:p>${cellContent}</text:p></table:table-cell>`;
        });
        textXml += '</table:table-row>';
      });
      textXml += '</table:table>';
    } else {
      Array.from(el.childNodes).forEach(processBlockNode);
    }
  };

  Array.from(docElement.childNodes).forEach(processBlockNode);
  if (!textXml) {
    textXml = '<text:p></text:p>';
  }

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
    <style:style style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
    <style:style style:name="Underline" style:family="text"><style:text-properties style:text-underline-style="solid"/></style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${textXml}
    </office:text>
  </office:body>
</office:document-content>`;

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

  const setup = clampPageSetup(pageSetup ?? readPageSetup(null));
  const page = PAGE_MM[setup.size];
  const cm = (mm: number) => (mm / 10).toFixed(2);
  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:automatic-styles>
    <style:page-layout style:name="FolioPage">
      <style:page-layout-properties fo:page-width="${cm(page.width)}cm" fo:page-height="${cm(page.height)}cm" fo:margin-top="${cm(setup.marginTop)}cm" fo:margin-right="${cm(setup.marginRight)}cm" fo:margin-bottom="${cm(setup.marginBottom)}cm" fo:margin-left="${cm(setup.marginLeft)}cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="FolioPage"/>
  </office:master-styles>
</office:document-styles>`;

  const zip = new JSZip();
  // mimetype MUST be uncompressed
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.folder('META-INF')?.file('manifest.xml', manifestXml);
  zip.file('content.xml', contentXml);
  zip.file('styles.xml', stylesXml);

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' });
}
