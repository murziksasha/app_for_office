import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { ImportReport, ImportWarning } from '../../types';
import { sanitizeHtml } from '../sanitize';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => {
    return ['p', 'h', 'span', 'list', 'list-item', 'table', 'table-row', 'table-cell', 'style'].includes(name);
  },
});

interface StyleDef {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  fontSize?: string;
}

export async function importOdt(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ html: string; report: ImportReport }> {
  const warnings: ImportWarning[] = [];
  const skippedFeatures: string[] = [];

  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) {
    throw new Error('Invalid ODT package: content.xml not found');
  }

  const xmlText = await contentFile.async('text');
  const parsed = xmlParser.parse(xmlText);
  const doc = parsed?.['document-content'] || parsed?.document;

  if (!doc) {
    throw new Error('Invalid ODT content structure');
  }

  // Parse automatic styles
  const styleMap: Record<string, StyleDef> = {};
  const autoStyles = doc['automatic-styles']?.style || [];
  const styleList = Array.isArray(autoStyles) ? autoStyles : [autoStyles];

  for (const st of styleList) {
    const name = st['@_name'];
    const tp = st['text-properties'];
    if (name && tp) {
      styleMap[name] = {
        bold: tp['@_font-weight'] === 'bold' || tp['@_font-weight-asian'] === 'bold',
        italic: tp['@_font-style'] === 'italic' || tp['@_font-style-asian'] === 'italic',
        underline: tp['@_text-underline-style'] === 'solid',
        strike: tp['@_text-line-through-style'] === 'solid',
        color: tp['@_color'],
        fontSize: tp['@_font-size'],
      };
    }
  }

  // Check skipped features
  if (xmlText.includes('annotation')) {
    skippedFeatures.push('Comments/Annotations');
    warnings.push({ item: 'Comments', reason: 'ODT annotations were omitted' });
  }

  const bodyText = doc.body?.text;
  if (!bodyText) {
    return {
      html: '<p></p>',
      report: { fileName, format: 'odt', importedAt: new Date().toISOString(), warnings, skippedFeatures },
    };
  }

  // Helper to extract image
  const extractImage = async (href: string): Promise<string | null> => {
    const cleanPath = href.replace(/^(\.\/|\/)/, '');
    const imgFile = zip.file(cleanPath);
    if (!imgFile) return null;
    try {
      const b64 = await imgFile.async('base64');
      const ext = cleanPath.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      return `data:${mime};base64,${b64}`;
    } catch {
      return null;
    }
  };

  // Helper to process inline spans and text
  const renderSpan = (sp: any): string => {
    if (!sp) return '';
    if (typeof sp === 'string') {
      return sp.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    const styleName = sp['@_style-name'];
    const sDef = styleName ? styleMap[styleName] : undefined;
    let text = '';
    if (typeof sp === 'object') {
      if (sp['#text']) text = String(sp['#text']);
      else if (sp.s) text = ' '; // <text:s/> is space
    }

    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (sDef) {
      if (sDef.color) html = `<span style="color: ${sDef.color}">${html}</span>`;
      if (sDef.bold) html = `<strong>${html}</strong>`;
      if (sDef.italic) html = `<em>${html}</em>`;
      if (sDef.underline) html = `<u>${html}</u>`;
      if (sDef.strike) html = `<s>${html}</s>`;
    }
    return html;
  };

  const renderParagraphContent = (p: any): string => {
    if (typeof p === 'string') {
      return p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (typeof p === 'number') return String(p);

    let content = '';
    if (p['#text']) {
      content += renderSpan(p['#text']);
    }

    if (p.span) {
      const spans = Array.isArray(p.span) ? p.span : [p.span];
      spans.forEach((sp: any) => {
        content += renderSpan(sp);
      });
    }

    if (p.a) {
      const links = Array.isArray(p.a) ? p.a : [p.a];
      links.forEach((a: any) => {
        const href = a['@_href'] || '#';
        const txt = a['#text'] || href;
        content += `<a href="${href}">${renderSpan(txt)}</a>`;
      });
    }

    return content || '<br>';
  };

  let resultHtml = '';

  // Process elements
  const pList = bodyText.p ? (Array.isArray(bodyText.p) ? bodyText.p : [bodyText.p]) : [];
  const hList = bodyText.h ? (Array.isArray(bodyText.h) ? bodyText.h : [bodyText.h]) : [];
  const listItems = bodyText.list ? (Array.isArray(bodyText.list) ? bodyText.list : [bodyText.list]) : [];
  const tables = bodyText.table ? (Array.isArray(bodyText.table) ? bodyText.table : [bodyText.table]) : [];

  // Headings
  hList.forEach((h: any) => {
    const lvl = Math.min(Math.max(parseInt(h['@_outline-level'] || '1', 10), 1), 6);
    resultHtml += `<h${lvl}>${renderParagraphContent(h)}</h${lvl}>`;
  });

  // Paragraphs
  pList.forEach((p: any) => {
    resultHtml += `<p>${renderParagraphContent(p)}</p>`;
  });

  // Lists
  listItems.forEach((l: any) => {
    resultHtml += '<ul>';
    const items = l['list-item'] ? (Array.isArray(l['list-item']) ? l['list-item'] : [l['list-item']]) : [];
    items.forEach((item: any) => {
      const innerP = item.p ? (Array.isArray(item.p) ? item.p : [item.p]) : [];
      const itemContent = innerP.map(renderParagraphContent).join(' ');
      resultHtml += `<li>${itemContent}</li>`;
    });
    resultHtml += '</ul>';
  });

  // Tables
  tables.forEach((t: any) => {
    resultHtml += '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;"><tbody>';
    const rows = t['table-row'] ? (Array.isArray(t['table-row']) ? t['table-row'] : [t['table-row']]) : [];
    rows.forEach((r: any) => {
      resultHtml += '<tr>';
      const cells = r['table-cell'] ? (Array.isArray(r['table-cell']) ? r['table-cell'] : [r['table-cell']]) : [];
      cells.forEach((c: any) => {
        resultHtml += '<td style="border: 1px solid #d8d3c8; padding: 6px 10px;">';
        const cellP = c.p ? (Array.isArray(c.p) ? c.p : [c.p]) : [];
        resultHtml += cellP.map(renderParagraphContent).join('<br>');
        resultHtml += '</td>';
      });
      resultHtml += '</tr>';
    });
    resultHtml += '</tbody></table>';
  });

  const sanitized = sanitizeHtml(resultHtml || '<p></p>');

  return {
    html: sanitized,
    report: {
      fileName,
      format: 'odt',
      importedAt: new Date().toISOString(),
      warnings,
      skippedFeatures,
    },
  };
}
