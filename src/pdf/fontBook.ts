import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import { readBundledFontBytes } from '../fonts/bytes';
import { DEFAULT_DOCUMENT_FONT } from '../fonts/names';
import { nearestFace, readFamilyFaceBytes, resolveFontFamily } from '../fonts/registry';
import type { FontEmbedding, FontFamilyRecord, FontStyleName } from '../fonts/types';

interface FaceSlot {
  pdf: PDFFont;
  kit: any;
  embedding: FontEmbedding;
  style: FontStyleName;
  approximated: boolean;
}

export interface PdfFontBook {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  defaultFamily: string;
  hasGlyph: (codePoint: number) => boolean;
  measure(
    text: string,
    size: number,
    bold: boolean,
    italic: boolean,
    family: string | undefined,
    record: (message: string) => void
  ): number;
  draw(
    page: PDFPage,
    text: string,
    options: { x: number; y: number; size: number; bold: boolean; italic: boolean; family?: string; color: RGB },
    record: (message: string) => void
  ): number;
}

const reported = new Set<string>();

function report(record: (message: string) => void, message: string) {
  if (reported.has(message)) return;
  reported.add(message);
  record(message);
}

function hasCode(kit: any, codePoint: number): boolean {
  if (codePoint === 32 || codePoint === 160 || codePoint === 9 || codePoint === 10) return true;
  try {
    return Boolean(kit?.hasGlyphForCodePoint?.(codePoint));
  } catch {
    return false;
  }
}

async function embedFace(
  doc: PDFDocument,
  family: FontFamilyRecord,
  style: FontStyleName
): Promise<FaceSlot | null> {
  const face = family.faces.find((item) => item.style === style);
  if (!face || face.embedding === 'restricted') return null;
  const bytes = family.origin === 'bundled' ? await readBundledFontBytes(face.file) : await readFamilyFaceBytes(family, style);
  if (!bytes) return null;
  const kit = fontkit.create(bytes as unknown as Buffer);
  const pdf = await doc.embedFont(bytes, { subset: true });
  return { pdf, kit, embedding: face.embedding, style, approximated: false };
}

export async function createFontBook(
  doc: PDFDocument,
  families: string[],
  defaultFamily = DEFAULT_DOCUMENT_FONT
): Promise<PdfFontBook> {
  doc.registerFontkit(fontkit);
  reported.clear();
  const slots = new Map<string, FaceSlot>();
  const wanted = [...new Set([defaultFamily, 'Noto Sans', 'Noto Serif', ...families])];
  for (const name of wanted) {
    const family = resolveFontFamily(name);
    if (!family) continue;
    for (const face of family.faces) {
      if (face.embedding === 'restricted') continue;
      const slot = await embedFace(doc, family, face.style);
      if (slot) slots.set(`${family.family.toLowerCase()}::${face.style}`, slot);
    }
  }

  const fallbackFamily = resolveFontFamily('Noto Sans') || resolveFontFamily(defaultFamily);
  if (!fallbackFamily) throw new Error('Bundled fonts are not available.');

  function slotFor(familyName: string | undefined, bold: boolean, italic: boolean, record: (message: string) => void): FaceSlot {
    const requested = familyName || defaultFamily;
    const family = resolveFontFamily(requested);
    const target = family || fallbackFamily!;
    if (!family) {
      report(record, `Font “${requested}” is not available. Substituted ${target.family}.`);
    }
    const restricted = family?.faces.every((face) => face.embedding === 'restricted');
    if (family && restricted) {
      report(record, `Font “${family.family}” does not allow embedding. Substituted ${fallbackFamily!.family}.`);
    }
    const source = family && !restricted ? family : fallbackFamily!;
    const wantedStyle = nearestFace(source, bold, italic);
    const exact = (bold && italic && wantedStyle === 'boldItalic') || (bold && !italic && wantedStyle === 'bold') || (!bold && italic && wantedStyle === 'italic') || (!bold && !italic && wantedStyle === 'regular');
    if (!exact) {
      report(record, `Approximated ${bold ? 'bold ' : ''}${italic ? 'italic ' : ''}${source.family} with ${wantedStyle}.`);
    }
    const slot = slots.get(`${source.family.toLowerCase()}::${wantedStyle}`) || slots.get(`${fallbackFamily!.family.toLowerCase()}::regular`);
    if (!slot) throw new Error('No embeddable font face is available.');
    return slot;
  }

  function pieces(text: string, bold: boolean, italic: boolean, family: string | undefined, record: (message: string) => void) {
    const primary = slotFor(family, bold, italic, record);
    const fallback = slotFor('Noto Sans', bold, italic, () => undefined);
    const runs: Array<{ text: string; slot: FaceSlot }> = [];
    let current = '';
    let currentSlot: FaceSlot | null = null;
    const flush = () => {
      if (current && currentSlot) runs.push({ text: current, slot: currentSlot });
      current = '';
    };
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      let slot = hasCode(primary.kit, cp) ? primary : null;
      if (!slot && hasCode(fallback.kit, cp)) {
        slot = fallback;
        if (slot !== primary) report(record, `Substituted a missing glyph U+${cp.toString(16).toUpperCase()} in ${primary === fallback ? defaultFamily : family || defaultFamily}.`);
      }
      if (!slot) {
        report(record, `No bundled font contains U+${cp.toString(16).toUpperCase()}.`);
        continue;
      }
      if (currentSlot && currentSlot !== slot) flush();
      currentSlot = slot;
      current += ch;
    }
    flush();
    return runs;
  }

  const key = (style: string) => `${fallbackFamily.family.toLowerCase()}::${style}`;
  const regular = slots.get(key('regular'))!.pdf;
  const bold = slots.get(key('bold'))?.pdf || regular;
  const italic = slots.get(key('italic'))?.pdf || regular;
  const boldItalic = slots.get(key('boldItalic'))?.pdf || bold;

  const book: PdfFontBook = {
    regular,
    bold,
    italic,
    boldItalic,
    defaultFamily,
    hasGlyph(codePoint: number) {
      for (const slot of slots.values()) {
        if (hasCode(slot.kit, codePoint)) return true;
      }
      return false;
    },
    measure(text, size, boldFlag, italicFlag, family, record) {
      return pieces(text, boldFlag, italicFlag, family, record).reduce(
        (sum, run) => sum + run.slot.pdf.widthOfTextAtSize(run.text, size),
        0
      );
    },
    draw(page, text, options, record) {
      let x = options.x;
      for (const run of pieces(text, options.bold, options.italic, options.family, record)) {
        page.drawText(run.text, {
          x,
          y: options.y,
          size: options.size,
          font: run.slot.pdf,
          color: options.color,
        });
        x += run.slot.pdf.widthOfTextAtSize(run.text, options.size);
      }
      return x - options.x;
    },
  };
  return book;
}
