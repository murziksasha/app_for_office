import React from 'react';
import { Save, Undo2, Redo2, Printer } from 'lucide-react';
import { t } from '../i18n/instance';
import { commandIsEnabled, getCommandById } from './commands';
import type { EditorState } from '../types';
import type { SlideEditorHandle } from '../slides/SlideEditor';
import type { WorkbookInstance } from '@fortune-sheet/react';

export interface QuickAccessProps {
  editorState: EditorState;
  onSave: () => void;
  onPrint: () => void;
  documentEditor?: any;
  sheetApi?: React.RefObject<WorkbookInstance | null>;
  slideCommands?: React.RefObject<SlideEditorHandle | null>;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  editorState,
  onSave,
  onPrint,
  documentEditor,
  sheetApi,
  slideCommands,
}) => {
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

  return (
    <div
      className="folio-quick-access no-print"
      role="toolbar"
      aria-label="Quick Access Toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 12,
      }}
    >
      <button
        type="button"
        className="folio-qa-save"
        title={`${t('ribbon.save')} (Ctrl+S)`}
        aria-label={t('ribbon.save')}
        onClick={() => runCommand('save')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Save size={14} />
      </button>

      <button
        type="button"
        className="folio-qa-undo"
        title={`${t('ribbon.undoShort')} (Ctrl+Z)`}
        aria-label={t('ribbon.undoShort')}
        onClick={() => runCommand('undo')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Undo2 size={14} />
      </button>

      <button
        type="button"
        className="folio-qa-redo"
        title={`${t('ribbon.redoShort')} (Ctrl+Y)`}
        aria-label={t('ribbon.redoShort')}
        disabled={!redoEnabled}
        onClick={() => runCommand('redo')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: redoEnabled ? 'pointer' : 'default',
          color: 'var(--folio-ink)',
          opacity: redoEnabled ? 1 : 0.35,
        }}
      >
        <Redo2 size={14} />
      </button>

      <button
        type="button"
        className="folio-qa-print"
        title={`${t('ribbon.print')} (Ctrl+P)`}
        aria-label={t('ribbon.print')}
        onClick={() => runCommand('print')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Printer size={14} />
      </button>
    </div>
  );
};

