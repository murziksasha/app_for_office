export const DEFAULT_DOCUMENT_FONT = 'Noto Serif';
export const DEFAULT_SPREADSHEET_FONT = 'Noto Sans';
export const DEFAULT_PRESENTATION_FONT = 'Noto Sans';
export const RECENT_FONT_KEY = 'folio_recent_fonts';
export const RECENT_FONT_LIMIT = 8;

export function canonicalFamilyName(value: string | undefined | null): string {
  if (!value) return '';
  const first = String(value).split(',')[0]?.trim() ?? '';
  return first.replace(/^['"]+|['"]+$/g, '').trim();
}

export function cssFamily(value: string | undefined | null, fallback: string): string {
  const name = canonicalFamilyName(value) || fallback;
  const generic = /serif/i.test(name) && !/sans/i.test(name) ? 'serif' : 'sans-serif';
  const safe = name.replace(/"/g, '');
  return `"${safe}", "${fallback.replace(/"/g, '')}", ${generic}`;
}

export function readRecentFonts(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_FONT_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === 'string').slice(0, RECENT_FONT_LIMIT);
  } catch {
    return [];
  }
}

export function rememberFont(family: string): string[] {
  const name = canonicalFamilyName(family);
  if (!name || typeof localStorage === 'undefined') return readRecentFonts();
  const next = [name, ...readRecentFonts().filter((item) => item.toLowerCase() !== name.toLowerCase())].slice(
    0,
    RECENT_FONT_LIMIT
  );
  localStorage.setItem(RECENT_FONT_KEY, JSON.stringify(next));
  return next;
}
