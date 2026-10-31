import React, { useEffect, useRef } from 'react';
import { t } from '../i18n/instance';

export interface ZoomPopoverProps {
  zoom: number;
  onSelectZoom: (zoom: number) => void;
  onClose: () => void;
  isDoc?: boolean;
}

const PRESETS = [50, 75, 100, 125, 150, 200];

export const ZoomPopover: React.FC<ZoomPopoverProps> = ({
  zoom,
  onSelectZoom,
  onClose,
  isDoc = false,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      data-testid="zoom-popover"
      className="folio-zoom-popover"
      style={{
        position: 'absolute',
        bottom: '32px',
        right: '16px',
        backgroundColor: 'var(--folio-page)',
        border: '1px solid var(--folio-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
        padding: '8px',
        minWidth: '140px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontSize: '12px',
        color: 'var(--folio-ink)',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: '11px',
          color: 'var(--folio-ink-muted)',
          padding: '2px 8px 4px',
          borderBottom: '1px solid var(--folio-border)',
        }}
      >
        {t('status.zoomPresets')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', paddingTop: '4px' }}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onSelectZoom(preset);
              onClose();
            }}
            style={{
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: zoom === preset ? 'var(--folio-teal-light)' : 'transparent',
              color: zoom === preset ? 'var(--folio-teal)' : 'var(--folio-ink)',
              fontWeight: zoom === preset ? 600 : 400,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: '11px',
            }}
          >
            {preset}%
          </button>
        ))}
      </div>

      {isDoc && (
        <>
          <div style={{ height: '1px', background: 'var(--folio-border)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={() => {
              onSelectZoom(130);
              onClose();
            }}
            style={{
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--folio-ink)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '11px',
            }}
          >
            {t('status.zoomPageWidth')}
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectZoom(70);
              onClose();
            }}
            style={{
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--folio-ink)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '11px',
            }}
          >
            {t('status.zoomWholePage')}
          </button>
        </>
      )}
    </div>
  );
};

