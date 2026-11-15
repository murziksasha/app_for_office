import fontkit from '@pdf-lib/fontkit';
import { coverageOf } from './coverage';
import type { FontEmbedding, FontStyleName } from './types';

export interface InspectedFont {
  family: string;
  style: FontStyleName;
  weight: number;
  italic: boolean;
  embedding: FontEmbedding;
  coverage: 'full' | 'partial';
  sha256: string;
}

export type InspectResult =
  | { ok: true; font: InspectedFont }
  | { ok: false; reason: string };

const FILE_RE = /\.(ttf|otf)$/i;

export async function sha256(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import(/* @vite-ignore */ 'crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

function embeddingOf(fsType: number): FontEmbedding {
  if (fsType & 0x0002) return 'restricted';
  if (fsType & 0x0004) return 'preview';
  if (fsType & 0x0008) return 'editable';
  return 'installable';
}

function styleOf(weight: number, italic: boolean): FontStyleName {
  if (italic && weight >= 600) return 'boldItalic';
  if (italic) return 'italic';
  if (weight >= 600) return 'bold';
  return 'regular';
}

export async function inspectFontFile(fileName: string, bytes: Uint8Array): Promise<InspectResult> {
  if (!FILE_RE.test(fileName)) {
    return { ok: false, reason: 'Only .ttf and .otf files can be added.' };
  }
  let created: any;
  try {
    created = fontkit.create(bytes as unknown as Buffer);
  } catch {
    return { ok: false, reason: 'The file is not a readable font.' };
  }
  if (!created || Array.isArray(created.fonts) || created.type === 'TTC') {
    return { ok: false, reason: 'Font collections are not supported.' };
  }
  const family = String(created.familyName || created.fullName || '').trim();
  if (!family) return { ok: false, reason: 'The font has no family name.' };
  const os2 = created['OS/2'];
  const subfamily = String(created.subfamilyName || '');
  const weight = Number(os2?.usWeightClass) || (/bold/i.test(subfamily) ? 700 : 400);
  const italic =
    Math.abs(Number(created.italicAngle) || 0) > 1 || /italic|oblique/i.test(subfamily);
  const has = (codePoint: number) => {
    try {
      return Boolean(created.hasGlyphForCodePoint?.(codePoint));
    } catch {
      return false;
    }
  };
  const glyphCount = created.characterSet?.length ?? created.numGlyphs ?? 0;
  if (!glyphCount) return { ok: false, reason: 'The font does not contain any glyphs.' };
  return {
    ok: true,
    font: {
      family,
      style: styleOf(weight, italic),
      weight: weight >= 600 ? 700 : 400,
      italic,
      embedding: embeddingOf(Number(os2?.fsType) || 0),
      coverage: coverageOf(has),
      sha256: await sha256(bytes),
    },
  };
}

export async function assertFontLoadable(
  bytes: Uint8Array,
  family: string,
  weight: number,
  italic: boolean
): Promise<void> {
  if (typeof FontFace === 'undefined') return;
  try {
    const face = new FontFace(family, bytes as BufferSource, {
      weight: String(weight),
      style: italic ? 'italic' : 'normal',
    });
    if (typeof face.load !== 'function') return;
    await face.load();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not implemented|not supported/i.test(message)) return;
    throw new Error('This font cannot be loaded for display.');
  }
}
