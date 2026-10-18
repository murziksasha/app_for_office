import React from 'react';
import { X } from 'lucide-react';
import { EditorState } from '../types';

interface TabStripProps {
  tabs: EditorState[];
  activeId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export const TabStrip: React.FC<TabStripProps> = ({ tabs, activeId, onSelect, onClose }) => {
  if (tabs.length === 0) return null;
  return (
    <div
      className="folio-tab-strip no-print"
      data-testid="tab-strip"
      style={{
        display: 'flex',
        gap: '4px',
        overflowX: 'auto',
        padding: '6px 10px 0',
        background: 'var(--folio-ribbon-bg)',
        borderBottom: '1px solid var(--folio-border-light)',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '220px',
              padding: '6px 8px',
              borderRadius: '6px 6px 0 0',
              background: active ? '#fff' : 'transparent',
              border: '1px solid var(--folio-border-light)',
              borderBottomColor: active ? '#fff' : 'var(--folio-border-light)',
              color: 'var(--folio-ink)',
            }}
          >
            <button
              onClick={() => tab.id && onSelect(tab.id)}
              title={tab.filePath || tab.fileName}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: '12px',
                fontWeight: active ? 650 : 500,
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.isDirty ? '● ' : ''}
              {tab.fileName}
            </button>
            <button
              data-testid="tab-close"
              aria-label={`Close ${tab.fileName}`}
              onClick={() => tab.id && onClose(tab.id)}
              style={{ padding: 0, background: 'transparent', color: 'var(--folio-ink-muted)' }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
