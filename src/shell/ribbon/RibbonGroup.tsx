import React from 'react';

interface RibbonGroupProps {
  label: string;
  /** Gallery keeps a single horizontal row, used by the styles strip. */
  layout?: 'stack' | 'gallery';
  children: React.ReactNode;
}

/** A labeled instrument cluster: tools on top, caption underneath. */
export const RibbonGroup: React.FC<RibbonGroupProps> = ({ label, layout = 'stack', children }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2px 8px 2px',
          minHeight: 92,
        }}
      >
        <div className={layout === 'gallery' ? 'folio-ribbon-tools is-gallery' : 'folio-ribbon-tools'}>
          {children}
        </div>
        <div
          className="folio-ribbon-caption"
          style={{
            marginTop: 2,
            fontSize: 11,
            lineHeight: 1.2,
            color: 'var(--folio-ink-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ width: 1, margin: '8px 0', background: 'var(--folio-border-light)' }} />
    </div>
  );
};
