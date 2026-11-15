import { bundledFamilies } from './catalog';
import { listStoredFamilies, readStoredFont, removeStoredFamily, writeStoredFamilies } from './platformStore';
import { importFontFiles, type FontImportIssue } from './importFonts';
import { rememberFontBytes } from './bytes';
import type { FontFamilyRecord, FontStyleName } from './types';

type Listener = () => void;

const listeners = new Set<Listener>();
let custom: FontFamilyRecord[] = [];
let loaded: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeFonts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listFontFamilies(): FontFamilyRecord[] {
  const bundled = bundledFamilies();
  const names = new Set(bundled.map((family) => family.family.toLowerCase()));
  return [...bundled, ...custom.filter((family) => !names.has(family.family.toLowerCase()))];
}

export function resolveFontFamily(name: string | undefined | null): FontFamilyRecord | null {
  const wanted = (name || '').trim().toLowerCase();
  if (!wanted) return null;
  return listFontFamilies().find((family) => family.family.toLowerCase() === wanted) || null;
}

export function nearestFace(family: FontFamilyRecord, bold: boolean, italic: boolean): FontStyleName {
  const styles = new Set(family.faces.map((face) => face.style));
  if (bold && italic && styles.has('boldItalic')) return 'boldItalic';
  if (bold && italic && styles.has('bold')) return 'bold';
  if (bold && italic && styles.has('italic')) return 'italic';
  if (bold && styles.has('bold')) return 'bold';
  if (italic && styles.has('italic')) return 'italic';
  return 'regular';
}

export async function loadCustomFonts(): Promise<void> {
  if (!loaded) {
    loaded = listStoredFamilies()
      .then((families) => {
        custom = families;
        emit();
      })
      .catch(() => {
        custom = [];
      });
  }
  await loaded;
}

export async function readFamilyFaceBytes(
  family: FontFamilyRecord,
  style: FontStyleName
): Promise<Uint8Array | null> {
  const face = family.faces.find((item) => item.style === style) || family.faces.find((item) => item.style === 'regular');
  if (!face) return null;
  if (family.origin === 'custom') {
    const bytes = await readStoredFont(face.file);
    rememberFontBytes(face.file, bytes);
    return bytes;
  }
  const { readBundledFontBytes } = await import('./bytes');
  return readBundledFontBytes(face.file);
}

export async function importChosenFonts(
  files: Array<{ name: string; bytes: Uint8Array }>
): Promise<FontImportIssue[]> {
  await loadCustomFonts();
  const result = await importFontFiles(files, custom);
  if (result.files.length === 0 && result.families.length === custom.length) {
    return result.issues;
  }
  try {
    await writeStoredFamilies(result.families, result.files);
    for (const file of result.files) rememberFontBytes(file.fileName, file.bytes);
    custom = result.families;
    emit();
  } catch (err) {
    result.issues.push({
      fileName: '',
      kind: 'storage',
      message: err instanceof Error ? err.message : 'Font storage failed.',
    });
  }
  return result.issues;
}

export async function removeCustomFont(family: string): Promise<void> {
  await loadCustomFonts();
  const target = custom.find((item) => item.family.toLowerCase() === family.toLowerCase());
  if (!target) return;
  await removeStoredFamily(target.family);
  custom = custom.filter((item) => item.family.toLowerCase() !== family.toLowerCase());
  emit();
}

export function resetCustomFontsForTests(families: FontFamilyRecord[] = []): void {
  custom = families;
  loaded = Promise.resolve();
  emit();
}
