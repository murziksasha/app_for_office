import { PDFDocument, PDFPage, rgb, RGB, PDFImage } from 'pdf-lib';
import { EditorState } from '../types';
import { embedNotoFonts, EmbeddedFonts } from './fonts';
import { getActiveSheet } from '../files/session';
import { mmToPt, PAGE_MM, pageSetupFromDoc } from '../document/pageSetup';
import {
  chromeFromDoc,
  hasChromeContent,
  resolveStoryForPage,
  type ChromeStory,
  type ChromeZone,
} from '../document/chrome';

export interface ExportPdfOptions {
  scope?: 'current' | 'all';
  slideIndex?: number;
}

export interface ExportPdfResult {
  bytes: Uint8Array;
  omissions: string[];
}

function parseColor(colorStr?: string): RGB {
  if (!colorStr) return rgb(0, 0, 0);
  const str = colorStr.trim().toLowerCase();
  if (str === 'transparent') return rgb(1, 1, 1);
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return rgb(r, g, b);
    }
  }
  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return rgb(
      parseInt(rgbMatch[1], 10) / 255,
      parseInt(rgbMatch[2], 10) / 255,
      parseInt(rgbMatch[3], 10) / 255
    );
  }
  return rgb(0, 0, 0);
}

async function embedBase64Image(
  doc: PDFDocument,
  src: string
): Promise<{ image: PDFImage | null; error?: string }> {
  if (!src) return { image: null };
  const comma = src.indexOf(',');
  if (comma < 0) {
    return { image: null, error: 'Omitted image: invalid data URI' };
  }
  const header = src.slice(0, comma).toLowerCase();
  const base64 = src.slice(comma + 1);

  let isPng = header.includes('image/png');
  let isJpg = header.includes('image/jpeg') || header.includes('image/jpg');

  if (!isPng && !isJpg) {
    return { image: null, error: 'Omitted image: format not supported (only PNG and JPEG are supported)' };
  }

  let bytes: Uint8Array;
  try {
    if (typeof atob !== 'undefined') {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else {
      bytes = Buffer.from(base64, 'base64');
    }
  } catch {
    return { image: null, error: 'Omitted image: failed to decode image data' };
  }

  try {
    if (isPng) {
      const img = await doc.embedPng(bytes);
      return { image: img };
    } else {
      const img = await doc.embedJpg(bytes);
      return { image: img };
    }
  } catch (err: any) {
    return { image: null, error: `Omitted image: ${err?.message || 'embed failed'}` };
  }
}

interface TextToken {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function filterGlyphs(
  token: TextToken,
  fonts: EmbeddedFonts,
  recordOmission: (msg: string) => void
): TextToken {
  let clean = '';
  for (const ch of token.text) {
    const cp = ch.codePointAt(0)!;
    if (fonts.hasGlyph(cp)) {
      clean += ch;
    } else {
      recordOmission(`Dropped unsupported character: '${ch}' (U+${cp.toString(16).toUpperCase()})`);
    }
  }
  return { ...token, text: clean };
}

function selectFont(bold: boolean, italic: boolean, fonts: EmbeddedFonts) {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

/**
 * Pure function to export Document, Spreadsheet, or Presentation to PDF bytes.
 */
export async function exportPdf(
  state: EditorState,
  options: ExportPdfOptions = {}
): Promise<ExportPdfResult> {
  const omissions: string[] = [];
  const recordOmission = (msg: string) => {
    if (!omissions.includes(msg)) {
      omissions.push(msg);
    }
  };

  const doc = await PDFDocument.create();
  const fonts = await embedNotoFonts(doc);

  if (state.kind === 'document') {
    await exportDocument(doc, state, fonts, recordOmission);
  } else if (state.kind === 'spreadsheet') {
    await exportSpreadsheet(doc, state, fonts, options.scope || 'current', recordOmission);
  } else if (state.kind === 'presentation') {
    await exportPresentation(
      doc,
      state,
      fonts,
      options.scope || 'all',
      options.slideIndex ?? 0,
      recordOmission
    );
  } else {
    throw new Error(`Save as PDF is not available for ${state.kind}`);
  }

  const bytes = await doc.save();
  return { bytes, omissions };
}

// ---------------------------------------------------------------------------
// DOCUMENT EXPORT
// ---------------------------------------------------------------------------
async function exportDocument(
  doc: PDFDocument,
  state: EditorState,
  fonts: EmbeddedFonts,
  recordOmission: (msg: string) => void
) {
  const setup = pageSetupFromDoc(state.documentContent);
  const pageBox = PAGE_MM[setup.size];
  const PAGE_WIDTH = mmToPt(pageBox.width);
  const PAGE_HEIGHT = mmToPt(pageBox.height);
  const marginLeft = mmToPt(setup.marginLeft);
  const marginRight = mmToPt(setup.marginRight);
  const marginTop = mmToPt(setup.marginTop);
  const marginBottom = mmToPt(setup.marginBottom);
  const CONTENT_WIDTH = PAGE_WIDTH - marginLeft - marginRight;

  let currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - marginTop;

  const ensureSpace = (neededHeight: number): PDFPage => {
    if (cursorY - neededHeight < marginBottom) {
      currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - marginTop;
    }
    return currentPage;
  };

  const nodes = state.documentContent?.content || [];

  for (const node of nodes) {
    if (node.type === 'pageBreak') {
      currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - marginTop;
      continue;
    }

    if (node.type === 'heading') {
      const level = node.attrs?.level || 1;
      const fontSize = level === 1 ? 20 : level === 2 ? 16 : 13;
      const lineHeight = fontSize * 1.35;
      const gapAfter = 8;

      const tokens = extractTokens(node, true);
      cursorY = renderParagraph(
        currentPage,
        ensureSpace,
        tokens,
        marginLeft,
        cursorY,
        CONTENT_WIDTH,
        fontSize,
        lineHeight,
        gapAfter,
        fonts,
        recordOmission
      );
      continue;
    }

    if (node.type === 'paragraph') {
      const fontSize = 11;
      const lineHeight = 15;
      const gapAfter = 6;

      const tokens = extractTokens(node, false);
      if (tokens.length === 0) {
        cursorY -= lineHeight;
        continue;
      }
      cursorY = renderParagraph(
        currentPage,
        ensureSpace,
        tokens,
        marginLeft,
        cursorY,
        CONTENT_WIDTH,
        fontSize,
        lineHeight,
        gapAfter,
        fonts,
        recordOmission
      );
      continue;
    }

    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const isOrdered = node.type === 'orderedList';
      const items = node.content || [];
      const fontSize = 11;
      const lineHeight = 15;
      const indent = 18;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const prefix = isOrdered ? `${idx + 1}. ` : '• ';
        const prefixToken: TextToken = {
          text: prefix,
          bold: false,
          italic: false,
          underline: false,
        };

        const itemTokens = [prefixToken, ...extractTokens(item, false)];
        cursorY = renderParagraph(
          currentPage,
          ensureSpace,
          itemTokens,
          marginLeft + indent,
          cursorY,
          CONTENT_WIDTH - indent,
          fontSize,
          lineHeight,
          4,
          fonts,
          recordOmission,
          -indent
        );
      }
      cursorY -= 4;
      continue;
    }

    if (node.type === 'image') {
      const src = node.attrs?.src;
      if (!src) continue;
      const embedded = await embedBase64Image(doc, src);
      if (embedded.error) {
        recordOmission(embedded.error);
        continue;
      }
      if (!embedded.image) continue;

      const img = embedded.image;
      const scale = Math.min(1, CONTENT_WIDTH / img.width);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;

      ensureSpace(drawHeight + 10);
      currentPage.drawImage(img, {
        x: marginLeft,
        y: cursorY - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });
      cursorY -= drawHeight + 10;
      continue;
    }

    if (node.type === 'table') {
      const rows = node.content || [];
      if (rows.length === 0) continue;

      let colCount = 1;
      for (const row of rows) {
        if (row.content && row.content.length > colCount) {
          colCount = row.content.length;
        }
      }

      const colWidth = CONTENT_WIDTH / colCount;

      for (const row of rows) {
        const cells = row.content || [];
        const cellData: { tokens: TextToken[]; lines: TextToken[][] }[] = [];
        let maxLines = 1;

        for (let c = 0; c < colCount; c++) {
          const cell = cells[c];
          const isHeader = cell?.type === 'tableHeader';
          const tokens = cell ? extractTokens(cell, isHeader) : [];
          const cellWidth = colWidth - 8; // padding
          const lines = wrapTokensToLines(tokens, cellWidth, 10, fonts, recordOmission);
          if (lines.length > maxLines) maxLines = lines.length;
          cellData.push({ tokens, lines });
        }

        const rowHeight = Math.max(18, maxLines * 13 + 8);
        ensureSpace(rowHeight);

        for (let c = 0; c < colCount; c++) {
          const cellX = marginLeft + c * colWidth;
          const cellY = cursorY - rowHeight;

          // Border
          currentPage.drawRectangle({
            x: cellX,
            y: cellY,
            width: colWidth,
            height: rowHeight,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });

          // Text lines inside cell
          const { lines } = cellData[c];
          let lineY = cursorY - 4 - 10;
          for (const line of lines) {
            let lineX = cellX + 4;
            for (const token of line) {
              const font = selectFont(token.bold, token.italic, fonts);
              currentPage.drawText(token.text, {
                x: lineX,
                y: lineY,
                size: 10,
                font,
                color: rgb(0, 0, 0),
              });
              const w = font.widthOfTextAtSize(token.text, 10);
              if (token.underline) {
                currentPage.drawLine({
                  start: { x: lineX, y: lineY - 1 },
                  end: { x: lineX + w, y: lineY - 1 },
                  thickness: 0.75,
                  color: rgb(0, 0, 0),
                });
              }
              lineX += w;
            }
            lineY -= 13;
          }
        }

        cursorY -= rowHeight;
      }

      cursorY -= 8;
      continue;
    }
  }

  const chrome = chromeFromDoc(state.documentContent);
  if (hasChromeContent(chrome)) {
    const pages = doc.getPages();
    const totalPages = pages.length;
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const page = pages[pIdx];
      const pageNumber = pIdx + 1;
      const headerStory = resolveStoryForPage(chrome, 'header', pageNumber);
      const footerStory = resolveStoryForPage(chrome, 'footer', pageNumber);

      await renderPdfStory(
        doc,
        page,
        headerStory,
        'header',
        pageNumber,
        totalPages,
        marginLeft,
        CONTENT_WIDTH,
        PAGE_HEIGHT - marginTop,
        marginTop,
        fonts,
        recordOmission
      );

      await renderPdfStory(
        doc,
        page,
        footerStory,
        'footer',
        pageNumber,
        totalPages,
        marginLeft,
        CONTENT_WIDTH,
        marginBottom,
        marginBottom,
        fonts,
        recordOmission
      );
    }
  }
}

