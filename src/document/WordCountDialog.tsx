import React, { useEffect } from 'react';
import { X, BarChart2 } from 'lucide-react';
import { t } from '../i18n/instance';
import type { DocumentWordCountStats } from './wordCount';

export interface WordCountDialogProps {
  stats: DocumentWordCountStats;
  onClose: () => void;
}

export const WordCountDialog: React.FC<WordCountDialogProps> = ({ stats, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { document: docStats, selection: selStats, hasSelection } = stats;

  const rows = [
    {
      label: t('wordCountDialog.pages'),
      docVal: docStats.pages,
      selVal: selStats ? selStats.pages : null,
    },
    {
      label: t('wordCountDialog.words'),
      docVal: docStats.words,
      selVal: selStats ? selStats.words : null,
    },
    {
      label: t('wordCountDialog.charactersNoSpaces'),
      docVal: docStats.charactersNoSpaces,
      selVal: selStats ? selStats.charactersNoSpaces : null,
    },
    {
      label: t('wordCountDialog.charactersWithSpaces'),
      docVal: docStats.charactersWithSpaces,
      selVal: selStats ? selStats.charactersWithSpaces : null,
    },
    {
      label: t('wordCountDialog.paragraphs'),
      docVal: docStats.paragraphs,
      selVal: selStats ? selStats.paragraphs : null,
    },
    {
      label: t('wordCountDialog.lines'),
      docVal: docStats.lines,
      selVal: selStats ? selStats.lines : null,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('wordCountDialog.title')}
      data-testid="word-count-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 380,
          backgroundColor: 'var(--folio-bg, #ffffff)',
          color: 'var(--folio-ink, #24292f)',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--folio-border, #d0d7de)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontSize: 13,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--folio-border, #e1e4e8)',
            backgroundColor: 'var(--folio-ribbon-bg, #f6f8fa)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <BarChart2 size={16} color="var(--folio-teal, #0f6cbd)" />
            <span>{t('wordCountDialog.title')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('wordCountDialog.close')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--folio-ink-muted, #57606a)',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 20px' }}>
          {hasSelection && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 90px',
                paddingBottom: 8,
                borderBottom: '1px solid var(--folio-border, #e1e4e8)',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 11,
                color: 'var(--folio-ink-muted, #57606a)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <span>{t('wordCountDialog.statistic') || 'Statistic'}</span>
              <span style={{ textAlign: 'right' }}>{t('wordCountDialog.selection')}</span>
              <span style={{ textAlign: 'right' }}>{t('wordCountDialog.document')}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: hasSelection ? '1fr 90px 90px' : '1fr auto',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--folio-ink, #24292f)' }}>{row.label}</span>
                {hasSelection && (
                  <span
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: 'var(--folio-teal, #0f6cbd)',
                    }}
                  >
                    {row.selVal?.toLocaleString() ?? 0}
                  </span>
                )}
                <span
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: hasSelection ? 400 : 600,
                    color: 'var(--folio-ink, #24292f)',
                  }}
                >
                  {row.docVal.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--folio-border, #e1e4e8)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--folio-ribbon-bg, #f6f8fa)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="word-count-close-btn"
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              backgroundColor: 'var(--folio-teal, #0f6cbd)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 12,
            }}
          >
            {t('wordCountDialog.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
