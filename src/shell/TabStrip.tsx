import React from 'react';
import { X, Plus } from 'lucide-react';
import { EditorState } from '../types';

interface TabStripProps {
  tabs: EditorState[];
  activeId?: string;
  homeOpen?: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onSelectHome?: () => void;
  onCloseHome?: () => void;
  onNewTab?: () => void;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeId,
  homeOpen,
  onSelect,
  onClose,
  onSelectHome,
  onCloseHome,
  onNewTab,
}) => {
  if (tabs.length === 0) return null;
  const isHomeActive = Boolean(homeOpen && !activeId);

  return (
    <div
      className="folio-tab-strip no-print"
      data-testid="tab-strip"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 10px 0',
        background: 'var(--folio-ribbon-bg)',
        borderBottom: '1px solid var(--folio-border-light)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: '4px',
          overflowX: 'auto',
          minWidth: 0,
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              onClick={() => tab.id && onSelect(tab.id)}
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
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  tab.id && onSelect(tab.id);
                }}
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
                  cursor: 'pointer',
                  color: 'inherit',
                }}
              >
                {tab.isDirty ? '● ' : ''}
                {tab.fileName}
              </button>
              <button
                data-testid="tab-close"
                aria-label={`Close ${tab.fileName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  tab.id && onClose(tab.id);
                }}
                style={{
                  padding: 0,
                  background: 'transparent',
                  color: 'var(--folio-ink-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        {homeOpen && (
          <div
            data-testid="tab-home"
            onClick={onSelectHome}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '220px',
              padding: '6px 8px',
              borderRadius: '6px 6px 0 0',
              background: isHomeActive ? '#fff' : 'transparent',
              border: '1px solid var(--folio-border-light)',
              borderBottomColor: isHomeActive ? '#fff' : 'var(--folio-border-light)',
              color: 'var(--folio-ink)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectHome?.();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: '12px',
                fontWeight: isHomeActive ? 650 : 500,
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              Home
            </button>
            <button
              data-testid="tab-close"
              aria-label="Close Home"
              onClick={(e) => {
                e.stopPropagation();
                onCloseHome?.();
              }}
              style={{
                padding: 0,
                background: 'transparent',
                color: 'var(--folio-ink-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
      <button
        data-testid="tab-new"
        aria-label="New tab"
        onClick={onNewTab}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '26px',
          height: '26px',
          marginLeft: '6px',
          marginBottom: '2px',
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: '4px',
          color: 'var(--folio-ink-muted)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
};
