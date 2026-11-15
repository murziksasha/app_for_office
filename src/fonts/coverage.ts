export const UKRAINIAN_ALPHABET =
  'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
export const BASIC_LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const DIGITS = '0123456789';
export const COMMON_PUNCTUATION = ' .,;:!?\'"()-/';
export const REQUIRED_FONT_TEXT = `${UKRAINIAN_ALPHABET}${BASIC_LATIN}${DIGITS}${COMMON_PUNCTUATION}`;

export function missingRequiredGlyphs(has: (codePoint: number) => boolean): string[] {
  const missing: string[] = [];
  for (const ch of REQUIRED_FONT_TEXT) {
    const cp = ch.codePointAt(0)!;
    if (!has(cp)) missing.push(ch);
  }
  return missing;
}

export function coverageOf(has: (codePoint: number) => boolean): 'full' | 'partial' {
  return missingRequiredGlyphs(has).length === 0 ? 'full' : 'partial';
}
