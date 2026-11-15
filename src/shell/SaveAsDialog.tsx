import React, { useState } from 'react';
import { DocumentKind, SupportedFormat } from '../types';
import { X, Save } from 'lucide-react';
import { saveFiltersForKind } from '../files/session';
import { t } from '../i18n/instance';

interface SaveAsDialogProps {
  currentKind: DocumentKind;
  currentFormat: SupportedFormat;
  currentFileName: string;
  onSave: (targetFormat: SupportedFormat, newName: string) => void;
  onClose: () => void;
}

export const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
  currentKind,
  currentFormat,
  currentFileName,
  onSave,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<SupportedFormat>(currentFormat);
  const baseName = currentFileName.replace(/\.[^/.]+$/, '');
  const [nameInput, setNameInput] = useState(baseName);

  const availableFormats = saveFiltersForKind(currentKind, currentFormat);

  const handleConfirm = () => {
    const chosenOption = availableFormats.find((f) => f.format === selectedFormat);
    const ext = chosenOption ? `.${chosenOption.extensions[0]}` : `.${selectedFormat}`;
    const cleanName = nameInput.trim() || t('saveAs.untitled');
    const finalName = cleanName.endsWith(ext) ? cleanName : `${cleanName}${ext}`;
    onSave(selectedFormat, finalName);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 32, 34, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('saveAs.title')}
        className="animate-fade-in"
        style={{
          width: '420px',
          maxWidth: '90vw',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--folio-radius-lg)',
          boxShadow: 'var(--folio-shadow-md)',
          border: '1px solid var(--folio-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>{t('saveAs.title')}</h3>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--folio-ink-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--folio-ink)' }}>
              {t('saveAs.fileName')}
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--folio-border)',
                borderRadius: 'var(--folio-radius-md)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--folio-ink)' }}>
              {t('saveAs.format')}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {availableFormats.map((opt) => (
                <label
                  key={opt.format}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--folio-radius-md)',
                    border: selectedFormat === opt.format ? '1px solid var(--folio-teal)' : '1px solid var(--folio-border-light)',
                    backgroundColor: selectedFormat === opt.format ? 'var(--folio-teal-tint)' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={selectedFormat === opt.format}
                    onChange={() => setSelectedFormat(opt.format)}
                  />
                  <span>{opt.label} (.{opt.extensions[0]})</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--folio-bg)',
            borderTop: '1px solid var(--folio-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--folio-bg-alt)',
              borderRadius: 'var(--folio-radius-md)',
              fontSize: '13px',
            }}
          >
            {t('saveAs.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              backgroundColor: 'var(--folio-teal)',
              color: 'white',
              borderRadius: 'var(--folio-radius-md)',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            <Save size={14} /> {t('saveAs.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