async function renderPdfStory(
  doc: PDFDocument,
  page: PDFPage,
  story: ChromeStory,
  bandType: 'header' | 'footer',
  pageNumber: number,
  totalPages: number,
  marginLeft: number,
  contentWidth: number,
  marginBoundY: number,
  marginHeight: number,
  fonts: EmbeddedFonts,
  recordOmission: (msg: string) => void
) {
  if (!story) return;
  const l0 = story.line0;
  const hasLine0 =
    (l0.left.runs && l0.left.runs.length > 0) ||
    (l0.center.runs && l0.center.runs.length > 0) ||
    (l0.right.runs && l0.right.runs.length > 0);
  const hasLines = story.lines && story.lines.length > 0;
  if (!hasLine0 && !hasLines) return;

  const defaultFontSize = 10;
  const lineHeight = 13;

  let baseY =
    bandType === 'header'
      ? marginBoundY + marginHeight - 18
      : marginBoundY - 14;

  const renderZone = async (
    zone: ChromeZone,
    zoneAlign: 'left' | 'center' | 'right',
    currentY: number
  ) => {
    if (!zone.runs || zone.runs.length === 0) return;

    const textRuns: { token: TextToken; fontSize: number; color?: RGB }[] = [];
    const imageRuns: { src: string; width?: number; height?: number }[] = [];

    for (const run of zone.runs) {
      if (run.type === 'image') {
        imageRuns.push(run);
      } else {
        const text =
          run.type === 'field'
            ? run.field === 'page'
              ? String(pageNumber)
              : `Page ${pageNumber} of ${totalPages}`
            : run.text;

        const token: TextToken = {
          text,
          bold: Boolean(run.bold),
          italic: Boolean(run.italic),
          underline: Boolean(run.underline),
        };
        const fontSize = run.fontSize || defaultFontSize;
        const color = run.color ? parseColor(run.color) : rgb(0, 0, 0);
        textRuns.push({ token, fontSize, color });
      }
    }

    let totalTextWidth = 0;
    const filteredRuns: { token: TextToken; fontSize: number; font: any; width: number; color?: RGB }[] = [];

    for (const r of textRuns) {
      const font = selectFont(r.token.bold, r.token.italic, fonts);
      const filtered = filterGlyphs(r.token, fonts, recordOmission);
      const w = font.widthOfTextAtSize(filtered.text, r.fontSize);
      filteredRuns.push({ token: filtered, fontSize: r.fontSize, font, width: w, color: r.color });
      totalTextWidth += w;
    }

    let currentX = marginLeft;
    if (zoneAlign === 'center') {
      currentX = marginLeft + (contentWidth - totalTextWidth) / 2;
    } else if (zoneAlign === 'right') {
      currentX = marginLeft + contentWidth - totalTextWidth;
    }

    for (const imgRun of imageRuns) {
      const embedded = await embedBase64Image(doc, imgRun.src);
      if (embedded.error) {
        recordOmission(embedded.error);
        continue;
      }
      if (embedded.image) {
        const img = embedded.image;
        const maxH = Math.min(img.height, marginHeight * 0.7);
        const scale = maxH / img.height;
        const drawW = img.width * scale;
        const drawH = maxH;
        let imgX = currentX;
        if (zoneAlign === 'right') {
          imgX = currentX - drawW - 4;
        }
        page.drawImage(img, {
          x: imgX,
          y: currentY - 2,
          width: drawW,
          height: drawH,
        });
        if (zoneAlign === 'left') {
          currentX += drawW + 4;
        }
      }
    }

    for (const r of filteredRuns) {
      page.drawText(r.token.text, {
        x: currentX,
        y: currentY,
        size: r.fontSize,
        font: r.font,
        color: r.color || rgb(0, 0, 0),
      });

      if (r.token.underline) {
        page.drawLine({
          start: { x: currentX, y: currentY - 1 },
          end: { x: currentX + r.width, y: currentY - 1 },
          thickness: 0.75,
          color: r.color || rgb(0, 0, 0),
        });
      }
      currentX += r.width;
    }
  };

  if (hasLine0) {
    await renderZone(l0.left, l0.left.align || 'left', baseY);
    await renderZone(l0.center, l0.center.align || 'center', baseY);
    await renderZone(l0.right, l0.right.align || 'right', baseY);
    baseY -= lineHeight;
  }

  for (const line of story.lines) {
    await renderZone(line, line.align || 'left', baseY);
    baseY -= lineHeight;
  }
}

