import React, { useState, useEffect } from 'react';
import { X, Search, Command } from 'lucide-react';
import { t } from '../i18n/instance';
import type { DocumentKind } from '../types';

export interface ShortcutPanelProps {
  open: boolean;
  onClose: () => void;
  activeKind?: DocumentKind;
}

interface ShortcutItem {
  keys: string[];
  descriptionKey: string;
  category: 'general' | 'formatting' | 'navigation';
  kinds?: DocumentKind[];
}

const SHORTCUT_LIST: ShortcutItem[] = [
  // General & File
  { keys: ['Ctrl', 'N'], descriptionKey: 'ribbon.new', category: 'general' },
  { keys: ['Ctrl', 'O'], descriptionKey: 'ribbon.open', category: 'general' },
  { keys: ['Ctrl', 'S'], descriptionKey: 'ribbon.save', category: 'general' },
  { keys: ['F12'], descriptionKey: 'ribbon.saveAs', category: 'general' },
  { keys: ['Ctrl', 'P'], descriptionKey: 'ribbon.print', category: 'general' },
  { keys: ['Ctrl', 'W'], descriptionKey: 'tab.close', category: 'general' },
  { keys: ['Alt'], descriptionKey: 'keyTips.hint', category: 'general' },
  { keys: ['?'], descriptionKey: 'shortcuts.title', category: 'general' },

  // Edit & Navigation
  { keys: ['Ctrl', 'Z'], descriptionKey: 'ribbon.undo', category: 'navigation' },
  { keys: ['Ctrl', 'Y'], descriptionKey: 'ribbon.redo', category: 'navigation' },
  { keys: ['Ctrl', 'F'], descriptionKey: 'find.action', category: 'navigation' },
  { keys: ['Ctrl', 'H'], descriptionKey: 'find.replace', category: 'navigation', kinds: ['document'] },
  { keys: ['F5'], descriptionKey: 'slides.startShow', category: 'navigation', kinds: ['presentation'] },
  { keys: ['Shift', 'F5'], descriptionKey: 'slides.startCurrent', category: 'navigation', kinds: ['presentation'] },
  { keys: ['L'], descriptionKey: 'slides.laserPointer', category: 'navigation', kinds: ['presentation'] },
  { keys: ['Esc'], descriptionKey: 'status.cancel', category: 'navigation' },

  // Formatting
  { keys: ['Ctrl', 'B'], descriptionKey: 'ribbon.bold', category: 'formatting', kinds: ['document', 'spreadsheet', 'presentation'] },
  { keys: ['Ctrl', 'I'], descriptionKey: 'ribbon.italic', category: 'formatting', kinds: ['document', 'spreadsheet', 'presentation'] },
  { keys: ['Ctrl', 'U'], descriptionKey: 'ribbon.underline', category: 'formatting', kinds: ['document', 'spreadsheet'] },
  { keys: ['Ctrl', 'K'], descriptionKey: 'ribbon.link', category: 'formatting', kinds: ['document'] },
];

export const ShortcutPanel: React.FC<ShortcutPanelProps> = ({ open, onClose, activeKind }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = SHORTCUT_LIST.filter((item) => {
    if (item.kinds && activeKind && !item.kinds.includes(activeKind)) {
      return false;
    }
    if (!query) return true;
    const desc = t(item.descriptionKey).toLowerCase();
    const keyStr = item.keys.join('+').toLowerCase();
    const q = query.toLowerCase();
    return desc.includes(q) || keyStr.includes(q);
  });

  const categories: Array<'general' | 'formatting' | 'navigation'> = ['general', 'navigation', 'formatting'];

  return (
    <div
      data-testid="shortcut-panel"
      className="folio-shortcut-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'folioFadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="folio-shortcut-dialog"
        style={{
          width: '640px',
          maxHeight: '80vh',
          backgroundColor: 'var(--folio-page)',
          border: '1px solid var(--folio-border)',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--folio-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--folio-ribbon-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Command size={16} color="var(--folio-teal)" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--folio-ink)' }}>
              {t('shortcuts.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--folio-ink-muted)',
            }}
            title={t('shortcuts.close')}
            aria-label={t('shortcuts.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--folio-border)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--folio-bg)',
              border: '1px solid var(--folio-border)',
              borderRadius: '6px',
              padding: '6px 10px',
            }}
          >
            <Search size={14} color="var(--folio-ink-muted)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('shortcuts.search')}
              autoFocus
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                color: 'var(--folio-ink)',
              }}
            />
          </div>
        </div>

        {/* Shortcut Groups */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {categories.map((cat) => {
            const items = filtered.filter((i) => i.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <h3
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--folio-teal)',
                    margin: '0 0 8px 0',
                    fontWeight: 700,
                  }}
                >
                  {t(`shortcuts.${cat}`)}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: 'var(--folio-bg)',
                        border: '1px solid var(--folio-border)',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: 'var(--folio-ink)' }}>
                        {t(item.descriptionKey)}
                      </span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: 'var(--folio-page)',
                              border: '1px solid var(--folio-border)',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontWeight: 600,
                              fontFamily: 'inherit',
                              color: 'var(--folio-ink)',
                              boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                            }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

