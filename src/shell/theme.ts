export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'folio_theme';
export const THEME_CHANGE_EVENT = 'folio-theme-change';

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Storage can be blocked. The interface still follows the system theme.
  }
  return 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(preference: ThemePreference, systemDark = systemPrefersDark()): ResolvedTheme {
  const resolved = resolveTheme(preference, systemDark);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
  }
  return resolved;
}

export function applyStoredTheme(): ResolvedTheme {
  return applyTheme(readThemePreference());
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice still applies for this visit.
  }
  const resolved = applyTheme(preference);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
  return resolved;
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => onChange();
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
