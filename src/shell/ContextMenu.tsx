import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { getCommandById, CommandContext } from './commands';
import { t } from '../i18n/instance';

export type ContextMenuTarget = 'docText' | 'docTable' | 'sheet' | 'slideObject';

export function getContextMenuItems(target: ContextMenuTarget): string[] {
  switch (target) {
    case 'docText':
      return ['cut', 'copy', 'paste', 'bold', 'italic', 'underline', 'clearFormatting', 'link'];
    case 'docTable':
      return [
        'cut',
        'copy',
        'paste',
        'bold',
        'italic',
        'underline',
        'clearFormatting',
        'link',
        'tableAddRow',
        'tableAddColumn',
        'tableDelete',
      ];
    case 'sheet':
      return [
        'cut',
        'copy',
        'paste',
        'sheetInsertRow',
        'sheetInsertColumn',
        'sheetDeleteRow',
        'sheetDeleteColumn',
        'sheetClear',
      ];
    case 'slideObject':
      return ['duplicate', 'delete', 'bringForward', 'sendBackward'];
  }
}

export interface ContextMenuProps {
  x: number;
  y: number;
  commandIds: string[];
  context?: CommandContext;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  commandIds,
  context,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = x;
    let top = y;

    if (left + rect.width > winW - 8) {
      left = Math.max(8, winW - rect.width - 8);
    }
    if (top + rect.height > winH - 8) {
      top = Math.max(8, winH - rect.height - 8);
    }

    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="folio-context-menu"
      style={{
        position: 'fixed',
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        zIndex: 1000,
        backgroundColor: 'var(--folio-page, #ffffff)',
        border: '1px solid var(--folio-border, #e2e8f0)',
        borderRadius: '6px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        padding: '4px 0',
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {context?.spelling && (
        <div style={{ borderBottom: '1px solid var(--folio-border, #e2e8f0)', paddingBottom: '4px', marginBottom: '4px' }}>
          {context.spelling.suggestions.length > 0 ? (
            context.spelling.suggestions.map((sug: string) => (
              <button
                key={sug}
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  context.spelling.onSelect(sug);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '6px 14px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--folio-teal, #0f766e)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--folio-bg, #f1f5f9)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <span>{sug}</span>
              </button>
            ))
          ) : (
            <div style={{ padding: '6px 14px', fontSize: '12px', color: 'var(--folio-ink-muted, #64748b)', fontStyle: 'italic' }}>
              {t('ribbon.noSuggestions')}
            </div>
          )}
          <button
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              context.spelling.onAdd(context.spelling.word);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '6px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '12px',
              color: 'var(--folio-ink-muted, #64748b)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--folio-bg, #f1f5f9)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <span>{t('ribbon.addToDictionary')}</span>
          </button>
        </div>
      )}
      {commandIds.map((id) => {
        const cmd = getCommandById(id);
        if (!cmd) return null;
        return (
          <button
            key={id}
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              cmd.run(context);
            }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              color: 'var(--folio-ink, #1e293b)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--folio-bg, #f1f5f9)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <span>{t(cmd.labelKey)}</span>
            {cmd.shortcut && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--folio-ink-muted, #64748b)',
                  marginLeft: '16px',
                }}
              >
                {cmd.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
