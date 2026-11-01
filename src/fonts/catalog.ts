import raw from './catalog.json';
import type { FontCatalogFile, FontFamilyRecord } from './types';

const catalog = raw as FontCatalogFile;

export const FONT_SOURCE_REVISION = catalog.revision;
export const FONT_SOURCE = catalog.source;

export function bundledFamilies(): FontFamilyRecord[] {
  return catalog.families.map((family) => ({ ...family, origin: 'bundled' as const }));
}
