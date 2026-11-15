import React, { useState, useEffect, useRef } from 'react';
import { Save, Undo2, Redo2, Printer, ChevronDown, Check, FilePlus, FolderOpen, SpellCheck } from 'lucide-react';
import { t } from '../i18n/instance';
import { commandIsEnabled, getCommandById } from './commands';
import type { EditorState } from '../types';
import type { SlideEditorHandle } from '../slides/SlideEditor';
import type { WorkbookInstance } from '@fortune-sheet/react';

export interface QuickAccessProps {
  editorState: EditorState;
  onSave: () => void;
  onPrint: () => void;
  onNew?: () => void;
  onOpen?: () => void;
  documentEditor?: any;
  sheetApi?: React.RefObject<WorkbookInstance | null>;
  slideCommands?: React.RefObject<SlideEditorHandle | null>;
}

const DEFAULT_QAT_ITEMS = ['save', 'undo', 'redo', 'print'];
const QAT_STORAGE_KEY = 'folio_qat_items';

function loadQatItems(): string[] {
  try {
    const raw = localStorage.getItem(QAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_QAT_ITEMS;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  editorState,
  onSave,
  onPrint,
  onNew,
  onOpen,
  documentEditor,
  sheetApi,
  slideCommands,
}) => {
  const [items, setItems] = useState<string[]>(loadQatItems);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(QAT_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // fallback
    }
  }, [items]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const toggleItem = (key: string) => {
    setItems((prev) => {
      if (prev.includes(key)) {
        // keep at least one item
        if (prev.length <= 1) return prev;
        return prev.filter((i) => i !== key);
      }
      return [...prev, key];
    });
  };

  const resetToDefault = () => {
    setItems(DEFAULT_QAT_ITEMS);
    setMenuOpen(false);
  };

  const handleUndo = () => {
    if (editorState.kind === 'document') {
      documentEditor?.chain?.().focus?.().undo?.().run?.();
    } else if (editorState.kind === 'spreadsheet') {
      const sheet = sheetApi?.current as { handleUndo?: () => void; undo?: () => void } | null;
      sheet?.handleUndo?.();
      if (!sheet?.handleUndo) sheet?.undo?.();
    } else if (editorState.kind === 'presentation') {
      slideCommands?.current?.undo?.();
    }
  };

  const commandContext = {
    kind: editorState.kind,
    editor: documentEditor,
    save: onSave,
    onSave,
    print: onPrint,
    onPrint,
    undo: handleUndo,
    redo: () => {
      if (editorState.kind === 'document') {
        documentEditor?.chain?.().focus?.().redo?.().run?.();
      } else if (editorState.kind === 'spreadsheet') {
        const sheet = sheetApi?.current as { handleRedo?: () => void; redo?: () => void } | null;
        sheet?.handleRedo?.();
        if (!sheet?.handleRedo) sheet?.redo?.();
      }
    },
  };

  const redoCommand = getCommandById('redo');
  const redoEnabled = editorState.kind !== 'presentation' && (redoCommand ? commandIsEnabled(redoCommand, commandContext) : false);

  const runCommand = (id: 'save' | 'undo' | 'print' | 'redo') => {
    const command = getCommandById(id);
    if (!command || !commandIsEnabled(command, commandContext)) return;
    void command.run(commandContext);
  };

  const availableTools: Array<{ id: string; label: string; icon: React.ReactNode; run: () => void; disabled?: boolean; testId?: string }> = [
    {
      id: 'save',
      label: `${t('qat.save')} (Ctrl+S)`,
      icon: <Save size={14} />,
      run: () => runCommand('save'),
      testId: 'folio-qa-save',
    },
    {
      id: 'undo',
      label: `${t('qat.undo')} (Ctrl+Z)`,
      icon: <Undo2 size={14} />,
      run: () => runCommand('undo'),
      testId: 'folio-qa-undo',
    },
    {
      id: 'redo',
      label: `${t('qat.redo')} (Ctrl+Y)`,
      icon: <Redo2 size={14} />,
      run: () => runCommand('redo'),
      disabled: !redoEnabled,
      testId: 'folio-qa-redo',
    },
    {
      id: 'print',
      label: `${t('qat.print')} (Ctrl+P)`,
      icon: <Printer size={14} />,
      run: () => runCommand('print'),
      testId: 'folio-qa-print',
    },
    {
      id: 'new',
      label: t('qat.new'),
      icon: <FilePlus size={14} />,
      run: () => onNew?.(),
      testId: 'folio-qa-new',
    },
    {
      id: 'open',
      label: t('qat.open'),
      icon: <FolderOpen size={14} />,
      run: () => onOpen?.(),
      testId: 'folio-qa-open',
    },
    ...(editorState.kind === 'document'
      ? [
          {
            id: 'spellCheck',
            label: t('qat.spellCheck'),
            icon: <SpellCheck size={14} />,
            run: () => documentEditor?.commands?.toggleSpellCheck?.(),
            testId: 'folio-qa-spell',
          },
        ]
      : []),
  ];

  return (
    <div
      ref={menuRef}
      className="folio-quick-access no-print"
      role="toolbar"
      aria-label="Quick Access Toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 12,
        position: 'relative',
      }}
    >
      {availableTools
        .filter((tool) => items.includes(tool.id))
        .map((tool) => {
          const isDisabled = Boolean(tool.disabled);
          return (
            <button
              key={tool.id}
              type="button"
              className={tool.testId}
              title={tool.label}
              aria-label={tool.label}
              disabled={isDisabled}
              onClick={tool.run}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 6px',
                borderRadius: '4px',
                border: 'none',
                background: 'none',
                cursor: isDisabled ? 'default' : 'pointer',
                color: 'var(--folio-ink)',
                opacity: isDisabled ? 0.35 : 1,
              }}
            >
              {tool.icon}
            </button>
          );
        })}

      {/* Customize QAT Dropdown Chevron */}
      <button
        type="button"
        className="folio-qa-customize"
        data-testid="folio-qa-customize"
        title={t('qat.customize')}
        aria-label={t('qat.customize')}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 2px',
          borderRadius: '4px',
          border: 'none',
          background: menuOpen ? 'var(--folio-border-light, #e1e4e8)' : 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink-muted, #57606a)',
        }}
      >
        <ChevronDown size={11} />
      </button>

      {/* QAT Customization Popup Menu */}
      {menuOpen && (
        <div
          data-testid="folio-qa-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 230,
            backgroundColor: 'var(--folio-bg, #ffffff)',
            border: '1px solid var(--folio-border, #d0d7de)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            padding: '6px 0',
            zIndex: 1000,
            fontSize: 12,
            color: 'var(--folio-ink, #24292f)',
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 11,
              color: 'var(--folio-ink-muted, #57606a)',
              borderBottom: '1px solid var(--folio-border-light, #f0f2f5)',
              marginBottom: 4,
            }}
          >
            {t('qat.customize')}
          </div>

          {availableTools.map((tool) => {
            const isChecked = items.includes(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                data-testid={`qat-item-toggle-${tool.id}`}
                onClick={() => toggleItem(tool.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--folio-ink, #24292f)',
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--folio-ribbon-bg, #f6f8fa)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isChecked && <Check size={13} color="var(--folio-teal, #0f6cbd)" />}
                </div>
                <span>{tool.label.split(' (')[0]}</span>
              </button>
            );
          })}

          <div
            style={{
              borderTop: '1px solid var(--folio-border-light, #f0f2f5)',
              margin: '4px 0',
            }}
          />

          <button
            type="button"
            data-testid="qat-reset-btn"
            onClick={resetToDefault}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 14px 6px 36px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'var(--folio-ink-muted, #57606a)',
              fontSize: 11,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--folio-ribbon-bg, #f6f8fa)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {t('qat.reset')}
          </button>
        </div>
      )}
    </div>
  );
};
