import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont } from 'pdf-lib';

// @ts-ignore
import regularUrl from './fonts/NotoSans-Regular.ttf?url';
// @ts-ignore
import boldUrl from './fonts/NotoSans-Bold.ttf?url';
// @ts-ignore
import italicUrl from './fonts/NotoSans-Italic.ttf?url';
// @ts-ignore
import boldItalicUrl from './fonts/NotoSans-BoldItalic.ttf?url';

export interface EmbeddedFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  hasGlyph: (codePoint: number) => boolean;
}

let cachedFontBytes: {
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
  boldItalic: Uint8Array;
} | null = null;

let cachedFkRegular: any = null;

async function fetchOrReadBytes(url: string, filename: string): Promise<Uint8Array> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fsModule = 'fs';
      const pathModule = 'path';
      const fs = await import(/* @vite-ignore */ fsModule);
      const path = await import(/* @vite-ignore */ pathModule);
      const cwd = process.cwd();
      const candidates = [
        path.resolve(cwd, url.startsWith('/') ? url.slice(1) : url),
        path.resolve(cwd, 'src/pdf/fonts', filename),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return new Uint8Array(fs.readFileSync(p));
        }
      }
    } catch {
      // fallback to fetch
    }
  }
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function loadFontBytes(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
  boldItalic: Uint8Array;
}> {
  if (cachedFontBytes) return cachedFontBytes;

  const [regular, bold, italic, boldItalic] = await Promise.all([
    fetchOrReadBytes(regularUrl, 'NotoSans-Regular.ttf'),
    fetchOrReadBytes(boldUrl, 'NotoSans-Bold.ttf'),
    fetchOrReadBytes(italicUrl, 'NotoSans-Italic.ttf'),
    fetchOrReadBytes(boldItalicUrl, 'NotoSans-BoldItalic.ttf'),
  ]);

  cachedFontBytes = { regular, bold, italic, boldItalic };
  return cachedFontBytes;
}

export async function embedNotoFonts(doc: PDFDocument): Promise<EmbeddedFonts> {
  doc.registerFontkit(fontkit);
  const bytes = await loadFontBytes();

  if (!cachedFkRegular) {
    cachedFkRegular = fontkit.create(bytes.regular);
  }

  const [regular, bold, italic, boldItalic] = await Promise.all([
    doc.embedFont(bytes.regular, { subset: true }),
    doc.embedFont(bytes.bold, { subset: true }),
    doc.embedFont(bytes.italic, { subset: true }),
    doc.embedFont(bytes.boldItalic, { subset: true }),
  ]);

  return {
    regular,
    bold,
    italic,
    boldItalic,
    hasGlyph: (codePoint: number) => {
      // Standard whitespace/newline
      if (codePoint === 32 || codePoint === 160 || codePoint === 9) return true;
      try {
        return Boolean(cachedFkRegular && cachedFkRegular.hasGlyphForCodePoint(codePoint));
      } catch {
        return false;
      }
    },
  };
}

