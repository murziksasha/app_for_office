import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import mammoth from 'mammoth';
import { ImportReport, ImportWarning } from '../../types';
import { sanitizeHtml } from '../sanitize';
import { pageSizeLabel, readDocxSection, type PageSetup } from '../pageSetup';
import {
  createEmptyChrome,
  createEmptyStory,
  hasChromeContent,
  type ChromeMarks,
  type ChromeParagraph,
  type ChromeRun,
  type ChromeStory,
  type DocumentChrome,
} from '../chrome';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => {
    return [
      'p',
      'r',
      'tbl',
      'tr',
      'tc',
      'Relationship',
      'lvl',
      'num',
      'abstractNum',
      'headerReference',
      'footerReference',
      'fldSimple',
      'style',
    ].includes(name);
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
 * Extracts relationship mappings from a .rels file (default: word/_rels/document.xml.rels)
 */
async function loadRelationships(zip: JSZip, relsPath = 'word/_rels/document.xml.rels'): Promise<RelMap> {
  const relFile = zip.file(relsPath);
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
    console.warn(`Could not parse ${relsPath}:`, err);
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

export interface DocxResolvedStyle {
  font?: string;
  sizePt?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export interface StylesDictionary {
  docDefaults: DocxResolvedStyle;
  styles: Map<string, DocxResolvedStyle>;
  lookup: (key: string | undefined | null) => DocxResolvedStyle | undefined;
}

function parseDocxRPr(rPr: any): DocxResolvedStyle {
  if (!rPr || typeof rPr !== 'object') return {};
  const res: DocxResolvedStyle = {};
  if (rPr.rFonts) {
    const f = rPr.rFonts['@_ascii'] || rPr.rFonts['@_hAnsi'] || rPr.rFonts['@_cs'];
    if (f) res.font = String(f);
  }
  if (rPr.sz) {
    const halfPt = typeof rPr.sz === 'object' ? rPr.sz['@_val'] : rPr.sz;
    if (halfPt != null) {
      const pt = parseFloat(String(halfPt)) / 2;
      if (!Number.isNaN(pt)) res.sizePt = pt;
    }
  }
  if (rPr.color) {
    const c = typeof rPr.color === 'object' ? rPr.color['@_val'] : rPr.color;
    if (c && c !== 'auto') res.color = String(c).replace(/^#/, '');
  }
  if (rPr.b !== undefined) {
    const v = typeof rPr.b === 'object' ? rPr.b?.['@_val'] : rPr.b;
    res.bold = v !== '0' && v !== 'false' && v !== 'off';
  }
  if (rPr.i !== undefined) {
    const v = typeof rPr.i === 'object' ? rPr.i?.['@_val'] : rPr.i;
    res.italic = v !== '0' && v !== 'false' && v !== 'off';
  }
  if (rPr.u !== undefined) {
    const v = typeof rPr.u === 'object' ? rPr.u?.['@_val'] : rPr.u;
    res.underline = v !== '0' && v !== 'false' && v !== 'none' && v !== 'off';
  }
  if (rPr.strike !== undefined) {
    const v = typeof rPr.strike === 'object' ? rPr.strike?.['@_val'] : rPr.strike;
    res.strike = v !== '0' && v !== 'false' && v !== 'off';
  }
  return res;
}

async function loadStyles(zip: JSZip): Promise<StylesDictionary> {
  const emptyDict: StylesDictionary = {
    docDefaults: {},
    styles: new Map(),
    lookup: () => undefined,
  };

  const stylesFile = zip.file('word/styles.xml');
  if (!stylesFile) return emptyDict;

  try {
    const xmlText = await stylesFile.async('text');
    const parsed = xmlParser.parse(xmlText);
    const stylesRoot = parsed?.styles;
    if (!stylesRoot) return emptyDict;

    const docDefaults = parseDocxRPr(stylesRoot.docDefaults?.rPrDefault?.rPr);

    const rawList = Array.isArray(stylesRoot.style)
      ? stylesRoot.style
      : stylesRoot.style
      ? [stylesRoot.style]
      : [];

    interface RawStyle {
      styleId: string;
      name?: string;
      basedOn?: string;
      type?: string;
      isDefault?: boolean;
      rPr: DocxResolvedStyle;
    }

    const rawMap = new Map<string, RawStyle>();
    let defaultParaStyleId: string | undefined;

    for (const s of rawList) {
      const styleId = s['@_styleId'];
      if (!styleId) continue;
      const name = s.name?.['@_val'];
      const basedOn = s.basedOn?.['@_val'];
      const type = s['@_type'] || 'paragraph';
      const isDefault = s['@_default'] === '1' || s['@_default'] === 'true';
      if (isDefault && type === 'paragraph') {
        defaultParaStyleId = styleId;
      }
      rawMap.set(styleId, {
        styleId,
        name,
        basedOn,
        type,
        isDefault,
        rPr: parseDocxRPr(s.rPr),
      });
    }

    const resolved = new Map<string, DocxResolvedStyle>();

    const resolveHierarchy = (id: string, visited = new Set<string>()): DocxResolvedStyle => {
      if (resolved.has(id)) return resolved.get(id)!;
      if (visited.has(id)) return {};
      visited.add(id);

      const raw = rawMap.get(id);
      if (!raw) return {};

      let base: DocxResolvedStyle = {};
      if (raw.basedOn && raw.basedOn !== id) {
        base = resolveHierarchy(raw.basedOn, visited);
      }

      const merged: DocxResolvedStyle = {
        font: raw.rPr.font ?? base.font,
        sizePt: raw.rPr.sizePt ?? base.sizePt,
        color: raw.rPr.color ?? base.color,
        bold: raw.rPr.bold ?? base.bold,
        italic: raw.rPr.italic ?? base.italic,
        underline: raw.rPr.underline ?? base.underline,
        strike: raw.rPr.strike ?? base.strike,
      };

      resolved.set(id, merged);
      return merged;
    };

    const finalStyles = new Map<string, DocxResolvedStyle>();

    for (const [id] of rawMap) {
      const res = resolveHierarchy(id);
      finalStyles.set(id, res);
      finalStyles.set(id.toLowerCase(), res);
      const raw = rawMap.get(id);
      if (raw?.name) {
        finalStyles.set(raw.name, res);
        finalStyles.set(raw.name.toLowerCase(), res);
        finalStyles.set(raw.name.toLowerCase().replace(/\s+/g, ''), res);
      }
    }

    if (defaultParaStyleId && finalStyles.has(defaultParaStyleId)) {
      finalStyles.set('__default_para__', finalStyles.get(defaultParaStyleId)!);
    }

    const lookup = (key: string | undefined | null): DocxResolvedStyle | undefined => {
      if (!key) return finalStyles.get('__default_para__') || finalStyles.get('normal');
      const direct = finalStyles.get(key);
      if (direct) return direct;
      const lower = key.toLowerCase();
      const lowerMatch = finalStyles.get(lower);
      if (lowerMatch) return lowerMatch;
      const noSpace = lower.replace(/\s+/g, '');
      return finalStyles.get(noSpace);
    };

    return {
      docDefaults,
      styles: finalStyles,
      lookup,
    };
  } catch (err) {
    console.warn('Could not parse word/styles.xml:', err);
    return emptyDict;
  }
}

/**
 * Resolves an image target from zip and returns a base64 data URL
 */
async function extractImageDataUrl(
  zip: JSZip,
  target: string,
  baseFolder = 'word'
): Promise<{ dataUrl: string | null; isUndrawable?: boolean }> {
  const lower = target.toLowerCase();
  if (lower.endsWith('.emf') || lower.endsWith('.wmf')) {
    return { dataUrl: null, isUndrawable: true };
  }

  let normalizedPath = target;
  if (!target.startsWith('/')) {
    normalizedPath = `${baseFolder}/${target.replace(/^(\.\.\/)+/, '')}`;
  } else {
    normalizedPath = target.slice(1);
  }

  const imageFile = zip.file(normalizedPath);
  if (!imageFile) return { dataUrl: null };

  try {
    const base64 = await imageFile.async('base64');
    let mime = 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.gif')) mime = 'image/gif';
    else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
    else if (lower.endsWith('.webp')) mime = 'image/webp';

    return { dataUrl: `data:${mime};base64,${base64}` };
  } catch {
    return { dataUrl: null };
  }
}

function extractMarks(rPr: any): ChromeMarks {
  if (!rPr || typeof rPr !== 'object') return {};
  const marks: ChromeMarks = {};
  if (rPr.b !== undefined && rPr.b?.['@_val'] !== '0' && rPr.b?.['@_val'] !== 'false') marks.bold = true;
  if (rPr.i !== undefined && rPr.i?.['@_val'] !== '0' && rPr.i?.['@_val'] !== 'false') marks.italic = true;
  if (rPr.u !== undefined && rPr.u?.['@_val'] !== 'none') marks.underline = true;
  if (rPr.color?.['@_val']) {
    const c = String(rPr.color['@_val']).replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(c)) marks.color = `#${c}`;
  }
  if (rPr.sz?.['@_val']) {
    const halfPt = Number(rPr.sz['@_val']);
    if (Number.isFinite(halfPt) && halfPt > 0) marks.fontSize = Math.round(halfPt / 2);
  }
  if (rPr.rFonts?.['@_ascii']) {
    marks.fontFamily = String(rPr.rFonts['@_ascii']);
  }
  return marks;
}

type RawParagraphRun =
  | { type: 'text'; text: string; marks: ChromeMarks }
  | { type: 'field'; field: 'page' | 'pageOfTotal'; marks: ChromeMarks }
  | { type: 'image'; src: string }
  | { type: 'tab' };

async function parseParagraphItems(
  pNode: any,
  zip: JSZip,
  rels: RelMap,
  warnings: ImportWarning[]
): Promise<RawParagraphRun[]> {
  const items: RawParagraphRun[] = [];
  if (!pNode || typeof pNode !== 'object') return items;

  // Process simple fields in paragraph
  if (pNode.fldSimple) {
    const fields = Array.isArray(pNode.fldSimple) ? pNode.fldSimple : [pNode.fldSimple];
    for (const f of fields) {
      const instr = String(f['@_instr'] || '').trim().toUpperCase();
      const marks = extractMarks(f.r?.rPr);
      if (instr.startsWith('PAGE')) {
        items.push({ type: 'field', field: 'page', marks });
      } else if (instr.startsWith('NUMPAGES')) {
        // Will be merged if adjacent
        items.push({ type: 'field', field: 'pageOfTotal', marks });
      } else {
        warnings.push({
          item: 'Unsupported Field',
          reason: `Field "${instr}" in header/footer is not supported and was omitted.`,
        });
      }
    }
  }

  const runs = Array.isArray(pNode.r) ? pNode.r : pNode.r ? [pNode.r] : [];
  let inComplexField = false;
  let complexFieldInstr = '';
  let complexFieldMarks: ChromeMarks = {};

  for (const r of runs) {
    const marks = extractMarks(r.rPr);

    // Tab character
    if (r.tab !== undefined) {
      items.push({ type: 'tab' });
      continue;
    }

    // Complex field handling
    if (r.fldChar) {
      const fldType = r.fldChar['@_fldCharType'];
      if (fldType === 'begin') {
        inComplexField = true;
        complexFieldInstr = '';
        complexFieldMarks = marks;
        continue;
      }
      if (fldType === 'end') {
        inComplexField = false;
        const instr = complexFieldInstr.trim().toUpperCase();
        if (instr.startsWith('PAGE')) {
          items.push({ type: 'field', field: 'page', marks: complexFieldMarks });
        } else if (instr.startsWith('NUMPAGES')) {
          items.push({ type: 'field', field: 'pageOfTotal', marks: complexFieldMarks });
        } else if (instr) {
          warnings.push({
            item: 'Unsupported Field',
            reason: `Field "${instr}" in header/footer is not supported and was omitted.`,
          });
        }
        complexFieldInstr = '';
        continue;
      }
    }

    if (inComplexField) {
      if (r.instrText) {
        const it = typeof r.instrText === 'string' ? r.instrText : r.instrText['#text'] || '';
        complexFieldInstr += ` ${it}`;
      }
      continue;
    }

    // Drawing / Image inside run
    if (r.drawing) {
      const drawingStr = JSON.stringify(r.drawing);
      const blipMatch = drawingStr.match(/"@_embed":\s*"([^"]+)"/);
      if (blipMatch && blipMatch[1]) {
        const rId = blipMatch[1];
        const rel = rels[rId];
        if (rel && rel.target) {
          const res = await extractImageDataUrl(zip, rel.target);
          if (res.isUndrawable) {
            warnings.push({
              item: 'Undrawable Image',
              reason: 'Image format (EMF/WMF) in header/footer is not supported and was omitted.',
            });
          } else if (res.dataUrl) {
            items.push({ type: 'image', src: res.dataUrl });
          }
        }
      }
    }

    // Text run
    let text = '';
    if (r.t !== undefined) {
      if (typeof r.t === 'string') text = r.t;
      else if (typeof r.t === 'number') text = String(r.t);
      else if (r.t && r.t['#text']) text = String(r.t['#text']);
    }
    if (text) {
      items.push({ type: 'text', text, marks });
    }
  }

  // Combine PAGE and NUMPAGES if they appear as "Page [PAGE] of [NUMPAGES]"
  const merged: RawParagraphRun[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nextItem = items[i + 1];
    const afterNext = items[i + 2];
    // Check pattern: "Page " + field(page) + " of " + field(pageOfTotal)
    if (
      item.type === 'field' &&
      item.field === 'page' &&
      nextItem &&
      nextItem.type === 'text' &&
      nextItem.text.trim().toLowerCase() === 'of' &&
      afterNext &&
      afterNext.type === 'field'
    ) {
      const prevItem = merged[merged.length - 1];
      if (prevItem && prevItem.type === 'text' && prevItem.text.trim().toLowerCase() === 'page') {
        merged.pop(); // remove "Page "
      }
      merged.push({ type: 'field', field: 'pageOfTotal', marks: item.marks });
      i += 2; // skip "of" and NUMPAGES
      continue;
    }
    merged.push(item);
  }

  return merged;
}

function normalizeRuns(raw: RawParagraphRun[]): ChromeRun[] {
  const result: ChromeRun[] = [];
  for (const item of raw) {
    if (item.type === 'tab') continue;
    if (item.type === 'image') {
      result.push({ type: 'image', src: item.src });
    } else if (item.type === 'field') {
      result.push({ type: 'field', field: item.field, ...item.marks });
    } else if (item.type === 'text') {
      result.push({ type: 'text', text: item.text, ...item.marks });
    }
  }
  return result;
}

async function parseHeaderFooterXml(
  xmlText: string,
  zip: JSZip,
  rels: RelMap,
  warnings: ImportWarning[]
): Promise<ChromeStory> {
  const parsed = xmlParser.parse(xmlText);
  const root = parsed?.hdr || parsed?.ftr;
  if (!root) return createEmptyStory();

  const story = createEmptyStory();

  // 1. Detect floating shapes / anchored images in raw XML
  let floatingLogoSrc: string | null = null;
  const anchorRegex = /<wp:anchor[\s\S]*?<\/wp:anchor>/g;
  const anchors = xmlText.match(anchorRegex) || [];
  for (const anchor of anchors) {
    const blipMatch = anchor.match(/embed="([^"]+)"/) || anchor.match(/r:id="([^"]+)"/);
    if (blipMatch && blipMatch[1]) {
      const rel = rels[blipMatch[1]];
      if (rel && rel.target) {
        const res = await extractImageDataUrl(zip, rel.target);
        if (res.isUndrawable) {
          warnings.push({
            item: 'Undrawable Image',
            reason: 'Image format (EMF/WMF) in header/footer is not supported and was omitted.',
          });
        } else if (res.dataUrl) {
          if (!floatingLogoSrc) {
            floatingLogoSrc = res.dataUrl;
          } else {
            warnings.push({
              item: 'Extra Floating Shapes',
              reason: 'Additional floating shapes or images in header/footer were omitted.',
            });
          }
        }
      }
    } else {
      warnings.push({
        item: 'Extra Floating Shapes',
        reason: 'Floating shapes in header/footer are not supported and were omitted.',
      });
    }
  }

  // 2. Check for Table
  const tables = Array.isArray(root.tbl) ? root.tbl : root.tbl ? [root.tbl] : [];
  const paragraphs = Array.isArray(root.p) ? root.p : root.p ? [root.p] : [];

  let line0Mapped = false;

  if (tables.length > 0) {
    const tbl = tables[0];
    const rows = Array.isArray(tbl.tr) ? tbl.tr : tbl.tr ? [tbl.tr] : [];
    if (rows.length > 1) {
      warnings.push({
        item: 'Multi-row Table',
        reason: 'Multi-row header and footer tables are not supported and were omitted.',
      });
    }
    if (rows.length >= 1) {
      const cells = Array.isArray(rows[0].tc) ? rows[0].tc : rows[0].tc ? [rows[0].tc] : [];
      if (cells.length === 3) {
        // Map 3 cells into left, center, right
        const [c0, c1, c2] = cells;
        const runs0 = await parseCellRuns(c0, zip, rels, warnings);
        const runs1 = await parseCellRuns(c1, zip, rels, warnings);
        const runs2 = await parseCellRuns(c2, zip, rels, warnings);

        story.line0.left.runs = runs0;
        story.line0.center.runs = runs1;
        story.line0.right.runs = runs2;
        line0Mapped = true;
      }
    }
  }

  // If line0 was not mapped from a 3-cell table, map from first paragraph's tabs
  let startParaIdx = 0;
  if (!line0Mapped && paragraphs.length > 0) {
    const firstP = paragraphs[0];
    startParaIdx = 1;
    const rawRuns = await parseParagraphItems(firstP, zip, rels, warnings);

    // Split runs by tab
    const zones: RawParagraphRun[][] = [[]];
    for (const r of rawRuns) {
      if (r.type === 'tab') {
        zones.push([]);
      } else {
        zones[zones.length - 1].push(r);
      }
    }

    if (zones.length >= 3) {
      story.line0.left.runs = normalizeRuns(zones[0]);
      story.line0.center.runs = normalizeRuns(zones[1]);
      story.line0.right.runs = normalizeRuns(zones.slice(2).flat());
    } else if (zones.length === 2) {
      story.line0.left.runs = normalizeRuns(zones[0]);
      story.line0.right.runs = normalizeRuns(zones[1]);
    } else {
      // 0 tabs - align by paragraph alignment if available
      const alignVal = firstP.pPr?.jc?.['@_val'];
      const align = alignVal === 'center' ? 'center' : alignVal === 'right' ? 'right' : 'left';
      if (align === 'center') {
        story.line0.center.runs = normalizeRuns(zones[0]);
      } else if (align === 'right') {
        story.line0.right.runs = normalizeRuns(zones[0]);
      } else {
        story.line0.left.runs = normalizeRuns(zones[0]);
      }
    }
    line0Mapped = true;
  }

  // Prepend floating logo to left zone if found
  if (floatingLogoSrc) {
    story.line0.left.runs.unshift({ type: 'image', src: floatingLogoSrc });
  }

  // Later paragraphs become full-width lines
  for (let idx = startParaIdx; idx < paragraphs.length; idx++) {
    const p = paragraphs[idx];
    const rawRuns = await parseParagraphItems(p, zip, rels, warnings);
    const runs = normalizeRuns(rawRuns);
    const alignVal = p.pPr?.jc?.['@_val'];
    const align = alignVal === 'center' ? 'center' : alignVal === 'right' ? 'right' : 'left';
    story.lines.push({ align, runs });
  }

  return story;
}

async function parseCellRuns(
  tcNode: any,
  zip: JSZip,
  rels: RelMap,
  warnings: ImportWarning[]
): Promise<ChromeRun[]> {
  const runs: ChromeRun[] = [];
  if (!tcNode || typeof tcNode !== 'object') return runs;
  const paragraphs = Array.isArray(tcNode.p) ? tcNode.p : tcNode.p ? [tcNode.p] : [];
  for (const p of paragraphs) {
    const raw = await parseParagraphItems(p, zip, rels, warnings);
    runs.push(...normalizeRuns(raw));
  }
  return runs;
}

/**
 * Imports DOCX array buffer into sanitized HTML and produces an ImportReport.
 */
export async function importDocx(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{
  html: string;
  report: ImportReport;
  pageSetup?: PageSetup | null;
  chrome?: DocumentChrome | null;
}> {
  const warnings: ImportWarning[] = [];
  const skippedFeatures: string[] = [];

  if (!buffer || buffer.byteLength === 0) {
    return {
      html: '<p></p>',
      pageSetup: null,
      chrome: null,
      report: {
        fileName,
        format: 'docx',
        importedAt: new Date().toISOString(),
        warnings,
        skippedFeatures,
      },
    };
  }

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

    const relMap = await loadRelationships(zip, 'word/_rels/document.xml.rels');
    const numMap = await loadNumbering(zip);
    const stylesDict = await loadStyles(zip);

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

    // Read section properties and headers/footers
    const allSectPrMatches = xmlText.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || [];
    if (allSectPrMatches.length > 1) {
      warnings.push({
        item: 'Extra Sections',
        reason: 'Multiple sections are not supported; headers and footers from additional sections were omitted.',
      });
    }

    const chrome = createEmptyChrome();
    const rawSectPr = body.sectPr;
    const sectPr = Array.isArray(rawSectPr) ? rawSectPr[rawSectPr.length - 1] : rawSectPr;

    if (sectPr) {
      const headerRefs = Array.isArray(sectPr.headerReference)
        ? sectPr.headerReference
        : sectPr.headerReference
        ? [sectPr.headerReference]
        : [];
      const footerRefs = Array.isArray(sectPr.footerReference)
        ? sectPr.footerReference
        : sectPr.footerReference
        ? [sectPr.footerReference]
        : [];

      // Check Different First Page
      if (
        (sectPr.titlePg !== undefined && sectPr.titlePg?.['@_val'] !== '0' && sectPr.titlePg?.['@_val'] !== 'false') ||
        headerRefs.some((r: any) => r['@_type'] === 'first') ||
        footerRefs.some((r: any) => r['@_type'] === 'first')
      ) {
        chrome.differentFirstPage = true;
      }

      // Check odd/even headers
      const hasEven = [...headerRefs, ...footerRefs].some((r) => r['@_type'] === 'even');
      if (hasEven) {
        warnings.push({
          item: 'Odd/Even Headers',
          reason: 'Different odd and even page headers and footers are not supported and were omitted.',
        });
      }

      for (const hr of headerRefs) {
        const type = hr['@_type'] || 'default';
        const rId = hr['@_id'];
        const rel = rId ? relMap[rId] : null;
        if (!rel || !rel.target) continue;

        const headerPath = rel.target.startsWith('word/')
          ? rel.target
          : `word/${rel.target.replace(/^(\.\.\/)+/, '')}`;
        const headerFile = zip.file(headerPath);
        if (!headerFile) continue;

        const headerBaseName = headerPath.split('/').pop() || '';
        const headerRelsPath = `word/_rels/${headerBaseName}.rels`;
        const headerRels = await loadRelationships(zip, headerRelsPath);
        const headerXml = await headerFile.async('text');
        const story = await parseHeaderFooterXml(headerXml, zip, headerRels, warnings);

        if (type === 'first') {
          chrome.firstHeader = story;
        } else if (type === 'default') {
          chrome.header = story;
        }
      }

      for (const fr of footerRefs) {
        const type = fr['@_type'] || 'default';
        const rId = fr['@_id'];
        const rel = rId ? relMap[rId] : null;
        if (!rel || !rel.target) continue;

        const footerPath = rel.target.startsWith('word/')
          ? rel.target
          : `word/${rel.target.replace(/^(\.\.\/)+/, '')}`;
        const footerFile = zip.file(footerPath);
        if (!footerFile) continue;

        const footerBaseName = footerPath.split('/').pop() || '';
        const footerRelsPath = `word/_rels/${footerBaseName}.rels`;
        const footerRels = await loadRelationships(zip, footerRelsPath);
        const footerXml = await footerFile.async('text');
        const story = await parseHeaderFooterXml(footerXml, zip, footerRels, warnings);

        if (type === 'first') {
          chrome.firstFooter = story;
        } else if (type === 'default') {
          chrome.footer = story;
        }
      }
    }

    // Helper to render text runs
    const renderRun = async (r: any, paraStyleName?: string): Promise<string> => {
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
            const res = await extractImageDataUrl(zip, rel.target);
            if (res.dataUrl) {
              return `<img src="${res.dataUrl}" alt="Imported document image" style="max-width: 100%; height: auto;" />`;
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

      const charStyleName = rPr.rStyle?.['@_val'];
      const charStyle = charStyleName ? stylesDict.lookup(charStyleName) : undefined;
      const paraStyle = (paraStyleName ? stylesDict.lookup(paraStyleName) : undefined) || stylesDict.lookup('Normal');
      const defaults = stylesDict.docDefaults;

      // Resolve bold
      let isBold: boolean | undefined = undefined;
      if (rPr.b !== undefined) {
        const v = typeof rPr.b === 'object' ? rPr.b?.['@_val'] : rPr.b;
        isBold = v !== '0' && v !== 'false' && v !== 'off';
      } else if (charStyle?.bold !== undefined) {
        isBold = charStyle.bold;
      } else if (paraStyle?.bold !== undefined) {
        isBold = paraStyle.bold;
      } else if (defaults.bold !== undefined) {
        isBold = defaults.bold;
      }

      // Resolve italic
      let isItalic: boolean | undefined = undefined;
      if (rPr.i !== undefined) {
        const v = typeof rPr.i === 'object' ? rPr.i?.['@_val'] : rPr.i;
        isItalic = v !== '0' && v !== 'false' && v !== 'off';
      } else if (charStyle?.italic !== undefined) {
        isItalic = charStyle.italic;
      } else if (paraStyle?.italic !== undefined) {
        isItalic = paraStyle.italic;
      } else if (defaults.italic !== undefined) {
        isItalic = defaults.italic;
      }

      // Resolve underline
      let isUnderline: boolean | undefined = undefined;
      if (rPr.u !== undefined) {
        const v = typeof rPr.u === 'object' ? rPr.u?.['@_val'] : rPr.u;
        isUnderline = v !== '0' && v !== 'false' && v !== 'none' && v !== 'off';
      } else if (charStyle?.underline !== undefined) {
        isUnderline = charStyle.underline;
      } else if (paraStyle?.underline !== undefined) {
        isUnderline = paraStyle.underline;
      } else if (defaults.underline !== undefined) {
        isUnderline = defaults.underline;
      }

      // Resolve strike
      let isStrike: boolean | undefined = undefined;
      if (rPr.strike !== undefined) {
        const v = typeof rPr.strike === 'object' ? rPr.strike?.['@_val'] : rPr.strike;
        isStrike = v !== '0' && v !== 'false' && v !== 'off';
      } else if (charStyle?.strike !== undefined) {
        isStrike = charStyle.strike;
      } else if (paraStyle?.strike !== undefined) {
        isStrike = paraStyle.strike;
      } else if (defaults.strike !== undefined) {
        isStrike = defaults.strike;
      }

      if (isBold) {
        styles.push('font-weight: bold;');
        html = `<strong>${html}</strong>`;
      }
      if (isItalic) {
        styles.push('font-style: italic;');
        html = `<em>${html}</em>`;
      }
      if (isUnderline) {
        styles.push('text-decoration: underline;');
        html = `<u>${html}</u>`;
      }
      if (isStrike) {
        styles.push('text-decoration: line-through;');
        html = `<s>${html}</s>`;
      }

      // Resolve size
      let sizePt: number | undefined = undefined;
      if (rPr.sz) {
        const halfPt = typeof rPr.sz === 'object' ? rPr.sz['@_val'] : rPr.sz;
        if (halfPt != null) {
          const pt = parseFloat(String(halfPt)) / 2;
          if (!Number.isNaN(pt)) sizePt = pt;
        }
      } else if (charStyle?.sizePt !== undefined) {
        sizePt = charStyle.sizePt;
      } else if (paraStyle?.sizePt !== undefined) {
        sizePt = paraStyle.sizePt;
      } else if (defaults.sizePt !== undefined) {
        sizePt = defaults.sizePt;
      }

      if (sizePt !== undefined) {
        styles.push(`font-size: ${sizePt}pt;`);
      }

      // Resolve color
      let colorVal: string | undefined = undefined;
      if (rPr.color) {
        const c = typeof rPr.color === 'object' ? rPr.color['@_val'] : rPr.color;
        if (c && c !== 'auto') colorVal = String(c).replace(/^#/, '');
      } else if (charStyle?.color !== undefined) {
        colorVal = charStyle.color;
      } else if (paraStyle?.color !== undefined) {
        colorVal = paraStyle.color;
      } else if (defaults.color !== undefined) {
        colorVal = defaults.color;
      }

      if (colorVal) {
        styles.push(`color: #${colorVal};`);
      }

      // Resolve font
      let fontVal: string | undefined = undefined;
      if (rPr.rFonts) {
        fontVal = rPr.rFonts['@_ascii'] || rPr.rFonts['@_hAnsi'] || rPr.rFonts['@_cs'];
      } else if (charStyle?.font !== undefined) {
        fontVal = charStyle.font;
      } else if (paraStyle?.font !== undefined) {
        fontVal = paraStyle.font;
      } else if (defaults.font !== undefined) {
        fontVal = defaults.font;
      }

      if (fontVal) {
        styles.push(`font-family: '${fontVal}', sans-serif;`);
      }

      if (styles.length > 0) {
        return `<span style="${styles.join(' ')}">${html}</span>`;
      }
      return html;
    };

    // Helper to render paragraph
    const renderParagraph = async (p: any): Promise<string> => {
      const pPr = p.pPr || {};
      const pStyle = pPr.pStyle?.['@_val'] || '';

      let alignStyle = '';
      if (pPr.jc) {
        const jcVal = pPr.jc['@_val'];
        if (jcVal === 'center') alignStyle = ' style="text-align: center;"';
        else if (jcVal === 'right') alignStyle = ' style="text-align: right;"';
        else if (jcVal === 'both') alignStyle = ' style="text-align: justify;"';
      }

      // Check page break inside paragraph
      let hasPageBreak = false;
      const runs = Array.isArray(p.r) ? p.r : p.r ? [p.r] : [];
      for (const r of runs) {
        if (r.br && (r.br['@_type'] === 'page' || r.br['@_clear'])) {
          hasPageBreak = true;
          break;
        }
      }

      let innerContent = '';
      for (const r of runs) {
        innerContent += await renderRun(r, pStyle);
      }

      // Handle hyperlinks
      if (p.hyperlink) {
        const hLinks = Array.isArray(p.hyperlink) ? p.hyperlink : [p.hyperlink];
        for (const hl of hLinks) {
          const rId = hl['@_id'];
          const target = relMap[rId]?.target || '#';
          let linkText = '';
          const hlRuns = Array.isArray(hl.r) ? hl.r : hl.r ? [hl.r] : [];
          for (const hr of hlRuns) {
            linkText += await renderRun(hr, pStyle);
          }
          innerContent += `<a href="${target}">${linkText || target}</a>`;
        }
      }

      if (hasPageBreak) {
        innerContent += '<hr data-page-break="true">';
      }

      if (!innerContent.trim()) {
        innerContent = '';
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
      chrome: hasChromeContent(chrome) ? chrome : null,
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
        chrome: null,
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
