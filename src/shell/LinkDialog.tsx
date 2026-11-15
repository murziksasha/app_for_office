import React, { useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n/instance';

interface LinkDialogProps {
  initialUrl: string;
  onApply: (url: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}

/** In-app link editor. Replaces the browser prompt so focus stays in Folio. */
export const LinkDialog: React.FC<LinkDialogProps> = ({ initialUrl, onApply, onRemove, onCancel }) => {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div
      className="no-print"
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 20, 20, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="folio-link-dialog"
        className="animate-fade-in"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(url.trim());
        }}
        style={{
          width: 420,
          maxWidth: '92vw',
          background: 'var(--folio-panel)',
          color: 'var(--folio-ink)',
          border: '1px solid var(--folio-border)',
          borderRadius: 'var(--folio-radius-md)',
          boxShadow: 'var(--folio-shadow-md)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>
          {t('ribbon.link')}
        </h2>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--folio-ink-muted)' }}>
          {t('ribbon.linkPrompt')}
          <input
            ref={inputRef}
            data-testid="folio-link-url"
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            style={{
              height: 32,
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--folio-border)',
              background: 'var(--folio-panel)',
              color: 'var(--folio-ink)',
              fontSize: 13,
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {initialUrl ? (
            <button type="button" onClick={onRemove} style={{ padding: '6px 10px', color: 'var(--folio-ink-muted)' }}>
              {t('ribbon.removeLink')}
            </button>
          ) : null}
          <button type="button" onClick={onCancel} style={{ padding: '6px 10px' }}>
            {t('settings.close')}
          </button>
          <button
            type="submit"
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              background: 'var(--folio-accent)',
              color: '#ffffff',
              fontWeight: 600,
            }}
          >
            {t('ribbon.applyLink')}
          </button>
        </div>
      </form>
    </div>
  );
};
