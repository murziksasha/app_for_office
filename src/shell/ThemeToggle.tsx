import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import {
  readThemePreference,
  resolveTheme,
  setThemePreference,
  systemPrefersDark,
  watchSystemTheme,
  THEME_CHANGE_EVENT,
  type ResolvedTheme,
} from './theme';

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();

  const getResolved = (): ResolvedTheme => {
    if (typeof document !== 'undefined' && (document.documentElement.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'light')) {
      return document.documentElement.dataset.theme as ResolvedTheme;
    }
    return resolveTheme(readThemePreference(), systemPrefersDark());
  };

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(getResolved);

  useEffect(() => {
    const sync = () => {
      const pref = readThemePreference();
      const resolved = resolveTheme(pref, systemPrefersDark());
      setResolvedTheme(resolved);
    };

    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    const unwatch = watchSystemTheme(sync);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
      unwatch();
    };
  }, []);

  const isDark = resolvedTheme === 'dark';
  const tip = isDark ? t('theme.switchToLight') : t('theme.switchToDark');

  const handleToggle = () => {
    const current = getResolved();
    const next: ResolvedTheme = current === 'dark' ? 'light' : 'dark';
    setThemePreference(next);
    setResolvedTheme(next);
  };

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      title={tip}
      aria-label={tip}
      onClick={handleToggle}
      style={{
        minWidth: 36,
        height: 26,
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid var(--folio-border)',
        background: 'var(--folio-bg)',
        color: 'var(--folio-ink)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
};
