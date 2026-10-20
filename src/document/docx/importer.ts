import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import mammoth from 'mammoth';
import { ImportReport, ImportWarning } from '../../types';
import { sanitizeHtml } from '../sanitize';
import { pageSizeLabel, readDocxSection, type PageSetup } from '../pageSetup';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => {
    return ['p', 'r', 'tbl', 'tr', 'tc', 'Relationship', 'lvl', 'num', 'abstractNum'].includes(name);
  },
});

interface RelMap {
  [id: string]: {
    target: string;
    type: string;
    targetMode?: string;
  };
}

interface NumberingMap {
  [numId: string]: 'bullet' | 'ordered';
}

/**
 * Extracts relationship mappings from word/_rels/document.xml.rels
 */
async function loadRelationships(zip: JSZip): Promise<RelMap> {
  const relFile = zip.file('word/_rels/document.xml.rels');
  if (!relFile) return {};

  try {
    const xmlText = await relFile.async('text');
    const parsed = xmlParser.parse(xmlText);
    const rels = parsed?.Relationships?.Relationship || [];
    const relList = Array.isArray(rels) ? rels : [rels];
    const map: RelMap = {};

    for (const r of relList) {
      if (r['@_Id'] && r['@_Target']) {
        map[r['@_Id']] = {
          target: r['@_Target'],
          type: r['@_Type'] || '',
          targetMode: r['@_TargetMode'],
        };
      }
    }
    return map;
  } catch (err) {
    console.warn('Could not parse document.xml.rels:', err);
    return {};
  }
}

/**
 * Reads numbering.xml to differentiate bullets vs ordered lists
 */
async function loadNumbering(zip: JSZip): Promise<NumberingMap> {
  const numFile = zip.file('word/numbering.xml');
  if (!numFile) return {};

  try {
    const xmlText = await numFile.async('text');
    const parsed = xmlParser.parse(xmlText);
    const numbering = parsed?.numbering;
    if (!numbering) return {};

    const abstractNums = Array.isArray(numbering.abstractNum)
      ? numbering.abstractNum
      : numbering.abstractNum
      ? [numbering.abstractNum]
      : [];
    const abstractFmtMap: Record<string, 'bullet' | 'ordered'> = {};

    for (const abs of abstractNums) {
      const absId = abs['@_abstractNumId'];
      const lvls = Array.isArray(abs.lvl) ? abs.lvl : abs.lvl ? [abs.lvl] : [];
      let isBullet = false;
      for (const lvl of lvls) {
        const fmt = lvl.numFmt?.['@_val'];
        if (fmt === 'bullet') {
          isBullet = true;
          break;
        }
      }
      if (absId !== undefined) {
        abstractFmtMap[String(absId)] = isBullet ? 'bullet' : 'ordered';
      }
    }

    const nums = Array.isArray(numbering.num) ? numbering.num : numbering.num ? [numbering.num] : [];
    const numMap: NumberingMap = {};
    for (const num of nums) {
      const numId = num['@_numId'];
      const absRef = num.abstractNumId?.['@_val'];
      if (numId !== undefined && absRef !== undefined) {
        numMap[String(numId)] = abstractFmtMap[String(absRef)] || 'bullet';
      }
    }
    return numMap;
  } catch (err) {
    console.warn('Could not parse numbering.xml:', err);
    return {};
  }
}

/**
 * Resolves an image target from zip and returns a base64 data URL
 */
