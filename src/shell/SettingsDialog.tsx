import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, X } from 'lucide-react';
import { LanguageButton } from './LanguageButton';
import {
  APP_NAME,
  APP_VERSION,
  APP_TAGLINE,
  AUTHOR_NAME,
  AUTHOR_EMAIL,
  AUTHOR_PHONE,
  getAuthorPlace,
} from './about';

interface SettingsDialogProps {
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language || '';
  const isUkrainian = currentLang.toLowerCase().startsWith('uk');
  const place = getAuthorPlace(currentLang);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      data-testid="settings-dialog"
      className="no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 32, 34, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '500px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--folio-panel)',
          borderRadius: 'var(--folio-radius-lg)',
          boxShadow: 'var(--folio-shadow-paper)',
          border: '1px solid var(--folio-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--folio-ribbon-bg)',
            borderBottom: '1px solid var(--folio-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--folio-teal)" />
            <h2 style={{ fontSize: '16px', fontWeight: 650, color: 'var(--folio-ink)', margin: 0 }}>
              {t('settings.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('settings.close')}
            data-testid="settings-close-x"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--folio-ink-muted)',
              borderRadius: 'var(--folio-radius-sm)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* One Section List */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            userSelect: 'text',
          }}
        >
          {/* Section 1: About */}
          <section data-section="about" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--folio-teal)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: 0,
                paddingBottom: '6px',
                borderBottom: '1px solid var(--folio-border-light)',
              }}
            >
              {t('settings.about')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--folio-ink)' }}>
                  {APP_NAME}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--folio-ink-muted)' }}>
                  {APP_VERSION}
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--folio-ink-muted)', fontSize: '13px', lineHeight: 1.45 }}>
                {APP_TAGLINE}
              </p>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--folio-bg)',
                borderRadius: 'var(--folio-radius-md)',
                border: '1px solid var(--folio-border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--folio-ink)',
                userSelect: 'text',
              }}
            >
              <div style={{ fontWeight: 650 }}>{AUTHOR_NAME}</div>
              <div>
                <a
                  href={`mailto:${AUTHOR_EMAIL}`}
                  style={{
                    color: 'var(--folio-teal)',
                    textDecoration: 'underline',
                    userSelect: 'text',
                  }}
                >
                  {AUTHOR_EMAIL}
                </a>
              </div>
              <div style={{ userSelect: 'text' }}>{AUTHOR_PHONE}</div>
              <div style={{ userSelect: 'text' }}>{place}</div>
            </div>
          </section>

          {/* Section 2: General */}
          <section data-section="general" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--folio-teal)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: 0,
                paddingBottom: '6px',
                borderBottom: '1px solid var(--folio-border-light)',
              }}
            >
              {t('settings.general')}
            </h3>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--folio-bg)',
                borderRadius: 'var(--folio-radius-md)',
                border: '1px solid var(--folio-border-light)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--folio-ink)' }}>
                  {t('settings.language')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--folio-ink-muted)' }}>
                  {isUkrainian ? 'Українська' : 'English'}
                </span>
              </div>
              <LanguageButton />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--folio-ribbon-bg)',
            borderTop: '1px solid var(--folio-border-light)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="settings-close-button"
            style={{
              padding: '6px 18px',
              borderRadius: 'var(--folio-radius-md)',
              backgroundColor: 'var(--folio-teal)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

