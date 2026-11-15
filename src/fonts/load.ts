import { cachedFontBytes, readBundledFontBytes, rememberFontBytes } from './bytes';
import { bundledFamilies } from './catalog';
import { readFamilyFaceBytes, resolveFontFamily, subscribeFonts } from './registry';
import type { FontFamilyRecord, FontStyleName } from './types';

export interface FontPackState {
  status: 'idle' | 'running' | 'ready' | 'error';
  done: number;
  total: number;
  message?: string;
}

const packListeners = new Set<() => void>();
let packState: FontPackState = { status: 'idle', done: 0, total: 0 };
let packTask: Promise<void> | null = null;

function setPack(next: FontPackState) {
  packState = next;
  packListeners.forEach((listener) => listener());
}

export function getFontPackState(): FontPackState {
  return packState;
}

export function subscribeFontPack(listener: () => void): () => void {
  packListeners.add(listener);
  return () => packListeners.delete(listener);
}

function weightOf(style: FontStyleName): string {
  return style === 'bold' || style === 'boldItalic' ? '700' : '400';
}

async function registerFace(family: FontFamilyRecord, style: FontStyleName): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
  const face = family.faces.find((item) => item.style === style);
  if (!face) return;
  const already = [...document.fonts].some(
    (loaded) => loaded.family === family.family && loaded.weight === weightOf(style) && loaded.style === (face.italic ? 'italic' : 'normal')
  );
  if (already) return;
  const bytes = family.origin === 'bundled' ? await readBundledFontBytes(face.file) : await readFamilyFaceBytes(family, style);
  if (!bytes) return;
  const fontFace = new FontFace(family.family, bytes as BufferSource, {
    weight: weightOf(style),
    style: face.italic ? 'italic' : 'normal',
  });
  await fontFace.load();
  document.fonts.add(fontFace);
}

export async function ensureFamilies(names: string[]): Promise<void> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (name) => {
      const family = resolveFontFamily(name);
      if (!family) return;
      await Promise.all(family.faces.map((face) => registerFace(family, face.style).catch(() => undefined)));
    })
  );
}

export function startFontPackCache(): void {
  if (packTask) return;
  const files = bundledFamilies().flatMap((family) => family.faces.map((face) => face.file));
  const total = files.length;
  if (total === 0) {
    setPack({ status: 'ready', done: 0, total: 0 });
    return;
  }
  setPack({ status: 'running', done: files.filter((file) => cachedFontBytes(file)).length, total });
  packTask = (async () => {
    let done = 0;
    let failed = 0;
    for (const file of files) {
      try {
        if (!cachedFontBytes(file)) await readBundledFontBytes(file);
        done += 1;
        setPack({ status: 'running', done, total });
      } catch (err) {
        failed += 1;
        setPack({
          status: 'error',
          done,
          total,
          message: err instanceof Error ? err.message : 'Font caching failed.',
        });
      }
    }
    if (failed === 0) setPack({ status: 'ready', done: total, total });
    packTask = null;
  })();
}

export function retryFontPackCache(): void {
  packTask = null;
  startFontPackCache();
}

export function bundledFileCount(): number {
  return bundledFamilies().reduce((sum, family) => sum + family.faces.length, 0);
}

void subscribeFonts(() => {
  /* custom fonts register on demand */
});
