import React from 'react';
import { ImportReport } from '../types';
import { AlertCircle, AlertTriangle, Check, X } from 'lucide-react';

interface ImportReportDialogProps {
  report: ImportReport;
  onClose: () => void;
}

export const ImportReportDialog: React.FC<ImportReportDialogProps> = ({ report, onClose }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Report"
      data-testid="import-report-dialog"
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
        className="animate-fade-in"
        style={{
          width: '460px',
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
            backgroundColor: report.fallbackUsed ? 'var(--folio-amber-light)' : 'var(--folio-teal-tint)',
            borderBottom: '1px solid var(--folio-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {report.fallbackUsed ? (
              <AlertTriangle size={20} color="var(--folio-amber)" />
            ) : (
              <AlertCircle size={20} color="var(--folio-teal)" />
            )}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>
                Import Report: {report.fileName}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--folio-ink-muted)' }}>
                {report.fallbackUsed ? 'Simplified fallback import used' : 'File opened successfully with notices'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--folio-ink-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px', maxHeight: '360px', overflowY: 'auto' }}>
          {report.fallbackUsed && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e',
              }}
            >
              The OpenXML parser encountered custom or non-standard structures. Folio safely loaded your document using
              the Mammoth engine. Some complex layouts or headers may be simplified.
            </div>
          )}

          {report.skippedFeatures.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--folio-ink)' }}>
                Skipped unsupported features:
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--folio-ink-muted)' }}>
                {report.skippedFeatures.map((feat, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    <strong>{feat}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--folio-ink)' }}>
                Details:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: '12px',
                      padding: '8px 10px',
                      backgroundColor: 'var(--folio-bg)',
                      borderRadius: '4px',
                      border: '1px solid var(--folio-border-light)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--folio-ink)' }}>{w.item}: </span>
                    <span style={{ color: 'var(--folio-ink-muted)' }}>{w.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--folio-bg)',
            borderTop: '1px solid var(--folio-border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: 'var(--folio-teal)',
              color: 'white',
              borderRadius: 'var(--folio-radius-md)',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

