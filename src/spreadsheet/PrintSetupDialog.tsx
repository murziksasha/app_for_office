import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SheetPrintSetup, defaultPrintSetup } from './sheetPrint';

interface PrintSetupDialogProps {
  open: boolean;
  currentSetup?: SheetPrintSetup;
  onConfirm: (setup: SheetPrintSetup) => void;
  onCancel: () => void;
}

export const PrintSetupDialog: React.FC<PrintSetupDialogProps> = ({
  open,
  currentSetup = defaultPrintSetup,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [setup, setSetup] = useState<SheetPrintSetup>(currentSetup);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={t('ribbon.printSetup') || 'Print Setup'}
      data-testid="folio-sheet-print-dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 24,
          width: 360,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--folio-ink, #1f2937)' }}>
          {t('ribbon.printSetup') || 'Print Setup'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="print-setup-fit-width"
              checked={setup.fitWidth}
              onChange={(e) => setSetup({ ...setup, fitWidth: e.target.checked })}
            />
            {t('ribbon.fitWidth') || 'Fit to Width'}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="print-setup-repeat-header"
              checked={setup.repeatHeaderRow}
              onChange={(e) => setSetup({ ...setup, repeatHeaderRow: e.target.checked })}
            />
            {t('ribbon.repeatHeaderRow') || 'Repeat Header Row'}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="print-setup-gridlines"
              checked={setup.gridlines}
              onChange={(e) => setSetup({ ...setup, gridlines: e.target.checked })}
            />
            {t('ribbon.gridlines') || 'Gridlines'}
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--folio-border, #d1d5db)',
              background: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t('dialog.cancel') || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(setup)}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--folio-teal, #0f766e)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('dialog.ok') || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

