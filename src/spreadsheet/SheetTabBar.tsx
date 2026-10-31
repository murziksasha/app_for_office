import React, { useState, useRef, useEffect } from 'react';
import { Plus, Palette, MoreHorizontal } from 'lucide-react';
import type { FortuneSheetData } from './adapters';
import { validateSheetName } from './sheetCommands';
import { t } from '../i18n/instance';

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

interface SheetTabBarProps {
  sheets: FortuneSheetData[];
  onSelectSheet: (id: string) => void;
  onRenameSheet: (id: string, newName: string) => void;
  onReorderSheets: (fromIndex: number, toIndex: number) => void;
  onSetSheetColor: (id: string, color?: string) => void;
  onAddSheet: () => void;
}

export const SheetTabBar: React.FC<SheetTabBarProps> = ({
  sheets,
  onSelectSheet,
  onRenameSheet,
  onReorderSheets,
  onSetSheetColor,
  onAddSheet,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorMenuSheetId, setColorMenuSheetId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitRename = (id: string, value: string) => {
    const sheet = sheets.find((s) => s.id === id);
    if (!sheet) {
      setEditingId(null);
      return;
    }
    const existingNames = sheets.map((s) => s.name);
    const result = validateSheetName(value, existingNames, sheet.name);
    if (result.valid) {
      onRenameSheet(id, value.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      className="folio-sheet-tab-bar"
      data-testid="folio-sheet-tab-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 31,
        backgroundColor: 'var(--folio-bg-subtle, #f3f4f6)',
        borderTop: '1px solid var(--folio-border, #e5e7eb)',
        padding: '0 8px',
        gap: 4,
        overflowX: 'auto',
        userSelect: 'none',
        fontSize: 12,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      <button
        type="button"
        title={t('ribbon.newSheet') || 'Add Sheet'}
        aria-label="Add Sheet"
        onClick={onAddSheet}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 4,
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          color: 'var(--folio-ink, #374151)',
        }}
      >
        <Plus size={16} />
      </button>

      {sheets.map((sheet, idx) => {
        const isActive = sheet.status === 1;
        const isEditing = editingId === sheet.id;

        return (
          <div
            key={sheet.id || `sheet-${idx}`}
            data-testid={`sheet-tab-${sheet.name}`}
            className={`folio-sheet-tab ${isActive ? 'active' : ''}`}
            draggable={!isEditing}
            onDragStart={(e) => {
              setDraggedIndex(idx);
              e.dataTransfer.setData('text/plain', String(idx));
            }}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = draggedIndex;
              if (from !== null && from !== idx) {
                onReorderSheets(from, idx);
              }
              setDraggedIndex(null);
            }}
            onClick={() => onSelectSheet(sheet.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setColorMenuSheetId(colorMenuSheetId === sheet.id ? null : sheet.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              height: 24,
              borderRadius: '4px 4px 0 0',
              backgroundColor: isActive ? '#ffffff' : 'transparent',
              color: isActive ? 'var(--folio-ink, #111827)' : 'var(--folio-ink-muted, #6b7280)',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              borderBottom: isActive ? '2px solid var(--folio-teal, #0f766e)' : '2px solid transparent',
              position: 'relative',
            }}
          >
            {sheet.color && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: sheet.color,
                  flexShrink: 0,
                }}
              />
            )}

            {isEditing ? (
              <input
                ref={inputRef}
                defaultValue={sheet.name}
                aria-label="Rename Sheet"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => commitRename(sheet.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitRename(sheet.id, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: '1px 4px',
                  width: 80,
                  border: '1px solid var(--folio-teal, #0f766e)',
                  borderRadius: 2,
                  outline: 'none',
                }}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(sheet.id);
                }}
                title={t('ribbon.renameSheet') || 'Double-click to rename'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {sheet.name}
              </span>
            )}

            {colorMenuSheetId === sheet.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: 28,
                  left: 0,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid var(--folio-border, #e5e7eb)',
                  borderRadius: 6,
                  padding: 8,
                  display: 'flex',
                  gap: 6,
                  zIndex: 20,
                }}
              >
                {PRESET_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      onSetSheetColor(sheet.id, col);
                      setColorMenuSheetId(null);
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: col,
                      border: '1px solid rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onSetSheetColor(sheet.id, undefined);
                    setColorMenuSheetId(null);
                  }}
                  style={{
                    fontSize: 10,
                    padding: '2px 4px',
                    borderRadius: 3,
                    border: '1px solid #d1d5db',
                    backgroundColor: '#f9fafb',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