function extractTokens(node: any, forceBold = false): TextToken[] {
  const tokens: TextToken[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (n.type === 'text' && typeof n.text === 'string') {
      const marks = n.marks || [];
      const bold = forceBold || marks.some((m: any) => m.type === 'bold');
      const italic = marks.some((m: any) => m.type === 'italic');
      const underline = marks.some((m: any) => m.type === 'underline');
      tokens.push({ text: n.text, bold, italic, underline });
      return;
    }
    if (n.content && Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child);
      }
    }
  };
  walk(node);
  return tokens;
}

function wrapTokensToLines(
  tokens: TextToken[],
  maxWidth: number,
  fontSize: number,
  fonts: EmbeddedFonts,
  recordOmission: (msg: string) => void
): TextToken[][] {
  const cleanTokens = tokens
    .map((t) => filterGlyphs(t, fonts, recordOmission))
    .filter((t) => t.text.length > 0);

  if (cleanTokens.length === 0) return [[]];

  const lines: TextToken[][] = [];
  let currentLine: TextToken[] = [];
  let currentLineWidth = 0;

  for (const token of cleanTokens) {
    const font = selectFont(token.bold, token.italic, fonts);
    // Split token into words
    const words = token.text.split(/(\s+)/);

    for (const word of words) {
      if (!word) continue;
      const wordWidth = font.widthOfTextAtSize(word, fontSize);

      if (currentLineWidth + wordWidth <= maxWidth || currentLine.length === 0) {
        currentLine.push({ ...token, text: word });
        currentLineWidth += wordWidth;
      } else {
        lines.push(currentLine);
        // Start next line (trim leading whitespace on new line)
        const isSpace = /^\s+$/.test(word);
        if (isSpace) {
          currentLine = [];
          currentLineWidth = 0;
        } else {
          currentLine = [{ ...token, text: word }];
          currentLineWidth = wordWidth;
        }
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function renderParagraph(
  page: PDFPage,
  ensureSpace: (neededHeight: number) => PDFPage,
  tokens: TextToken[],
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  gapAfter: number,
  fonts: EmbeddedFonts,
  recordOmission: (msg: string) => void,
  firstLineOffset = 0
): number {
  const lines = wrapTokensToLines(tokens, maxWidth, fontSize, fonts, recordOmission);
  let y = startY;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const activePage = ensureSpace(lineHeight);
    if (activePage !== page) {
      page = activePage;
      y = page.getHeight() - 54;
    }

    let lineX = x + (i === 0 ? firstLineOffset : 0);
    const baselineY = y - fontSize;

    for (const token of line) {
      const font = selectFont(token.bold, token.italic, fonts);
      page.drawText(token.text, {
        x: lineX,
        y: baselineY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const w = font.widthOfTextAtSize(token.text, fontSize);
      if (token.underline) {
        page.drawLine({
          start: { x: lineX, y: baselineY - 2 },
          end: { x: lineX + w, y: baselineY - 2 },
          thickness: 0.75,
          color: rgb(0, 0, 0),
        });
      }
      lineX += w;
    }

    y -= lineHeight;
  }

  return y - gapAfter;
}

// ---------------------------------------------------------------------------
// SPREADSHEET EXPORT
// ---------------------------------------------------------------------------
async function exportSpreadsheet(
  doc: PDFDocument,
  state: EditorState,
  fonts: EmbeddedFonts,
  scope: 'current' | 'all',
  recordOmission: (msg: string) => void
) {
  const PAGE_WIDTH = 612; // US Letter portrait
  const PAGE_HEIGHT = 792;
  const MARGIN = 36;
  const AVAILABLE_WIDTH = PAGE_WIDTH - MARGIN * 2; // 540 pt

  const allSheets = state.spreadsheetData || [];
  const sheetsToExport =
    scope === 'current'
      ? [getActiveSheet(allSheets) || allSheets[0] || { name: 'Sheet1', data: [] }]
      : allSheets;

  for (const sheet of sheetsToExport) {
    const grid = (sheet.data || []) as any[][];

    // Find used range
    let minR = -1;
    let maxR = -1;
    let minC = -1;
    let maxC = -1;

    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        const val = cell?.m ?? (cell?.v != null ? String(cell.v) : '');
        if (String(val).trim().length > 0) {
          if (minR < 0 || r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (minC < 0 || c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }

    if (minR < 0) {
      // Empty sheet - draw a single page
      doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      continue;
    }

    const colCount = maxC - minC + 1;
    const colWidths: number[] = [];
    let totalColsWidth = 0;

    for (let c = minC; c <= maxC; c++) {
      const customLen = sheet.config?.columnlen?.[String(c)];
      const w = customLen ? Number(customLen) * 0.75 : 64;
      colWidths.push(w);
      totalColsWidth += w;
    }

    // Shrink wide sheet uniformly to page width
    const scale = Math.min(1, AVAILABLE_WIDTH / Math.max(1, totalColsWidth));
    const scaledColWidths = colWidths.map((w) => w * scale);
    const fontSize = Math.max(4, 9 * scale);
    const rowHeight = Math.max(8, 16 * scale);

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    for (let r = minR; r <= maxR; r++) {
      if (cursorY - rowHeight < MARGIN) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
      }

      const row = grid[r] || [];
      let cellX = MARGIN;

      for (let c = minC; c <= maxC; c++) {
        const w = scaledColWidths[c - minC];
        const cell = row[c];

        // Draw cell border
        page.drawRectangle({
          x: cellX,
          y: cursorY - rowHeight,
          width: w,
          height: rowHeight,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.5,
        });

        // Displayed text (m, otherwise v; formula strings f are NOT written)
        const rawText = cell?.m != null ? String(cell.m) : cell?.v != null ? String(cell.v) : '';

        if (rawText.length > 0) {
          const isBold = Boolean(cell?.bl === 1);
          const isItalic = Boolean(cell?.it === 1);
          const font = selectFont(isBold, isItalic, fonts);

          // Drop unsupported glyphs
          let clean = '';
          for (const ch of rawText) {
            const cp = ch.codePointAt(0)!;
            if (fonts.hasGlyph(cp)) {
              clean += ch;
            } else {
              recordOmission(`Dropped unsupported character: '${ch}' (U+${cp.toString(16).toUpperCase()})`);
            }
          }

          if (clean.length > 0) {
            // Clip / single line inside cell
            page.drawText(clean, {
              x: cellX + 2 * scale,
              y: cursorY - rowHeight + 3.5 * scale,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
              maxWidth: Math.max(1, w - 4 * scale),
            });
          }
        }

        cellX += w;
      }

      cursorY -= rowHeight;
    }
  }
}

// ---------------------------------------------------------------------------
// PRESENTATION EXPORT
// ---------------------------------------------------------------------------
async function exportPresentation(
  doc: PDFDocument,
  state: EditorState,
  fonts: EmbeddedFonts,
  scope: 'current' | 'all',
  slideIndex: number,
  recordOmission: (msg: string) => void
) {
  const PAGE_WIDTH = 792; // US Letter landscape
  const PAGE_HEIGHT = 612;

  const slides = state.presentationData?.slides || [];
  const targetSlides =
    scope === 'current'
      ? [slides[slideIndex] || slides[0] || { id: 'slide1', elements: [] }]
      : slides.length > 0
      ? slides
      : [{ id: 'slide1', elements: [] }];

  const slideSize = state.presentationData?.slideSize || '16:9';
  const frameWidth = 720;
  const frameHeight = slideSize === '4:3' ? 540 : slideSize === '16:10' ? 450 : 405;
  const frameX = (PAGE_WIDTH - frameWidth) / 2;
  const frameY = (PAGE_HEIGHT - frameHeight) / 2;

  for (const slide of targetSlides) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Slide background
    const bgColor = slide.background ? parseColor(slide.background) : rgb(1, 1, 1);
    page.drawRectangle({
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      color: bgColor,
    });

    for (const elem of slide.elements || []) {
      const elemW = (elem.width / 100) * frameWidth;
      const elemH = (elem.height / 100) * frameHeight;
      const elemX = frameX + (elem.x / 100) * frameWidth;
      // In PDF, Y=0 is bottom, so invert percentage Y
      const elemY = frameY + frameHeight - (elem.y / 100) * frameHeight - elemH;

      if (elem.type === 'rect') {
        const shape = elem.shape || 'rect';
        const fill = elem.fill ? parseColor(elem.fill) : undefined;
        const borderColor = elem.borderColor ? parseColor(elem.borderColor) : undefined;
        const borderWidth = elem.borderWidth || (borderColor ? 1 : 0);

        if (shape === 'line') {
          page.drawLine({
            start: { x: elemX, y: elemY + elemH / 2 },
            end: { x: elemX + elemW, y: elemY + elemH / 2 },
            thickness: borderWidth || 2,
            color: borderColor || fill || rgb(0, 0, 0),
          });
        } else if (shape === 'ellipse') {
          page.drawEllipse({
            x: elemX + elemW / 2,
            y: elemY + elemH / 2,
            xScale: elemW / 2,
            yScale: elemH / 2,
            color: fill,
            borderColor,
            borderWidth,
          });
        } else if (shape === 'triangle') {
          let drawnTriangle = false;
          if (typeof page.drawSvgPath === 'function') {
            try {
              const path = `M 0 0 L ${elemW / 2} ${elemH} L ${elemW} 0 Z`;
              page.drawSvgPath(path, {
                x: elemX,
                y: elemY,
                color: fill,
                borderColor,
                borderWidth,
              });
              drawnTriangle = true;
            } catch {
              drawnTriangle = false;
            }
          }
          if (!drawnTriangle) {
            page.drawRectangle({
              x: elemX,
              y: elemY,
              width: elemW,
              height: elemH,
              color: fill,
              borderColor,
              borderWidth,
            });
            recordOmission('A triangle shape was simplified to a rectangle in the PDF.');
          }
        } else if (shape === 'roundRect') {
          let drawnRoundRect = false;
          if (typeof page.drawSvgPath === 'function') {
            try {
              const r = Math.min(8, elemW / 4, elemH / 4);
              const path = `M ${r} 0 L ${elemW - r} 0 Q ${elemW} 0 ${elemW} ${r} L ${elemW} ${elemH - r} Q ${elemW} ${elemH} ${elemW - r} ${elemH} L ${r} ${elemH} Q 0 ${elemH} 0 ${elemH - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
              page.drawSvgPath(path, {
                x: elemX,
                y: elemY,
                color: fill,
                borderColor,
                borderWidth,
              });
              drawnRoundRect = true;
            } catch {
              drawnRoundRect = false;
            }
          }
          if (!drawnRoundRect) {
            page.drawRectangle({
              x: elemX,
              y: elemY,
              width: elemW,
              height: elemH,
              color: fill,
              borderColor,
              borderWidth,
            });
          }
        } else {
          page.drawRectangle({
            x: elemX,
            y: elemY,
            width: elemW,
            height: elemH,
            color: fill,
            borderColor,
            borderWidth,
          });
        }

        if (elem.text && shape !== 'line') {
          const isBold = Boolean(elem.bold);
          const isItalic = Boolean(elem.italic);
          const font = selectFont(isBold, isItalic, fonts);
          const textColor = elem.color ? parseColor(elem.color) : rgb(0, 0, 0);
          const baseSize = elem.fontSize || 18;
          const fontSize = Math.max(6, (baseSize * frameWidth) / 960);
          const lineHeight = fontSize * 1.25;

          let cleanText = '';
          for (const ch of elem.text) {
            const cp = ch.codePointAt(0)!;
            if (fonts.hasGlyph(cp)) {
              cleanText += ch;
            } else {
              recordOmission(`Dropped unsupported character: '${ch}' (U+${cp.toString(16).toUpperCase()})`);
            }
          }

          const rawLines = cleanText.split('\n');
          const totalTextHeight = rawLines.length * lineHeight;
          let textY = elemY + (elemH + totalTextHeight) / 2 - fontSize;

          for (const rawLine of rawLines) {
            const w = font.widthOfTextAtSize(rawLine, fontSize);
            let lineX = elemX + (elemW - w) / 2;
            if (elem.align === 'left') lineX = elemX + 8;
            else if (elem.align === 'right') lineX = elemX + elemW - w - 8;
            page.drawText(rawLine, {
              x: Math.max(elemX, lineX),
              y: textY,
              size: fontSize,
              font,
              color: textColor,
            });
            textY -= lineHeight;
          }
        }
        continue;
      }

      if (elem.type === 'table' && elem.rows && elem.rows.length > 0) {
        const numRows = elem.rows.length;
        const numCols = elem.rows[0]?.length || 1;
        const cellW = elemW / numCols;
        const cellH = elemH / numRows;

        for (let r = 0; r < numRows; r++) {
          for (let c = 0; c < numCols; c++) {
            const cellX = elemX + c * cellW;
            const cellY = elemY + elemH - (r + 1) * cellH;

            page.drawRectangle({
              x: cellX,
              y: cellY,
              width: cellW,
              height: cellH,
              borderColor: rgb(0, 0, 0),
              borderWidth: 0.5,
            });

            const rawText = elem.rows[r]?.[c] || '';
            if (rawText) {
              let cleanText = '';
              for (const ch of rawText) {
                const cp = ch.codePointAt(0)!;
                if (fonts.hasGlyph(cp)) {
                  cleanText += ch;
                } else {
                  recordOmission(`Dropped unsupported character: '${ch}' (U+${cp.toString(16).toUpperCase()})`);
                }
              }

              if (cleanText) {
                let fontSize = Math.max(6, (12 * frameWidth) / 960);
                const textW = fonts.regular.widthOfTextAtSize(cleanText, fontSize);
                const maxW = Math.max(1, cellW - 4);
                if (textW > maxW) {
                  fontSize = Math.max(4, fontSize * (maxW / textW));
                }
                page.drawText(cleanText, {
                  x: cellX + 2,
                  y: cellY + (cellH - fontSize) / 2,
                  size: fontSize,
                  font: fonts.regular,
                  color: rgb(0, 0, 0),
                  maxWidth: maxW,
                });
              }
            }
          }
        }
        continue;
      }

      if (elem.type === 'video') {
        recordOmission('A slide video was left out of the PDF.');
        continue;
      }

      if (elem.type === 'image' && elem.src) {
        const embedded = await embedBase64Image(doc, elem.src);
        if (embedded.error) {
          recordOmission(embedded.error);
          continue;
        }
        if (embedded.image) {
          page.drawImage(embedded.image, {
            x: elemX,
            y: elemY,
            width: elemW,
            height: elemH,
          });
        }
        continue;
      }

      if (elem.type === 'text' && elem.text) {
        const isBold = Boolean(elem.bold);
        const isItalic = Boolean(elem.italic);
        const font = selectFont(isBold, isItalic, fonts);
        const textColor = elem.color ? parseColor(elem.color) : rgb(0, 0, 0);

        // Scale font size according to slide frame ratio
        const baseSize = elem.fontSize || 18;
        const fontSize = Math.max(6, (baseSize * frameWidth) / 960);
        const lineHeight = fontSize * 1.25;

        // Clean text of unsupported glyphs
        let cleanText = '';
        for (const ch of elem.text) {
          const cp = ch.codePointAt(0)!;
          if (fonts.hasGlyph(cp)) {
            cleanText += ch;
          } else {
            recordOmission(`Dropped unsupported character: '${ch}' (U+${cp.toString(16).toUpperCase()})`);
          }
        }

        // Split text by lines and wrap
        const rawLines = cleanText.split('\n');
        let textY = elemY + elemH - fontSize;

        for (const rawLine of rawLines) {
          const words = rawLine.split(/(\s+)/);
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine + word;
            const w = font.widthOfTextAtSize(testLine, fontSize);
            if (w <= elemW || !currentLine) {
              currentLine = testLine;
            } else {
              if (textY >= elemY) {
                page.drawText(currentLine, {
                  x: elemX,
                  y: textY,
                  size: fontSize,
                  font,
                  color: textColor,
                });
                textY -= lineHeight;
              }
              currentLine = word.trimStart();
            }
          }

          if (currentLine && textY >= elemY) {
            page.drawText(currentLine, {
              x: elemX,
              y: textY,
              size: fontSize,
              font,
              color: textColor,
            });
            textY -= lineHeight;
          }
        }
      }
    }
  }
}

