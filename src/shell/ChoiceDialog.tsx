import React from 'react';
import { t } from '../i18n/instance';

const BUTTON_KEYS: Record<string, string> = {
  Save: 'buttons.save',
  "Don't save": 'buttons.dontSave',
  Cancel: 'buttons.cancel',
  OK: 'buttons.ok',
  Overwrite: 'buttons.overwrite',
  'Save As': 'buttons.saveAs',
  Reload: 'buttons.reload',
  Keep: 'buttons.keep',
  Restore: 'buttons.restore',
  'Open from disk': 'buttons.openFromDisk',
  Replace: 'buttons.replace',
  'Active sheet': 'buttons.activeSheet',
  'All sheets': 'buttons.allSheets',
  'All slides': 'buttons.allSlides',
  'This slide': 'buttons.thisSlide',
  'All pages': 'buttons.allPages',
  'This page': 'buttons.thisPage',
};

interface ChoiceDialogProps {
  title: string;
  message: string;
  buttons: string[];
  onChoose: (choice: string | null) => void;
}

export const ChoiceDialog: React.FC<ChoiceDialogProps> = ({ title, message, buttons, onChoose }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="choice-dialog"
      className="no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(31, 35, 40, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
      }}
    >
      <div
        style={{
          width: 'min(440px, calc(100vw - 32px))',
          background: '#fff',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
        }}
      >
        <h2 style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--folio-ink)' }}>{title}</h2>
        <p style={{ fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--folio-ink)', marginBottom: '16px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          {buttons.map((label, index) => (
            <button
              key={label}
              data-testid={`choice-${label}`}
              onClick={() => onChoose(label)}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                background: index === 0 ? 'var(--folio-teal)' : 'var(--folio-bg)',
                color: index === 0 ? 'white' : 'var(--folio-ink)',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              {BUTTON_KEYS[label] ? t(BUTTON_KEYS[label]) : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
