import { isDesktopPlatform, userRegion } from '../platform';
import { i18n } from './instance';
import { resolveUiLanguage, type UiLanguage } from './resolve';

export const UI_LANG_KEY = 'folio_ui_lang';

export async function initI18n(): Promise<UiLanguage> {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(UI_LANG_KEY);
  } catch {
    saved = null;
  }
  let country: string | null = null;
  if (isDesktopPlatform()) {
    try {
      country = await userRegion();
    } catch {
      country = null;
    }
  }
  const language = resolveUiLanguage({
    saved,
    country,
    displayLanguage: typeof navigator !== 'undefined' ? navigator.language : 'en',
  });
  await i18n.changeLanguage(language);
  return language;
}

export { i18n, t } from './instance';
export { resolveUiLanguage } from './resolve';
