import { get, set } from 'idb-keyval';
import { getPlatformAdapter, isDesktopPlatform } from '../platform';
import type { FontFamilyRecord, FontStyleName } from './types';

const BROWSER_KEY = 'folio_custom_fonts';

interface BrowserFontPack {
  families: FontFamilyRecord[];
  files: Record<string, Uint8Array>;
}

export interface StoredFontFile {
  fileName: string;
  bytes: Uint8Array;
}

function emptyPack(): BrowserFontPack {
  return { families: [], files: {} };
}

async function browserPack(): Promise<BrowserFontPack> {
  if (typeof indexedDB === 'undefined') return emptyPack();
  const stored = await get<BrowserFontPack>(BROWSER_KEY);
  if (!stored?.families || !stored.files) return emptyPack();
  return stored;
}

export async function listStoredFamilies(): Promise<FontFamilyRecord[]> {
  if (isDesktopPlatform()) {
    const json = await getPlatformAdapter().fontList();
    const parsed = JSON.parse(json || '{"families":[]}') as { families?: FontFamilyRecord[] };
    return (parsed.families || []).map((family) => ({ ...family, origin: 'custom' as const }));
  }
  const pack = await browserPack();
  return pack.families.map((family) => ({ ...family, origin: 'custom' as const }));
}

export async function readStoredFont(fileName: string): Promise<Uint8Array> {
  if (!/^[a-f0-9]{64}\.(ttf|otf)$/i.test(fileName)) {
    throw new Error('Unknown font file.');
  }
  if (isDesktopPlatform()) return getPlatformAdapter().fontRead(fileName);
  const pack = await browserPack();
  const bytes = pack.files[fileName];
  if (!bytes) throw new Error('The stored font is missing.');
  return bytes;
}

export async function writeStoredFamilies(
  families: FontFamilyRecord[],
  files: StoredFontFile[]
): Promise<void> {
  const custom = families
    .filter((family) => family.origin === 'custom')
    .map((family) => ({ ...family, origin: 'custom' as const }));
  if (isDesktopPlatform()) {
    await getPlatformAdapter().fontPut(JSON.stringify({ families: custom }), files);
    return;
  }
  if (typeof indexedDB === 'undefined') {
    throw new Error('Font storage is not available in this browser.');
  }
  const pack = await browserPack();
  for (const file of files) pack.files[file.fileName] = file.bytes;
  const keep = new Set(custom.flatMap((family) => family.faces.map((face) => face.file)));
  for (const name of Object.keys(pack.files)) {
    if (!keep.has(name)) delete pack.files[name];
  }
  pack.families = custom;
  await set(BROWSER_KEY, pack);
}

export async function removeStoredFamily(familyName: string): Promise<void> {
  if (isDesktopPlatform()) {
    await getPlatformAdapter().fontRemove(familyName);
    return;
  }
  const pack = await browserPack();
  const removed = pack.families.find((family) => family.family.toLowerCase() === familyName.toLowerCase());
  pack.families = pack.families.filter((family) => family.family.toLowerCase() !== familyName.toLowerCase());
  const keep = new Set(pack.families.flatMap((family) => family.faces.map((face) => face.file)));
  for (const face of removed?.faces || []) {
    if (!keep.has(face.file)) delete pack.files[face.file];
  }
  await set(BROWSER_KEY, pack);
}

export function styleFile(family: FontFamilyRecord, style: FontStyleName): string | undefined {
  return family.faces.find((face) => face.style === style)?.file;
}
