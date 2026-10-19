import React from 'react';
import { useTranslation } from 'react-i18next';

const LANG_KEY = 'folio_ui_lang';

export const LanguageButton: React.FC = () => {
  const { i18n, t } = useTranslation();
  const ukrainian = (i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('uk');
  const tip = ukrainian ? t('lang.switchToEnglish') : t('lang.switchToUkrainian');
  return (
    <button
      type="button"
      title={tip}
      aria-label={tip}
      onClick={() => {
        const next = ukrainian ? 'en' : 'uk';
        localStorage.setItem(LANG_KEY, next);
        void i18n.changeLanguage(next);
      }}
      style={{
        minWidth: 36,
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid var(--folio-border)',
        background: 'var(--folio-bg)',
        color: 'var(--folio-ink)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {ukrainian ? 'UA' : 'EN'}
    </button>
  );
};