async function extractImageDataUrl(zip: JSZip, target: string): Promise<string | null> {
  // Target in rels may be relative, like 'media/image1.png' or '../media/image1.png'
  const normalizedPath = target.startsWith('word/')
    ? target
    : target.startsWith('/')
    ? target.slice(1)
    : `word/${target.replace(/^(\.\.\/)+/, '')}`;

  const imageFile = zip.file(normalizedPath);
  if (!imageFile) return null;

  try {
    const base64 = await imageFile.async('base64');
    let mime = 'image/png';
    const lower = target.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.gif')) mime = 'image/gif';
    else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
    else if (lower.endsWith('.webp')) mime = 'image/webp';

    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Imports DOCX array buffer into sanitized HTML and produces an ImportReport.
 */
export async function importDocx(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ html: string; report: ImportReport; pageSetup?: PageSetup | null }> {
  const warnings: ImportWarning[] = [];
  const skippedFeatures: string[] = [];

  try {
    const zip = await JSZip.loadAsync(buffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      throw new Error('word/document.xml not found in DOCX package');
    }

    const xmlText = await docFile.async('text');
    const parsed = xmlParser.parse(xmlText);
    const body = parsed?.document?.body;

    if (!body) {
      throw new Error('Invalid document body in word/document.xml');
    }

    const relMap = await loadRelationships(zip);
    const numMap = await loadNumbering(zip);

    // Detect skipped features in raw XML
    if (xmlText.includes('commentReference') || zip.file('word/comments.xml')) {
      skippedFeatures.push('Comments');
      warnings.push({ item: 'Comments', reason: 'Word comments are not supported in this version' });
    }
    if (xmlText.includes('<w:ins ') || xmlText.includes('<w:del ')) {
      skippedFeatures.push('Tracked Changes');
      warnings.push({ item: 'Tracked Changes', reason: 'Tracked changes were accepted into the main text' });
    }
    if (xmlText.includes('txbxContent') || xmlText.includes('v:textbox')) {
      skippedFeatures.push('Text Boxes');
      warnings.push({ item: 'Floating Text Boxes', reason: 'Positioned floating text boxes skipped' });
    }
    if (xmlText.includes('m:oMath') || xmlText.includes('m:oMathPara')) {
      skippedFeatures.push('Equations');
      warnings.push({ item: 'Math Equations', reason: 'Equations were omitted' });
    }
    if (xmlText.includes('headerReference') || xmlText.includes('footerReference')) {
      skippedFeatures.push('Headers & Footers');
      warnings.push({ item: 'Headers & Footers', reason: 'Document headers and footers were omitted' });
    }

    // Helper to render text runs
    const renderRun = async (r: any): Promise<string> => {
      if (!r) return '';
      const rPr = r.rPr || {};
      let text = '';

      if (r.t) {
        if (typeof r.t === 'string') text = r.t;
        else if (typeof r.t === 'number') text = String(r.t);
        else if (r.t['#text']) text = String(r.t['#text']);
      }

      // Check break
      if (r.br) text += '<br>';
      if (r.tab) text += '&emsp;';

      // Check drawing / image
      if (r.drawing) {
        const drawingStr = JSON.stringify(r.drawing);
        const blipMatch = drawingStr.match(/"@_embed":\s*"([^"]+)"/);
        if (blipMatch && blipMatch[1]) {
          const rId = blipMatch[1];
          const rel = relMap[rId];
          if (rel && rel.target) {
            const dataUrl = await extractImageDataUrl(zip, rel.target);
            if (dataUrl) {
              return `<img src="${dataUrl}" alt="Imported document image" style="max-width: 100%; height: auto;" />`;
            }
          }
        }
      }

      if (!text) return '';

      // Escape HTML
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Style attributes
      const styles: string[] = [];
      if (rPr.color && rPr.color['@_val']) {
        const c = rPr.color['@_val'];
        if (c !== 'auto') styles.push(`color: #${c}`);
      }
      if (rPr.sz && rPr.sz['@_val']) {
        const pt = parseInt(rPr.sz['@_val'], 10) / 2;
        if (!isNaN(pt)) styles.push(`font-size: ${pt}pt`);
      }
      if (rPr.rFonts && (rPr.rFonts['@_ascii'] || rPr.rFonts['@_hAnsi'])) {
        const font = rPr.rFonts['@_ascii'] || rPr.rFonts['@_hAnsi'];
        styles.push(`font-family: '${font}', sans-serif`);
      }
      if (rPr.highlight && rPr.highlight['@_val']) {
        const hColor = rPr.highlight['@_val'];
        styles.push(`background-color: ${hColor}`);
      }

      if (styles.length > 0) {
        html = `<span style="${styles.join('; ')}">${html}</span>`;
      }

      // Formatting marks
      if (rPr.b !== undefined && rPr.b['@_val'] !== '0' && rPr.b['@_val'] !== 'false') {
        html = `<strong>${html}</strong>`;
      }
      if (rPr.i !== undefined && rPr.i['@_val'] !== '0' && rPr.i['@_val'] !== 'false') {
        html = `<em>${html}</em>`;
      }
      if (rPr.u !== undefined && rPr.u['@_val'] !== 'none') {
        html = `<u>${html}</u>`;
      }
      if (rPr.strike !== undefined && rPr.strike['@_val'] !== '0') {
        html = `<s>${html}</s>`;
      }

      return html;
    };

    // Helper to render paragraph
    const renderParagraph = async (p: any): Promise<string> => {
      const pPr = p.pPr || {};
      const pStyle = pPr.pStyle?.['@_val'] || '';
      const jc = pPr.jc?.['@_val'];

      // Check alignment
      const alignStyle = jc ? ` style="text-align: ${jc === 'both' ? 'justify' : jc}"` : '';

      // Runs inside paragraph
      let innerContent = '';

      // Direct children might be runs, hyperlinks, etc.
      // Collect all child elements in order
      const runs = Array.isArray(p.r) ? p.r : p.r ? [p.r] : [];
      for (const r of runs) {
        innerContent += await renderRun(r);
      }

      // Check hyperlinks
      if (p.hyperlink) {
        const links = Array.isArray(p.hyperlink) ? p.hyperlink : [p.hyperlink];
        for (const link of links) {
          const rId = link['@_id'];
          const target = relMap[rId]?.target || '#';
          let linkText = '';
          const lRuns = Array.isArray(link.r) ? link.r : link.r ? [link.r] : [];
          for (const lr of lRuns) {
            linkText += await renderRun(lr);
          }
          innerContent += `<a href="${target}">${linkText || target}</a>`;
        }
      }

      if (!innerContent.trim()) {
        innerContent = '<br>';
      }

      // Check heading style
      const headingMatch = pStyle.match(/Heading\s*([1-6])/i);
      if (headingMatch) {
        const level = headingMatch[1];
        return `<h${level}${alignStyle}>${innerContent}</h${level}>`;
      }
      if (/Title/i.test(pStyle)) {
        return `<h1${alignStyle}>${innerContent}</h1>`;
      }
      if (/Subtitle/i.test(pStyle)) {
        return `<h2${alignStyle}>${innerContent}</h2>`;
      }

      // Check list item
      if (pPr.numPr) {
        const numId = pPr.numPr.numId?.['@_val'];
        const listType = numMap[String(numId)] || 'bullet';
        return `<li data-list-type="${listType}">${innerContent}</li>`;
      }

      return `<p${alignStyle}>${innerContent}</p>`;
    };

    // Helper to render table
    const renderTable = async (tbl: any): Promise<string> => {
      let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;"><tbody>';
      const rows = Array.isArray(tbl.tr) ? tbl.tr : tbl.tr ? [tbl.tr] : [];

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        tableHtml += '<tr>';
        const cells = Array.isArray(row.tc) ? row.tc : row.tc ? [row.tc] : [];
        for (const cell of cells) {
          const tag = rIdx === 0 && (tbl.tblPr?.tblHeader || false) ? 'th' : 'td';
          tableHtml += `<${tag} style="border: 1px solid #d8d3c8; padding: 6px 10px;">`;
          const cParagraphs = Array.isArray(cell.p) ? cell.p : cell.p ? [cell.p] : [];
          for (const cp of cParagraphs) {
            tableHtml += await renderParagraph(cp);
          }
          tableHtml += `</${tag}>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table>';
      return tableHtml;
    };

    // Walk body elements
    let resultHtml = '';
    const bodyElements: any[] = [];

    // Body can contain p and tbl
    if (body.p) {
      const pArr = Array.isArray(body.p) ? body.p : [body.p];
      bodyElements.push(...pArr.map((p: any) => ({ type: 'p', data: p })));
    }
    if (body.tbl) {
      const tblArr = Array.isArray(body.tbl) ? body.tbl : [body.tbl];
      bodyElements.push(...tblArr.map((t: any) => ({ type: 'tbl', data: t })));
    }

    // Process elements
    let currentList: { type: 'bullet' | 'ordered'; items: string[] } | null = null;

    const flushList = () => {
      if (!currentList) return;
      const tag = currentList.type === 'ordered' ? 'ol' : 'ul';
      resultHtml += `<${tag}>${currentList.items.join('')}</${tag}>`;
      currentList = null;
    };

    for (const elem of bodyElements) {
      if (elem.type === 'p') {
        const pStr = await renderParagraph(elem.data);
        if (pStr.startsWith('<li')) {
          const isOrdered = pStr.includes('data-list-type="ordered"');
          const listType = isOrdered ? 'ordered' : 'bullet';
          const cleanLi = pStr.replace(/ data-list-type="(bullet|ordered)"/, '');

          if (!currentList || currentList.type !== listType) {
            flushList();
            currentList = { type: listType, items: [cleanLi] };
          } else {
            currentList.items.push(cleanLi);
          }
        } else {
          flushList();
          resultHtml += pStr;
        }
      } else if (elem.type === 'tbl') {
        flushList();
        resultHtml += await renderTable(elem.data);
      }
    }
    flushList();

    const section = readDocxSection(body);
    if (section?.adjusted) {
      warnings.push({
        item: 'Page size',
        reason: `Page size was adjusted to ${pageSizeLabel(section.setup.size)}.`,
      });
    }

    const sanitized = sanitizeHtml(resultHtml || '<p></p>');
    return {
      html: sanitized,
      pageSetup: section?.setup ?? null,
      report: {
        fileName,
        format: 'docx',
        importedAt: new Date().toISOString(),
        warnings,
        skippedFeatures,
      },
    };
  } catch (primaryErr) {
    console.warn('DOCX custom parser failed, attempting Mammoth fallback:', primaryErr);
    // Mammoth fallback
    try {
      const mammothResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
      const sanitized = sanitizeHtml(mammothResult.value || '<p></p>');
      const fallbackWarnings: ImportWarning[] = [
        {
          item: 'Mammoth Fallback',
          reason: 'Custom OpenXML parser encountered an unexpected structure; loaded via Mammoth fallback. Some direct formatting and layout elements may be simplified.',
        },
      ];
      if (mammothResult.messages && mammothResult.messages.length > 0) {
        mammothResult.messages.forEach((m) => {
          fallbackWarnings.push({ item: m.type, reason: m.message });
        });
      }

      return {
        html: sanitized,
        report: {
          fileName,
          format: 'docx',
          importedAt: new Date().toISOString(),
          fallbackUsed: true,
          warnings: fallbackWarnings,
          skippedFeatures: ['Advanced layout', 'Direct styles'],
        },
      };
    } catch (fallbackErr: any) {
      throw new Error(`Failed to import DOCX: ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}`);
    }
  }
}
