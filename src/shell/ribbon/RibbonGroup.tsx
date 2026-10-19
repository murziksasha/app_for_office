import React from 'react';

interface RibbonGroupProps {
  label: string;
  children: React.ReactNode;
}

/** A labeled instrument cluster: tools on top, caption underneath. */
export const RibbonGroup: React.FC<RibbonGroupProps> = ({ label, children }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 10px 2px',
          minHeight: 96,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            alignContent: 'center',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
            maxWidth: 460,
          }}
        >
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
