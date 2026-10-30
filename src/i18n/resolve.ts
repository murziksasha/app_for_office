export type UiLanguage = 'en' | 'uk';

export function resolveUiLanguage(input: {
  saved?: string | null;
  country?: string | null;
  displayLanguage?: string | null;
}): UiLanguage {
  const saved = (input.saved || '').trim().toLowerCase();
  if (saved === 'en' || saved === 'uk') return saved;
  if ((input.country || '').trim().toUpperCase() === 'UA') return 'uk';
  const display = (input.displayLanguage || '').trim().toLowerCase();
  if (display === 'uk' || display.startsWith('uk-')) return 'uk';
  return 'en';
}
